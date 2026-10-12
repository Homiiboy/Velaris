package com.novarion.velaristv

import android.app.Activity
import android.app.AlertDialog
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
    // Every card requesting the same artwork must be updated when one fetch finishes.
    private val pendingImages = mutableMapOf<String,MutableList<ImageView>>()
    private var server = ""
    private var token = ""
    private var userId = ""
    private var homeRoot: LinearLayout? = null
    private var activeSection = "Start"
    private var activeCollectionId = ""
    private var searchMode = "Alle"
    private var editProfilesMode = false
    private var restoreMediaFocusId = ""
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
            try { action() } finally { suppressHistory=false }
        } else if(activeSection!="Start") {
            showHome()
        } else {
            // A new settings page must not accumulate recursive Back actions.
            showSettingsDialog()
        }
    }

    private fun rememberBack(action:()->Unit) {
        if(!suppressHistory) {
            // Bound the history retained through extensive D-pad navigation.
            if(backStack.size>=40)backStack.removeFirst()
            backStack.addLast(action)
        }
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
        // Two equally sized actions in one row: consistent with the TV login card.
        // Reserve enough space for a visible D-pad focus ring on both buttons.
        val actions=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL
            gravity=Gravity.CENTER_VERTICAL
            clipChildren=false
            clipToPadding=false
        }
        val signInButton=button("Anmelden") { login(user.text.toString(), pass.text.toString()) }.apply {
            id=View.generateViewId()
        }
        val backButton=actionButton("Zurück",false) { clearConnection(); showServer() }.apply {
            id=View.generateViewId()
        }
        actions.addView(signInButton,LinearLayout.LayoutParams(0,dp(64),1f).apply {
            marginEnd=dp(10)
        })
        actions.addView(backButton,LinearLayout.LayoutParams(0,dp(64),1f).apply {
            marginStart=dp(10)
        })
        root.addView(actions,params(600,64,18))
        signInButton.nextFocusRightId=backButton.id
        backButton.nextFocusLeftId=signInButton.id
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

    /** One navigation strip on every media screen; profile/settings only on Start. */
    private fun appHeader(home:Boolean):View {
        val top=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL; gravity=Gravity.CENTER_VERTICAL
            setPadding(dp(48),dp(16),dp(48),dp(8))
            // Keep the scrolling navigation strictly inside its own viewport.
            clipChildren=true;clipToPadding=true
            background=GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0xE608080D.toInt(),0x9908080D.toInt(),0x0008080D)
            )
        }
        top.addView(TextView(this).apply {
            text="VELARIS"; textSize=26f; typeface=Typeface.DEFAULT_BOLD
            letterSpacing=0.12f
            setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
            gravity=Gravity.CENTER_VERTICAL
            post {
                val width=paint.measureText(text.toString())
                paint.shader=android.graphics.LinearGradient(0f,0f,width,0f,
                    intArrayOf(Color.WHITE,VelarisDesign.color("accent",0xFF7C5CFC.toInt()),Color.WHITE),null,
                    android.graphics.Shader.TileMode.CLAMP)
                invalidate()
            }
        },LinearLayout.LayoutParams(dp(152),dp(50)).apply{marginEnd=dp(18)})
        // Keep all destinations reachable with the D-pad, even on smaller/overscanned TVs.
        val nav=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
            clipChildren=true;clipToPadding=true
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
            button.isSelected=(label==activeSection)
            styleNavButton(button,false)
            // Measure the real text rather than forcing category names into fixed boxes.
            val width=(((button.paint.measureText(label)/resources.displayMetrics.density).toInt()+36).coerceAtLeast(76))
            nav.addView(button,LinearLayout.LayoutParams(dp(width),dp(42)).apply{marginEnd=dp(14)})
        }
        // Reserve real space after the last tab so its pill and focus outline
        // are completely visible at the scroll limit (also on overscanned TVs).
        nav.addView(View(this).apply{isFocusable=false},
            LinearLayout.LayoutParams(dp(30),dp(1)))
        val navScroll=HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled=false
            isFillViewport=false
            isFocusable=false
            clipChildren=true;clipToPadding=true
            overScrollMode=View.OVER_SCROLL_NEVER
            setPadding(dp(12),0,dp(24),0)
            addView(nav,FrameLayout.LayoutParams(-2,-1))
        }
        // Arrow has its own reserved slot: text never disappears below a gradient
        // overlay or a partially drawn button.
        val navBox=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
            clipChildren=true;clipToPadding=true
        }
        navBox.addView(navScroll,LinearLayout.LayoutParams(0,dp(48),1f))
        // Draw the chevron geometrically rather than as a font glyph.
        // Text glyph baselines vary by Google TV font and visually shift the arrow.
        val moreArrow=object:View(this) {
            private val stroke=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                color=Color.WHITE
                style=android.graphics.Paint.Style.STROKE
                strokeWidth=dp(3).toFloat()
                strokeCap=android.graphics.Paint.Cap.ROUND
                strokeJoin=android.graphics.Paint.Join.ROUND
            }
            override fun onDraw(canvas:android.graphics.Canvas) {
                super.onDraw(canvas)
                val x=width/2f
                val y=height/2f
                val halfWidth=dp(4).toFloat()
                val halfHeight=dp(6).toFloat()
                val chevron=android.graphics.Path().apply {
                    moveTo(x-halfWidth,y-halfHeight)
                    lineTo(x+halfWidth,y)
                    lineTo(x-halfWidth,y+halfHeight)
                }
                canvas.drawPath(chevron,stroke)
            }
        }.apply {
            contentDescription="Weitere Kategorien nach rechts"
            isFocusable=true;isClickable=true
            background=GradientDrawable().apply {
                setColor(0xFF22212E.toInt())
                cornerRadius=dp(21).toFloat()
                setStroke(dp(1),0x665D547A)
            }
            setOnFocusChangeListener { _,focused->
                background=GradientDrawable().apply {
                    setColor(if(focused)VelarisDesign.color("accent",0xFF7C5CFC.toInt()) else 0xFF22212E.toInt())
                    cornerRadius=dp(21).toFloat()
                    if(focused)setStroke(dp(2),Color.WHITE)
                }
            }
            setOnClickListener {
                // Snap forward to show the NEXT whole chip instead of stopping
                // with half of the final category cut off.
                val visibleRight=navScroll.scrollX+navScroll.width-navScroll.paddingRight-dp(10)
                val next=(0 until nav.childCount)
                    .map { nav.getChildAt(it) }
                    .firstOrNull { it is Button && it.right>visibleRight }
                val maxX=(nav.width+navScroll.paddingLeft+navScroll.paddingRight-navScroll.width)
                    .coerceAtLeast(0)
                val nextX=next?.let {
                    (it.right+navScroll.paddingRight+dp(18)-navScroll.width)
                        .coerceIn(0,maxX)
                } ?: maxX
                navScroll.smoothScrollTo(nextX,0)
            }
        }
        navBox.addView(moreArrow,LinearLayout.LayoutParams(dp(40),dp(40)).apply{
            marginStart=dp(6);marginEnd=dp(7)
        })
        val updateArrow={
            val hasMore=navScroll.canScrollHorizontally(1)
            moreArrow.visibility=if(hasMore)View.VISIBLE else View.INVISIBLE
            moreArrow.isFocusable=hasMore
        }
        navScroll.setOnScrollChangeListener { _,_,_,_,_->updateArrow() }
        navScroll.post { updateArrow() }
        top.addView(navBox,LinearLayout.LayoutParams(0,dp(54),1f))
        top.addView(navButton("⌕"){showSearch()},LinearLayout.LayoutParams(dp(54),dp(46)).apply{marginEnd=dp(4)})
        if(home) {
            top.addView(navButton("Profil"){showProfiles()},LinearLayout.LayoutParams(dp(78),dp(46)).apply{marginEnd=dp(4)})
            top.addView(navButton("⚙"){showSettingsDialog()},LinearLayout.LayoutParams(dp(54),dp(46)))
        }
        return top
    }

    private fun showAppPage(page:View) {
        val frame=FrameLayout(this).apply{
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
        }
        frame.addView(page,FrameLayout.LayoutParams(-1,-1).apply{topMargin=dp(82)})
        frame.addView(appHeader(false),FrameLayout.LayoutParams(-1,dp(82),Gravity.TOP))
        setContentView(frame)
        // Small, non-blocking reveal for navigating between media sections.
        // The header remains fixed and responds immediately to the remote.
        page.alpha=0.88f
        page.animate().alpha(1f).setDuration(170).start()
    }

    /** A single pulsing placeholder scene with automatically cancelled animation. */
    private fun premiumLoadingScene(home:Boolean=false):LinearLayout {
        val shell=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(if(home)dp(52)else 0,dp(18),dp(48),dp(34))
            isFocusable=false
            importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        fun bar(w:Int,h:Int):View=View(this).apply {
            isFocusable=false
            background=GradientDrawable().apply {
                setColor(0xFF292633.toInt());cornerRadius=dp(10).toFloat()
            }
            layoutParams=LinearLayout.LayoutParams(if(w<0)w else dp(w),dp(h))
        }
        shell.addView(bar(if(home)-1 else 370,if(home)330 else 30))
        shell.addView(bar(230,15),LinearLayout.LayoutParams(dp(230),dp(15)).apply{
            topMargin=dp(20)
        })
        val row=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL}
        repeat(5){
            row.addView(bar(140,203),LinearLayout.LayoutParams(dp(140),dp(203)).apply{
                marginEnd=dp(18)
            })
        }
        shell.addView(row,LinearLayout.LayoutParams(-1,dp(203)).apply{topMargin=dp(25)})
        val pulse=android.animation.ValueAnimator.ofFloat(0.55f,0.95f).apply {
            duration=850
            repeatCount=android.animation.ValueAnimator.INFINITE
            repeatMode=android.animation.ValueAnimator.REVERSE
            addUpdateListener{shell.alpha=it.animatedValue as Float}
        }
        shell.addOnAttachStateChangeListener(object:View.OnAttachStateChangeListener {
            override fun onViewAttachedToWindow(v:View){pulse.start()}
            override fun onViewDetachedFromWindow(v:View){pulse.cancel()}
        })
        return shell
    }

    private fun showHome() {
        activeSection="Start";activeCollectionId=""
        if(!suppressHistory) backStack.clear()

        val content = LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            setPadding(0,0,0,dp(30))
            clipToPadding=false
        }
        homeRoot=content
        content.addView(premiumLoadingScene(home=true),LinearLayout.LayoutParams(-1,-2))
        val scroll=ScrollView(this).apply {
            isVerticalScrollBarEnabled=false
            clipChildren=false;clipToPadding=false
            descendantFocusability=android.view.ViewGroup.FOCUS_AFTER_DESCENDANTS
            addView(content)
        }
        val screen=FrameLayout(this).apply { setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        screen.addView(scroll,FrameLayout.LayoutParams(-1,-1))

        screen.addView(appHeader(true),FrameLayout.LayoutParams(-1,dp(82),Gravity.TOP))
        setContentView(screen)
        loadHome()
    }

    private fun playRandomMovie() {
        io.execute {
            try {
                val movies=items("/Users/$userId/Items?Recursive=true&IncludeItemTypes=Movie&Filters=IsNotFolder&Limit=200&SortBy=Random&EnableUserData=true")
                val selected=movies.randomOrNull()
                runOnUiThread {
                    if(selected!=null) playNative(selected.optString("Id"),0L)
                    else toast("Keine Filme für die Zufallswiedergabe gefunden.")
                }
            } catch (_: Exception) {
                runOnUiThread { toast("Zufälliger Film konnte nicht geladen werden.") }
            }
        }
    }

    private fun loadHome() {
        val requestRoot=homeRoot?:return
        io.execute {
            try {
                fun async(path:String)=java.util.concurrent.CompletableFuture.supplyAsync({ items(path) },io)
                val resumeF=async("/Users/$userId/Items/Resume?Limit=12&Fields=PrimaryImageAspectRatio,Overview,RunTimeTicks&MediaTypes=Video")
                val latestF=async("/Users/$userId/Items/Latest?Limit=18&Fields=PrimaryImageAspectRatio,Overview,PremiereDate&IncludeItemTypes=Movie,Series")
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
                    if(destroyed || homeRoot!==requestRoot || !requestRoot.isAttachedToWindow)
                        return@runOnUiThread
                    requestRoot.animate().cancel()
                    requestRoot.alpha=0f
                    requestRoot.removeAllViews()
                    addHeroCarousel((latest+recommended).distinctBy{it.optString("Id")}.take(5))
                    val randomButton=actionButton("🎲  Zufälliger Film",false){playRandomMovie()}
                    requestRoot.addView(randomButton,LinearLayout.LayoutParams(dp(255),dp(54)).apply {
                        leftMargin=dp(52);topMargin=dp(7);bottomMargin=dp(12)
                    })
                    val unwatched=latest.filter{it.optJSONObject("UserData")?.optBoolean("Played",false)!=true}
                    val popular=(latest+recommended).distinctBy{it.optString("Id")}
                        .filter{it.optDouble("CommunityRating",0.0)>0}
                        .sortedByDescending{it.optDouble("CommunityRating",0.0)}
                    val hiddenGems=latest.filter {
                        it.optJSONObject("UserData")?.optBoolean("Played",false)!=true &&
                            it.optDouble("CommunityRating",0.0)>=7.0
                    }
                    val shortFilms=latest.filter {
                        it.optString("Type")=="Movie" &&
                            it.optLong("RunTimeTicks",0L) in 1..60_000_000_000L
                    }
                    val upcoming=latest.filter {
                        val date=it.optString("PremiereDate").take(10)
                        date.length==10 && date>java.time.LocalDate.now().toString()
                    }
                    val rowData=mapOf(
                        "topTen" to topTen,"resume" to resume,"favorites" to favorites,
                        "because" to because,"latest" to latest,"recommended" to recommended,
                        "movieNight" to recommended.filter{it.optString("Type")=="Movie"},
                        "unwatched" to unwatched,"upcoming" to upcoming,
                        "popular" to popular,"hiddenGems" to hiddenGems,
                        "short" to shortFilms,"action" to action,"comedy" to comedy,
                        "scifi" to sciFi,"replay" to replay
                    )
                    val hiddenRows=prefs.getStringSet("hidden_home_rows_$userId",emptySet<String>()).orEmpty()
                    savedHomeOrder().filterNot{it in hiddenRows}.forEach { key ->
                        val data=rowData[key].orEmpty()
                        if(data.isNotEmpty() && !(key=="because" && becauseTitle.isBlank())) {
                            val title=if(key=="because")"Weil du „$becauseTitle“ gesehen hast"
                                else homeRowKeys().firstOrNull{it.first==key}?.second ?:key
                            when(key) {
                                "topTen" -> addRankedRow(title,data)
                                "resume" -> addContinueRow(data)
                                else -> addRow(title,data)
                            }
                        }
                    }
                    requestRoot.animate().alpha(1f).setDuration(280).start()
                    val focusId=restoreMediaFocusId
                    if(focusId.isNotBlank()) {
                        restoreMediaFocusId=""
                        requestRoot.post {
                            if(requestRoot.isAttachedToWindow) {
                                requestRoot.findViewWithTag<View>("velaris_media_$focusId")?.requestFocus()
                            }
                        }
                    }
                }
            } catch(e:Exception) { runOnUiThread {
                if(destroyed || homeRoot!==requestRoot || !requestRoot.isAttachedToWindow)
                    return@runOnUiThread
                requestRoot.animate().cancel()
                requestRoot.alpha=1f
                requestRoot.removeAllViews()
                requestRoot.addView(TextView(this).apply {
                    text="Velaris konnte den Server gerade nicht erreichen."
                    textSize=22f;typeface=Typeface.DEFAULT_BOLD
                    setTextColor(Color.WHITE);setPadding(dp(52),dp(72),dp(52),dp(18))
                })
                requestRoot.addView(TextView(this).apply{
                    text="Prüfe deine Jellyfin-Verbindung und versuche es erneut."
                    textSize=17f;setTextColor(0xFFB9B9C3.toInt())
                    setPadding(dp(52),0,dp(52),dp(18))
                })
                requestRoot.addView(button("Erneut versuchen"){
                    requestRoot.removeAllViews()
                    requestRoot.addView(premiumLoadingScene(home=true))
                    loadHome()
                },LinearLayout.LayoutParams(dp(250),dp(54)).apply{leftMargin=dp(52)})
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
        val holder=FrameLayout(this).apply {
            // Crossfade both layers instead of fading the whole hero to black.
            clipChildren=false
            clipToPadding=false
        }
        val wrapper=FrameLayout(this).apply { clipChildren=false;clipToPadding=false }
        wrapper.addView(holder,FrameLayout.LayoutParams(-1,-1))
        homeRoot?.addView(wrapper,LinearLayout.LayoutParams(-1,dp(525)).apply{bottomMargin=dp(-12)})
        val indicators=mutableListOf<View>()
        var currentIndex=-1
        fun render(index:Int) {
            if(destroyed || items.isEmpty() || index==currentIndex) return
            val previous=homeRoot
            val temp=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL}
            homeRoot=temp
            try { addHero(items[index % items.size]) } finally { homeRoot=previous }
            if(temp.childCount==0) return
            val hero=temp.getChildAt(0)
            temp.removeView(hero)
            holder.animate().cancel()
            // Remove stale layers if a previous transition was interrupted.
            while(holder.childCount>1) holder.removeViewAt(0)
            val oldHero=if(holder.childCount>0)holder.getChildAt(0) else null
            val shouldAnimate=oldHero!=null && prefs.getBoolean("ui_animations",true) &&
                android.animation.ValueAnimator.areAnimatorsEnabled()
            hero.alpha=if(shouldAnimate)0f else 1f
            holder.addView(hero,FrameLayout.LayoutParams(-1,-1))
            currentIndex=index
            indicators.forEachIndexed { dotIndex,dot ->
                dot.background=GradientDrawable().apply {
                    setColor(if(dotIndex==currentIndex)VelarisDesign.color("accent",0xFF7C5CFC.toInt())
                        else 0x99FFFFFF.toInt())
                    cornerRadius=dp(5).toFloat()
                }
                dot.alpha=if(dotIndex==currentIndex)1f else 0.65f
            }
            if(shouldAnimate) {
                hero.animate().alpha(1f).setDuration(550).withEndAction {
                    if(oldHero?.parent===holder)holder.removeView(oldHero)
                }.start()
            } else if(oldHero?.parent===holder) holder.removeView(oldHero)
        }
        render(0)
        if(items.size>1) {
            val pagination=LinearLayout(this).apply {
                orientation=LinearLayout.HORIZONTAL
                gravity=Gravity.CENTER_VERTICAL
                clipChildren=false;clipToPadding=false
            }
            items.forEachIndexed { index,_ ->
                val dot=View(this).apply {
                    isFocusable=true
                    isClickable=true
                    contentDescription="Highlight ${index+1} von ${items.size}"
                    background=GradientDrawable().apply {
                        setColor(if(index==0)VelarisDesign.color("accent",0xFF7C5CFC.toInt())
                            else 0x99FFFFFF.toInt())
                        cornerRadius=dp(5).toFloat()
                    }
                    setOnFocusChangeListener { view,focused->
                        view.animate().scaleX(if(focused)1.25f else 1f)
                            .scaleY(if(focused)1.25f else 1f).setDuration(110).start()
                    }
                    setOnClickListener { render(index) }
                }
                indicators.add(dot)
                pagination.addView(dot,LinearLayout.LayoutParams(dp(22),dp(8)).apply {
                    marginStart=dp(10)
                })
            }
            wrapper.addView(pagination,FrameLayout.LayoutParams(-2,dp(35),Gravity.END or Gravity.BOTTOM).apply {
                marginEnd=dp(62);bottomMargin=dp(32)
            })
        }
        if(items.size>1 && prefs.getBoolean("auto_hero",true)) holder.postDelayed(object:Runnable {
            var index=1
            override fun run() {
                if(wrapper.isAttachedToWindow && !wrapper.hasFocus()) {
                    render(index)
                    index=(index+1)%items.size
                }
                if(holder.isAttachedToWindow) holder.postDelayed(this,9000)
            }
        },9000)
    }

    /** Identical cinematic shading for home, movie and series backdrops. */
    private fun addCinematicHeroShades(hero:FrameLayout) {
        hero.addView(View(this).apply {
            isFocusable=false
            background=GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                intArrayOf(0xF708080D.toInt(),0xD208080D.toInt(),0x7408080D,0x1008080D))
        },FrameLayout.LayoutParams(-1,-1))
        hero.addView(View(this).apply {
            isFocusable=false
            background=GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0x0008080D,0x1908080D,0xEB08080D.toInt()))
        },FrameLayout.LayoutParams(-1,dp(260),Gravity.BOTTOM))
    }

    private fun heroEyebrow(label:String)=TextView(this).apply {
        text=label;maxLines=1
        textSize=13f;letterSpacing=0.15f
        typeface=Typeface.DEFAULT_BOLD
        setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
        setPadding(0,0,0,dp(10))
    }

    private fun heroMediaMeta(item:JSONObject):String {
        val year=item.optInt("ProductionYear",0)
        val rating=item.optDouble("CommunityRating",0.0)
        val runtime=item.optLong("RunTimeTicks",0L)/600_000_000L
        val type=when(item.optString("Type")) {
            "Series"->"Serie";"Episode"->"Episode";"Movie"->"Film";else->"Titel"
        }
        return listOfNotNull(
            year.takeIf{it>0}?.toString(),type,
            runtime.takeIf{it>0 && item.optString("Type")!="Series"}?.let{"$it Min."},
            rating.takeIf{it>0}?.let{"★ %.1f".format(it)}
        ).joinToString("   ·   ")
    }

    private fun heroGenres(item:JSONObject):String {
        val genres=item.optJSONArray("Genres")?:return ""
        return (0 until minOf(3,genres.length()))
            .mapNotNull{genres.optString(it).takeIf(String::isNotBlank)}
            .joinToString("   ·   ")
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

        addCinematicHeroShades(hero)

        val info=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            gravity=Gravity.BOTTOM
            setPadding(dp(64),0,dp(58),dp(50))
        }
        info.addView(heroEyebrow(VelarisDesign.themeText("heroLabel","IM RAMPENLICHT")))
        val logo=ImageView(this).apply{scaleType=ImageView.ScaleType.FIT_START;visibility=View.INVISIBLE}
        info.addView(logo,LinearLayout.LayoutParams(dp(430),dp(120)))
        loadImageWithFallback(logo,id,"Logo",700) {
            logo.visibility=View.GONE
            info.addView(TextView(this).apply { text=title; textSize=48f; setTextColor(Color.WHITE); typeface=Typeface.DEFAULT_BOLD;maxLines=2 },1)
        }
        val meta=heroMediaMeta(item)
        if(meta.isNotBlank())info.addView(TextView(this).apply {
            text=meta;textSize=16f;setTextColor(0xFFEBE9F3.toInt())
            setPadding(0,dp(10),0,0)
        })
        val genres=heroGenres(item)
        if(genres.isNotBlank())info.addView(TextView(this).apply{
            text=genres;textSize=14f;maxLines=1
            setTextColor(0xFFC5BFDB.toInt());setPadding(0,dp(7),0,0)
        },LinearLayout.LayoutParams(dp(650),-2))
        watchedLabel(item)?.let { label ->
            info.addView(TextView(this).apply {
                text=label;setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                textSize=15f;typeface=Typeface.DEFAULT_BOLD;setPadding(0,dp(8),0,0)
            })
        }
        if(overview.isNotBlank()) info.addView(TextView(this).apply {
            text=overview;textSize=16f;setTextColor(0xFFE6E3ED.toInt())
            maxLines=3;setLineSpacing(dp(2).toFloat(),1.06f)
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

    private fun playbackPercent(item:JSONObject):Int {
        val user=item.optJSONObject("UserData")?:return 0
        if(user.optBoolean("Played",false))return 100
        val ticks=user.optLong("PlaybackPositionTicks",0L).coerceAtLeast(0L)
        val duration=item.optLong("RunTimeTicks",0L)
        val measured=if(duration>0)ticks.toDouble()/duration*100.0 else 0.0
        val reported=user.optDouble("PlayedPercentage",0.0).takeIf{it.isFinite()}?:0.0
        return maxOf(measured,reported).coerceIn(0.0,100.0).toInt()
    }

    private fun hasResumeProgress(item:JSONObject):Boolean {
        val pct=playbackPercent(item)
        return item.optJSONObject("UserData")?.optBoolean("Played",false)!=true &&
            pct in 1..99
    }

    private fun remainingMinutes(item:JSONObject):Long? {
        if(!hasResumeProgress(item))return null
        val duration=item.optLong("RunTimeTicks",0L)
        if(duration<=0L)return null
        val position=item.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L)?:0L
        val fraction=maxOf(position.toDouble()/duration,playbackPercent(item)/100.0)
            .coerceIn(0.0,1.0)
        val remaining=kotlin.math.ceil(duration.toDouble()*(1-fraction)/600_000_000.0).toLong()
        return remaining.takeIf{it>0L}
    }

    private fun statusBadge(item:JSONObject):Pair<String,Boolean>? {
        val played=watchedLabel(item)
        if(played!=null)return played to true
        return if(hasResumeProgress(item))"FORTSETZEN" to false else null
    }

    private fun watchedPoster(item:JSONObject,w:Int,h:Int,imageType:String,requestedWidth:Int,landscape:Boolean=false):FrameLayout {
        val frame=FrameLayout(this).apply {
            background=GradientDrawable().apply{
                setColor(VelarisDesign.color("surface",0xFF15151B.toInt()))
                cornerRadius=dp(9).toFloat()
            }
            clipToOutline=true
        }
        val poster=ImageView(this).apply{
            // Only cinematic 16:9 previews crop; vertical posters stay complete.
            scaleType=if(landscape)ImageView.ScaleType.CENTER_CROP else ImageView.ScaleType.FIT_CENTER
            setBackgroundColor(VelarisDesign.color("surface",0xFF15151B.toInt()))
        }
        frame.addView(poster,FrameLayout.LayoutParams(-1,-1))
        loadImage(poster,item.optString("Id"),imageType,requestedWidth)
        // A focused card reveals a small metadata ribbon inside the artwork.
        // Keeping the ribbon INSIDE the poster avoids resizing or cutting edges.
        val year=item.optInt("ProductionYear",0)
        val kind=when(item.optString("Type")) {
            "Series" -> "SERIE"
            "Episode" -> "EPISODE"
            "BoxSet" -> "SAMMLUNG"
            else -> "FILM"
        }
        val focusInfo=listOfNotNull(kind,year.takeIf{it>0}?.toString()).joinToString("  ·  ")
        val focusCaption=TextView(this).apply {
            tag="velaris_poster_focus_caption"
            text=focusInfo
            textSize=12f
            typeface=Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            setPadding(dp(12),dp(9),dp(12),dp(10))
            background=GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(0x10101017,0xEE101017.toInt())
            )
            isFocusable=false
            alpha=0f
            visibility=View.GONE
        }
        frame.addView(focusCaption,FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM))
        statusBadge(item)?.let{(label,watched)->
            frame.addView(TextView(this).apply{
                text=label;setTextColor(if(watched)0xFF80ECA3.toInt() else 0xFFE6DEFF.toInt())
                textSize=11f;typeface=Typeface.DEFAULT_BOLD;gravity=Gravity.CENTER
                setPadding(dp(9),dp(5),dp(9),dp(5))
                background=GradientDrawable().apply{
                    setColor(if(watched)0xEE172A22.toInt() else 0xEE231846.toInt())
                    cornerRadius=dp(6).toFloat()
                    setStroke(dp(1),if(watched)
                        VelarisDesign.color("success",0xFF46D369.toInt())
                        else 0xFFB49DFF.toInt())
                }
            },FrameLayout.LayoutParams(-2,-2,Gravity.TOP or Gravity.RIGHT).apply{
                setMargins(dp(6),dp(7),dp(7),0)
            })
        }
        return frame
    }

    // Draw the play triangle with its visual center on the circle's center.
    // Android font glyphs (▶) have asymmetric side bearings on different TVs.
    private fun playCircle(diameter:Int=46):View = object:View(this) {
        private val paint=android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color=Color.WHITE
            style=android.graphics.Paint.Style.FILL
        }
        override fun onDraw(canvas:android.graphics.Canvas) {
            super.onDraw(canvas)
            val x=width/2f
            val y=height/2f
            val halfHeight=dp(9).toFloat()*diameter/46f
            val leftOffset=dp(5).toFloat()*diameter/46f
            val rightOffset=leftOffset*2f
            val triangle=android.graphics.Path().apply {
                moveTo(x-leftOffset,y-halfHeight)
                lineTo(x+rightOffset,y)
                lineTo(x-leftOffset,y+halfHeight)
                close()
            }
            canvas.drawPath(triangle,paint)
        }
    }.apply {
        contentDescription="Abspielen"
        importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
        background=GradientDrawable().apply {
            setColor(0xAA101016.toInt())
            cornerRadius=dp(diameter/2).toFloat()
            setStroke(dp(2),0xFFF4F0FF.toInt())
        }
    }

    private fun addContinueRow(data:List<JSONObject>) {
        val hidden=prefs.getStringSet("hidden_resume_$userId",emptySet<String>()).orEmpty()
        val visible=data.filter { !hidden.contains(it.optString("Id")) }
        if(visible.isEmpty())return
        homeRoot?.addView(sectionTitle(VelarisDesign.homeRow("resume","Weiterschauen")))
        val row=LinearLayout(this).apply{
            orientation=LinearLayout.HORIZONTAL
            setPadding(dp(52),dp(12),dp(48),dp(34))
            clipChildren=false;clipToPadding=false
        }
        visible.forEach{item->
            val id=item.optString("Id")
            if(id.isBlank())return@forEach
            val progressTicks=item.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L)?:0L
            val total=item.optLong("RunTimeTicks",0L)
            val percent=playbackPercent(item)
            val remaining=remainingMinutes(item)
            val thumb=FrameLayout(this).apply{
                background=GradientDrawable().apply{
                    setColor(VelarisDesign.color("surface",0xFF15151B.toInt()))
                    cornerRadius=dp(10).toFloat()
                }
                clipToOutline=true
            }
            val imageType=if((item.optJSONArray("BackdropImageTags")?.length()?:0)>0)"Backdrop" else "Primary"
            val poster=ImageView(this).apply{
                scaleType=if(imageType=="Backdrop")ImageView.ScaleType.CENTER_CROP else ImageView.ScaleType.FIT_CENTER
                setBackgroundColor(VelarisDesign.color("surfaceAlt",0xFF202027.toInt()))
            }
            thumb.addView(poster,FrameLayout.LayoutParams(-1,-1))
            loadImage(poster,id,imageType,720)
            thumb.addView(playCircle().apply{tag="velaris_continue_play"},
                FrameLayout.LayoutParams(dp(46),dp(46),Gravity.CENTER))
            if(hasResumeProgress(item))thumb.addView(TextView(this).apply{
                text="FORTSETZEN";textSize=11f;typeface=Typeface.DEFAULT_BOLD
                setTextColor(0xFFE6DEFF.toInt())
                setPadding(dp(9),dp(6),dp(9),dp(6))
                background=GradientDrawable().apply{
                    setColor(0xEE231846.toInt());cornerRadius=dp(6).toFloat()
                    setStroke(dp(1),0xFFB49DFF.toInt())
                }
            },FrameLayout.LayoutParams(-2,-2,Gravity.TOP or Gravity.LEFT).apply{
                leftMargin=dp(10);topMargin=dp(10)
            })
            if(percent in 1..99)thumb.addView(
                ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply{
                    max=1000
                    progress=percent*10
                    progressTintList=android.content.res.ColorStateList.valueOf(
                        VelarisDesign.color("progress",0xFFE50914.toInt()))
                    progressBackgroundTintList=android.content.res.ColorStateList.valueOf(0xAA888888.toInt())
                },FrameLayout.LayoutParams(-1,dp(4),Gravity.BOTTOM)
            )
            val card=LinearLayout(this).apply {
                orientation=LinearLayout.VERTICAL;isFocusable=true;isClickable=true
                clipChildren=false;clipToPadding=false
                setPadding(dp(3),dp(3),dp(3),dp(3))
                setOnClickListener{playNative(id,progressTicks)}
                setOnLongClickListener {
                    AlertDialog.Builder(this@MainActivity)
                        .setTitle("Aus Weiterschauen ausblenden?")
                        .setMessage("Der Jellyfin-Fortschritt von \"${item.optString("Name")}\" bleibt gespeichert.")
                        .setNegativeButton("Abbrechen",null)
                        .setPositiveButton("Ausblenden"){_,_->
                            val old=prefs.getStringSet("hidden_resume_$userId",emptySet<String>()).orEmpty()
                            prefs.edit().putStringSet("hidden_resume_$userId",old+id).apply()
                            showHome()
                        }.show()
                    true
                }
                applyCardFocus(this,thumb)
            }
            card.addView(thumb,LinearLayout.LayoutParams(dp(310),dp(174)))
            card.addView(TextView(this).apply{
                text=if(item.optString("Type")=="Episode")episodeTitle(item) else item.optString("Name");textSize=16f;maxLines=1
                typeface=Typeface.DEFAULT_BOLD;setTextColor(Color.WHITE)
                setPadding(dp(4),dp(8),0,0)
            },LinearLayout.LayoutParams(dp(310),dp(34)))
            val episode=item.optInt("IndexNumber",0)
            val season=item.optInt("ParentIndexNumber",0)
            val series=if(item.optString("Type")=="Episode")
                item.optString("SeriesName").takeIf(String::isNotBlank) else null
            val episodeCode=if(episode>0)"S$season:E$episode" else null
            val description=listOfNotNull(series,episodeCode).joinToString("   ·   ")
            if(description.isNotBlank())card.addView(TextView(this).apply{
                text=description;textSize=13f;maxLines=1;setTextColor(0xFFD5D0E3.toInt())
                setPadding(dp(4),0,0,0)
            },LinearLayout.LayoutParams(dp(310),dp(26)))
            if(remaining!=null)card.addView(TextView(this).apply{
                text="Noch $remaining Min.";textSize=13f
                typeface=Typeface.DEFAULT_BOLD;setTextColor(VelarisDesign.color("focus",0xFFDCCFFF.toInt()))
                setPadding(dp(4),0,0,0)
            },LinearLayout.LayoutParams(dp(310),dp(25)))
            row.addView(card,LinearLayout.LayoutParams(dp(326),dp(280)).apply{
                marginEnd=dp(16)
            })
        }
        homeRoot?.addView(HorizontalScrollView(this).apply{
            isHorizontalScrollBarEnabled=false
            clipChildren=false;clipToPadding=false
            addView(row)
        },LinearLayout.LayoutParams(-1,dp(343)))
    }

    private fun homeRowKeys():List<Pair<String,String>> = listOf(
        "topTen" to "Top 10 für dich", "resume" to "Weiterschauen",
        "favorites" to "Meine Liste", "because" to "Weil du … gesehen hast",
        "latest" to "Kürzlich hinzugefügt", "recommended" to "Für dich",
        "movieNight" to "Für deinen Filmabend", "unwatched" to "Noch nicht angesehen",
        "upcoming" to "Demnächst", "popular" to "Heute beliebt",
        "hiddenGems" to "Verborgene Schätze", "short" to "Kurz und spannend",
        "action" to "Action", "comedy" to "Komödien",
        "scifi" to "Science-Fiction", "replay" to "Noch einmal ansehen"
    )

    private fun savedHomeOrder():List<String> {
        val available=homeRowKeys().map { it.first }
        val saved=prefs.getString("home_row_order_$userId","").orEmpty()
            .split(",").filter { it in available }.distinct()
        return saved+available.filterNot { it in saved }
    }

    private fun showHomeRowSettings() {
        rememberBack { showSettingsDialog() }
        val root=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(dp(52),dp(30),dp(52),dp(65))
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
        }
        root.addView(TextView(this).apply {
            text="Startseite anpassen";textSize=34f
            typeface=Typeface.DEFAULT_BOLD;setTextColor(Color.WHITE)
        },params(-1,-2,10))
        root.addView(TextView(this).apply {
            text="OK blendet eine Reihe ein oder aus. Mit den Pfeilen änderst du die Reihenfolge."
            textSize=16f;setTextColor(Color.LTGRAY)
        },params(-1,-2,20))
        val hidden=prefs.getStringSet("hidden_home_rows_$userId",emptySet<String>()).orEmpty()
        savedHomeOrder().forEachIndexed { index,key ->
            val title=homeRowKeys().firstOrNull{it.first==key}?.second ?:key
            val row=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL }
            val enabled=key !in hidden
            row.addView(settingsCard(if(enabled)"✓" else "○",title,if(enabled)"Sichtbar" else "Ausgeblendet") {
                val latest=prefs.getStringSet("hidden_home_rows_$userId",emptySet<String>()).orEmpty()
                prefs.edit().putStringSet("hidden_home_rows_$userId",
                    if(key in latest)latest-key else latest+key).apply()
                showHomeRowSettings()
            },LinearLayout.LayoutParams(0,dp(76),1f))
            fun reorder(direction:Int) {
                val order=savedHomeOrder().toMutableList()
                val old=order.indexOf(key);val new=old+direction
                if(old>=0&&new in order.indices) {
                    java.util.Collections.swap(order,old,new)
                    prefs.edit().putString("home_row_order_$userId",order.joinToString(",")).apply()
                }
                showHomeRowSettings()
            }
            row.addView(actionButton("↑",false){reorder(-1)},
                LinearLayout.LayoutParams(dp(65),dp(64)).apply { marginStart=dp(10) })
            row.addView(actionButton("↓",false){reorder(1)},
                LinearLayout.LayoutParams(dp(65),dp(64)).apply { marginStart=dp(8) })
            root.addView(row,LinearLayout.LayoutParams(-1,dp(83)).apply{bottomMargin=dp(6)})
        }
        root.addView(actionButton("Standard wiederherstellen",false) {
            prefs.edit().remove("home_row_order_$userId").remove("hidden_home_rows_$userId").apply()
            showHomeRowSettings()
        },params(320,56,16))
        root.addView(actionButton("Zurück",false){showSettingsDialog()},params(160,55,12))
        showAppPage(ScrollView(this).apply {
            isVerticalScrollBarEnabled=false
            addView(root)
        })
        root.post { (root.getChildAt(2) as? LinearLayout)?.getChildAt(0)?.requestFocus() }
    }

    private fun showPosterQuickActions(item:JSONObject) {
        val id=item.optString("Id")
        if(id.isBlank())return
        val title=item.optString("Name","Titel")
        val year=item.optInt("ProductionYear",0)
        val genres=item.optJSONArray("Genres")
        val primaryGenre=genres?.optString(0).orEmpty()
        val runtime=item.optLong("RunTimeTicks",0L)/600_000_000L
        val details=listOfNotNull(
            year.takeIf{it>0}?.toString(),
            runtime.takeIf{it>0}?.let{"$it Min."},
            primaryGenre.takeIf{it.isNotBlank()},
            item.optDouble("CommunityRating",0.0).takeIf{it>0}?.let{"★ %.1f".format(it)}
        ).joinToString(" · ")
        val favorite=item.optJSONObject("UserData")?.optBoolean("IsFavorite",false)==true
        val options=if(item.optString("Type")=="BoxSet") arrayOf("Details","Abbrechen")
            else arrayOf("▶ Abspielen","ⓘ Mehr Infos",if(favorite)"Aus Meine Liste entfernen" else "Zu Meine Liste","Abbrechen")
        android.app.AlertDialog.Builder(this)
            .setTitle(title)
            .setMessage(details.ifBlank{"Weitere Informationen anzeigen"})
            .setItems(options){ _,which ->
                if(item.optString("Type")=="BoxSet"){
                    if(which==0)showCollection(id)
                }else when(which){
                    0->playNative(id,item.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L)?:0L)
                    1->showDetails(id)
                    2->setFavorite(id,!favorite){showHome()}
                }
            }
            .setNegativeButton("Schließen",null)
            .show()
    }

    private fun addRankedRow(title:String,data:List<JSONObject>) {
        if(data.isEmpty()) return
        homeRoot?.addView(sectionTitle(title))
        val row=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; setPadding(dp(52),dp(12),dp(56),dp(44)); clipChildren=false; clipToPadding=false }
        data.take(10).forEachIndexed { index,item ->
            val cover=watchedPoster(item,160,234,"Primary",450)
            val wrap=FrameLayout(this).apply {
                isFocusable=true;isClickable=true
                clipChildren=false;clipToPadding=false
                setOnClickListener { openMediaItem(item) }
                setOnLongClickListener { showPosterQuickActions(item); true }
                applyCardFocus(this,cover)
                tag="velaris_media_${item.optString("Id")}"
            }
            wrap.addView(TextView(this).apply {
                text="${index+1}";textSize=104f
                includeFontPadding=false
                typeface=Typeface.create("sans-serif-black",Typeface.BOLD)
                setTextColor(0xFF11111B.toInt())
                setShadowLayer(dp(2).toFloat(),0f,0f,VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
                gravity=Gravity.BOTTOM or Gravity.LEFT
            },FrameLayout.LayoutParams(dp(128),dp(246),Gravity.BOTTOM or Gravity.LEFT))
            wrap.addView(cover,FrameLayout.LayoutParams(dp(160),dp(234),Gravity.TOP or Gravity.RIGHT))
            row.addView(wrap,LinearLayout.LayoutParams(dp(230),dp(252)).apply{marginEnd=dp(12)})
        }
        homeRoot?.addView(HorizontalScrollView(this).apply{
            isHorizontalScrollBarEnabled=false
            clipChildren=false;clipToPadding=false
            addView(row)
        },LinearLayout.LayoutParams(-1,dp(320)))
    }

    private fun sectionTitle(label:String)=TextView(this).apply {
        text=label; setTextColor(Color.WHITE); textSize=26f; typeface=Typeface.DEFAULT_BOLD
        setPadding(dp(52),dp(18),0,dp(12))
    }

    private fun applyCardFocus(v:View, poster:View?=null) {
        v.setOnFocusChangeListener { _,focused ->
            val target=poster ?: v
            val showPreview=prefs.getBoolean("ui_preview",true)
            if(poster is FrameLayout) {
                poster.foreground=if(focused)GradientDrawable().apply{
                    setColor(Color.TRANSPARENT)
                    cornerRadius=dp(10).toFloat()
                    setStroke(dp(2),VelarisDesign.color("focus",0xFFDCCFFF.toInt()))
                } else null
                val caption=poster.findViewWithTag<TextView>("velaris_poster_focus_caption")
                if(caption!=null) {
                    caption.animate().cancel()
                    if(focused && showPreview) {
                        caption.alpha=0f
                        caption.postDelayed({
                            if(v.hasFocus() && prefs.getBoolean("ui_preview",true)) {
                                caption.visibility=View.VISIBLE
                                caption.animate().alpha(1f).setDuration(150).start()
                            }
                        },450L)
                    } else {
                        caption.animate().alpha(0f).setDuration(115)
                            .withEndAction { if(!v.hasFocus())caption.visibility=View.GONE }
                            .start()
                    }
                }
                // Play bubble stays in the middle while changing only its tint.
                val bubble=poster.findViewWithTag<View>("velaris_continue_play")
                if(bubble!=null) {
                    bubble.background=GradientDrawable().apply{
                        setColor(if(focused)VelarisDesign.color("accent",0xFFD95B3E.toInt()) else 0xAA101016.toInt())
                        cornerRadius=dp(23).toFloat()
                        setStroke(dp(2),if(focused)VelarisDesign.color("focus",0xFFDCCFFF.toInt()) else Color.WHITE)
                    }
                }
            } else {
                v.background=GradientDrawable().apply {
                    setColor(if(focused)0x302E2E38 else Color.TRANSPARENT)
                    cornerRadius=dp(12).toFloat()
                    if(focused)setStroke(dp(2),VelarisDesign.color("focus",0xFFDCCFFF.toInt()))
                }
            }
            // A restrained 2% cinematic focus lift. Existing poster rows
            // provide safe-area padding and disable child clipping.
            target.animate().cancel()
            target.animate()
                .scaleX(if(focused)1.02f else 1f)
                .scaleY(if(focused)1.02f else 1f)
                .translationZ(if(focused)dp(10).toFloat() else 0f)
                .setDuration(if(prefs.getBoolean("ui_animations",true)) { if(focused)170 else 130 } else 0).start()
        }
    }

    private fun addRow(title: String, data: List<JSONObject>) {
        if(data.isEmpty()) return
        homeRoot?.addView(sectionTitle(title))
        val row=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL
            setPadding(dp(52),dp(12),dp(56),dp(34))
            clipChildren=false
            clipToPadding=false
        }
        data.forEach { item ->
            val id=item.optString("Id")
            val type=item.optString("Type")
            if(id.isBlank()) return@forEach
            val cover=watchedPoster(item,176,248,"Primary",420)
            val card=LinearLayout(this).apply {
                tag="velaris_media_$id"
                orientation=LinearLayout.VERTICAL; isFocusable=true; isClickable=true
                setPadding(dp(4),dp(4),dp(4),dp(4))
                setOnClickListener { openMediaItem(item) }
                applyCardFocus(this,cover)
            }
            card.addView(cover,LinearLayout.LayoutParams(dp(176),dp(248)))
            card.setOnLongClickListener { showPosterQuickActions(item); true }
            val percent=playbackPercent(item)
            if(percent in 1..99)card.addView(ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal).apply {
                max=1000;progress=percent*10
                progressTintList=android.content.res.ColorStateList.valueOf(
                    VelarisDesign.color("progress",0xFFE50914.toInt()))
                progressBackgroundTintList=android.content.res.ColorStateList.valueOf(
                    0xAA888888.toInt())
            },LinearLayout.LayoutParams(dp(176),dp(4)))
            row.addView(card,LinearLayout.LayoutParams(dp(188),dp(304)).apply { marginEnd=dp(12) })
        }
        homeRoot?.addView(HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled=false; clipChildren=false; clipToPadding=false
            addView(row)
        },LinearLayout.LayoutParams(-1,dp(354)))
    }


    private fun addLibraryGrid(data:List<JSONObject>) {
        if(data.isEmpty()) return
        val grid=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; clipChildren=false; clipToPadding=false; setPadding(dp(16),dp(20),dp(16),dp(42)) }
        // Respect the available TV viewport instead of forcing five posters
        // across devices that are narrower (or use larger accessibility scaling).
        val available=(resources.displayMetrics.widthPixels-dp(128)).coerceAtLeast(dp(228))
        val columns=(available/dp(228)).coerceIn(1,5)
        data.chunked(columns).forEach { items ->
            val row=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; gravity=Gravity.START; clipChildren=false; clipToPadding=false }
            items.forEach { item ->
                val id=item.optString("Id"); if(id.isBlank()) return@forEach
                val type=item.optString("Type")
                val cover=watchedPoster(item,196,276,"Primary",460)
                val card=LinearLayout(this).apply {
                    orientation=LinearLayout.VERTICAL; isFocusable=true; isClickable=true
                    clipChildren=false;clipToPadding=false
                    setOnClickListener { openMediaItem(item) }
                    applyCardFocus(this,cover)
                }
                card.addView(cover,LinearLayout.LayoutParams(dp(196),dp(276)))
                card.addView(TextView(this).apply { text=item.optString("Name"); textSize=15f; setTextColor(Color.WHITE); maxLines=1; setPadding(dp(4),dp(7),dp(4),0) },LinearLayout.LayoutParams(dp(196),dp(30)))
                row.addView(card,LinearLayout.LayoutParams(dp(212),dp(326)).apply { marginEnd=dp(16); bottomMargin=dp(18) })
            }
            grid.addView(row,LinearLayout.LayoutParams(-1,dp(344)))
        }
        homeRoot?.addView(grid,LinearLayout.LayoutParams(-1,-2))
    }

    private fun showMediaFolderLibrary(title:String, type:String) {
        activeSection=title;activeCollectionId=""
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text=title; textSize=32f; setTextColor(Color.WHITE); typeface=Typeface.DEFAULT_BOLD })
        root.addView(premiumLoadingScene(),LinearLayout.LayoutParams(-1,-2))
        showAppPage(ScrollView(this).apply { addView(root) })
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
        activeSection=title;activeCollectionId=""
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text=title; textSize=32f; setTextColor(Color.WHITE) })
        root.addView(premiumLoadingScene(),LinearLayout.LayoutParams(-1,-2))
        showAppPage(ScrollView(this).apply { addView(root) })
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

    private fun openMediaItem(item:JSONObject) {
        val id=item.optString("Id")
        if(id.isBlank())return
        restoreMediaFocusId=id
        when(item.optString("Type")) {
            "BoxSet" -> showCollection(id)
            "Series" -> showSeries(id)
            else -> showDetails(id)
        }
    }

    private fun showCollection(collectionId:String) {
        activeSection="Sammlungen";activeCollectionId=collectionId
        rememberBack { showLibrary("Sammlungen","BoxSet") }
        val root=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(dp(48),dp(34),dp(48),dp(55))
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            clipChildren=false;clipToPadding=false
        }
        root.addView(TextView(this).apply {
            text="Sammlung wird geladen …";textSize=26f;setTextColor(Color.WHITE)
        })
        val spinner=premiumLoadingScene()
        root.addView(spinner,LinearLayout.LayoutParams(-1,-2))
        showAppPage(ScrollView(this).apply{
            isVerticalScrollBarEnabled=false;clipChildren=false;clipToPadding=false
            addView(root)
        })
        io.execute {
            try {
                val collection=request("/Users/$userId/Items/$collectionId")
                // Jellyfin BoxSets expose their actual member movies as children.
                // Do not treat the BoxSet as a playable Movie.
                val children=items("/Users/$userId/Items?ParentId=$collectionId&Recursive=true&IncludeItemTypes=Movie,Series&SortBy=PremiereDate,SortName&SortOrder=Ascending&Limit=500&EnableUserData=true&Fields=Overview,PremiereDate,ProductionYear,PrimaryImageAspectRatio")
                runOnUiThread {
                    root.removeAllViews()
                    val collectionHero=FrameLayout(this).apply{
                        setBackgroundColor(VelarisDesign.color("surface",0xFF15151B.toInt()))
                    }
                    val backdrop=ImageView(this).apply{
                        scaleType=ImageView.ScaleType.CENTER_CROP
                    }
                    collectionHero.addView(backdrop,FrameLayout.LayoutParams(-1,-1))
                    loadImage(backdrop,collectionId,"Backdrop",1600)
                    addCinematicHeroShades(collectionHero)
                    val copy=LinearLayout(this).apply{
                        orientation=LinearLayout.VERTICAL
                        gravity=Gravity.BOTTOM
                        setPadding(dp(28),0,dp(34),dp(34))
                    }
                    copy.addView(heroEyebrow("VELARIS KOLLEKTION"))
                    copy.addView(TextView(this).apply{
                        text=collection.optString("Name","Sammlung")
                        textSize=40f;maxLines=2
                        typeface=Typeface.DEFAULT_BOLD;setTextColor(Color.WHITE)
                    })
                    val overview=collection.optString("Overview")
                    if(overview.isNotBlank())copy.addView(TextView(this).apply{
                        text=overview;setTextColor(0xFFE6E3ED.toInt());textSize=16f
                        maxLines=3;setPadding(0,dp(10),0,0)
                    })
                    copy.addView(TextView(this).apply{
                        text="${children.size} Titel · Nach Erscheinungsjahr"
                        textSize=15f;setTextColor(Color.LTGRAY)
                        setPadding(0,dp(10),0,0)
                    })
                    collectionHero.addView(copy,FrameLayout.LayoutParams(-1,-1))
                    root.addView(collectionHero,LinearLayout.LayoutParams(-1,dp(365)).apply{bottomMargin=dp(18)})
                    homeRoot=root
                    if(children.isEmpty())root.addView(TextView(this).apply {
                        text="Diese Sammlung enthält keine verfügbaren Filme oder Serien."
                        textSize=18f;setTextColor(Color.LTGRAY)
                    },params(-1,-2,28))
                    else addLibraryGrid(children)
                }
            } catch(e:Exception) {
                runOnUiThread {
                    root.removeView(spinner)
                    root.addView(TextView(this).apply{
                        text="Sammlung konnte nicht geladen werden: ${e.message ?: "Verbindungsfehler"}"
                        textSize=17f;setTextColor(Color.LTGRAY)
                    })
                }
            }
        }
    }

    private fun showLibrary(title:String, type:String) {
        activeSection=title;activeCollectionId=""
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text=title; textSize=32f; setTextColor(Color.WHITE) })
        root.addView(premiumLoadingScene(),LinearLayout.LayoutParams(-1,-2))
        showAppPage(ScrollView(this).apply { addView(root) })
        io.execute {
            try {
                val data=items("/Users/$userId/Items?Recursive=true&Limit=100&SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=$type&Fields=PrimaryImageAspectRatio")
                runOnUiThread {
                    root.removeViewAt(1)
                    homeRoot=root
                    if(data.isEmpty()) {
                        root.addView(TextView(this).apply {
                            text="Hier sind noch keine Titel vorhanden."
                            textSize=19f
                            setTextColor(0xFFB9B9C3.toInt())
                            setPadding(0,dp(28),0,dp(24))
                        })
                    } else addLibraryGrid(data)
                }
            } catch(e:Exception){ runOnUiThread{toast("$title konnten nicht geladen werden")} }
        }
    }

    private fun showFavorites() {
        activeSection="Meine Liste";activeCollectionId=""
        rememberBack { showHome() }
        val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(48),dp(28),dp(48),dp(28)); setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
        root.addView(TextView(this).apply { text="Meine Liste"; textSize=32f; setTextColor(Color.WHITE) })
        root.addView(premiumLoadingScene(),LinearLayout.LayoutParams(-1,-2))
        showAppPage(ScrollView(this).apply { addView(root) })
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
        searchMode="Alle"
        val fromSection=activeSection
        val fromCollection=activeCollectionId
        rememberBack {
            activeSection=fromSection;activeCollectionId=fromCollection
            when(fromSection) {
                "Start" -> showHome()
                "Anime","Anime Filme","Animation","Cartoons" -> showMediaFolderLibrary(fromSection,when(fromSection) {
                    "Anime" -> "Series"
                    "Anime Filme" -> "Movie"
                    else -> "Movie,Series"
                })
                "Sammlungen" -> if(fromCollection.isNotBlank())showCollection(fromCollection) else showLibrary(fromSection,"BoxSet")
                "Filme" -> showLibrary(fromSection,"Movie")
                "Serien" -> showLibrary(fromSection,"Series")
                else -> showHome()
            }
        }
        val root=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(dp(54),dp(48),dp(54),dp(40));setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))}
        val left=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(0,0,dp(36),0)}
        left.addView(TextView(this).apply{
            text=if(activeSection=="Start")"Suche" else "Suche in $activeSection"
            textSize=36f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD
        })
        val input=EditText(this).apply{
            hint="Titel suchen…";setTextColor(Color.WHITE);setHintTextColor(Color.GRAY);textSize=20f;setSingleLine()
            background=GradientDrawable().apply{setColor(0xFF202026.toInt());cornerRadius=dp(10).toFloat()}
            setPadding(dp(18),0,dp(18),0)
            setOnEditorActionListener{_,_,_->val q=text.toString().trim();if(q.isNotBlank())search(q);true}
        }
        left.addView(input,LinearLayout.LayoutParams(dp(440),dp(64)).apply{topMargin=dp(24)})
        left.addView(actionButton("Suchen",true){val q=input.text.toString().trim();if(q.isNotBlank())search(q)},LinearLayout.LayoutParams(dp(180),dp(58)).apply{topMargin=dp(16)})
        val filters=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL
            clipChildren=false
            clipToPadding=false
        }
        listOf("Alle","Filme","Serien","Ungesehen").forEach { label ->
            val chip=navButton(label) {
                searchMode=label
                val q=input.text.toString().trim()
                if(q.isNotBlank())search(q)
                else toast("Zuerst einen Suchbegriff eingeben")
            }
            filters.addView(chip,LinearLayout.LayoutParams(0,dp(50),1f).apply{marginEnd=dp(8)})
        }
        left.addView(filters,LinearLayout.LayoutParams(-1,dp(50)).apply{topMargin=dp(14)})
        val history=prefs.getString("search_history_$userId","").orEmpty().split("|").filter(String::isNotBlank).take(5)
        if(history.isNotEmpty()){
            left.addView(TextView(this).apply {
                text="ZULETZT GESUCHT"
                textSize=14f
                typeface=Typeface.DEFAULT_BOLD
                setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
            },params(-1,-2,18))
            history.forEach { previous ->
                left.addView(actionButton("⌕  $previous",false) {
                    input.setText(previous)
                    search(previous)
                },LinearLayout.LayoutParams(dp(435),dp(51)).apply{bottomMargin=dp(7)})
            }
        }
        root.addView(left,LinearLayout.LayoutParams(dp(500),-1))
        root.addView(TextView(this).apply{text="Gib einen Film, eine Serie oder einen Anime ein.\nDie Ergebnisse erscheinen als Poster.";textSize=20f;setTextColor(Color.LTGRAY);gravity=Gravity.CENTER},LinearLayout.LayoutParams(0,-1,1f))
        showAppPage(root);input.requestFocus()
    }

    private fun search(query:String, person:Boolean=false) {
        if(!person) {
            val current=prefs.getString("search_history_$userId","").orEmpty()
                .split("|").filter(String::isNotBlank)
            val trimmed=query.trim().replace("|"," ").replace("\n"," ")
            prefs.edit().putString("search_history_$userId",
                (listOf(trimmed)+current.filter{!it.equals(trimmed,true)}).take(5).joinToString("|")).apply()
        }
        rememberBack { showSearch() }
        val encoded=java.net.URLEncoder.encode(query,"UTF-8")
        val scope=activeSection
        val collectionId=activeCollectionId
        io.execute {
            try {
                val queryParts=mutableListOf("Recursive=true","Limit=150",
                    if(person)"Person=$encoded" else "SearchTerm=$encoded",
                    "Fields=PrimaryImageAspectRatio,ProductionYear","EnableUserData=true")
                if(collectionId.isNotBlank()) {
                    queryParts.add("ParentId=$collectionId")
                    queryParts.add("IncludeItemTypes=Movie,Series")
                } else if(scope=="Sammlungen") {
                    queryParts.add("IncludeItemTypes=BoxSet")
                } else if(scope=="Meine Liste") {
                    queryParts.add("Filters=IsFavorite")
                    queryParts.add("IncludeItemTypes=Movie,Series")
                } else if(scope=="Start") {
                    queryParts.add("IncludeItemTypes="+when(searchMode) {
                        "Filme" -> "Movie"
                        "Serien" -> "Series"
                        else -> "Movie,Series"
                    })
                    if(searchMode=="Ungesehen")queryParts.add("Filters=IsUnplayed")
                } else {
                    val aliases=when(scope) {
                        "Anime" -> listOf("anime","animes","animeserien","animeseries")
                        "Anime Filme" -> listOf("animemovies","animefilme","animefilms")
                        "Animation" -> listOf("animation","animations","animationsfilme")
                        "Cartoons" -> listOf("cartoons","cartoon","zeichentrick","zeichentrickfilme")
                        "Filme" -> listOf("filme","movies","movie")
                        "Serien" -> listOf("serien","series","tvshows","shows")
                        else -> emptyList()
                    }
                    fun norm(name:String)=java.text.Normalizer.normalize(name.lowercase(),java.text.Normalizer.Form.NFD)
                        .replace(Regex("[\\u0300-\\u036f]"),"")
                        .replace(Regex("[^a-z0-9]"),"")
                    val folder=items("/Users/$userId/Views")
                        .firstOrNull { aliases.contains(norm(it.optString("Name"))) }
                    val id=folder?.optString("Id").orEmpty()
                    if(id.isNotBlank())queryParts.add("ParentId=$id")
                    else queryParts.add("ParentId=00000000000000000000000000000000")
                    queryParts.add("IncludeItemTypes="+when(scope) {
                        "Anime Filme","Filme" -> "Movie"
                        "Anime","Serien" -> "Series"
                        else -> "Movie,Series"
                    })
                }
                val data=items("/Users/$userId/Items?"+queryParts.joinToString("&"))
                runOnUiThread {
                    val root=LinearLayout(this).apply {
                        orientation=LinearLayout.VERTICAL
                        setPadding(dp(48),dp(28),dp(48),dp(28))
                        setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
                    }
                    root.addView(TextView(this).apply {
                        text="Suchergebnisse in $scope für „$query“"
                        textSize=30f;setTextColor(Color.WHITE)
                    })
                    homeRoot=root
                    if(data.isEmpty()) root.addView(TextView(this).apply {
                        text="Keine passenden Titel gefunden."
                        textSize=18f;setTextColor(Color.LTGRAY)
                    },params(-1,-2,20))
                    else addLibraryGrid(data)
                    root.addView(button("Neue Suche") { showSearch() },params(220,56,16))
                    showAppPage(ScrollView(this).apply {
                        isVerticalScrollBarEnabled=false;addView(root)
                    })
                }
            } catch(e:Exception){ runOnUiThread { toast("Suche fehlgeschlagen") } }
        }
    }

    // Jellyfin may return a placeholder Name even when it knows the episode's
    // real EpisodeTitle or OriginalTitle. Do not invent unavailable metadata.
    private fun episodeTitle(item:JSONObject):String {
        val generic=Regex("""^(?:(?:folge|episode|ep\.?|teil|part)\s*#?\s*\d+|s\d{1,2}\s*e\d{1,3}|\d+)$""",RegexOption.IGNORE_CASE)
        val prefix=Regex("""^(?:(?:folge|episode|ep\.?)\s*\d+|s\d{1,2}\s*e\d{1,3}|\d+\s*[.):])\s*[-:–—]\s*""",RegexOption.IGNORE_CASE)
        val numbered=Regex("""^\d+\s*[.):]\s*""")
        val candidates=listOf("Name","EpisodeTitle","OriginalTitle").map{
            item.optString(it).trim().replace(Regex("""\s+""")," ")
        }.filter(String::isNotBlank)
        candidates.forEach { candidate ->
            val stripped=candidate.replace(prefix,"")
            if(stripped.isNotBlank() && !generic.matches(stripped))return stripped
            val withoutNumber=candidate.replace(numbered,"")
            if(withoutNumber.isNotBlank() && !generic.matches(withoutNumber))return withoutNumber
        }
        val num=item.optInt("IndexNumber",0)
        return if(num>0)"Folge $num" else candidates.firstOrNull().orEmpty().ifBlank{"Folge"}
    }

    private fun episodeHeading(item:JSONObject):String {
        val title=episodeTitle(item)
        if(Regex("""^(?:folge|episode)\s*\d+$""",RegexOption.IGNORE_CASE).matches(title))return title
        val num=item.optInt("IndexNumber",0)
        return if(num>0)"$num. $title" else title
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
                            items("/Shows/$seriesId/Episodes?UserId=$userId&SeasonId=${season.optString("Id")}&Limit=1000&EnableUserData=true&Fields=Overview,OriginalTitle,RunTimeTicks")
                        }.getOrNull()
                    },io)
                }
                val episodesBySeason=seasons.mapIndexed { index,season ->
                    season.optString("Id") to runCatching { seasonQueries[index].get() }.getOrNull()
                }.toMap()
                val finishedSeasons=seasons.associate { season ->
                    val episodes=episodesBySeason[season.optString("Id")]
                    season.optString("Id") to (episodes!=null && episodes.isNotEmpty() &&
                        episodes.all { it.optJSONObject("UserData")?.optBoolean("Played",false)==true })
                }
                val seriesComplete=seasons.isNotEmpty() && finishedSeasons.values.all { it }
                runOnUiThread {
                    val root=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt())) }
                    val hero=FrameLayout(this)
                    val bg=ImageView(this).apply{scaleType=ImageView.ScaleType.CENTER_CROP}; hero.addView(bg,FrameLayout.LayoutParams(-1,dp(440))); loadImage(bg,seriesId,"Backdrop",1600)
                    addCinematicHeroShades(hero)
                    val info=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.BOTTOM;setPadding(dp(54),dp(42),dp(54),dp(35))}
                    info.addView(heroEyebrow("SERIE AUF VELARIS"))
                    info.addView(TextView(this).apply{
                        text=series.optString("Name");textSize=40f;maxLines=2
                        setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD
                    },LinearLayout.LayoutParams(dp(770),-2))
                    val seriesMeta=heroMediaMeta(series)
                    if(seriesMeta.isNotBlank())info.addView(TextView(this).apply{
                        text=seriesMeta;textSize=16f
                        setTextColor(0xFFE6E3ED.toInt());setPadding(0,dp(9),0,0)
                    })
                    val seriesGenres=heroGenres(series)
                    if(seriesGenres.isNotBlank())info.addView(TextView(this).apply{
                        text=seriesGenres;textSize=14f;maxLines=1
                        setTextColor(0xFFC5BFDB.toInt());setPadding(0,dp(7),0,0)
                    })
                    if(seriesComplete)info.addView(TextView(this).apply {
                        text="✓ SERIE VOLLSTÄNDIG GESEHEN"
                        textSize=16f;typeface=Typeface.DEFAULT_BOLD
                        setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                        setPadding(0,dp(9),0,0)
                    })
                    if(series.optString("Overview").isNotBlank())
                        info.addView(TextView(this).apply{
                            text=series.optString("Overview");textSize=16f;maxLines=2
                            setTextColor(0xFFE6E3ED.toInt());setLineSpacing(dp(2).toFloat(),1.04f)
                            setPadding(0,dp(11),0,0)
                        },LinearLayout.LayoutParams(dp(740),-2))
                    val favorite=series.optJSONObject("UserData")?.optBoolean("IsFavorite",false)?:false
                    val acts=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(0,dp(16),0,0)}
                    acts.addView(actionButton(if(favorite)"✓  Meine Liste" else "+  Meine Liste",false){setFavorite(seriesId,!favorite){showSeries(seriesId)}},LinearLayout.LayoutParams(dp(220),dp(56)).apply{marginEnd=dp(10)})
                    val orderedEpisodes=seasons.flatMap{episodesBySeason[it.optString("Id")].orEmpty()}
                    val nextUnwatched=orderedEpisodes.firstOrNull{
                        (it.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L)?:0L)>0L &&
                            it.optJSONObject("UserData")?.optBoolean("Played",false)!=true
                    } ?: orderedEpisodes.firstOrNull{
                        it.optJSONObject("UserData")?.optBoolean("Played",false)!=true
                    }
                    if(nextUnwatched!=null)acts.addView(actionButton("▶  Nächste Folge",true) {
                        playNative(nextUnwatched.optString("Id"),
                            nextUnwatched.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L)?:0L)
                    },LinearLayout.LayoutParams(dp(225),dp(56)).apply {marginEnd=dp(10)})
                    acts.addView(actionButton("Zufällige Folge",false){playRandomEpisode(seriesId)},LinearLayout.LayoutParams(dp(200),dp(56)))
                    info.addView(acts); hero.addView(info,FrameLayout.LayoutParams(-1,-1)); root.addView(hero,LinearLayout.LayoutParams(-1,dp(440)))
                    // Netflix-style season selector: show season 1 episodes immediately
                    // under the same series page, without routing to a separate screen.
                    val selector=LinearLayout(this).apply {
                        orientation=LinearLayout.VERTICAL
                        setPadding(dp(54),dp(16),dp(54),dp(8))
                        clipChildren=false;clipToPadding=false
                    }
                    selector.addView(TextView(this).apply {
                        text="Episoden";textSize=27f;typeface=Typeface.DEFAULT_BOLD
                        setTextColor(Color.WHITE)
                    })
                    val chooser=LinearLayout(this).apply {
                        orientation=LinearLayout.VERTICAL
                        visibility=View.GONE
                        setPadding(0,dp(4),0,dp(6))
                    }
                    val episodeList=LinearLayout(this).apply{
                        orientation=LinearLayout.VERTICAL
                        setPadding(0,dp(14),0,dp(36))
                        clipChildren=false;clipToPadding=false
                    }
                    lateinit var seasonButton:Button
                    fun renderSeason(index:Int) {
                        val selected=seasons.getOrNull(index) ?: return
                        val seasonId=selected.optString("Id")
                        val episodes=episodesBySeason[seasonId]
                        seasonButton.text=(if(finishedSeasons[seasonId]==true)"✓  " else "")+
                            selected.optString("Name","Staffel ${index+1}")
                        chooser.visibility=View.GONE
                        episodeList.removeAllViews()
                        if(finishedSeasons[seasonId]==true) episodeList.addView(TextView(this).apply{
                            text="✓ STAFFEL VOLLSTÄNDIG GESEHEN"
                            textSize=14f;typeface=Typeface.DEFAULT_BOLD
                            setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                        },params(-1,-2,10))
                        if(episodes==null) episodeList.addView(TextView(this).apply {
                            text="Folgen konnten nicht geladen werden."
                            textSize=16f;setTextColor(Color.LTGRAY)
                        },params(-1,-2,12))
                        else if(episodes.isEmpty()) episodeList.addView(TextView(this).apply {
                            text="Keine Episoden in dieser Staffel."
                            textSize=16f;setTextColor(Color.LTGRAY)
                        },params(-1,-2,12))
                        else episodes.forEachIndexed { i,ep ->
                            val eid=ep.optString("Id")
                            val ticks=ep.optJSONObject("UserData")?.optLong("PlaybackPositionTicks",0L)?:0L
                            val nextId=episodes.getOrNull(i+1)?.optString("Id").orEmpty()
                            val cover=watchedPoster(ep,246,138,"Primary",520,landscape=true)
                            val card=LinearLayout(this).apply {
                                orientation=LinearLayout.HORIZONTAL
                                gravity=Gravity.CENTER_VERTICAL
                                isFocusable=true;isClickable=true
                                setPadding(dp(10),dp(10),dp(10),dp(10))
                                setOnClickListener { startEpisode(eid,ticks,nextId) }
                                applyCardFocus(this,cover)
                            }
                            card.addView(cover,LinearLayout.LayoutParams(dp(246),dp(138)))
                            val detail=LinearLayout(this).apply{
                                orientation=LinearLayout.VERTICAL
                                setPadding(dp(22),0,dp(12),0)
                            }
                            detail.addView(TextView(this).apply {
                                text=episodeHeading(ep)
                                textSize=19f;typeface=Typeface.DEFAULT_BOLD;setTextColor(Color.WHITE)
                            })
                            if(watchedLabel(ep)!=null)detail.addView(TextView(this).apply {
                                text="✓ FOLGE GESEHEN";textSize=13f
                                setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                            },params(-1,-2,5))
                            val duration=ep.optLong("RunTimeTicks",0L)/600_000_000L
                            if(duration>0)detail.addView(TextView(this).apply {
                                text="$duration Min.";textSize=13f;setTextColor(Color.LTGRAY)
                            },params(-1,-2,5))
                            detail.addView(TextView(this).apply {
                                text=ep.optString("Overview");textSize=14f;maxLines=2
                                setTextColor(Color.LTGRAY)
                            },params(-1,-2,8))
                            card.addView(detail,LinearLayout.LayoutParams(0,-2,1f))
                            episodeList.addView(card,params(-1,172,12))
                        }
                    }
                    seasonButton=actionButton("Staffel wählen",false) {
                        chooser.visibility=if(chooser.visibility==View.VISIBLE)View.GONE else View.VISIBLE
                        if(chooser.visibility==View.VISIBLE)chooser.post{chooser.getChildAt(0)?.requestFocus()}
                    }
                    selector.addView(seasonButton,params(265,54,16))
                    seasons.forEachIndexed { index,season ->
                        val id=season.optString("Id")
                        val label=(if(finishedSeasons[id]==true)"✓  " else "")+
                            season.optString("Name","Staffel ${index+1}")
                        chooser.addView(actionButton(label,false){
                            renderSeason(index)
                            seasonButton.requestFocus()
                        },params(265,50,6))
                    }
                    selector.addView(chooser)
                    selector.addView(episodeList)
                    root.addView(selector)
                    if(seasons.isNotEmpty()) {
                        // Season 0 ("Specials") must not replace season 1 on first open.
                        val firstRegular=seasons.indexOfFirst{it.optInt("IndexNumber",-1)==1}
                        renderSeason(if(firstRegular>=0)firstRegular else 0)
                    } else episodeList.addView(TextView(this).apply{
                        text="Keine Staffeln gefunden.";textSize=16f;setTextColor(Color.LTGRAY)
                    },params(-1,-2,12))
                    showAppPage(ScrollView(this).apply{isVerticalScrollBarEnabled=false;addView(root)})
                }
            } catch(e:Exception){ runOnUiThread{toast("Serie konnte nicht geladen werden")} }
        }
    }

    private fun showSeason(seriesId:String, seasonId:String) {
        rememberBack { showSeries(seriesId) }
        io.execute {
            try {
                val episodes=items("/Shows/$seriesId/Episodes?UserId=$userId&SeasonId=$seasonId&Fields=Overview,OriginalTitle,PrimaryImageAspectRatio,RunTimeTicks&EnableUserData=true&Limit=1000")
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
                        val name=episodeHeading(ep)
                        val nextId=episodes.getOrNull(episodes.indexOf(ep)+1)?.optString("Id").orEmpty()
                        val card=LinearLayout(this).apply { orientation=LinearLayout.HORIZONTAL; gravity=Gravity.CENTER_VERTICAL; isFocusable=true; isClickable=true; setPadding(dp(8),dp(8),dp(8),dp(8)); setOnClickListener { startEpisode(eid,ticks,nextId) }; applyCardFocus(this) }
                        card.addView(watchedPoster(ep,250,140,"Primary",500,landscape=true),
                            LinearLayout.LayoutParams(dp(250),dp(140)))
                        val info=LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setPadding(dp(18),0,0,0) }
                        info.addView(TextView(this).apply {
                            text=name
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
                    showAppPage(ScrollView(this).apply { addView(root) })
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
                    addCinematicHeroShades(hero)
                    val info=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;gravity=Gravity.BOTTOM;setPadding(dp(58),dp(90),dp(58),dp(42))}
                    info.addView(heroEyebrow(when(x.optString("Type")){
                        "Series"->"SERIE AUF VELARIS";"Episode"->"EPISODE AUF VELARIS"
                        else->"FILM AUF VELARIS"
                    }))
                    info.addView(TextView(this).apply{
                        text=if(x.optString("Type")=="Episode")episodeTitle(x) else x.optString("Name")
                        textSize=42f;maxLines=2
                        setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD
                    },LinearLayout.LayoutParams(dp(790),-2))
                    val meta=heroMediaMeta(x)
                    if(meta.isNotBlank())info.addView(TextView(this).apply{
                        text=meta;textSize=16f;setTextColor(0xFFE6E3ED.toInt())
                        setPadding(0,dp(10),0,0)
                    })
                    val streams=x.optJSONArray("MediaSources")?.optJSONObject(0)?.optJSONArray("MediaStreams")
                    var video:JSONObject?=null
                    var audio:JSONObject?=null
                    var subtitles=false
                    if(streams!=null) for(index in 0 until streams.length()){
                        val stream=streams.optJSONObject(index)?:continue
                        when(stream.optString("Type")) {
                            "Video" -> if(video==null)video=stream
                            "Audio" -> if(audio==null)audio=stream
                            "Subtitle" -> subtitles=true
                        }
                    }
                    val picture=video
                    val sound=audio
                    val badges=listOfNotNull(
                        when {
                            (picture?.optInt("Width")?:0)>=3800 -> "4K"
                            (picture?.optInt("Height")?:0)>=1080 -> "Full HD"
                            (picture?.optInt("Height")?:0)>=720 -> "HD"
                            else -> null
                        },
                        when {
                            picture?.optString("VideoRangeType").orEmpty().contains("dolbyvision",true) -> "Dolby Vision"
                            picture?.optString("VideoRange").orEmpty().let{it.isNotBlank()&&!it.equals("SDR",true)} -> "HDR"
                            else -> null
                        },
                        if((sound?.optInt("Channels")?:0)>=6) "5.1 Audio" else null,
                        if(subtitles)"Untertitel" else null
                    )
                    if(badges.isNotEmpty()) info.addView(TextView(this).apply {
                        text=badges.joinToString("    ·    ")
                        textSize=13f
                        typeface=Typeface.DEFAULT_BOLD
                        setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
                    },params(-1,-2,10))
                    val detailGenres=heroGenres(x)
                    if(detailGenres.isNotBlank())info.addView(TextView(this).apply{
                        text=detailGenres;textSize=14f;maxLines=1
                        setTextColor(0xFFC5BFDB.toInt());setPadding(0,dp(7),0,0)
                    })
                    watchedLabel(x)?.let { label ->
                        info.addView(TextView(this).apply {
                            text=label;typeface=Typeface.DEFAULT_BOLD;textSize=16f
                            setTextColor(VelarisDesign.color("success",0xFF46D369.toInt()))
                        },params(-1,-2,9))
                    }
                    if(x.optString("Overview").isNotBlank())
                        info.addView(TextView(this).apply{
                            text=x.optString("Overview");textSize=16f;maxLines=3
                            setTextColor(0xFFE6E3ED.toInt());setLineSpacing(dp(2).toFloat(),1.06f)
                            setPadding(0,dp(12),0,0)
                        },LinearLayout.LayoutParams(dp(750),-2))
                    val ud=x.optJSONObject("UserData"); val ticks=ud?.optLong("PlaybackPositionTicks",0L)?:0L; val fav=ud?.optBoolean("IsFavorite",false)?:false
                    val actions=LinearLayout(this).apply{orientation=LinearLayout.HORIZONTAL;setPadding(0,dp(20),0,0)}
                    actions.addView(actionButton(if(ticks>0)"▶  Fortsetzen" else "▶  Abspielen",true){playNative(id,ticks)},LinearLayout.LayoutParams(dp(220),dp(58)).apply{marginEnd=dp(12)})
                    actions.addView(actionButton(if(fav)"✓  Meine Liste" else "+  Meine Liste",false){setFavorite(id,!fav){showDetails(id)}},LinearLayout.LayoutParams(dp(220),dp(58)).apply{marginEnd=dp(12)})
                    if(x.optString("Type")=="Series") actions.addView(actionButton("Zufällige Folge",false){playRandomEpisode(id)},LinearLayout.LayoutParams(dp(210),dp(58)))
                    info.addView(actions); hero.addView(info,FrameLayout.LayoutParams(-1,-1)); outer.addView(hero,LinearLayout.LayoutParams(-1,dp(500)))
                    val people=x.optJSONArray("People")
                    if(people!=null && people.length()>0) {
                        outer.addView(sectionTitle("Cast & Crew"))
                        val peopleRow=LinearLayout(this).apply {
                            orientation=LinearLayout.HORIZONTAL
                            setPadding(dp(52),dp(8),dp(52),dp(20))
                        }
                        for(index in 0 until minOf(12,people.length())){
                            val person=people.optJSONObject(index)?:continue
                            val name=person.optString("Name")
                            if(name.isBlank())continue
                            peopleRow.addView(actionButton(name,false) {
                                activeSection="Start"
                                activeCollectionId=""
                                search(name,true)
                            },LinearLayout.LayoutParams(dp(190),dp(57)).apply { marginEnd=dp(12) })
                        }
                        outer.addView(HorizontalScrollView(this).apply {
                            isHorizontalScrollBarEnabled=false
                            addView(peopleRow)
                        })
                    }
                    homeRoot=outer
                    addRow("Ähnliche Titel",similar)
                    showAppPage(ScrollView(this).apply{isVerticalScrollBarEnabled=false;addView(outer)})
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
                    showAppPage(ScrollView(this).apply { addView(root) })
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
            if(focused)setStroke(dp(2),VelarisDesign.color("focus",0xFFDCCFFF.toInt()))
            else if(selected)setStroke(dp(2),VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
        }
        frame.animate().scaleX(if(focused)1.025f else 1f).scaleY(if(focused)1.025f else 1f)
            .setDuration(120).start()
    }

    // Cinematic, non-interactive hero slideshow on the right of the profile picker.
    // It never starts playback; all focus remains in the profile column.
    private fun loadProfileHeroCarousel(screen:FrameLayout,hero:FrameLayout) {
        val requestedServer=server
        val requestedUser=userId
        if(requestedServer.isBlank()||requestedUser.isBlank()||token.isBlank())return
        io.execute {
            val candidates=runCatching {
                items("/Users/$requestedUser/Items?Recursive=true&IncludeItemTypes=Movie,Series" +
                    "&SortBy=DateCreated&SortOrder=Descending&Limit=75" +
                    "&Fields=Overview,ProductionYear,BackdropImageTags")
                    .filter { item ->
                        item.optString("Id").isNotBlank() &&
                            (item.optJSONArray("BackdropImageTags")?.length()?:0)>0
                    }
                    .distinctBy{it.optString("Id")}.shuffled().take(7)
            }.getOrDefault(emptyList())
            if(candidates.isEmpty())return@execute
            runOnUiThread {
                if(!screen.isAttachedToWindow||destroyed ||
                    requestedServer!=server||requestedUser!=userId)return@runOnUiThread
                fun render(index:Int) {
                    if(!screen.isAttachedToWindow || destroyed ||
                        requestedServer!=server||requestedUser!=userId)return
                    val item=candidates[index%candidates.size]
                    hero.animate().cancel()
                    hero.animate().alpha(0f).setDuration(240).withEndAction {
                        if(!screen.isAttachedToWindow || destroyed)return@withEndAction
                        hero.removeAllViews()
                        val backdrop=ImageView(this).apply {
                            scaleType=ImageView.ScaleType.CENTER_CROP
                            isFocusable=false
                            importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO
                        }
                        hero.addView(backdrop,FrameLayout.LayoutParams(-1,-1))
                        loadImage(backdrop,item.optString("Id"),"Backdrop",1280)
                        hero.addView(View(this).apply {
                            background=GradientDrawable(
                                GradientDrawable.Orientation.LEFT_RIGHT,
                                intArrayOf(0xD808080D.toInt(),0x4808080D,0x1808080D))
                        },FrameLayout.LayoutParams(-1,-1))
                        hero.addView(View(this).apply {
                            background=GradientDrawable(
                                GradientDrawable.Orientation.TOP_BOTTOM,
                                intArrayOf(0x0808080D,0x0808080D,0xE808080D.toInt()))
                        },FrameLayout.LayoutParams(-1,-1))
                        val info=LinearLayout(this).apply {
                            orientation=LinearLayout.VERTICAL
                            gravity=Gravity.BOTTOM
                            setPadding(dp(48),0,dp(60),dp(62))
                        }
                        info.addView(TextView(this).apply {
                            text="JETZT AUF VELARIS"
                            textSize=13f;letterSpacing=0.15f
                            typeface=Typeface.DEFAULT_BOLD
                            setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
                        },params(-1,-2,8))
                        info.addView(TextView(this).apply {
                            text=item.optString("Name")
                            textSize=39f;typeface=Typeface.DEFAULT_BOLD
                            setTextColor(Color.WHITE);maxLines=2
                        },params(-1,-2,9))
                        val year=item.optInt("ProductionYear",0)
                        if(year>0)info.addView(TextView(this).apply {
                            text=year.toString();textSize=15f
                            setTextColor(0xFFE3E3E9.toInt())
                        },params(-1,-2,8))
                        val overview=item.optString("Overview")
                            .replace(Regex("<[^>]+>")," ").trim()
                        if(overview.isNotBlank())info.addView(TextView(this).apply {
                            text=overview;textSize=16f;maxLines=3
                            setTextColor(0xFFE2E2E7.toInt())
                        },params(-1,-2,20))
                        info.addView(TextView(this).apply {
                            text=candidates.indices.joinToString("  ") {
                                if(it==index%candidates.size)"●" else "○"
                            }
                            textSize=18f;setTextColor(Color.WHITE)
                        })
                        hero.addView(info,FrameLayout.LayoutParams(-1,-1))
                        hero.animate().alpha(1f).setDuration(550).start()
                    }.start()
                }
                render(0)
                if(candidates.size>1) {
                    val tick=object:Runnable {
                        var slide=1
                        override fun run() {
                            if(!screen.isAttachedToWindow||destroyed ||
                                requestedServer!=server||requestedUser!=userId)return
                            render(slide++)
                            screen.postDelayed(this,8500L)
                        }
                    }
                    screen.postDelayed(tick,8500L)
                }
            }
        }
    }

    private fun showProfileAvatarEditor(profile:JSONObject) {
        val labels=arrayOf("Rot","Blau","Weiße Robbe","Graue Robbe")
        val avatar=profile.optInt("avatar",0).coerceIn(0,labels.lastIndex)
        AlertDialog.Builder(this)
            .setTitle("Avatar für ${profile.optString("name","Profil")} auswählen")
            .setSingleChoiceItems(labels,avatar) { dialog,selected ->
                val all=readProfiles()
                val target=profile.optString("id")
                val found=(0 until all.length()).firstOrNull {
                    all.optJSONObject(it)?.optString("id")==target
                }
                if(found!=null) {
                    all.optJSONObject(found)?.put("avatar",selected)
                    prefs.edit().putString("velaris_profiles",all.toString()).apply()
                    if(profile.optString("userId")==userId && profile.optString("server")==server)
                        prefs.edit().putInt("active_profile_avatar",selected).apply()
                    dialog.dismiss()
                    showProfiles(true)
                } else {
                    dialog.dismiss()
                    toast("Profil wurde nicht gefunden")
                }
            }
            .setNegativeButton("Abbrechen",null)
            .show()
    }

    private fun showProfiles(startup:Boolean=false) {
        if(!startup) {
            editProfilesMode=false
            rememberBack { showHome() }
        }
        val profiles=readProfiles()
        val scene=FrameLayout(this).apply {
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
        }
        val columns=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL
            isFocusable=false
        }
        scene.addView(columns,FrameLayout.LayoutParams(-1,-1))
        val rail=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(dp(40),dp(40),dp(18),dp(28))
            setBackgroundColor(0xFF0D0D14.toInt())
            clipChildren=false;clipToPadding=false
        }
        columns.addView(rail,LinearLayout.LayoutParams(dp(372),-1))
        val hero=FrameLayout(this).apply {
            isFocusable=false
            setBackgroundColor(0xFF12121C.toInt())
            importantForAccessibility=View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS
        }
        columns.addView(hero,LinearLayout.LayoutParams(0,-1,1f))
        rail.addView(TextView(this).apply {
            text="VELARIS";textSize=22f;letterSpacing=0.12f
            typeface=Typeface.DEFAULT_BOLD
            setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
        },params(-1,-2,20))
        rail.addView(TextView(this).apply {
            text="Wer schaut gerade?"
            textSize=29f;typeface=Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE);maxLines=2
        },params(-1,-2,7))
        val hint=TextView(this).apply {
            text=if(editProfilesMode)"Profil wählen, um den Avatar zu ändern"
                else "Wähle dein Profil"
            textSize=15f;setTextColor(0xFFB9B9C3.toInt())
            maxLines=2
        }
        rail.addView(hint,params(-1,-2,17))
        val list=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            clipChildren=false;clipToPadding=false
        }
        val scroller=ScrollView(this).apply {
            isVerticalScrollBarEnabled=false
            clipChildren=false;clipToPadding=false
            isFillViewport=false
            addView(list)
        }
        rail.addView(scroller,LinearLayout.LayoutParams(-1,0,1f))
        val editIndicators=mutableListOf<View>()
        var firstProfile:View?=null
        for(i in 0 until profiles.length()) {
            val profile=profiles.optJSONObject(i)?:continue
            val name=profile.optString("name","Profil")
            val picture=avatarFrame(profile.optInt("avatar",i),name)
            val editIcon=TextView(this).apply {
                text="✎";textSize=23f
                setTextColor(VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
                gravity=Gravity.CENTER
                visibility=if(editProfilesMode)View.VISIBLE else View.GONE
            }
            editIndicators.add(editIcon)
            val tile=LinearLayout(this).apply {
                orientation=LinearLayout.HORIZONTAL
                gravity=Gravity.CENTER_VERTICAL
                isFocusable=true;isClickable=true
                setPadding(dp(8),dp(4),dp(9),dp(4))
                background=GradientDrawable().apply {
                    setColor(0xFF1A1A24.toInt());cornerRadius=dp(14).toFloat()
                }
                setOnClickListener {
                    if(editProfilesMode)showProfileAvatarEditor(profile)
                    else activateJellyfinProfile(profile)
                }
                setOnFocusChangeListener{v,focused ->
                    highlightAvatar(picture,focused)
                    v.background=GradientDrawable().apply {
                        setColor(if(focused)0xFF302B48.toInt() else 0xFF1A1A24.toInt())
                        cornerRadius=dp(14).toFloat()
                        if(focused)setStroke(dp(2),Color.WHITE)
                    }
                }
            }
            tile.addView(picture,LinearLayout.LayoutParams(dp(65),dp(65)))
            tile.addView(TextView(this).apply {
                text=name;maxLines=1;textSize=17f
                setTextColor(Color.WHITE)
                typeface=Typeface.DEFAULT_BOLD
                setPadding(dp(13),0,0,0)
            },LinearLayout.LayoutParams(0,-2,1f))
            tile.addView(editIcon,LinearLayout.LayoutParams(dp(32),dp(40)))
            list.addView(tile,LinearLayout.LayoutParams(-1,dp(81)).apply {
                bottomMargin=dp(8)
            })
            if(firstProfile==null)firstProfile=tile
        }
        if(profiles.length()<VelarisDesign.maxProfiles()) {
            val add=LinearLayout(this).apply {
                orientation=LinearLayout.HORIZONTAL;gravity=Gravity.CENTER_VERTICAL
                setPadding(dp(15),dp(5),dp(10),dp(5))
                isFocusable=true;isClickable=true
                setOnClickListener{showCreateProfile()}
                setOnFocusChangeListener{v,focused->
                    v.background=GradientDrawable().apply{
                        setColor(if(focused)0xFF302B48.toInt() else Color.TRANSPARENT)
                        cornerRadius=dp(12).toFloat()
                        if(focused)setStroke(dp(2),Color.WHITE)
                    }
                }
            }
            add.addView(TextView(this).apply {
                text="+";textSize=36f;gravity=Gravity.CENTER
                setTextColor(Color.WHITE)
            },LinearLayout.LayoutParams(dp(65),dp(60)))
            add.addView(TextView(this).apply {
                text="Profil hinzufügen";textSize=16f
                setTextColor(0xFFB9B9C3.toInt())
                setPadding(dp(13),0,0,0)
            })
            list.addView(add,LinearLayout.LayoutParams(-1,dp(75)))
            if(firstProfile==null)firstProfile=add
        }
        val editor=actionButton(if(editProfilesMode)"✓  Fertig" else "✎  Profile bearbeiten",false){}
        editor.setOnClickListener {
            editProfilesMode=!editProfilesMode
            editor.text=if(editProfilesMode)"✓  Fertig" else "✎  Profile bearbeiten"
            hint.text=if(editProfilesMode)"Profil wählen, um den Avatar zu ändern"
                else "Wähle dein Profil"
            editIndicators.forEach {
                it.visibility=if(editProfilesMode)View.VISIBLE else View.GONE
            }
        }
        rail.addView(editor,LinearLayout.LayoutParams(-1,dp(54)).apply {
            topMargin=dp(14)
        })
        setContentView(scene)
        scene.post { firstProfile?.requestFocus() }
        loadProfileHeroCarousel(scene,hero)
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
        val shouldFetch=synchronized(pendingImages) {
            val waiting=pendingImages[cacheKey]
            if(waiting!=null){waiting.add(view);false}
            else{pendingImages[cacheKey]=mutableListOf(view);true}
        }
        if(!shouldFetch)return
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
                            val waiting=synchronized(pendingImages){pendingImages[cacheKey]?.toList().orEmpty()}
                            runOnUiThread{
                                if(!isFinishing&&!isDestroyed)waiting.forEach{image->
                                    image.animate().cancel()
                                    val visible=image.isAttachedToWindow
                                    if(visible)image.alpha=0f
                                    image.setImageBitmap(bmp)
                                    if(visible)image.animate().alpha(1f)
                                        .setDuration(260).start()
                                }
                            }
                        }
                    }
                } finally { conn.disconnect() }
            } catch(_:Exception) {} finally {
                synchronized(pendingImages){pendingImages.remove(cacheKey)}
            }
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
            conn.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="1.0.0"${if(auth && token.isNotBlank()) ", Token=\"$token\"" else ""}""")
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
        root.addView(TextView(this).apply{
            text="Velaris TV · Version 1.0.0"
            textSize=16f;setTextColor(Color.GRAY)
            setPadding(0,dp(4),0,dp(24))
        })
        val playback=settingsCard("▶","Wiedergabe","Autoplay, Intro, Rückblick und Abspann"){showPlaybackSettings()}
        val appearance=settingsCard("◉","Darstellung","Farben, Highlights und Animationen"){showAppearanceSettings()}
        val homeRows=settingsCard("▤","Startseite anpassen","Reihen einblenden, ausblenden und sortieren"){showHomeRowSettings()}
        val profiles=settingsCard("●","Profile","Profile verwalten und wechseln"){showProfiles()}
        val serverCard=settingsCard("◉","Server",server.ifBlank{"Nicht verbunden"}){clearConnection();showServer()}
        val logout=settingsCard("↪","Abmelden","Jellyfin-Sitzung auf diesem TV beenden"){token="";userId="";prefs.edit().remove("access_token").remove("user_id").apply();showLogin()}
        listOf(playback,appearance,homeRows,profiles,serverCard,logout).forEach{root.addView(it,LinearLayout.LayoutParams(-1,dp(86)).apply{bottomMargin=dp(12)})}
        val page=ScrollView(this).apply {
            isVerticalScrollBarEnabled=false
            isFillViewport=true
            clipChildren=false;clipToPadding=false
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            addView(root)
        }
        showAppPage(page)
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

    private fun showAppearanceSettings() {
        val root=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(dp(52),dp(28),dp(52),dp(60))
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
            clipChildren=false;clipToPadding=false
        }
        root.addView(TextView(this).apply {
            text="Darstellung"
            textSize=34f
            typeface=Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        },params(-1,-2,8))
        root.addView(TextView(this).apply {
            text="Akzentfarbe wählen – dunkler Hintergrund und Farbverlauf bleiben erhalten."
            textSize=17f
            setTextColor(0xFFB9B9C3.toInt())
        },params(-1,-2,16))
        val selected=VelarisDesign.selectedAccent(this)
        val choices=LinearLayout(this).apply {
            orientation=LinearLayout.HORIZONTAL
            clipChildren=false
            clipToPadding=false
        }
        VelarisDesign.accents.forEach { (key,option) ->
            val (label,hex)=option
            val active=key==selected
            val chip=Button(this).apply {
                text=if(active)"✓ $label" else label
                contentDescription="$label ${if(active)"ausgewählt" else "auswählen"}"
                isAllCaps=false
                setTextColor(if(key=="green"||key=="yellow"||key=="orange")0xFF101016.toInt() else Color.WHITE)
                textSize=16f
                isFocusable=true
                background=GradientDrawable().apply {
                    setColor(Color.parseColor(hex))
                    cornerRadius=dp(14).toFloat()
                    if(active)setStroke(dp(3),Color.WHITE)
                }
                setOnClickListener {
                    VelarisDesign.setAccent(this@MainActivity,key)
                    showAppearanceSettings()
                }
            }
            choices.addView(chip,LinearLayout.LayoutParams(0,dp(62),1f).apply { marginEnd=dp(9) })
        }
        root.addView(choices,LinearLayout.LayoutParams(-1,dp(62)).apply { bottomMargin=dp(14) })
        val switches=listOf(
            Triple("Highlights automatisch wechseln","auto_hero",true),
            Triple("Sanfte Animationen","ui_animations",true),
            Triple("Poster-Vorschau bei Fokus","ui_preview",true)
        )
        switches.forEach { (label,key,default) ->
            val checked=prefs.getBoolean(key,default)
            root.addView(settingsCard(if(checked)"●" else "○",label,if(checked)"Ein" else "Aus") {
                prefs.edit().putBoolean(key,!checked).apply()
                showAppearanceSettings()
            },LinearLayout.LayoutParams(-1,dp(73)).apply { bottomMargin=dp(9) })
        }
        root.addView(settingsCard("↺","Weiterschauen wiederherstellen","Ausgeblendete Titel wieder einblenden") {
            prefs.edit().remove("hidden_resume_$userId").apply()
            toast("Ausgeblendete Titel werden wieder angezeigt.")
            showAppearanceSettings()
        },LinearLayout.LayoutParams(-1,dp(75)).apply{bottomMargin=dp(12)})
        root.addView(settingsCard("Aa","Untertitelgröße","Klein, Standard oder Groß"){showSubtitleSizeSettings()},
            LinearLayout.LayoutParams(-1,dp(75)).apply{bottomMargin=dp(12)})
        root.addView(actionButton("Zurück",false){showSettingsDialog()},params(190,54,13))
        showAppPage(ScrollView(this).apply {
            isVerticalScrollBarEnabled=false
            clipChildren=false
            clipToPadding=false
            addView(root)
        })
        root.post { choices.getChildAt(0)?.requestFocus() }
    }

    private fun showSubtitleSizeSettings() {
        val options=listOf(
            "Klein" to 0.038f,
            "Standard" to 0.0533f,
            "Groß" to 0.070f
        )
        val current=prefs.getFloat("subtitle_scale",0.0533f)
        val root=LinearLayout(this).apply {
            orientation=LinearLayout.VERTICAL
            setPadding(dp(52),dp(38),dp(52),dp(60))
            setBackgroundColor(VelarisDesign.color("background",0xFF08080D.toInt()))
        }
        root.addView(TextView(this).apply {
            text="Untertitelgröße";textSize=34f;typeface=Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        },params(-1,-2,18))
        options.forEach{(label,scale)->
            root.addView(settingsCard(if(kotlin.math.abs(scale-current)<0.001f)"✓" else "Aa",label,
                if(kotlin.math.abs(scale-current)<0.001f)"Ausgewählt" else "Untertitelgröße einstellen") {
                prefs.edit().putFloat("subtitle_scale",scale).apply()
                showSubtitleSizeSettings()
            },LinearLayout.LayoutParams(-1,dp(82)).apply {bottomMargin=dp(10)})
        }
        root.addView(actionButton("Zurück",false){showAppearanceSettings()},params(180,54,16))
        showAppPage(ScrollView(this).apply { addView(root) })
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
        val rates=listOf(4_000_000,8_000_000,12_000_000,20_000_000)
        val selected=prefs.getInt("max_video_bitrate",8_000_000)
        root.addView(settingsCard("HD","Streamingqualität",
            "Maximal ${selected/1_000_000} Mbit/s · Jellyfin bestimmt das Format") {
            val index=rates.indexOf(selected).takeIf{it>=0}?:1
            prefs.edit().putInt("max_video_bitrate",rates[(index+1)%rates.size]).apply()
            showPlaybackSettings()
        },LinearLayout.LayoutParams(-1,dp(82)).apply{topMargin=dp(10)})
        root.addView(actionButton("Zurück",false){showSettingsDialog()},params(180,56,22))
        showAppPage(ScrollView(this).apply{
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
    private fun styleNavButton(button:Button,focused:Boolean) {
        val selected=button.isSelected
        button.background=GradientDrawable().apply {
            setColor(when {
                selected -> VelarisDesign.color("accent",0xFF7C5CFC.toInt())
                focused -> 0x442B2941
                else -> Color.TRANSPARENT
            })
            cornerRadius=dp(24).toFloat()
            if(focused)setStroke(dp(2),VelarisDesign.color("focus",0xFFDCCFFF.toInt()))
        }
        button.setTextColor(if(selected||focused)Color.WHITE else 0xCCDCDCE4.toInt())
        button.typeface=if(selected)Typeface.DEFAULT_BOLD else Typeface.DEFAULT
    }

    private fun navButton(label:String, click:()->Unit)=Button(this).apply {
        text=label;contentDescription=label;isAllCaps=false
        textSize=15f;setSingleLine(true);includeFontPadding=false
        isFocusable=true;isClickable=true
        minWidth=0;minimumWidth=0
        setPadding(dp(14),0,dp(14),0)
        stateListAnimator=null;elevation=0f
        styleNavButton(this,false)
        setOnClickListener{click()}
        setOnFocusChangeListener { view,focused ->
            styleNavButton(this,focused)
            // Move the whole chip into view when navigating with the D-pad.
            if(focused)post {
                val strip=parent as? LinearLayout
                val scroll=strip?.parent as? HorizontalScrollView
                if(scroll!=null) {
                    val inset=dp(20)
                    val leftEdge=scroll.scrollX+scroll.paddingLeft+inset
                    val rightEdge=scroll.scrollX+scroll.width-scroll.paddingRight-inset
                    val maxX=(strip.width+scroll.paddingLeft+scroll.paddingRight-scroll.width)
                        .coerceAtLeast(0)
                    when {
                        right>rightEdge -> scroll.smoothScrollTo(
                            (right+scroll.paddingRight+inset-scroll.width).coerceIn(0,maxX),0)
                        left<leftEdge -> scroll.smoothScrollTo(
                            (left-scroll.paddingLeft-inset).coerceIn(0,maxX),0)
                    }
                }
            }
            view.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
        }
    }

    private fun actionButton(label:String,primary:Boolean,click:()->Unit)=Button(this).apply {
        text=label;contentDescription=label;isAllCaps=false
        textSize=17f;typeface=Typeface.DEFAULT_BOLD;includeFontPadding=false
        gravity=Gravity.CENTER;minWidth=0;minimumWidth=0
        setPadding(dp(14),0,dp(14),0)
        stateListAnimator=null;elevation=0f
        isFocusable=true;isClickable=true
        fun style(focused:Boolean) {
            background=GradientDrawable().apply {
                setColor(when {
                    focused -> VelarisDesign.color("focus",0xFF7E57FF.toInt())
                    primary -> Color.WHITE
                    else -> 0xD034343B.toInt()
                })
                cornerRadius=dp(10).toFloat()
                if(focused)setStroke(dp(2),VelarisDesign.color("focus",0xFFDCCFFF.toInt()))
            }
            setTextColor(if(focused||!primary)Color.WHITE else 0xFF101016.toInt())
        }
        style(false)
        setOnClickListener{click()}
        setOnFocusChangeListener{v,focused->
            style(focused)
            // Focus ring, no overscan/cropped scaling at screen edges.
            v.animate().scaleX(1f).scaleY(1f).setDuration(110).start()
        }
    }

    private fun button(label:String,click:()->Unit)=Button(this).apply {
        text=label;contentDescription=label;isAllCaps=false
        textSize=17f;typeface=Typeface.DEFAULT_BOLD;includeFontPadding=false
        gravity=Gravity.CENTER
        minHeight=dp(48);setPadding(dp(16),0,dp(16),0)
        stateListAnimator=null;elevation=0f
        isFocusable=true;isClickable=true
        fun style(focused:Boolean) {
            background=GradientDrawable().apply {
                setColor(if(focused)VelarisDesign.color("focus",0xFF7E57FF.toInt())
                    else VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
                cornerRadius=dp(10).toFloat()
                if(focused)setStroke(dp(2),VelarisDesign.color("focus",0xFFDCCFFF.toInt()))
            }
            setTextColor(Color.WHITE)
        }
        style(false)
        setOnClickListener{click()}
        setOnFocusChangeListener{_,focused->style(focused)}
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
