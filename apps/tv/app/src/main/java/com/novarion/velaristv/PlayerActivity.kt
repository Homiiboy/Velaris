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
    private var nextOverlay: TextView? = null
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
        immersive()

        val root = FrameLayout(this).apply { setBackgroundColor(Color.BLACK) }
        val playerView = PlayerView(this).apply {
            useController = true
            controllerShowTimeoutMs = 4000
            controllerHideOnTouch = true
            setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
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
        titleText=TextView(this).apply{textSize=18f;setTextColor(Color.WHITE);typeface=Typeface.DEFAULT_BOLD;setBackgroundColor(0x77000000);setPadding(20,12,20,12)}
        root.addView(titleText,FrameLayout.LayoutParams(-2,-2,android.view.Gravity.START or android.view.Gravity.BOTTOM).apply{marginStart=34;bottomMargin=42})
        nextOverlay=TextView(this).apply{text="Nächste Folge";textSize=16f;setTextColor(Color.WHITE);setBackgroundColor(0xAA202026.toInt());setPadding(18,12,18,12);visibility=View.GONE}
        root.addView(nextOverlay,FrameLayout.LayoutParams(-2,-2,android.view.Gravity.END or android.view.Gravity.BOTTOM).apply{marginEnd=42;bottomMargin=140})
        loadPlayerTitle(itemId)
        setContentView(root)

        val exo = createPlayer()
        player = exo
        playerView.player = exo
        attachPlayerListener(exo)
        preparePlayback(exo, itemId, startTicks)
        introUiHandler.post(introUiTick)
        playerView.requestFocus()
    }

    private fun authorizationHeader():String =
        """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="0.7.0", Token="$token" """

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
                    c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="0.7.0", Token="$token"""")
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
        skipIntroButton?.visibility=View.GONE
        loadMediaSegments(id)
        val request=++playbackRequestSerial
        io.execute {
            val result=runCatching{resolvePlaybackUrl(id,forceCompatible)}
            runOnUiThread {
                if(isFinishing||isDestroyed||player!==exo||request!=playbackRequestSerial)return@runOnUiThread
                result.onSuccess { url ->
                    val media=MediaItem.Builder().setUri(url).apply {
                        if(url.substringBefore('?').contains(".m3u8",ignoreCase=true))
                            setMimeType(MimeTypes.APPLICATION_M3U8)
                    }.build()
                    exo.setMediaItem(media)
                    exo.prepare()
                    if(resumeTicks>0)exo.seekTo(resumeTicks/10_000L)
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

    private fun loadPlayerTitle(id:String) {
        io.execute {
            try {
                val c=URL("$server/Users/$userId/Items/$id").openConnection() as HttpURLConnection
                try {
                    c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="0.7.0", Token="$token"""")
                    if(c.responseCode in 200..299) {
                        val x=JSONObject(c.inputStream.bufferedReader().use{it.readText()})
                        val name=x.optString("Name");val series=x.optString("SeriesName");val season=x.optInt("ParentIndexNumber",0);val ep=x.optInt("IndexNumber",0)
                        val label=if(series.isNotBlank()) "$series  •  S$season:E$ep  •  $name" else name
                        runOnUiThread{titleText?.text=label}
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
                    c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="0.7.0", Token="$token"""")
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
            .put("MaxStreamingBitrate",8_000_000)
            .put("MaxStaticBitrate",8_000_000)
            .put("DirectPlayProfiles",direct)
            .put("TranscodingProfiles",transcode)
            .put("SubtitleProfiles",JSONArray())
            .put("CodecProfiles",JSONArray())
            .put("ContainerProfiles",JSONArray())
    }

    private fun resolvePlaybackUrl(id:String,forceCompatible:Boolean=false):String {
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
            .put("MaxStreamingBitrate",8_000_000)
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
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun toggleStats() {
        val v=statsText ?: return
        if(v.visibility==View.VISIBLE) v.visibility=View.GONE else { v.text="Velaris Wiedergabe\n$lastPlaybackLabel${if(lastMediaInfo.isNotBlank()) "\n$lastMediaInfo" else ""}"; v.visibility=View.VISIBLE }
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
                c.setRequestProperty("Authorization", """MediaBrowser Client="Velaris TV", Device="Android TV", DeviceId="velaris-tv", Version="0.7.0", Token="$token"""")
                c.outputStream.use { it.write(body.toByteArray()) }
                c.responseCode
                } finally { c.disconnect() }
            } catch (_: Exception) {}
        }
    }

    private fun immersive() {
        if (android.os.Build.VERSION.SDK_INT >= 30) window.insetsController?.apply {
            hide(WindowInsets.Type.systemBars())
            systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        } else @Suppress("DEPRECATION") run { window.decorView.systemUiVisibility = 5894 }
    }
}
