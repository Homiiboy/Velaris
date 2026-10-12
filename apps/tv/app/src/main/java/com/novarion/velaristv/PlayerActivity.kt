package com.novarion.velaristv

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.FrameLayout
import android.widget.TextView
import android.widget.Button
import android.widget.ImageView
import android.app.AlertDialog
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.Player
import androidx.media3.common.PlaybackException
import androidx.media3.common.C
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.common.Tracks
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.ui.PlayerView
import org.json.JSONObject
import org.json.JSONArray
import java.net.URLEncoder
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

@UnstableApi
class PlayerActivity : Activity() {
    private val io = Executors.newSingleThreadExecutor()
    private var player: ExoPlayer? = null
    private var itemId = ""
    private var server = ""
    private var token = ""
    private var startTicks = 0L
    private var sessionStarted = false
    private var stoppedReported = false
    private var nextItemId = ""
    private var userId = ""
    private var mediaSourceId = ""
    private var availableTracks: Tracks? = null
    private data class MediaSegment(val type:String,val startMs:Long,val endMs:Long)
    private val mediaSegments=mutableListOf<MediaSegment>()
    private var skipIntroButton: Button? = null
    private var activeSegment: MediaSegment? = null
    private var statsText: TextView? = null
    private var titleText: TextView? = null
    private var playbackTimeText: TextView? = null
    private var nextOverlay: Button? = null
    private var nextEpisodeLabel = ""
    private var nextEpisodeImage: ImageView? = null
    private var nextResolvedFor = ""
    private var autoNextEnabled = true
    private var lastPlaybackLabel = "Auto"
    private var triedCompatibleFallback = false
    private var playbackRequestSerial = 0
    private var lastMediaInfo = ""
    private var playerViewRef: PlayerView? = null
    private var releasedPositionMs = 0L
    private var shouldResumeAfterStop = false
    private val introUiHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private val introUiTick = object : Runnable {
        override fun run() {
            updateIntroButton()
            updatePlaybackTime()
            updateNextOverlay()
            introUiHandler.postDelayed(this, 500L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        server = intent.getStringExtra("server").orEmpty()
        token = intent.getStringExtra("token").orEmpty()
        itemId = intent.getStringExtra("itemId").orEmpty()
        userId = intent.getStringExtra("userId").orEmpty()
        startTicks = intent.getLongExtra("startTicks", 0L)
        nextItemId = intent.getStringExtra("nextItemId").orEmpty()
        autoNextEnabled=getSharedPreferences("velaris_tv",MODE_PRIVATE).getBoolean("auto_next",true)
        if (server.isBlank() || token.isBlank() || itemId.isBlank()) {
            android.widget.Toast.makeText(this, "Ungültige Wiedergabeparameter", android.widget.Toast.LENGTH_LONG).show()
            finish()
            return
        }
        // The player decor view is not attached yet: applying insets here
        // crashes on Android 15 / Google TV emulators (PhoneWindow.getInsetsController).
        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        val playerView = PlayerView(this).apply {
            useController = true
            controllerShowTimeoutMs = 4000
            controllerHideOnTouch = true
            setControllerVisibilityListener(PlayerView.ControllerVisibilityListener { visibility ->
                val show = visibility == View.VISIBLE
                titleText?.visibility = if (show) View.VISIBLE else View.GONE
                playbackTimeText?.visibility = if (show) View.VISIBLE else View.GONE
                if (show) updatePlaybackTime()
            })
            setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
            // Respect the user's TV subtitle size without changing the font family.
            subtitleView?.setFractionalTextSize(
                getSharedPreferences("velaris_tv",MODE_PRIVATE).getFloat("subtitle_scale",0.0533f)
            )
        }
        playerViewRef=playerView
        root.addView(playerView, FrameLayout.LayoutParams(-1, -1))
        root.addView(TextView(this).apply {
            text = "VELARIS"; textSize = 15f; setTextColor(0x88FFFFFF.toInt()); typeface=Typeface.DEFAULT_BOLD
            setPadding(28, 18, 0, 0)
        })
        skipIntroButton = Button(this).apply {
            text = "Intro überspringen"
            contentDescription = "Intro überspringen"
            isAllCaps = false
            textSize = 17f
            setTextColor(Color.WHITE)
            background=GradientDrawable().apply{setColor(0xDDFFFFFF.toInt());cornerRadius=10f}
            setTextColor(Color.BLACK)
            stateListAnimator=null
            visibility = View.GONE
            setOnClickListener {
                val segment=activeSegment
                if(segment != null && segment.endMs > 0) {
                    player?.seekTo(segment.endMs)
                    visibility = View.GONE
                    playerView.requestFocus()
                }
            }
        }
        root.addView(skipIntroButton, FrameLayout.LayoutParams(300,72,android.view.Gravity.END or android.view.Gravity.BOTTOM).apply {
            marginEnd=42; bottomMargin=58
        })
        statsText=TextView(this).apply { textSize=14f; setTextColor(Color.WHITE); setBackgroundColor(0xAA000000.toInt()); setPadding(18,12,18,12); visibility=View.GONE }
        root.addView(statsText,FrameLayout.LayoutParams(-2,-2,android.view.Gravity.START or android.view.Gravity.TOP).apply { marginStart=28; topMargin=54 })
        titleText=TextView(this).apply{textSize=18f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD;setPadding(0,12,0,12);visibility=View.GONE}
        root.addView(titleText,FrameLayout.LayoutParams(-2,-2,android.view.Gravity.START or android.view.Gravity.BOTTOM).apply{marginStart=34;bottomMargin=42})
        playbackTimeText = TextView(this).apply {
            textSize = 16f
            setTextColor(Color.WHITE)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, 12, 0, 12)
            visibility = View.GONE
        }
        root.addView(playbackTimeText, FrameLayout.LayoutParams(-2, -2, android.view.Gravity.END or android.view.Gravity.BOTTOM).apply {
            marginEnd = 34; bottomMargin = 42
        })
        nextOverlay=Button(this).apply {
            text="Nächste Folge";textSize=17f;isAllCaps=false
            setTextColor(Color.WHITE)
            stateListAnimator=null
            background=GradientDrawable().apply{
                setColor(0xF0181822.toInt())
                cornerRadius=16f
                setStroke(2,VelarisDesign.color("accent",0xFF7C5CFC.toInt()))
            }
            visibility=View.GONE
            setOnClickListener { playNextEpisodeNow() }
        }
        root.addView(nextOverlay,FrameLayout.LayoutParams(420,90,android.view.Gravity.END or android.view.Gravity.BOTTOM).apply{marginEnd=42;bottomMargin=140})
        nextEpisodeImage=ImageView(this).apply{
            scaleType=ImageView.ScaleType.CENTER_CROP
            visibility=View.GONE
            background=GradientDrawable().apply {
                setColor(0xFF202027.toInt())
                cornerRadius=12f
            }
            clipToOutline=true
            isFocusable=false
        }
        root.addView(nextEpisodeImage,FrameLayout.LayoutParams(105,90,android.view.Gravity.END or android.view.Gravity.BOTTOM).apply{
            marginEnd=357;bottomMargin=140
        })
        VelarisDesign.load(this)
        loadPlayerTitle(itemId)
        setContentView(root)
        // Wait for the player view to attach before changing system bars.
        root.post { if(!isFinishing && !isDestroyed) immersive() }

        val exo = createPlayer()
        player = exo
        playerView.player = exo
        attachPlayerListener(exo)
        preparePlayback(exo, itemId, startTicks)
        introUiHandler.post(introUiTick)
        playerView.requestFocus()
    }

    private fun authorizationHeader():String =
        """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="1.0.0", Token="$token" """

    private fun createPlayer():ExoPlayer {
        // Authenticate HLS playlists and their segments, not just the metadata call.
        val http=DefaultHttpDataSource.Factory().setDefaultRequestProperties(
            mapOf("X-Emby-Token" to token,"Authorization" to authorizationHeader().trim())
        )
        return ExoPlayer.Builder(this)
            .setMediaSourceFactory(DefaultMediaSourceFactory(http))
            .build()
    }

    private fun attachPlayerListener(exo:ExoPlayer) {
        exo.addListener(object:Player.Listener {
            override fun onIsPlayingChanged(isPlaying:Boolean) {
                if(isPlaying && !sessionStarted) {
                    sessionStarted=true
                    report("Playing")
                } else if(!isPlaying && sessionStarted) report("Progress")
            }
            override fun onPlaybackStateChanged(state:Int) {
                if(state==Player.STATE_ENDED) {
                    nextOverlay?.visibility=View.GONE
                    reportStoppedOnce()
                    if(nextItemId.isNotBlank() && autoNextEnabled) {
                        itemId=nextItemId;nextItemId=""
                        stoppedReported=false;sessionStarted=false
                        triedCompatibleFallback=false
                        loadFollowingEpisodeAndPlay(exo,itemId)
                    } else finish()
                }
            }
            override fun onTracksChanged(tracks:Tracks) {availableTracks=tracks}
            override fun onPlayerError(error:PlaybackException) {
                Log.w("VelarisPlayback","Player error ${error.errorCodeName}",error)
                val retriable=error.errorCode in 3000..5999 ||
                    error.errorCode==PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS
                if(!triedCompatibleFallback && retriable) {
                    triedCompatibleFallback=true
                    val ticks=exo.currentPosition.coerceAtLeast(0L)*10_000L
                    android.widget.Toast.makeText(this@PlayerActivity,
                        "Versuche kompatiblen H.264/AAC-Stream …",
                        android.widget.Toast.LENGTH_LONG).show()
                    preparePlayback(exo,itemId,ticks,forceCompatible=true)
                } else {
                    showPlaybackError("Playerfehler: ${error.errorCodeName}. "+
                        "Prüfe in Jellyfin, ob Transcoding für deinen Benutzer erlaubt ist.")
                }
            }
        })
    }

    private fun showPlaybackError(message:String) {
        if(isFinishing||isDestroyed)return
        AlertDialog.Builder(this).setTitle("Wiedergabe fehlgeschlagen")
            .setMessage(message)
            .setPositiveButton("Erneut versuchen"){_,_->
                triedCompatibleFallback=false
                player?.let{preparePlayback(it,itemId,it.currentPosition.coerceAtLeast(0L)*10_000L)}
            }
            .setNegativeButton("Schließen"){_,_->finish()}
            .show()
    }

    private fun loadFollowingEpisodeAndPlay(exo: ExoPlayer, id:String) {
        io.execute {
            var following=""
            try {
                val c=URL("$server/Shows/NextUp?UserId=$userId&StartItemId=$id&Limit=1").openConnection() as HttpURLConnection
                try {
                    c.connectTimeout=6000; c.readTimeout=8000
                    c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="1.0.0", Token="$token"""")
                    if(c.responseCode in 200..299) {
                        val json=JSONObject(c.inputStream.bufferedReader().use { it.readText() })
                        val arr=json.optJSONArray("Items")
                        if(arr!=null && arr.length()>0) following=arr.getJSONObject(0).optString("Id")
                    }
                } finally { c.disconnect() }
            } catch(_:Exception) {}
            nextItemId=following
            runOnUiThread { if(!isFinishing && !isDestroyed) preparePlayback(exo,id,0L); loadPlayerTitle(id) }
        }
    }

    private fun preparePlayback(exo:ExoPlayer,id:String,resumeTicks:Long,forceCompatible:Boolean=false) {
        synchronized(mediaSegments){mediaSegments.clear()}
        activeSegment=null
        nextOverlay?.visibility=View.GONE
        nextEpisodeImage?.visibility=View.GONE
        skipIntroButton?.visibility=View.GONE
        loadMediaSegments(id)
        val request=++playbackRequestSerial
        nextOverlay?.visibility=View.GONE
        io.execute {
            val result=runCatching{resolvePlaybackUrl(id,forceCompatible)}
            runOnUiThread {
                if(isFinishing||isDestroyed||player!==exo||request!=playbackRequestSerial)return@runOnUiThread
                result.onSuccess { url ->
                    val media=MediaItem.Builder().setUri(url).apply {
                        if(url.substringBefore('?').contains(".m3u8",ignoreCase=true))
                            setMimeType(MimeTypes.APPLICATION_M3U8)
                    }.build()
                    // Apply the resume position before preparing the media source so
                    // ExoPlayer can initially buffer from the target position.
                    exo.setMediaItem(media)
                    if (resumeTicks > 0L) exo.seekTo(resumeTicks / 10_000L)
                    exo.prepare()
                    exo.playWhenReady=true
                }.onFailure { err ->
                    Log.w("VelarisPlayback","Unable to resolve playback stream",err)
                    showPlaybackError("Jellyfin konnte keinen kompatiblen Videostream bereitstellen. "+
                        (err.message?:"Unbekannter Serverfehler")+
                        "\nPrüfe die Jellyfin-Transcoding-Berechtigung und FFmpeg.")
                }
            }
        }
    }

    private fun loadNextEpisodeThumbnail(id:String) {
        io.execute {
            val bitmap=runCatching {
                val connection=URL("$server/Items/$id/Images/Primary?maxWidth=220").openConnection() as HttpURLConnection
                try {
                    connection.connectTimeout=5000
                    connection.readTimeout=7000
                    connection.setRequestProperty("X-Emby-Token",token)
                    if(connection.responseCode in 200..299)
                        android.graphics.BitmapFactory.decodeStream(connection.inputStream)
                    else null
                } finally {connection.disconnect()}
            }.getOrNull()
            runOnUiThread {
                if(itemId.isNotBlank() && nextItemId==id && !isFinishing){
                    nextEpisodeImage?.setImageBitmap(bitmap)
                    if(bitmap!=null && nextOverlay?.visibility==View.VISIBLE)
                        nextEpisodeImage?.visibility=View.VISIBLE
                }
            }
        }
    }

    private fun playNextEpisodeNow() {
        val target=nextItemId
        val exo=player
        if(target.isBlank() || exo==null)return
        reportStoppedOnce()
        nextOverlay?.visibility=View.GONE
        nextItemId=""
        itemId=target
        stoppedReported=false
        sessionStarted=false
        triedCompatibleFallback=false
        loadFollowingEpisodeAndPlay(exo,target)
    }

    private fun updateNextOverlay() {
        val exo=player ?: return
        val button=nextOverlay ?: return
        val total=exo.duration
        val remaining=if(total>0L && total!=C.TIME_UNSET)total-exo.currentPosition else Long.MAX_VALUE
        if(nextItemId.isBlank()||remaining !in 1..90_000L) {
            if(button.visibility==View.VISIBLE)button.visibility=View.GONE
            nextEpisodeImage?.visibility=View.GONE
            return
        }
        val seconds=((remaining+999L)/1000L).coerceAtLeast(1L)
        button.text="▶  Nächste Folge\n${nextEpisodeLabel.ifBlank{"Jetzt weiterschauen"}} · ${seconds}s"
        if(button.visibility!=View.VISIBLE)button.visibility=View.VISIBLE
        if(nextEpisodeImage?.drawable!=null)nextEpisodeImage?.visibility=View.VISIBLE
    }

    // Resolve the actual next episode from this series, rather than guessing an ID.
    private fun resolveFollowingEpisode(current:JSONObject,id:String) {
        val seriesId=current.optString("SeriesId")
        if(seriesId.isBlank())return
        nextResolvedFor=id
        io.execute {
            var following=""
            var label=""
            try {
                val path="/Shows/$seriesId/Episodes?UserId=$userId&Limit=1000&Fields=Overview,PrimaryImageAspectRatio"
                val connection=URL("$server$path").openConnection() as HttpURLConnection
                try {
                    connection.connectTimeout=6000
                    connection.readTimeout=10000
                    connection.setRequestProperty("Authorization",authorizationHeader().trim())
                    if(connection.responseCode in 200..299) {
                        val json=JSONObject(connection.inputStream.bufferedReader().use{it.readText()})
                        val episodes=json.optJSONArray("Items") ?: JSONArray()
                        for(index in 0 until episodes.length()-1) {
                            if(episodes.optJSONObject(index)?.optString("Id")==id) {
                                val next=episodes.optJSONObject(index+1)
                                following=next?.optString("Id").orEmpty()
                                label=next?.optString("Name").orEmpty()
                                break
                            }
                        }
                    }
                } finally { connection.disconnect() }
            } catch(_:Exception) {}
            runOnUiThread {
                if(itemId==id && nextResolvedFor==id && !isFinishing) {
                    nextItemId=following
                    nextEpisodeLabel=label
                    nextOverlay?.visibility=View.GONE
                    nextEpisodeImage?.visibility=View.GONE
                    nextEpisodeImage?.setImageDrawable(null)
                    if(following.isNotBlank())loadNextEpisodeThumbnail(following)
                }
            }
        }
    }

    private fun loadPlayerTitle(id:String) {
        io.execute {
            try {
                val c=URL("$server/Users/$userId/Items/$id").openConnection() as HttpURLConnection
                try {
                    c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="1.0.0", Token="$token"""")
                    if(c.responseCode in 200..299) {
                        val x=JSONObject(c.inputStream.bufferedReader().use{it.readText()})
                        val name=x.optString("Name");val series=x.optString("SeriesName");val season=x.optInt("ParentIndexNumber",0);val ep=x.optInt("IndexNumber",0)
                        val label=if(series.isNotBlank()) "$series  •  S$season:E$ep  •  $name" else name
                        runOnUiThread {
                            if(itemId==id) {
                                titleText?.text=label
                                if(x.optString("Type")=="Episode")resolveFollowingEpisode(x,id)
                            }
                        }
                    }
                } finally {c.disconnect()}
            } catch(_:Exception){}
        }
    }

    private fun loadMediaSegments(id:String) {
        io.execute {
            try {
                val types=URLEncoder.encode("Intro,Recap,Outro,Credits,Preview","UTF-8")
                val c=URL("$server/MediaSegments/$id?includeSegmentTypes=$types").openConnection() as HttpURLConnection
                try {
                    c.connectTimeout=6000; c.readTimeout=8000
                    c.setRequestProperty("Accept","application/json")
                    c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="1.0.0", Token="$token"""")
                    if(c.responseCode in 200..299) {
                        val json=JSONObject(c.inputStream.bufferedReader().use { it.readText() })
                        val arr=json.optJSONArray("Items")
                        val loaded=mutableListOf<MediaSegment>()
                        if(arr!=null) for(i in 0 until arr.length()) {
                            val s=arr.getJSONObject(i)
                            val type=s.optString("Type")
                            val start=s.optLong("StartTicks",0L)/10_000L
                            val end=s.optLong("EndTicks",0L)/10_000L
                            if(type.isNotBlank() && end>start) loaded.add(MediaSegment(type,start,end))
                        }
                        synchronized(mediaSegments) { mediaSegments.clear(); mediaSegments.addAll(loaded) }
                    }
                } finally { c.disconnect() }
            } catch(_:Exception) {}
        }
    }

    private fun formatPlaybackTime(ms: Long): String {
        val seconds = (ms.coerceAtLeast(0L) / 1000L)
        val hours = seconds / 3600L
        val minutes = (seconds % 3600L) / 60L
        val remainder = seconds % 60L
        return if (hours > 0L) "%d:%02d:%02d".format(hours, minutes, remainder)
        else "%02d:%02d".format(minutes, remainder)
    }

    private fun updatePlaybackTime() {
        val view = playbackTimeText ?: return
        if (view.visibility != View.VISIBLE) return
        val exo = player ?: return
        val position = exo.currentPosition.coerceAtLeast(0L)
        val duration = exo.duration
        view.text = if (duration > 0L && duration != C.TIME_UNSET) {
            "${formatPlaybackTime(position)} / ${formatPlaybackTime(duration)}"
        } else formatPlaybackTime(position)
    }

    private fun updateIntroButton() {
        val p=player ?: return
        val current=p.currentPosition
        val segment=synchronized(mediaSegments) { mediaSegments.firstOrNull { current in it.startMs until it.endMs } }
        activeSegment=segment
        val button=skipIntroButton ?: return
        if(segment!=null) {
            val prefs=getSharedPreferences("velaris_tv",MODE_PRIVATE)
            val auto=when(segment.type.lowercase()) { "intro"->prefs.getBoolean("auto_skip_intro",false); "recap"->prefs.getBoolean("auto_skip_recap",false); "outro","credits"->prefs.getBoolean("auto_skip_credits",false); else->false }
            if(auto) { p.seekTo(segment.endMs); button.visibility=View.GONE; return }
            button.text=when(segment.type.lowercase()) {
                "recap" -> "Rückblick überspringen"
                "outro","credits" -> if(nextItemId.isNotBlank()) "Nächste Folge" else "Abspann überspringen"
                "preview" -> "Vorschau überspringen"
                else -> "Intro überspringen"
            }
            button.contentDescription=button.text
            if(button.visibility!=View.VISIBLE) { button.visibility=View.VISIBLE; button.requestFocus() }
        } else if(button.visibility==View.VISIBLE) {
            button.visibility=View.GONE
        }
    }

    private fun emulatorSafeDeviceProfile():JSONObject {
        // Conservative profile suitable for emulator software decoders.
        // Jellyfin chooses direct play for supported MP4/H.264/AAC sources;
        // on incompatible codecs it can return an HLS transcode URL.
        val direct=JSONArray().put(JSONObject()
            .put("Type","Video").put("Container","mp4,m4v,mov")
            .put("VideoCodec","h264").put("AudioCodec","aac,mp3"))
        val transcode=JSONArray().put(JSONObject()
            .put("Type","Video").put("Context","Streaming")
            .put("Protocol","hls").put("Container","ts")
            .put("VideoCodec","h264").put("AudioCodec","aac")
            .put("Conditions",JSONArray()))
        return JSONObject().put("Name","Velaris Android TV (H.264/AAC)")
            .put("MaxStreamingBitrate",getSharedPreferences("velaris_tv",MODE_PRIVATE)
                .getInt("max_video_bitrate",8_000_000))
            .put("MaxStaticBitrate",8_000_000)
            .put("DirectPlayProfiles",direct)
            .put("TranscodingProfiles",transcode)
            .put("SubtitleProfiles",JSONArray())
            .put("CodecProfiles",JSONArray())
            .put("ContainerProfiles",JSONArray())
    }

    private fun resolvePlaybackUrl(id:String,forceCompatible:Boolean=false):String {
        val preferred=getSharedPreferences("velaris_tv",MODE_PRIVATE).getInt("max_video_bitrate",8_000_000)
        val bitrate=preferred.coerceIn(2_000_000,20_000_000)
        val body=JSONObject()
            .put("UserId",userId)
            .put("StartTimeTicks",0L)
            .put("IsPlayback",true)
            .put("AutoOpenLiveStream",true)
            .put("EnableDirectPlay",!forceCompatible)
            .put("EnableDirectStream",!forceCompatible)
            .put("EnableTranscoding",true)
            .put("AllowVideoStreamCopy",!forceCompatible)
            .put("AllowAudioStreamCopy",!forceCompatible)
            .put("MaxStreamingBitrate",bitrate)
            .put("DeviceProfile",emulatorSafeDeviceProfile())
            .toString()
        val c=URL("$server/Items/$id/PlaybackInfo").openConnection() as HttpURLConnection
        try {
            c.requestMethod="POST"
            c.doOutput=true;c.connectTimeout=8000;c.readTimeout=12000
            c.setRequestProperty("Content-Type","application/json")
            c.setRequestProperty("Accept","application/json")
            c.setRequestProperty("Authorization",authorizationHeader().trim())
            c.outputStream.use{it.write(body.toByteArray())}
            val status=c.responseCode
            if(status !in 200..299)throw IllegalStateException("PlaybackInfo HTTP $status")
            val json=JSONObject(c.inputStream.bufferedReader().use{it.readText()})
            val sources=json.optJSONArray("MediaSources")?:throw IllegalStateException("Keine Medienquelle")
            if(sources.length()==0)throw IllegalStateException("Keine Medienquelle")
            val source=sources.getJSONObject(0)
            mediaSourceId=source.optString("Id")
            val streams=source.optJSONArray("MediaStreams")
            var video:JSONObject?=null
            if(streams!=null)for(i in 0 until streams.length()){
                val candidate=streams.getJSONObject(i)
                if(candidate.optString("Type")=="Video"){video=candidate;break}
            }
            lastMediaInfo=listOfNotNull(
                video?.optString("Codec")?.uppercase()?.takeIf{it.isNotBlank()},
                video?.optInt("Width")?.takeIf{it>0}?.let{"$it px"},
                source.optLong("Bitrate").takeIf{it>0}?.let{"${it/1_000_000} Mbps"}
            ).joinToString(" • ")
            val transcode=source.optString("TranscodingUrl")
            if(transcode.isNotBlank()){
                lastPlaybackLabel="Transcoding (H.264/AAC)"
                return if(transcode.startsWith("http",ignoreCase=true))transcode else server+transcode
            }
            if(forceCompatible)throw IllegalStateException(
                "Der Server hat keinen HLS-Transcoding-Stream geliefert."
            )
            if(!source.optBoolean("SupportsDirectPlay",true))
                throw IllegalStateException("Jellyfin erlaubt für diesen Titel weder Direct Play noch Transcoding.")
            lastPlaybackLabel="Direct Play"
            val container=source.optString("Container","mp4").split(",")
                .firstOrNull().orEmpty().ifBlank{"mp4"}
            val encoded=URLEncoder.encode(mediaSourceId,"UTF-8")
            return "$server/Videos/$id/stream.$container?Static=true&MediaSourceId=$encoded&api_key=$token"
        }finally{c.disconnect()}
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            when (event.keyCode) {
                KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> { if (player?.isPlaying == true) player?.pause() else player?.play(); return true }
                KeyEvent.KEYCODE_MEDIA_PLAY -> { player?.play(); return true }
                KeyEvent.KEYCODE_MEDIA_PAUSE -> { player?.pause(); return true }
                KeyEvent.KEYCODE_MEDIA_FAST_FORWARD -> { player?.seekForward(); return true }
                KeyEvent.KEYCODE_MEDIA_REWIND -> { player?.seekBack(); return true }
                KeyEvent.KEYCODE_MENU, KeyEvent.KEYCODE_SETTINGS -> { showTrackMenu(); return true }
                KeyEvent.KEYCODE_INFO -> { toggleStats(); return true }
                KeyEvent.KEYCODE_PROG_BLUE -> { showQualityMenu(); return true }
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun toggleStats() {
        val v=statsText ?: return
        if(v.visibility==View.VISIBLE) v.visibility=View.GONE else { v.text="Velaris Wiedergabe\n$lastPlaybackLabel${if(lastMediaInfo.isNotBlank()) "\n$lastMediaInfo" else ""}"; v.visibility=View.VISIBLE }
    }

    private fun showQualityMenu() {
        val values=intArrayOf(4_000_000,8_000_000,12_000_000,20_000_000)
        val labels=arrayOf("Datensparend · 4 Mbit/s","Standard · 8 Mbit/s",
            "Hoch · 12 Mbit/s","Maximum · 20 Mbit/s")
        val current=getSharedPreferences("velaris_tv",MODE_PRIVATE).getInt("max_video_bitrate",8_000_000)
        val selected=values.indexOf(current).coerceAtLeast(0)
        AlertDialog.Builder(this).setTitle("Streamingqualität")
            .setSingleChoiceItems(labels,selected) { dialog,index ->
                getSharedPreferences("velaris_tv",MODE_PRIVATE).edit()
                    .putInt("max_video_bitrate",values[index]).apply()
                dialog.dismiss()
                val exo=player
                if(exo!=null) {
                    val position=exo.currentPosition.coerceAtLeast(0L)*10_000L
                    preparePlayback(exo,itemId,position)
                }
            }.setNegativeButton("Abbrechen",null).show()
    }

    private fun showTrackMenu() {
        val exo=player ?: return
        val tracks=availableTracks ?: return
        val choices=mutableListOf<Pair<String,Pair<Tracks.Group,Int>>>()
        for(group in tracks.groups) {
            if(group.type!=C.TRACK_TYPE_AUDIO && group.type!=C.TRACK_TYPE_TEXT) continue
            for(i in 0 until group.length) {
                if(!group.isTrackSupported(i)) continue
                val format=group.getTrackFormat(i)
                val kind=if(group.type==C.TRACK_TYPE_AUDIO) "Audio" else "Untertitel"
                val label=format.label ?: format.language ?: "Spur ${i+1}"
                choices.add("$kind: $label" to (group to i))
            }
        }
        val labels=mutableListOf("Untertitel aus")
        labels.addAll(choices.map{it.first})
        AlertDialog.Builder(this).setTitle("Audio & Untertitel").setItems(labels.toTypedArray()) { _,which ->
            if(which==0) {
                exo.trackSelectionParameters=exo.trackSelectionParameters.buildUpon().setTrackTypeDisabled(C.TRACK_TYPE_TEXT,true).build()
            } else {
                val (group,index)=choices[which-1].second
                val builder=exo.trackSelectionParameters.buildUpon()
                if(group.type==C.TRACK_TYPE_TEXT) builder.setTrackTypeDisabled(C.TRACK_TYPE_TEXT,false)
                builder.setOverrideForType(TrackSelectionOverride(group.mediaTrackGroup,index))
                exo.trackSelectionParameters=builder.build()
            }
        }.setNegativeButton("Schließen",null).show()
    }

    override fun onStop() {
        val p=player
        if(p!=null) { releasedPositionMs=p.currentPosition; shouldResumeAfterStop=!isFinishing }
        reportStoppedOnce()
        p?.release(); player=null
        super.onStop()
    }

    override fun onStart() {
        super.onStart()
        if(player==null && shouldResumeAfterStop && server.isNotBlank() && itemId.isNotBlank()) {
            val exo=createPlayer()
            player=exo;playerViewRef?.player=exo
            attachPlayerListener(exo)
            stoppedReported=false; sessionStarted=false; shouldResumeAfterStop=false
            preparePlayback(exo,itemId,releasedPositionMs*10_000L)
        }
    }

    override fun onDestroy() { introUiHandler.removeCallbacks(introUiTick); io.shutdownNow(); super.onDestroy() }

    private fun reportStoppedOnce() {
        if (stoppedReported) return
        stoppedReported = true
        report("Stopped")
    }

    private fun report(kind: String) {
        val p = player ?: return
        val body = JSONObject()
            .put("ItemId", itemId)
            .put("PositionTicks", p.currentPosition * 10_000L)
            .put("IsPaused", !p.isPlaying)
            .put("CanSeek", true)
            .toString()
        io.execute {
            try {
                val endpoint = when(kind) {
                    "Playing" -> "/Sessions/Playing"
                    "Stopped" -> "/Sessions/Playing/Stopped"
                    else -> "/Sessions/Playing/Progress"
                }
                val c = URL(server + endpoint).openConnection() as HttpURLConnection
                try {
                c.requestMethod = "POST"; c.doOutput = true; c.connectTimeout = 6000; c.readTimeout = 6000
                c.setRequestProperty("Content-Type","application/json")
                c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="1.0.0", Token="$token"""")
                c.outputStream.use { it.write(body.toByteArray()) }
                c.responseCode
                } finally { c.disconnect() }
            } catch (_: Exception) {}
        }
    }

    private fun immersive() {
        // Never use Window.getInsetsController() before its DecorView exists.
        // The attached decor view returns null safely if insets are not ready.
        val decor = window.decorView
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            decor.windowInsetsController?.apply {
                hide(WindowInsets.Type.systemBars())
                systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            @Suppress("DEPRECATION")
            decor.systemUiVisibility = 5894
        }
    }
}
