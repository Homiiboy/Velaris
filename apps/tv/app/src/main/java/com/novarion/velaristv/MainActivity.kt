package com.novarion.velaristv

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.InputType
import android.view.inputmethod.EditorInfo
import android.view.inputmethod.InputMethodManager
import android.view.WindowManager
import android.view.Gravity
import android.view.View
import android.view.KeyEvent
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.*
import androidx.media3.common.util.UnstableApi
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

@UnstableApi
class MainActivity : Activity() {
    private val prefs by lazy { getSharedPreferences("velaris_tv", MODE_PRIVATE) }
    private val io = Executors.newFixedThreadPool(6)
    private val imageCacheMaxKb = ((Runtime.getRuntime().maxMemory() / 1024L) / 8L).coerceIn(12L * 1024L, 48L * 1024L).toInt()
    private val imageCache = object: android.util.LruCache<String,android.graphics.Bitmap>(imageCacheMaxKb) {
        override fun sizeOf(key:String, value:android.graphics.Bitmap):Int = (value.byteCount / 1024).coerceAtLeast(1)
    }
    private val imageLoads = java.util.Collections.synchronizedSet(mutableSetOf<String>())
    private var server = ""
    private var token = ""
    private var userId = ""
    private var homeRoot: LinearLayout? = null
    @Volatile private var destroyed = false
    private val backStack = java.util.ArrayDeque<()->Unit>()
    private var suppressHistory = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        VelarisDesign.load(this)
        // Keep the on-screen keyboard hidden until the user chooses a text field.
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN or
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        immersive()
        server = prefs.getString("server_url", "").orEmpty()
        token = prefs.getString("access_token", "").orEmpty()
        userId = prefs.getString("user_id", "").orEmpty()
        when {
            server.isBlank() -> showServer()
            token.isBlank() || userId.isBlank() -> showLogin()
            else -> showProfiles(true)
        }
    }

    override fun onDestroy() { destroyed = true; io.shutdownNow(); super.onDestroy() }

    override fun onTrimMemory(level:Int) {
        super.onTrimMemory(level)
        if(level >= TRIM_MEMORY_BACKGROUND) imageCache.evictAll()
        else if(level >= TRIM_MEMORY_RUNNING_LOW) imageCache.trimToSize(imageCacheMaxKb / 2)
    }

    override fun onBackPressed() {
        if(backStack.isNotEmpty()) {
            val action=backStack.removeLast()
            suppressHistory=true
            action()
            suppressHistory=false
        } else showSettingsDialog()
    }

    private fun rememberBack(action:()->Unit) {
        if(!suppressHistory) backStack.addLast(action)
    }

    // TV keyboards vary: handle the IME Next/Done button AND D-pad down.
    // Moving focus after hiding the IME allows continued remote navigation.
    private fun hideTvKeyboardAndFocus(field:EditText,next:View) {
        val ime=getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        ime.hideSoftInputFromWindow(field.windowToken,0)
        field.clearFocus()
        next.post {
            if(!isFinishing && !isDestroyed) {
                next.requestFocus()
                ime.hideSoftInputFromWindow(next.windowToken,0)
            }
        }
    }

    private fun configureTvInput(field:EditText,next:View,done:Boolean=false) {
        field.imeOptions=if(done) EditorInfo.IME_ACTION_DONE else EditorInfo.IME_ACTION_NEXT
        field.setOnEditorActionListener { _,action,event->
            val imeAction=action==EditorInfo.IME_ACTION_NEXT || action==EditorInfo.IME_ACTION_DONE
            val enter=event?.keyCode==KeyEvent.KEYCODE_ENTER && event.action==KeyEvent.ACTION_DOWN
            if(imeAction || enter) {
                hideTvKeyboardAndFocus(field,next)
                true
            } else false
        }
        field.setOnKeyListener { _,code,event->
            if(code==KeyEvent.KEYCODE_DPAD_DOWN && event.action==KeyEvent.ACTION_DOWN) {
                hideTvKeyboardAndFocus(field,next)
                true
            } else false
        }
    }

    private fun showServer() {
        val input = EditText(this).apply {
            hint = VelarisDesign.defaultServerUrl()
            setText(server.ifBlank { VelarisDesign.defaultServerUrl() });setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY); textSize = 18f; setSingleLine()
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
        }
        val root = setupPage("Velaris verbinden", "Adresse deines Jellyfin-Servers", input)
        val connectButton=button("Verbinden") {
            val value = normalize(input.text.toString())
            if (value == null) toast("Ungültige Server-Adresse") else {
                server = value; prefs.edit().putString("server_url", server).apply(); showLogin()
            }
        }
        root.addView(connectButton, params(260, 64, 18))
        configureTvInput(input,connectButton,done=true)
        setContentView(root)
    }

    private fun showLogin() {
        val user = EditText(this).apply { hint="Benutzername"; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY); setSingleLine() }
        val pass = EditText(this).apply {
            hint="Passwort"; setTextColor(Color.WHITE); setHintTextColor(Color.GRAY); setSingleLine()
            inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        val root = setupPage("Willkommen bei Velaris", "Mit deinem Jellyfin-Konto anmelden", user)
        root.addView(pass, params(600, 62, 12))
        val signInButton=button("Anmelden") { login(user.text.toString(), pass.text.toString()) }
        root.addView(signInButton, params(260,64,18))
        root.addView(button("Server ändern") { clearConnection(); showServer() }, params(260,58,10))
        configureTvInput(user,pass)
        configureTvInput(pass,signInButton,done=true)
        setContentView(root)
        root.post{user.requestFocus()}
    }

    private fun login(username: String, password: String) {
        if (username.isBlank()) return toast("Benutzername eingeben")
        io.execute {
            try {
                val body = JSONObject().put("Username", username).put("Pw", password).toString()
                val json = request("/Users/AuthenticateByName", "POST", body, false)
                token = json.getString("AccessToken")
                userId = json.getJSONObject("User").getString("Id")
                val accountName = json.getJSONObject("User").optString("Name", username)
                prefs.edit().putString("access_token", token).putString("user_id", userId)
                    .putString("active_profile_name", accountName).apply()
                runOnUiThread {
                    if (saveJellyfinProfile(server, userId, token, accountName, 0)) {
                        showProfiles(true)
                    } else {
                        toast("Maximal ${VelarisDesign.maxProfiles()} Jellyfin-Profile. Entferne zuerst ein bestehendes Profil.")
                        showProfiles(true)
                    }
                }
            } catch (e: Exception) { runOnUiThread { toast("Anmeldung fehlgeschlagen: ${e.message ?: "Server nicht erreichbar"}") } }
        }
    }

    private fun showHome() {
        if(!suppressHistory) backStack.clear()

        val content = LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            setPadding(0,0,0,dp(30))
            clipToPadding=false
        }
        homeRoot=content

        val scroll=ScrollView(this).apply {
            isVerticalScrollBarEnabled=false
            clipChildren=false;clipToPadding=false
            descendantFocusability=android.view.ViewGroup.FOCUS_AFTER_DESCENDANTS
            addView(content)
        }
        val screen=FrameLayout(this).apply { setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        screen.addView(scroll,FrameLayout.LayoutParams(-1,-1))

        val top=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL; gravity=Gravity.CENTER_VERTICAL
            setPadding(dp(48),dp(16),dp(48),dp(8))
            clipChildren=false;clipToPadding=false
            background=GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0xE608080D.toInt(),0x9908080D.toInt(),0x0008080D)
            )
        }
        top.addView(TextView(this).apply {
            text="VELARIS"; textSize=26f; typeface=Typeface.DEFAULT_BOLD
            letterSpacing=0.12f; setTextColor(Color.WHITE); gravity=Gravity.CENTER_VERTICAL
        },LinearLayout.LayoutParams(dp(152),dp(50)).apply{marginEnd=dp(18)})
        // Keep all destinations reachable with the D-pad, even on smaller/overscanned TVs.
        val nav=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
            clipChildren=false;clipToPadding=false
        }
        listOf(
            VelarisDesign.navigation("home","Start") to navButton(VelarisDesign.navigation("home","Start")){showHome()},
            VelarisDesign.navigation("animation","Animation") to navButton(VelarisDesign.navigation("animation","Animation")){showMediaFolderLibrary("Animation","Movie,Series")},
            VelarisDesign.navigation("anime","Anime") to navButton(VelarisDesign.navigation("anime","Anime")){showMediaFolderLibrary("Anime","Series")},
            VelarisDesign.navigation("animeMovies","Anime Filme") to navButton(VelarisDesign.navigation("animeMovies","Anime Filme")){showMediaFolderLibrary("Anime Filme","Movie")},
            VelarisDesign.navigation("cartoons","Cartoons") to navButton(VelarisDesign.navigation("cartoons","Cartoons")){showMediaFolderLibrary("Cartoons","Movie,Series")},
            VelarisDesign.navigation("movies","Filme") to navButton(VelarisDesign.navigation("movies","Filme")){showLibrary("Filme","Movie")},
            VelarisDesign.navigation("collections","Sammlungen") to navButton(VelarisDesign.navigation("collections","Sammlungen")){showLibrary("Sammlungen","BoxSet")},
            VelarisDesign.navigation("series","Serien") to navButton(VelarisDesign.navigation("series","Serien")){showLibrary("Serien","Series")}
        ).forEach { (label,button) ->
            val width=when(label) { "Start"->dp(78); "Anime Filme"->dp(116); "Sammlungen"->dp(130); "Animation"->dp(119); "Cartoons"->dp(108); else->dp(84) }
            nav.addView(button,LinearLayout.LayoutParams(width,dp(46)).apply{marginEnd=dp(3)})
        }
        val navScroll=HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled=false
            isFillViewport=false
            isFocusable=false
            clipChildren=false;clipToPadding=false
            overScrollMode=View.OVER_SCROLL_NEVER
            setPadding(dp(10),0,dp(14),0)
            addView(nav,FrameLayout.LayoutParams(-2,-1))
        }
        top.addView(navScroll,LinearLayout.LayoutParams(0,dp(54),1f))
        top.addView(navButton("⌕"){showSearch()},LinearLayout.LayoutParams(dp(60),dp(46)).apply{marginEnd=dp(6)})
        top.addView(navButton("Profil"){showProfiles()},LinearLayout.LayoutParams(dp(82),dp(46)).apply{marginEnd=dp(4)})
        top.addView(navButton("⚙"){showSettingsDialog()},LinearLayout.LayoutParams(dp(60),dp(46)))
        screen.addView(top,FrameLayout.LayoutParams(-1,dp(82),Gravity.TOP))
        setContentView(screen)
        loadHome()
    }

    private fun loadHome() {
        io.execute {
            try {
                fun async(path:String)=java.util.concurrent.CompletableFuture.supplyAsync({ items(path) },io)
                val resumeF=async("/Users/$userId/Items/Resume?Limit=12&Fields=PrimaryImageAspectRatio,Overview,RunTimeTicks&MediaTypes=Video")
                val latestF=async("/Users/$userId/Items/Latest?Limit=18&Fields=PrimaryImageAspectRatio,Overview&IncludeItemTypes=Movie,Series")
                val favoritesF=async("/Users/$userId/Items?Recursive=true&Limit=18&Filters=IsFavorite&IncludeItemTypes=Movie,Series&Fields=PrimaryImageAspectRatio")
                val recommendedF=async("/Users/$userId/Items?Recursive=true&Limit=18&SortBy=CommunityRating,DatePlayed&SortOrder=Descending&IncludeItemTypes=Movie,Series&Filters=IsNotFolder&Fields=PrimaryImageAspectRatio,CommunityRating")
                val topTenF=async("/Users/$userId/Items?Recursive=true&Limit=10&SortBy=CommunityRating&SortOrder=Descending&IncludeItemTypes=Movie,Series&Filters=IsNotFolder&Fields=PrimaryImageAspectRatio,CommunityRating")
                val actionF=async("/Users/$userId/Items?Recursive=true&Limit=18&Genres=Action&IncludeItemTypes=Movie,Series&Fields=PrimaryImageAspectRatio")
                val comedyF=async("/Users/$userId/Items?Recursive=true&Limit=18&Genres=Comedy&IncludeItemTypes=Movie,Series&Fields=PrimaryImageAspectRatio")
                val sciFiF=async("/Users/$userId/Items?Recursive=true&Limit=18&Genres=Science%20Fiction&IncludeItemTypes=Movie,Series&Fields=PrimaryImageAspectRatio")
                val replayF=async("/Users/$userId/Items?Recursive=true&Limit=18&SortBy=DatePlayed&SortOrder=Descending&IncludeItemTypes=Movie,Series&Filters=IsPlayed&Fields=PrimaryImageAspectRatio")
                val watchedF=async("/Users/$userId/Items?Recursive=true&Limit=1&SortBy=DatePlayed&SortOrder=Descending&IncludeItemTypes=Movie,Series&Filters=IsPlayed&Fields=PrimaryImageAspectRatio")
                val resume=resumeF.get(); val latest=latestF.get(); val favorites=favoritesF.get()
                val recommended=recommendedF.get(); val topTen=topTenF.get(); val action=actionF.get()
                val comedy=comedyF.get(); val sciFi=sciFiF.get(); val replay=replayF.get(); val watched=watchedF.get()
                val becauseTitle=watched.firstOrNull()?.optString("Name").orEmpty()
                val because=watched.firstOrNull()?.optString("Id")?.takeIf{it.isNotBlank()}?.let{watchedId->
                    runCatching{items("/Items/$watchedId/Similar?UserId=$userId&Limit=18&Fields=PrimaryImageAspectRatio,CommunityRating")}.getOrDefault(emptyList())
                }?:emptyList()
                runOnUiThread {
                    homeRoot?.let { if(it.childCount>2) it.removeViews(2,it.childCount-2) }
                    addHeroCarousel((latest+recommended).distinctBy{it.optString("Id")}.take(5))
                    addRankedRow(VelarisDesign.homeRow("topTen","Top 10 für dich"),topTen)
                    addContinueRow(resume)
                    addRow(VelarisDesign.homeRow("favorites","Meine Liste"),favorites)
                    if(becauseTitle.isNotBlank()) addRow("${VelarisDesign.homeRow("becausePrefix","Weil du")} „$becauseTitle“ gesehen hast",because)
                    addRow(VelarisDesign.homeRow("latest","Kürzlich hinzugefügt"),latest)
                    addRow(VelarisDesign.homeRow("recommended","Für dich"),recommended)
                    addRow("Action",action); addRow("Komödien",comedy); addRow("Science-Fiction",sciFi)
                    addRow("Noch einmal ansehen",replay)
                }
            } catch(e:Exception) { runOnUiThread {
                val root=homeRoot ?: return@runOnUiThread
                root.let { if(it.childCount>2) it.removeViews(2,it.childCount-2) }
                root.addView(TextView(this).apply{text="Velaris konnte den Server gerade nicht erreichen.";textSize=20f;setTextColor(Color.LTGRAY);gravity=Gravity.CENTER;setPadding(0,dp(32),0,dp(18))})
                root.addView(button("Erneut versuchen"){loadHome()},params(260,60,8))
            }}
        }
    }

    private fun items(path: String): List<JSONObject> {
        val json=request(path)
        val arr=if(json.has("Items")) json.getJSONArray("Items") else json.optJSONArray("array")
        val out=mutableListOf<JSONObject>()
        if(arr!=null) for(i in 0 until arr.length()) out.add(arr.getJSONObject(i))
        return out
    }

    private fun addHeroCarousel(items:List<JSONObject>) {
        if(items.isEmpty()) return
        val holder=FrameLayout(this)
        homeRoot?.addView(holder,LinearLayout.LayoutParams(-1,dp(525)).apply{bottomMargin=dp(-12)})
        fun render(index:Int) {
            if(destroyed || items.isEmpty()) return
            holder.animate().alpha(0f).setDuration(150).withEndAction {
                holder.removeAllViews()
                val previous=homeRoot
                val temp=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
                homeRoot=temp; addHero(items[index % items.size]); homeRoot=previous
                if(temp.childCount>0) {
                    val hero=temp.getChildAt(0); temp.removeView(hero)
                    holder.addView(hero,FrameLayout.LayoutParams(-1,-1))
                }
                holder.animate().alpha(1f).setDuration(220).start()
            }.start()
        }
        render(0)
        if(items.size>1) holder.postDelayed(object:Runnable {
            var index=1
            override fun run() {
                if(holder.isAttachedToWindow && !holder.hasFocus()) { render(index); index=(index+1)%items.size }
                if(holder.isAttachedToWindow) holder.postDelayed(this,9000)
            }
        },9000)
    }

    private fun addHero(item: JSONObject?) {
        if(item==null) return
        val id=item.optString("Id"); if(id.isBlank()) return
        val title=item.optString("Name","Velaris")
        val overview=item.optString("Overview")
        val year=item.optInt("ProductionYear",0)
        val rating=item.optDouble("CommunityRating",0.0)
        val ticks=item.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L) ?: 0L

        val hero=FrameLayout(this).apply {
            minimumHeight=dp(515)
            setBackgroundColor(Color.rgb(12,12,18))
        }
        val image=ImageView(this).apply { scaleType=ImageView.ScaleType.CENTER_CROP }
        hero.addView(image, FrameLayout.LayoutParams(-1,dp(515)))
        loadImage(image,id,"Backdrop",1600)

        val shade=View(this).apply {
            background=GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(0xFB08080D.toInt(),0xD008080D.toInt(),0x5008080D,0x0808080D)
            )
        }
        hero.addView(shade,FrameLayout.LayoutParams(-1,-1))
        hero.addView(View(this).apply {
            background=GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,intArrayOf(0x0008080D,0x1108080D,0xF508080D.toInt()))
        },FrameLayout.LayoutParams(-1,dp(180),Gravity.BOTTOM))

        val info=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            gravity=Gravity.BOTTOM
            setPadding(dp(64),0,dp(58),dp(55))
        }
        info.addView(TextView(this).apply {
            text=VelarisDesign.themeText("heroLabel","IM RAMPENLICHT")
            textSize=13f; letterSpacing=0.17f; typeface=Typeface.DEFAULT_BOLD
            setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
            setPadding(0,0,0,dp(12))
        })
        val logo=ImageView(this).apply{scaleType=ImageView.ScaleType.FIT_START;visibility=View.INVISIBLE}
        info.addView(logo,LinearLayout.LayoutParams(dp(430),dp(120)))
        loadImageWithFallback(logo,id,"Logo",700) {
            logo.visibility=View.GONE
            info.addView(TextView(this).apply { text=title; textSize=48f; setTextColor(Color.WHITE); typeface=Typeface.DEFAULT_BOLD;maxLines=2 },1)
        }
        val meta=listOfNotNull(
            if(year>0) year.toString() else null,
            if(rating>0) "★ %.1f".format(rating) else null
        ).joinToString("   •   ")
        if(meta.isNotBlank()) info.addView(TextView(this).apply {
            text=meta; textSize=17f; setTextColor(Color.LTGRAY); setPadding(0,dp(8),0,0)
        })
        watchedLabel(item)?.let { label ->
            info.addView(TextView(this).apply {
                text=label;setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                textSize=15f;typeface=Typeface.DEFAULT_BOLD;setPadding(0,dp(8),0,0)
            })
        }
        if(overview.isNotBlank()) info.addView(TextView(this).apply {
            text=overview; textSize=17f; setTextColor(Color.WHITE); maxLines=3;setLineSpacing(0f,1.2f)
            setPadding(0,dp(12),0,0)
        },LinearLayout.LayoutParams(dp(650),-2))

        val actions=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL
            setPadding(0,dp(20),0,0)
        }
        actions.addView(actionButton(if(ticks>0) "▶  Fortsetzen" else "▶  Abspielen",true) {
            playNative(id,ticks)
        },LinearLayout.LayoutParams(dp(220),dp(58)).apply { marginEnd=dp(12) })
        val isFav=item.optJSONObject("UserData")?.optBoolean("IsFavorite",false)?:false
        actions.addView(actionButton(if(isFav)"✓  Meine Liste" else "+  Meine Liste",false) { setFavorite(id,!isFav){showHome()} },
            LinearLayout.LayoutParams(dp(210),dp(58)).apply{marginEnd=dp(12)})
        actions.addView(actionButton("ⓘ  Mehr Infos",false){showDetails(id)},
            LinearLayout.LayoutParams(dp(195),dp(58)))
        info.addView(actions)
        hero.addView(info,FrameLayout.LayoutParams(-1,-1))
        homeRoot?.addView(hero,LinearLayout.LayoutParams(-1,dp(515)).apply { bottomMargin=dp(8) })
    }

    private fun watchedLabel(item:JSONObject):String? {
        if(item.optJSONObject("UserData")?.optBoolean("Played",false)!=true)return null
        return when(item.optString("Type")) {
            "Movie" -> "✓ GESEHEN"
            "Episode" -> "✓ FOLGE"
            "Season" -> "✓ STAFFEL"
            "Series" -> "✓ SERIE"
            else -> null
        }
    }

    private fun watchedPoster(item:JSONObject,w:Int,h:Int,imageType:String,requestedWidth:Int):FrameLayout {
        val frame=FrameLayout(this).apply {
            background=GradientDrawable().apply{
                setColor(VelarisDesign.color("surface",0xFF15151B.toInt()))
                cornerRadius=dp(9).toFloat()
            }
            clipToOutline=true
        }
        val poster=ImageView(this).apply{scaleType=ImageView.ScaleType.CENTER_CROP}
        frame.addView(poster,FrameLayout.LayoutParams(-1,-1))
        loadImage(poster,item.optString("Id"),imageType,requestedWidth)
        watchedLabel(item)?.let{label->
            frame.addView(TextView(this).apply{
                text=label;setTextColor(Color.WHITE);textSize=12f;typeface=Typeface.DEFAULT_BOLD
                gravity=Gravity.CENTER
                setPadding(dp(9),dp(5),dp(9),dp(5))
                background=GradientDrawable().apply{
                    setColor(0xEE172A22.toInt());cornerRadius=dp(6).toFloat()
                    setStroke(dp(1),VelarisDesign.color("success",0xFF46D369.toInt()))
                }
            },FrameLayout.LayoutParams(-2,-2,Gravity.TOP or Gravity.RIGHT).apply{
                setMargins(dp(6),dp(7),dp(7),0)
            })
        }
        return frame
    }

    private fun addContinueRow(data:List<JSONObject>) {
        if(data.isEmpty()) return
        homeRoot?.addView(sectionTitle(VelarisDesign.homeRow("resume","Weiterschauen")))
        val row=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; setPadding(dp(52),dp(12),dp(40),dp(44)); clipChildren=false; clipToPadding=false }
        data.forEach { item ->
            val id=item.optString("Id"); if(id.isBlank()) return@forEach
            val ticks=item.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L) ?: 0L
            val total=item.optLong("RunTimeTicks",0L)
            val card=LinearLayout(this).apply {
                orientation=LinearLayout.VERTICAL; isFocusable=true; isClickable=true
                setOnClickListener { playNative(id,ticks) }; applyCardFocus(this)
            }
            val img=ImageView(this).apply { scaleType=ImageView.ScaleType.CENTER_CROP }
            val thumb=FrameLayout(this).apply {
                background=GradientDrawable().apply {
                    setColor(VelarisDesign.color("surface",0xFF15151B.toInt()))
                    cornerRadius=dp(9).toFloat()
                }
                clipToOutline=true
            }
            thumb.addView(img,FrameLayout.LayoutParams(-1,-1));loadImage(img,id,"Backdrop",620)
            thumb.addView(TextView(this).apply {
                text="▶";textSize=22f;setTextColor(Color.WHITE);gravity=Gravity.CENTER
                background=GradientDrawable().apply {
                    setColor(0x88000000.toInt())
                    cornerRadius=dp(26).toFloat()
                    setStroke(dp(2),0xCCFFFFFF.toInt())
                }
            },FrameLayout.LayoutParams(dp(52),dp(52),Gravity.CENTER))
            if(ticks>0 && total>0)thumb.addView(ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply {
                max=1000;progress=((ticks.toDouble()/total)*1000).toInt().coerceIn(0,1000)
                progressTintList=android.content.res.ColorStateList.valueOf(VelarisDesign.color("progress",0xFFE50914.toInt()))
                progressBackgroundTintList=android.content.res.ColorStateList.valueOf(0xAA888888.toInt())
            },FrameLayout.LayoutParams(-1,dp(5),Gravity.BOTTOM))
            card.addView(thumb,LinearLayout.LayoutParams(dp(310),dp(174)))
            card.addView(TextView(this).apply { text=item.optString("Name"); setTextColor(Color.WHITE); textSize=15f; maxLines=1; setPadding(dp(4),dp(7),0,0) },LinearLayout.LayoutParams(dp(310),dp(30)))
            val remaining=((total-ticks).coerceAtLeast(0L)/600_000_000L)
            val ep=item.optInt("IndexNumber",0); val season=item.optInt("ParentIndexNumber",0)
            val resumeMeta=listOfNotNull(if(season>0&&ep>0)"S$season:E$ep" else null,if(remaining>0)"Noch $remaining Min." else null).joinToString("  •  ")
            if(resumeMeta.isNotBlank()) card.addView(TextView(this).apply{text=resumeMeta;textSize=12f;setTextColor(Color.GRAY);setPadding(dp(4),0,0,0)},LinearLayout.LayoutParams(dp(310),dp(24)))
            row.addView(card,LinearLayout.LayoutParams(dp(322),dp(230)).apply{marginEnd=dp(12)})
        }
        homeRoot?.addView(HorizontalScrollView(this).apply{isHorizontalScrollBarEnabled=false;clipChildren=false;addView(row)},LinearLayout.LayoutParams(-1,dp(268)))
    }

    private fun addRankedRow(title:String,data:List<JSONObject>) {
        if(data.isEmpty()) return
        homeRoot?.addView(sectionTitle(title))
        val row=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; setPadding(dp(52),dp(12),dp(40),dp(44)); clipChildren=false; clipToPadding=false }
        data.take(10).forEachIndexed { index,item ->
            val wrap=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; gravity=Gravity.BOTTOM; isFocusable=true; isClickable=true
                setOnClickListener { if(item.optString("Type")=="Series") showSeries(item.optString("Id")) else showDetails(item.optString("Id")) }; applyCardFocus(this) }
            wrap.addView(TextView(this).apply { text="${index+1}"; textSize=68f; typeface=Typeface.DEFAULT_BOLD; setTextColor(VelarisDesign.color("surfaceAlt",0xFF202027.toInt())); gravity=Gravity.BOTTOM },LinearLayout.LayoutParams(dp(58),dp(218)))
            wrap.addView(watchedPoster(item,154,218,"Primary",380),LinearLayout.LayoutParams(dp(154),dp(218)))
            row.addView(wrap,LinearLayout.LayoutParams(dp(220),dp(228)).apply{marginEnd=dp(4)})
        }
        homeRoot?.addView(HorizontalScrollView(this).apply{isHorizontalScrollBarEnabled=false;clipChildren=false;addView(row)},LinearLayout.LayoutParams(-1,dp(300)))
    }

    private fun sectionTitle(label:String)=TextView(this).apply {
        text=label; setTextColor(Color.WHITE); textSize=26f; typeface=Typeface.DEFAULT_BOLD
        setPadding(dp(52),dp(18),0,dp(12))
    }

    private fun applyCardFocus(v:View) {
        v.setOnFocusChangeListener { view,focused ->
            view.background=GradientDrawable().apply {
                setColor(if(focused) 0x302E2E38 else Color.TRANSPARENT)
                cornerRadius=dp(12).toFloat()
                if(focused)setStroke(dp(2),Color.WHITE)
            }
            view.animate().scaleX(if(focused)1.065f else 1f).scaleY(if(focused)1.065f else 1f)
                .translationZ(if(focused)dp(14).toFloat() else 0f).setDuration(140).start()
        }
    }

    private fun addRow(title: String, data: List<JSONObject>) {
        if(data.isEmpty()) return
        homeRoot?.addView(sectionTitle(title))
        val row=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL
            setPadding(dp(52),dp(8),dp(52),dp(30))
            clipChildren=false
            clipToPadding=false
        }
        data.forEach { item ->
            val id=item.optString("Id")
            val type=item.optString("Type")
            if(id.isBlank()) return@forEach
            val card=LinearLayout(this).apply {
                orientation=LinearLayout.VERTICAL; isFocusable=true; isClickable=true
                setPadding(dp(3),dp(3),dp(3),dp(3))
                setOnClickListener { if(type=="Series") showSeries(id) else showDetails(id) }
                applyCardFocus(this)
            }
            card.addView(watchedPoster(item,176,248,"Primary",420),LinearLayout.LayoutParams(dp(176),dp(248)))
            card.setOnLongClickListener { showDetails(id); true }
            val progress=item.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L) ?: 0L
            val total=item.optLong("RunTimeTicks",0L)
            if(progress>0 && total>0) card.addView(ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply {
                max=1000; this.progress=((progress.toDouble()/total)*1000).toInt().coerceIn(0,1000)
                progressTintList=android.content.res.ColorStateList.valueOf(VelarisDesign.color("progress",0xFFE50914.toInt()))
            },LinearLayout.LayoutParams(dp(176),dp(5)))
            row.addView(card,LinearLayout.LayoutParams(dp(188),dp(304)).apply { marginEnd=dp(8) })
        }
        homeRoot?.addView(HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled=false; clipChildren=false; clipToPadding=false; addView(row)
        },LinearLayout.LayoutParams(-1,dp(334)))
    }


    private fun addLibraryGrid(data:List<JSONObject>) {
        if(data.isEmpty()) return
        val grid=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; clipChildren=false; clipToPadding=false; setPadding(dp(12),dp(20),dp(12),dp(42)) }
        data.chunked(5).forEach { items ->
            val row=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; gravity=Gravity.START; clipChildren=false; clipToPadding=false }
            items.forEach { item ->
                val id=item.optString("Id"); if(id.isBlank()) return@forEach
                val type=item.optString("Type")
                val card=LinearLayout(this).apply {
                    orientation=LinearLayout.VERTICAL; isFocusable=true; isClickable=true; clipChildren=false
                    setOnClickListener { if(type=="Series") showSeries(id) else showDetails(id) }
                    applyCardFocus(this)
                }
                card.addView(watchedPoster(item,196,276,"Primary",460),LinearLayout.LayoutParams(dp(196),dp(276)))
                card.addView(TextView(this).apply { text=item.optString("Name"); textSize=15f; setTextColor(Color.WHITE); maxLines=1; setPadding(dp(4),dp(7),dp(4),0) },LinearLayout.LayoutParams(dp(196),dp(30)))
                row.addView(card,LinearLayout.LayoutParams(dp(212),dp(326)).apply { marginEnd=dp(16); bottomMargin=dp(18) })
            }
            grid.addView(row,LinearLayout.LayoutParams(-1,dp(344)))
        }
        homeRoot?.addView(grid,LinearLayout.LayoutParams(-1,-2))
    }

    private fun showMediaFolderLibrary(title:String, type:String) {
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text=title; textSize=32f; setTextColor(Color.WHITE); typeface=Typeface.DEFAULT_BOLD })
        root.addView(ProgressBar(this))
        setContentView(ScrollView(this).apply { addView(root) })
        io.execute {
            try {
                val views=items("/Users/$userId/Views")
                fun normalized(value:String)=java.text.Normalizer.normalize(value.lowercase(),java.text.Normalizer.Form.NFD)
                    .replace(Regex("[\\u0300-\\u036f]"),"")
                    .replace(Regex("[^a-z0-9]"),"")
                val aliases=when(title) {
                    "Anime Filme" -> listOf("animemovies","animefilme","animefilms")
                    "Animation" -> listOf("animation","animations","animationsfilme")
                    "Cartoons" -> listOf("cartoons","cartoon","zeichentrick","zeichentrickfilme")
                    else -> listOf("anime","animes","animeserien","animeseries")
                }
                val folder=views.firstOrNull { view -> aliases.contains(normalized(view.optString("Name"))) }
                val folderId=folder?.optString("Id").orEmpty()
                val data=if(folderId.isBlank()) emptyList() else items("/Users/$userId/Items?ParentId=$folderId&Recursive=true&Limit=250&SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=$type&Fields=PrimaryImageAspectRatio&EnableUserData=true")
                runOnUiThread {
                    root.removeViewAt(1); homeRoot=root
                    if(folderId.isBlank()) {
                        val names=views.mapNotNull{it.optString("Name").takeIf(String::isNotBlank)}.joinToString(", ")
                        root.addView(TextView(this).apply { text="Die Jellyfin-Bibliothek „$title“ wurde nicht gefunden.${if(names.isNotBlank()) "\nGefunden: $names" else ""}"; textSize=18f; setTextColor(Color.LTGRAY); setPadding(0,dp(24),0,dp(24)) })
                    } else if(data.isEmpty()) root.addView(TextView(this).apply { text="In „$title“ wurden keine passenden Inhalte gefunden."; textSize=18f; setTextColor(Color.LTGRAY); setPadding(0,dp(24),0,dp(24)) })
                    else addLibraryGrid(data)
                }
            } catch(e:Exception){ runOnUiThread{toast("$title konnten nicht geladen werden")} }
        }
    }

    private fun showGenreLibrary(title:String, type:String) {
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text=title; textSize=32f; setTextColor(Color.WHITE) })
        root.addView(ProgressBar(this))
        setContentView(ScrollView(this).apply { addView(root) })
        io.execute {
            try {
                val data=items("/Users/$userId/Items?Recursive=true&Limit=100&SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=$type&Genres=Anime&Fields=PrimaryImageAspectRatio")
                runOnUiThread {
                    root.removeViewAt(1); homeRoot=root
                    if(data.isEmpty()) root.addView(TextView(this).apply { text="Keine $title gefunden. Prüfe, ob deine Jellyfin-Titel das Genre „Anime“ verwenden."; textSize=18f; setTextColor(Color.LTGRAY); setPadding(0,dp(24),0,dp(24)) })
                    else addLibraryGrid(data)
                }
            } catch(e:Exception){ runOnUiThread{toast("$title konnten nicht geladen werden")} }
        }
    }

    private fun showLibrary(title:String, type:String) {
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text=title; textSize=32f; setTextColor(Color.WHITE) })
        root.addView(ProgressBar(this))
        setContentView(ScrollView(this).apply { addView(root) })
        io.execute {
            try {
                val data=items("/Users/$userId/Items?Recursive=true&Limit=100&SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=$type&Fields=PrimaryImageAspectRatio")
                runOnUiThread {
                    root.removeViewAt(1)
                    homeRoot=root
                    addLibraryGrid(data)
                }
            } catch(e:Exception){ runOnUiThread{toast("$title konnten nicht geladen werden")} }
        }
    }

    private fun showFavorites() {
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text="Meine Liste"; textSize=32f; setTextColor(Color.WHITE) })
        root.addView(ProgressBar(this))
        setContentView(ScrollView(this).apply { addView(root) })
        io.execute {
            try {
                val data=items("/Users/$userId/Items?Recursive=true&Limit=100&Filters=IsFavorite&IncludeItemTypes=Movie,Series&Fields=PrimaryImageAspectRatio")
                runOnUiThread {
                    root.removeViewAt(1); homeRoot=root
                    if(data.isEmpty()) root.addView(TextView(this).apply { text="Deine Liste ist noch leer."; textSize=18f; setTextColor(Color.LTGRAY); setPadding(0,dp(24),0,dp(24)) })
                    else addRow("Favoriten",data)
                    root.addView(button("Zurück") { showHome() },params(220,56,16))
                }
            } catch(e:Exception){ runOnUiThread{toast("Meine Liste konnte nicht geladen werden")} }
        }
    }

    private fun showSearch() {
        rememberBack { showHome() }
        val root=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(dp(54),dp(48),dp(54),dp(40));setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))}
        val left=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(0,0,dp(36),0)}
        left.addView(TextView(this).apply{text="Suche";textSize=36f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD})
        val input=EditText(this).apply{
            hint="Titel suchen…";setTextColor(Color.WHITE);setHintTextColor(Color.GRAY);textSize=20f;setSingleLine()
            background=GradientDrawable().apply{setColor(0xFF202026.toInt());cornerRadius=dp(10).toFloat()}
            setPadding(dp(18),0,dp(18),0)
            setOnEditorActionListener{_,_,_->val q=text.toString().trim();if(q.isNotBlank())search(q);true}
        }
        left.addView(input,LinearLayout.LayoutParams(dp(440),dp(64)).apply{topMargin=dp(24)})
        left.addView(actionButton("Suchen",true){val q=input.text.toString().trim();if(q.isNotBlank())search(q)},LinearLayout.LayoutParams(dp(180),dp(58)).apply{topMargin=dp(16)})
        root.addView(left,LinearLayout.LayoutParams(dp(500),-1))
        root.addView(TextView(this).apply{text="Gib einen Film, eine Serie oder einen Anime ein.\nDie Ergebnisse erscheinen als Poster.";textSize=20f;setTextColor(Color.LTGRAY);gravity=Gravity.CENTER},LinearLayout.LayoutParams(0,-1,1f))
        setContentView(root);input.requestFocus()
    }

    private fun search(query:String) {
        rememberBack { showSearch() }
        val encoded=java.net.URLEncoder.encode(query,"UTF-8")
        io.execute {
            try {
                val data=items("/Users/$userId/Items?Recursive=true&Limit=50&SearchTerm=$encoded&IncludeItemTypes=Movie,Series&Fields=PrimaryImageAspectRatio")
                runOnUiThread {
                    val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
                    root.addView(TextView(this).apply { text="Suchergebnisse für „$query“"; textSize=30f; setTextColor(Color.WHITE) })
                    homeRoot=root
                    addRow("Ergebnisse",data)
                    root.addView(button("Neue Suche") { showSearch() },params(220,56,16))
                    setContentView(ScrollView(this).apply { addView(root) })
                }
            } catch(e:Exception){ runOnUiThread{toast("Suche fehlgeschlagen")} }
        }
    }

    private fun showSeries(seriesId:String) {
        rememberBack { showHome() }
        io.execute {
            try {
                val series=request("/Users/$userId/Items/$seriesId")
                val seasons=items("/Shows/$seriesId/Seasons?UserId=$userId&Fields=PrimaryImageAspectRatio&EnableUserData=true&Limit=500")
                // Query per-season episodes once, in parallel, and only award a
                // complete season/series checkmark when all returned episodes are played.
                val seasonQueries=seasons.map { season ->
                    java.util.concurrent.CompletableFuture.supplyAsync({
                        runCatching {
                            items("/Shows/$seriesId/Episodes?UserId=$userId&SeasonId=${season.optString("Id")}&Limit=1000&EnableUserData=true")
                        }.getOrNull()
                    },io)
                }
                val finishedSeasons=seasons.mapIndexed { index,season ->
                    val episodes=runCatching { seasonQueries[index].get() }.getOrNull()
                    season.optString("Id") to (episodes!=null && episodes.isNotEmpty() &&
                        episodes.all { it.optJSONObject("UserData")?.optBoolean("Played",false)==true })
                }.toMap()
                val seriesComplete=seasons.isNotEmpty() && finishedSeasons.values.all { it }
                runOnUiThread {
                    val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
                    val hero=FrameLayout(this)
                    val bg=ImageView(this).apply{scaleType=ImageView.ScaleType.CENTER_CROP}; hero.addView(bg,FrameLayout.LayoutParams(-1,dp(390))); loadImage(bg,seriesId,"Backdrop",1600)
                    hero.addView(View(this).apply{background=GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,intArrayOf(0xF708080D.toInt(),0xA808080D.toInt(),0x2208080D))},FrameLayout.LayoutParams(-1,-1))
                    val info=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.BOTTOM;setPadding(dp(54),dp(80),dp(54),dp(38))}
                    info.addView(TextView(this).apply{text=series.optString("Name");textSize=40f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD})
                    if(seriesComplete)info.addView(TextView(this).apply {
                        text="✓ SERIE VOLLSTÄNDIG GESEHEN"
                        textSize=16f;typeface=Typeface.DEFAULT_BOLD
                        setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                        setPadding(0,dp(9),0,0)
                    })
                    info.addView(TextView(this).apply{text=series.optString("Overview");textSize=16f;setTextColor(Color.LTGRAY);maxLines=3;setPadding(0,dp(10),0,0)},LinearLayout.LayoutParams(dp(720),-2))
                    val favorite=series.optJSONObject("UserData")?.optBoolean("IsFavorite",false)?:false
                    val acts=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(0,dp(16),0,0)}
                    acts.addView(actionButton(if(favorite)"✓  Meine Liste" else "+  Meine Liste",false){setFavorite(seriesId,!favorite){showSeries(seriesId)}},LinearLayout.LayoutParams(dp(220),dp(56)).apply{marginEnd=dp(10)})
                    acts.addView(actionButton("Zufällige Folge",false){playRandomEpisode(seriesId)},LinearLayout.LayoutParams(dp(200),dp(56)))
                    info.addView(acts); hero.addView(info,FrameLayout.LayoutParams(-1,-1)); root.addView(hero,LinearLayout.LayoutParams(-1,dp(390)))
                    root.addView(sectionTitle("Staffeln"))
                    val seasonRow=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(dp(52),dp(8),dp(52),dp(22))}
                    seasons.forEach { season ->
                        val id=season.optString("Id")
                        val label=(if(finishedSeasons[id]==true)"✓  " else "")+season.optString("Name","Staffel")
                        seasonRow.addView(actionButton(label,false){showSeason(seriesId,id)},
                            LinearLayout.LayoutParams(dp(205),dp(56)).apply{marginEnd=dp(10)})
                    }
                    root.addView(HorizontalScrollView(this).apply{isHorizontalScrollBarEnabled=false;addView(seasonRow)})
                    setContentView(ScrollView(this).apply{isVerticalScrollBarEnabled=false;addView(root)})
                }
            } catch(e:Exception){ runOnUiThread{toast("Serie konnte nicht geladen werden")} }
        }
    }

    private fun showSeason(seriesId:String, seasonId:String) {
        rememberBack { showSeries(seriesId) }
        io.execute {
            try {
                val episodes=items("/Shows/$seriesId/Episodes?UserId=$userId&SeasonId=$seasonId&Fields=Overview,PrimaryImageAspectRatio,RunTimeTicks&EnableUserData=true&Limit=1000")
                val seasonComplete=episodes.isNotEmpty() && episodes.all{it.optJSONObject("UserData")?.optBoolean("Played",false)==true}
                runOnUiThread {
                    val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
                    root.addView(TextView(this).apply { text="Episoden"; textSize=32f; setTextColor(Color.WHITE) })
                    if(seasonComplete)root.addView(TextView(this).apply {
                        text="✓ STAFFEL VOLLSTÄNDIG GESEHEN"
                        textSize=16f;typeface=Typeface.DEFAULT_BOLD
                        setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                    },params(-1,-2,9))
                    episodes.forEach { ep ->
                        val eid=ep.optString("Id")
                        val ticks=ep.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L) ?: 0L
                        val number=ep.optInt("IndexNumber",0)
                        val name=ep.optString("Name")
                        val nextId=episodes.getOrNull(episodes.indexOf(ep)+1)?.optString("Id").orEmpty()
                        val card=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; gravity=Gravity.CENTER_VERTICAL; isFocusable=true; isClickable=true; setPadding(dp(8),dp(8),dp(8),dp(8)); setOnClickListener { startEpisode(eid,ticks,nextId) }; applyCardFocus(this) }
                        card.addView(watchedPoster(ep,250,140,"Primary",500),
                            LinearLayout.LayoutParams(dp(250),dp(140)))
                        val info=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(18),0,0,0) }
                        info.addView(TextView(this).apply {
                            text=(if(number>0) "$number. " else "")+name
                            textSize=20f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD
                        })
                        if(watchedLabel(ep)!=null)info.addView(TextView(this).apply{
                            text="✓ FOLGE GESEHEN";textSize=12f;typeface=Typeface.DEFAULT_BOLD
                            setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                        },params(-1,-2,4))
                        val runtime=ep.optLong("RunTimeTicks",0L)/600_000_000L
                        if(runtime>0) info.addView(TextView(this).apply { text="$runtime Min."; textSize=13f; setTextColor(Color.GRAY) },params(-1,-2,3))
                        info.addView(TextView(this).apply { text=ep.optString("Overview"); textSize=14f; setTextColor(Color.LTGRAY); maxLines=2 },params(-1,-2,5))
                        card.addView(info,LinearLayout.LayoutParams(0,dp(140),1f))
                        root.addView(card,params(-1,156,8))
                    }
                    root.addView(button("Zurück zur Serie") { showSeries(seriesId) },params(260,56,18))
                    setContentView(ScrollView(this).apply { addView(root) })
                }
            } catch(e:Exception){ runOnUiThread{toast("Episoden konnten nicht geladen werden")} }
        }
    }

    private fun startEpisode(id:String,ticks:Long,nextId:String="")=playNative(id,ticks,nextId)

    private fun showDetails(id:String) {
        rememberBack { showHome() }
        io.execute {
            try {
                val x=request("/Users/$userId/Items/$id")
                val similar=runCatching { items("/Items/$id/Similar?UserId=$userId&Limit=16&Fields=PrimaryImageAspectRatio") }.getOrDefault(emptyList())
                runOnUiThread {
                    val outer=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
                    val hero=FrameLayout(this)
                    val bg=ImageView(this).apply{scaleType=ImageView.ScaleType.CENTER_CROP}; hero.addView(bg,FrameLayout.LayoutParams(-1,dp(500))); loadImage(bg,id,"Backdrop",1600)
                    hero.addView(View(this).apply{background=GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,intArrayOf(0xF708080D.toInt(),0xB008080D.toInt(),0x2208080D))},FrameLayout.LayoutParams(-1,-1))
                    val info=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.BOTTOM;setPadding(dp(58),dp(90),dp(58),dp(42))}
                    info.addView(TextView(this).apply{text=x.optString("Name");textSize=42f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD})
                    val year=x.optInt("ProductionYear",0); val rating=x.optDouble("CommunityRating",0.0); val runtime=x.optLong("RunTimeTicks",0L)/600_000_000L
                    val meta=listOfNotNull(if(year>0)year.toString()else null,if(runtime>0)"$runtime Min."else null,if(rating>0)"★ %.1f".format(rating)else null).joinToString("  •  ")
                    if(meta.isNotBlank()) info.addView(TextView(this).apply{text=meta;textSize=16f;setTextColor(Color.LTGRAY)})
                    watchedLabel(x)?.let { label ->
                        info.addView(TextView(this).apply {
                            text=label;typeface=Typeface.DEFAULT_BOLD;textSize=16f
                            setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                        },params(-1,-2,9))
                    }
                    info.addView(TextView(this).apply{text=x.optString("Overview");textSize=17f;setTextColor(Color.WHITE);maxLines=4;setPadding(0,dp(12),0,0)},LinearLayout.LayoutParams(dp(700),-2))
                    val ud=x.optJSONObject("UserData"); val ticks=ud?.optLong("PlaybackPositionTicks",0L)?:0L; val fav=ud?.optBoolean("IsFavorite",false)?:false
                    val actions=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(0,dp(20),0,0)}
                    actions.addView(actionButton(if(ticks>0)"▶  Fortsetzen" else "▶  Abspielen",true){playNative(id,ticks)},LinearLayout.LayoutParams(dp(220),dp(58)).apply{marginEnd=dp(12)})
                    actions.addView(actionButton(if(fav)"✓  Meine Liste" else "+  Meine Liste",false){setFavorite(id,!fav){showDetails(id)}},LinearLayout.LayoutParams(dp(220),dp(58)).apply{marginEnd=dp(12)})
                    if(x.optString("Type")=="Series") actions.addView(actionButton("Zufällige Folge",false){playRandomEpisode(id)},LinearLayout.LayoutParams(dp(210),dp(58)))
                    info.addView(actions); hero.addView(info,FrameLayout.LayoutParams(-1,-1)); outer.addView(hero,LinearLayout.LayoutParams(-1,dp(500)))
                    homeRoot=outer
                    addRow("Ähnliche Titel",similar)
                    setContentView(ScrollView(this).apply{isVerticalScrollBarEnabled=false;addView(outer)})
                }
            } catch(e:Exception){ runOnUiThread{toast("Details konnten nicht geladen werden")} }
        }
    }

    private fun showSimilar(id:String) {
        rememberBack { showDetails(id) }
        io.execute {
            try {
                val data=items("/Items/$id/Similar?UserId=$userId&Limit=20&Fields=PrimaryImageAspectRatio")
                runOnUiThread {
                    val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
                    root.addView(TextView(this).apply { text="Ähnliche Titel"; textSize=32f; setTextColor(Color.WHITE) })
                    homeRoot=root; addRow("Das könnte dir gefallen",data)
                    root.addView(button("Zurück") { showDetails(id) },params(220,56,18))
                    setContentView(ScrollView(this).apply { addView(root) })
                }
            } catch(e:Exception) { runOnUiThread { toast("Ähnliche Titel konnten nicht geladen werden") } }
        }
    }

    private fun playRandomEpisode(seriesId:String) {
        io.execute {
            try {
                val data=items("/Users/$userId/Items?Recursive=true&ParentId=$seriesId&IncludeItemTypes=Episode&Limit=200")
                val ep=if(data.isEmpty()) null else data[java.util.concurrent.ThreadLocalRandom.current().nextInt(data.size)]
                runOnUiThread { if(ep==null) toast("Keine Episode gefunden") else playNative(ep.optString("Id"),0L) }
            } catch(e:Exception) { runOnUiThread { toast("Zufällige Folge konnte nicht gestartet werden") } }
        }
    }

    // Profiles are Jellyfin accounts, not independent local display names.
    // Legacy local-only profiles are intentionally migrated to the one authenticated
    // account; there is no valid Jellyfin token for the other legacy aliases.
    private fun readProfiles():org.json.JSONArray {
        val stored=prefs.getString("velaris_profiles","").orEmpty()
        val existing=runCatching{org.json.JSONArray(stored)}.getOrDefault(org.json.JSONArray())
        if(existing.length()>0 && (0 until existing.length()).all { i ->
            val p=existing.optJSONObject(i)
            p!=null && p.optString("userId").isNotBlank() && p.optString("token").isNotBlank()
        }) return existing
        if(server.isBlank() || userId.isBlank() || token.isBlank()) return org.json.JSONArray()
        val oldAvatar=prefs.getInt("active_profile_avatar",0)
        val avatar=if(stored.isBlank()) 0 else when(oldAvatar){0->2;1->3;else->oldAvatar.coerceIn(0,3)}
        val migrated=org.json.JSONArray().put(JSONObject()
            .put("id","$server:$userId")
            .put("server",server).put("userId",userId).put("token",token)
            .put("name",prefs.getString("active_profile_name","Jellyfin") ?: "Jellyfin")
            .put("avatar",avatar))
        prefs.edit().putString("velaris_profiles",migrated.toString()).apply()
        return migrated
    }

    private fun saveJellyfinProfile(serverUrl:String, id:String, accessToken:String, name:String, avatar:Int):Boolean {
        val profiles=readProfiles()
        val key="$serverUrl:$id"
        val existing=(0 until profiles.length()).firstOrNull{profiles.optJSONObject(it)?.optString("id")==key}
        if(existing==null && profiles.length()>=VelarisDesign.maxProfiles()) return false
        val account=JSONObject().put("id",key).put("server",serverUrl).put("userId",id)
            .put("token",accessToken).put("name",name).put("avatar",avatar.coerceIn(0,3))
        if(existing!=null) {
            val old=profiles.optJSONObject(existing)
            if(old!=null)account.put("avatar",old.optInt("avatar",avatar).coerceIn(0,3))
            profiles.put(existing,account)
        } else profiles.put(account)
        prefs.edit().putString("velaris_profiles",profiles.toString()).apply()
        return true
    }

    private fun activateJellyfinProfile(profile:JSONObject) {
        val nextServer=profile.optString("server")
        val nextUser=profile.optString("userId")
        val nextToken=profile.optString("token")
        if(nextServer.isBlank() || nextUser.isBlank() || nextToken.isBlank()) {
            toast("Bitte dieses Jellyfin-Profil erneut anmelden")
            return
        }
        server=nextServer;userId=nextUser;token=nextToken
        prefs.edit().putString("server_url",server).putString("user_id",userId)
            .putString("access_token",token)
            .putString("active_profile_name",profile.optString("name","Jellyfin"))
            .putInt("active_profile_avatar",profile.optInt("avatar",0)).apply()
        showHome()
    }

    private fun avatarFrame(index:Int,description:String):FrameLayout {
        return FrameLayout(this).apply {
            clipChildren=false;clipToPadding=false
            addView(avatarFace(index,description),FrameLayout.LayoutParams(-1,-1).apply {
                setMargins(dp(4),dp(4),dp(4),dp(4))
            })
        }
    }

    private fun highlightAvatar(frame:View,focused:Boolean,selected:Boolean=false) {
        frame.background=GradientDrawable().apply {
            setColor(Color.TRANSPARENT)
            cornerRadius=dp(20).toFloat()
            if(focused)setStroke(dp(3),Color.WHITE)
            else if(selected)setStroke(dp(2),VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
        }
        frame.animate().scaleX(if(focused)1.045f else 1f).scaleY(if(focused)1.045f else 1f)
            .setDuration(120).start()
    }

    private fun showProfiles(startup:Boolean=false) {
        if(!startup) rememberBack { showHome() }
        val profiles=readProfiles()
        val root=LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER
            setPadding(dp(70),dp(34),dp(70),dp(34));setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
        }
        root.addView(TextView(this).apply{
            text="Wer schaut gerade?";textSize=40f;setTextColor(Color.WHITE)
            typeface=Typeface.DEFAULT_BOLD;gravity=Gravity.CENTER
        },params(-1,-2,0))
        root.addView(TextView(this).apply{
            text="Wähle dein Profil";textSize=17f;setTextColor(0xFF9B9BA4.toInt());gravity=Gravity.CENTER
        },params(-1,-2,8))

        val grid=LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER
            clipChildren=false;clipToPadding=false
            setPadding(dp(12),dp(26),dp(12),dp(12))
        }
        var firstProfile:View?=null
        var row=LinearLayout(this).apply{
            orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER
            clipChildren=false;clipToPadding=false
        }
        fun addTile(tile:View,index:Int){
            if(index>0 && index%5==0){
                grid.addView(row)
                row=LinearLayout(this).apply{
                    orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER
                    clipChildren=false;clipToPadding=false
                }
            }
            row.addView(tile,LinearLayout.LayoutParams(dp(180),dp(205)).apply{marginEnd=dp(12)})
        }
        for(i in 0 until profiles.length()) {
            val p=profiles.optJSONObject(i) ?: continue
            val name=p.optString("name","Profil");val av=p.optInt("avatar",i)
            val picture=avatarFrame(av,name)
            val tile=LinearLayout(this).apply{
                orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER
                isFocusable=true;isClickable=true
                clipChildren=false;clipToPadding=false
                setPadding(dp(8),dp(8),dp(8),dp(4))
                setOnFocusChangeListener{_,focused->highlightAvatar(picture,focused)}
                setOnClickListener{activateJellyfinProfile(p)}
            }
            tile.addView(picture,LinearLayout.LayoutParams(dp(142),dp(142)))
            tile.addView(TextView(this).apply{
                text=name;textSize=17f;setTextColor(0xFFBDBDC4.toInt())
                gravity=Gravity.CENTER;maxLines=1
            },LinearLayout.LayoutParams(dp(164),dp(42)))
            if(firstProfile==null)firstProfile=tile
            addTile(tile,i)
        }
        if(profiles.length()<VelarisDesign.maxProfiles()){
            val addPicture=FrameLayout(this).apply{
                clipChildren=false;clipToPadding=false
                addView(TextView(this@MainActivity).apply{
                    text="+";textSize=54f;setTextColor(0xFFBDBDC4.toInt());gravity=Gravity.CENTER
                    background=GradientDrawable().apply{
                        setColor(VelarisDesign.color("surfaceAlt",0xFF222229.toInt()))
                        cornerRadius=dp(14).toFloat()
                    }
                },FrameLayout.LayoutParams(-1,-1).apply{setMargins(dp(4),dp(4),dp(4),dp(4))})
            }
            val add=LinearLayout(this).apply{
                orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER
                isFocusable=true;isClickable=true
                clipChildren=false;clipToPadding=false
                setPadding(dp(8),dp(8),dp(8),dp(4))
                setOnClickListener{showCreateProfile()}
                setOnFocusChangeListener{_,focused->highlightAvatar(addPicture,focused)}
            }
            add.addView(addPicture,LinearLayout.LayoutParams(dp(142),dp(142)))
            add.addView(TextView(this).apply{
                text="Profil hinzufügen";textSize=15f
                setTextColor(0xFFBDBDC4.toInt())
                gravity=Gravity.CENTER
            },LinearLayout.LayoutParams(dp(164),dp(42)))
            if(firstProfile==null)firstProfile=add
            addTile(add,profiles.length())
        }
        grid.addView(row);root.addView(grid)
        setContentView(root)
        root.post{firstProfile?.requestFocus()}
    }

    private fun avatarFace(index:Int,initial:String):View {
        val avatars=intArrayOf(
            R.drawable.velaris_avatar_red,
            R.drawable.velaris_avatar_blue,
            R.drawable.avatar_seal_white,
            R.drawable.avatar_seal_gray
        )
        return ImageView(this).apply {
            scaleType=ImageView.ScaleType.CENTER_CROP
            setImageResource(avatars[index.coerceIn(0,avatars.lastIndex)])
            clipToOutline=true
            outlineProvider=object:android.view.ViewOutlineProvider(){
                override fun getOutline(v:View,o:android.graphics.Outline){
                    o.setRoundRect(0,0,v.width.coerceAtLeast(1),v.height.coerceAtLeast(1),dp(16).toFloat())
                }
            }
            contentDescription=if(initial.isBlank()) "Avatar "+(index+1) else "Avatar "+initial
        }
    }

    private fun showCreateProfile() {
        val root=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL;gravity=Gravity.CENTER
            setPadding(dp(80),dp(44),dp(80),dp(44))
            setBackgroundColor(VelarisDesign.color("background",VelarisDesign.color("background",0xFF08080D.toInt())))
        }
        root.addView(TextView(this).apply {
            text="Jellyfin-Profil hinzufügen";textSize=34f;setTextColor(Color.WHITE)
            typeface=Typeface.DEFAULT_BOLD
        },params(-2,-2,0))
        root.addView(TextView(this).apply {
            text="Melde einen weiteren Jellyfin-Benutzer an, damit Verlauf und Favoriten getrennt bleiben."
            textSize=16f;setTextColor(Color.LTGRAY)
        },params(-2,-2,14))
        val user=EditText(this).apply {
            hint="Jellyfin-Benutzername";setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY);setSingleLine()
        }
        val pass=EditText(this).apply {
            hint="Passwort";setTextColor(Color.WHITE);setHintTextColor(Color.GRAY)
            setSingleLine()
            inputType=InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(user,params(520,62,22))
        root.addView(pass,params(520,62,12))
        root.addView(TextView(this).apply {
            text="Avatar auswählen";textSize=18f;setTextColor(Color.LTGRAY)
        },params(-2,-2,22))
        val avatarChoices=LinearLayout(this).apply{
            orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER
            clipChildren=false;clipToPadding=false
        }
        var selected=0
        val choices=mutableListOf<FrameLayout>()
        for(i in 0..3) {
            val picture=avatarFrame(i,"").apply {
                isFocusable=true;isClickable=true
            }
            picture.setOnFocusChangeListener{_,focused->highlightAvatar(picture,focused,selected==i)}
            picture.setOnClickListener {
                selected=i
                choices.forEachIndexed { index,frame ->
                    highlightAvatar(frame,frame.hasFocus(),selected==index)
                }
            }
            choices.add(picture)
            avatarChoices.addView(picture,LinearLayout.LayoutParams(dp(90),dp(90)).apply{marginEnd=dp(10)})
        }
        highlightAvatar(choices.first(),false,true)
        root.addView(avatarChoices,params(-2,100,12))
        configureTvInput(user,pass)
        configureTvInput(pass,choices.first(),done=true)
        root.addView(actionButton("Jellyfin-Profil hinzufügen",true) {
            val username=user.text.toString().trim()
            val password=pass.text.toString()
            if(username.isBlank()) {
                toast("Jellyfin-Benutzername eingeben")
            } else {
                val requestedAvatar=selected
                val targetServer=server
                io.execute {
                    try {
                        val body=JSONObject().put("Username",username).put("Pw",password).toString()
                        val response=request("/Users/AuthenticateByName","POST",body,false)
                        val account=response.getJSONObject("User")
                        val newId=account.getString("Id")
                        val newToken=response.getString("AccessToken")
                        val newName=account.optString("Name",username)
                        runOnUiThread {
                            if(targetServer!=server) {
                                toast("Server hat sich geändert. Bitte erneut anmelden.")
                            } else if(saveJellyfinProfile(server,newId,newToken,newName,requestedAvatar)) {
                                val list=readProfiles()
                                val next=(0 until list.length()).mapNotNull{list.optJSONObject(it)}
                                    .firstOrNull{it.optString("userId")==newId && it.optString("server")==server}
                                if(next!=null)activateJellyfinProfile(next) else showProfiles(true)
                            } else toast("Maximal ${VelarisDesign.maxProfiles()} Jellyfin-Profile")
                        }
                    } catch(e:Exception) {
                        runOnUiThread {toast("Anmeldung fehlgeschlagen: ${e.message ?: "Server nicht erreichbar"}")}
                    }
                }
            }
        },params(330,58,24))
        root.addView(actionButton("Zurück",false){showProfiles()},params(180,56,12))
        setContentView(ScrollView(this).apply{
            isFillViewport=true;isVerticalScrollBarEnabled=false
            clipChildren=false;clipToPadding=false
            addView(root)
        })
        root.post{user.requestFocus()}
    }

    private fun setPlayed(id:String, played:Boolean, done:()->Unit) {
        if(id.isBlank()) return
        io.execute {
            try {
                request("/Users/$userId/PlayedItems/$id", if(played) "POST" else "DELETE")
                runOnUiThread { toast(if(played) "Als gesehen markiert" else "Als ungesehen markiert"); done() }
            } catch(e:Exception) { runOnUiThread { toast("Wiedergabestatus konnte nicht geändert werden") } }
        }
    }

    private fun setFavorite(id:String, favorite:Boolean, done:()->Unit) {
        if(id.isBlank()) return
        io.execute {
            try {
                request("/Users/$userId/FavoriteItems/$id", if(favorite) "POST" else "DELETE")
                runOnUiThread { toast(if(favorite) "Zu Meine Liste hinzugefügt" else "Aus Meine Liste entfernt"); done() }
            } catch(e:Exception) { runOnUiThread { toast("Meine Liste konnte nicht geändert werden") } }
        }
    }

    private fun playNative(id:String, startTicks:Long=0L, nextId:String="") {
        if(id.isBlank() || server.isBlank() || token.isBlank() || destroyed) return toast("Wiedergabe kann nicht gestartet werden")
        startActivity(android.content.Intent(this, PlayerActivity::class.java).apply {
            putExtra("server",server)
            putExtra("token",token)
            putExtra("userId",userId)
            putExtra("itemId",id)
            putExtra("startTicks",startTicks)
            putExtra("nextItemId",nextId)
            putExtra("autoNext",true)
        })
    }

    private fun loadImage(view:ImageView,id:String,type:String,width:Int) {
        if(id.isBlank() || server.isBlank() || token.isBlank()) return
        val cacheKey="$id:$type:$width"
        imageCache.get(cacheKey)?.let { view.setImageBitmap(it); return }
        view.clipToOutline=true
        view.outlineProvider=object:android.view.ViewOutlineProvider() {
            override fun getOutline(v:View,outline:android.graphics.Outline) {
                outline.setRoundRect(0,0,v.width.coerceAtLeast(1),v.height.coerceAtLeast(1),dp(10).toFloat())
            }
        }
        val disk=java.io.File(cacheDir,"img_"+cacheKey.hashCode().toUInt().toString(16)+".jpg")
        if(disk.exists()) {
            val bmp=runCatching{android.graphics.BitmapFactory.decodeFile(disk.absolutePath)}.getOrNull()
            if(bmp!=null) { imageCache.put(cacheKey,bmp); view.setImageBitmap(bmp); return } else disk.delete()
        }
        if(!imageLoads.add(cacheKey)) return
        io.execute {
            try {
                val conn=URL("$server/Items/$id/Images/$type?maxWidth=$width&quality=82").openConnection() as HttpURLConnection
                conn.setRequestProperty("X-Emby-Token",token); conn.connectTimeout=4500; conn.readTimeout=7000
                try {
                    if(conn.responseCode in 200..299) {
                        val bytes=conn.inputStream.use{it.readBytes()}
                        val bmp=android.graphics.BitmapFactory.decodeByteArray(bytes,0,bytes.size)
                        if(bmp!=null && !destroyed) {
                            imageCache.put(cacheKey,bmp)
                            runCatching{disk.writeBytes(bytes)}
                            runOnUiThread{if(!isFinishing&&!isDestroyed)view.setImageBitmap(bmp)}
                        }
                    }
                } finally { conn.disconnect() }
            } catch(_:Exception) {} finally { imageLoads.remove(cacheKey) }
        }
    }

    private fun loadImageWithFallback(view:ImageView,id:String,type:String,width:Int,onMissing:()->Unit) {
        if(id.isBlank() || server.isBlank() || token.isBlank()) return onMissing()
        io.execute {
            try {
                val conn=URL("$server/Items/$id/Images/$type?maxWidth=$width&quality=92").openConnection() as HttpURLConnection
                try {
                    conn.setRequestProperty("X-Emby-Token",token);conn.connectTimeout=5000;conn.readTimeout=7000
                    if(conn.responseCode in 200..299) {
                        val bmp=conn.inputStream.use{android.graphics.BitmapFactory.decodeStream(it)}
                        runOnUiThread{if(bmp!=null){view.visibility=View.VISIBLE;view.setImageBitmap(bmp)}else onMissing()}
                    } else runOnUiThread{onMissing()}
                } finally {conn.disconnect()}
            } catch(_:Exception){runOnUiThread{onMissing()}}
        }
    }

    private fun request(path:String, method:String="GET", body:String?=null, auth:Boolean=true):JSONObject {
        if(server.isBlank()) throw IllegalStateException("Kein Server konfiguriert")
        val conn=URL(server+path).openConnection() as HttpURLConnection
        try {
            conn.requestMethod=method; conn.connectTimeout=8000; conn.readTimeout=12000
            conn.setRequestProperty("Accept","application/json")
            conn.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="0.7.0"${if(auth && token.isNotBlank()) ", Token=\"$token\"" else ""}""")
            if(body!=null){ conn.doOutput=true; conn.setRequestProperty("Content-Type","application/json"); conn.outputStream.use{it.write(body.toByteArray())} }
            val code=conn.responseCode
            val text=(if(code in 200..299) conn.inputStream else conn.errorStream)?.bufferedReader()?.use{it.readText()}.orEmpty()
            if(code == 401 || code == 403) throw SecurityException("Sitzung abgelaufen")
            if(code !in 200..299) throw IllegalStateException("Serverfehler HTTP $code")
            return if(text.trim().startsWith("[")) JSONObject().put("array",org.json.JSONArray(text)) else if(text.isBlank()) JSONObject() else JSONObject(text)
        } finally { conn.disconnect() }
    }

    private fun showSettingsDialog() {
        rememberBack { showHome() }
        val root=LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL
            setPadding(dp(52),dp(38),dp(52),dp(82))
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            clipChildren=false;clipToPadding=false
        }
        root.addView(TextView(this).apply{text="Einstellungen";textSize=38f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD})
        root.addView(TextView(this).apply{text="Velaris TV";textSize=16f;setTextColor(Color.GRAY);setPadding(0,dp(4),0,dp(24))})
        val playback=settingsCard("▶","Wiedergabe","Autoplay, Intro, Rückblick und Abspann"){showPlaybackSettings()}
        val profiles=settingsCard("●","Profile","Profile verwalten und wechseln"){showProfiles()}
        val serverCard=settingsCard("◉","Server",server.ifBlank{"Nicht verbunden"}){clearConnection();showServer()}
        val logout=settingsCard("↪","Abmelden","Jellyfin-Sitzung auf diesem TV beenden"){token="";userId="";prefs.edit().remove("access_token").remove("user_id").apply();showLogin()}
        listOf(playback,profiles,serverCard,logout).forEach{root.addView(it,LinearLayout.LayoutParams(-1,dp(86)).apply{bottomMargin=dp(12)})}
        val page=ScrollView(this).apply {
            isVerticalScrollBarEnabled=false
            isFillViewport=true
            clipChildren=false;clipToPadding=false
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            addView(root)
        }
        setContentView(page)
        page.post { playback.requestFocus() }
    }

    private fun settingsCard(icon:String,title:String,sub:String,click:()->Unit)=LinearLayout(this).apply{
        orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL;setPadding(dp(22),0,dp(22),0);isFocusable=true;isClickable=true
        background=GradientDrawable().apply{setColor(VelarisDesign.color("surface",0xFF18181E.toInt()));cornerRadius=dp(12).toFloat()}
        addView(TextView(this@MainActivity).apply{text=icon;textSize=26f;setTextColor(Color.WHITE);gravity=Gravity.CENTER},LinearLayout.LayoutParams(dp(54),dp(54)))
        addView(LinearLayout(this@MainActivity).apply{orientation=LinearLayout.VERTICAL;setPadding(dp(18),0,0,0);addView(TextView(this@MainActivity).apply{text=title;textSize=20f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD});addView(TextView(this@MainActivity).apply{text=sub;textSize=14f;setTextColor(Color.GRAY)})},LinearLayout.LayoutParams(0,-2,1f))
        addView(TextView(this@MainActivity).apply{text="›";textSize=30f;setTextColor(Color.LTGRAY)})
        stateListAnimator=null
        setOnClickListener{click()}
        setOnFocusChangeListener{_,focused->
            background=GradientDrawable().apply{
                setColor(if(focused)VelarisDesign.color("surfaceAlt",0xFF202027.toInt()) else VelarisDesign.color("surface",0xFF18181E.toInt()))
                cornerRadius=dp(12).toFloat()
                if(focused)setStroke(dp(2),Color.WHITE)
            }
            // Borders provide focus feedback without scaling/cropping the full-width row.
            animate().scaleX(1f).scaleY(1f).setDuration(100).start()
        }
    }

    private fun showPlaybackSettings() {
        val root=LinearLayout(this).apply{
            orientation=LinearLayout.VERTICAL
            setPadding(dp(52),dp(38),dp(52),dp(82))
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            clipChildren=false;clipToPadding=false
        }
        root.addView(TextView(this).apply{text="Wiedergabe";textSize=36f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD})
        val options=listOf("Automatisch nächste Folge" to "auto_next","Intro automatisch überspringen" to "auto_skip_intro","Rückblick automatisch überspringen" to "auto_skip_recap","Abspann automatisch überspringen" to "auto_skip_credits")
        options.forEachIndexed{i,(label,key)->
            val row=settingsCard(if(prefs.getBoolean(key,i==0))"●" else "○",label,if(prefs.getBoolean(key,i==0))"Ein" else "Aus"){
                val value=!prefs.getBoolean(key,i==0);prefs.edit().putBoolean(key,value).apply();showPlaybackSettings()
            }
            root.addView(row,LinearLayout.LayoutParams(-1,dp(82)).apply{topMargin=dp(10)})
        }
        root.addView(actionButton("Zurück",false){showSettingsDialog()},params(180,56,22))
        setContentView(ScrollView(this).apply{
            isVerticalScrollBarEnabled=false;isFillViewport=true
            clipChildren=false;clipToPadding=false
            addView(root)
        })
        root.post{(root.getChildAt(1) as? View)?.requestFocus()}
    }


    private fun clearConnection(){
        server="";token="";userId=""
        prefs.edit().remove("server_url").remove("access_token").remove("user_id")
            .remove("active_profile_name").remove("active_profile_avatar").apply()
    }
    private fun setupPage(title:String,sub:String,first:View)=LinearLayout(this).apply {
        orientation=LinearLayout.VERTICAL; gravity=Gravity.CENTER; setPadding(dp(72),dp(36),dp(72),dp(36)); setBackgroundColor(Color.BLACK)
        addView(ImageView(this@MainActivity).apply{setImageResource(R.drawable.velaris_logo);scaleType=ImageView.ScaleType.FIT_CENTER},params(180,180,0))
        addView(TextView(this@MainActivity).apply{text=title;textSize=30f;setTextColor(Color.WHITE);gravity=Gravity.CENTER},params(-2,-2,12))
        addView(TextView(this@MainActivity).apply{text=sub;textSize=16f;setTextColor(Color.LTGRAY);gravity=Gravity.CENTER},params(-2,-2,8))
        addView(first,params(600,62,22))
    }
    private fun navButton(label:String, click:()->Unit)=Button(this).apply {
        text=label; contentDescription=label; isAllCaps=false; textSize=15f; setSingleLine(true); includeFontPadding=false
        setTextColor(Color.WHITE); isFocusable=true; isClickable=true
        setPadding(dp(9),0,dp(9),0)
        background=GradientDrawable().apply {
            setColor(Color.TRANSPARENT)
            cornerRadius=dp(7).toFloat()
        }
        stateListAnimator=null
        elevation=0f
        setOnClickListener { click() }
        setOnFocusChangeListener { v, focused ->
            background=GradientDrawable().apply {
                setColor(if(focused) 0x70404048 else Color.TRANSPARENT)
                cornerRadius=dp(10).toFloat()
                if(focused)setStroke(dp(1),0xCCFFFFFF.toInt())
            }
            // The HorizontalScrollView follows D-pad focus to "Sammlungen".
            if(focused) post {
                val strip=parent as? LinearLayout
                val scroll=strip?.parent as? HorizontalScrollView
                if(scroll!=null)scroll.smoothScrollTo((left - dp(30)).coerceAtLeast(0),0)
            }
            v.animate().scaleX(1f).scaleY(1f).setDuration(110).start()
        }
    }

    private fun actionButton(label:String, primary:Boolean, click:()->Unit)=Button(this).apply {
        text=label; contentDescription=label; isAllCaps=false; textSize=17f; typeface=Typeface.DEFAULT_BOLD
        setTextColor(if(primary) Color.BLACK else Color.WHITE); isFocusable=true
        background=GradientDrawable().apply {
            setColor(if(primary) Color.WHITE else 0xD034343B.toInt()); cornerRadius=dp(10).toFloat()
        }
        setOnClickListener { click() }
        setOnFocusChangeListener { v, focused ->
            background=GradientDrawable().apply {
                setColor(if(focused) VelarisDesign.color("focus",0xFF7E57FF.toInt()) else if(primary) Color.WHITE else 0x99282830.toInt())
                cornerRadius=dp(8).toFloat()
            }
            setTextColor(if(focused || !primary) Color.WHITE else Color.BLACK)
            v.animate().scaleX(if(focused)1.05f else 1f).scaleY(if(focused)1.05f else 1f).setDuration(100).start()
        }
    }

    private fun button(label:String, click:()->Unit)=Button(this).apply {
        text=label; contentDescription=label; isAllCaps=false; textSize=17f; setTextColor(Color.WHITE); isFocusable=true; minHeight=dp(48)
        backgroundTintList=android.content.res.ColorStateList.valueOf(Color.rgb(83,50,205)); setOnClickListener{click()}
    }
    private fun params(w:Int,h:Int,top:Int)=LinearLayout.LayoutParams(if(w<0)w else dp(w),if(h<0)h else dp(h)).apply{topMargin=dp(top)}
    private fun normalize(raw:String):String? { var v=raw.trim();if(v.isBlank())return null;if(!v.contains("://"))v="http://$v";val u=runCatching{Uri.parse(v)}.getOrNull()?:return null;return if(u.host.isNullOrBlank() || (u.scheme!="http" && u.scheme!="https"))null else v.trimEnd('/') }
    private fun toast(s:String)=Toast.makeText(this,s,Toast.LENGTH_LONG).show()
    private fun dp(v:Int)=(v*resources.displayMetrics.density).toInt()
    private fun immersive() {
        // Some Android/Google TV firmware exposes WindowInsetsController only after
        // the decor view has been attached. Defer immersive mode until then so
        // startup never depends on an unavailable DecorView.
        window.decorView.post {
            if (isFinishing || isDestroyed) return@post
            if (Build.VERSION.SDK_INT >= 30) {
                window.decorView.windowInsetsController?.apply {
                    hide(WindowInsets.Type.systemBars())
                    systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = 5894
            }
        }
    }
}
