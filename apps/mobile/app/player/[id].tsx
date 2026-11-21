import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '@/context/AuthContext';
import { buildPlaybackUrl, getEpisodes, getPrimaryImageUrl, getItem, getMediaSegments, normalizeMediaSegments, getNextEpisode, getPlaybackInfo, getSeasons, reportPlaybackProgress, reportPlaybackStart, reportPlaybackStopped } from '@/services/jellyfin';
import type { JellyfinItem, JellyfinMediaSource, JellyfinPlaybackInfo } from '@/types/jellyfin';
import { colors } from '@/theme';
import { useVelarisTheme } from '@/context/ThemeContext';
import { defaultPluginSettings,loadPluginSettings,type PluginSettings } from '@/services/pluginSettings';
import { CastControls } from '@/components/CastControls';
import { downloadItem, isDownloaded, removeDownload } from '@/services/downloads';

const ticks=(seconds:number)=>Math.max(0,Math.floor(seconds*10_000_000));
const formatTime=(seconds:number)=>{
 const whole=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 const hours=Math.floor(whole/3600);
 const minutes=Math.floor((whole%3600)/60);
 const rest=whole%60;
 return hours>0?`${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`:
 `${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}`;
};

export default function PlayerScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
 const {accentColor}=useVelarisTheme();
 const {width:viewportWidth,height:viewportHeight}=useWindowDimensions();
 const goBack=()=>{if(router.canGoBack())router.back();else router.replace('/(tabs)/home')};
 const [downloaded,setDownloaded]=useState(false); const [downloading,setDownloading]=useState(false); const [downloadProgress,setDownloadProgress]=useState(0); const [downloadError,setDownloadError]=useState(''); const [item,setItem]=useState<JellyfinItem|null>(null); const [info,setInfo]=useState<JellyfinPlaybackInfo|null>(null); const [url,setUrl]=useState('');
 const [quality,setQuality]=useState<number|undefined>();
 const [preparing,setPreparing]=useState(false);
 const [settingsSheet,setSettingsSheet]=useState<'tracks'|'quality'|null>(null);
 const [episodeSheet,setEpisodeSheet]=useState(false);
 const [episodeOptions,setEpisodeOptions]=useState<JellyfinItem[]>([]);
 const [selectedSeason,setSelectedSeason]=useState<number|null>(null);
 useEffect(()=>setSelectedSeason(null),[id]);
 const [fullscreen,setFullscreen]=useState(false);
 const [controlsVisible,setControlsVisible]=useState(true);
 const [playing,setPlaying]=useState(false);
 const [seekWidth,setSeekWidth]=useState(1);
 const [plugins,setPlugins]=useState<PluginSettings>(defaultPluginSettings); const [segments,setSegments]=useState<{Type:string;StartTicks:number;EndTicks:number}[]>([]); const [position,setPosition]=useState(0); const [audio,setAudio]=useState<number|undefined>(); const [subtitle,setSubtitle]=useState<number|undefined>(); const [error,setError]=useState(''); const [nextEpisode,setNextEpisode]=useState<JellyfinItem|null>(null); const [autoPlay,setAutoPlay]=useState(true);
 const lastReport=useRef(0); const stopped=useRef(false); const resumeAt=useRef(0); const didResume=useRef(false);
 const pendingSeek=useRef<number|null>(null);
 const skippedSegment=useRef<string>('');
 const source: JellyfinMediaSource|undefined=info?.MediaSources?.[0];
 const player=useVideoPlayer(url||null,p=>{p.timeUpdateEventInterval=5;p.loop=false;});

 async function prepare(a=audio,s=subtitle,bitrate=quality){
  if(!session||!id)return;
  pendingSeek.current=Math.max(0,player.currentTime||resumeAt.current);
  setPreparing(true);setError('');
  try{const media=await getPlaybackInfo(session,id,a,s,bitrate);setInfo(media);setUrl(buildPlaybackUrl(session,id,media));}
  catch(e){
   // Jellyfin can return 500 from PlaybackInfo even though the static video stream itself is available.
   // Fall back to the same authenticated direct stream endpoint used by downloads instead of blocking playback.
   setInfo(null);
   const p=new URLSearchParams({static:'true',api_key:session.accessToken});
   setUrl(`${session.serverUrl}/Videos/${id}/stream?${p}`);
   setError('');
  } finally {setPreparing(false)}
 }
 useEffect(()=>{loadPluginSettings().then(setPlugins)},[]);
 useEffect(()=>{if(session&&id)isDownloaded(session,id).then(setDownloaded)},[session,id]);
 useEffect(()=>{if(!session||!id)return;getMediaSegments(session,id).then(x=>setSegments(normalizeMediaSegments(x))).catch(()=>setSegments([]));getItem(session,id).then(async x=>{if(x.Type==='Series'){try{const seasons=await getSeasons(session,x.Id);const firstSeason=seasons.Items[0];if(firstSeason){const eps=await getEpisodes(session,x.Id,firstSeason.Id);const target=eps.Items.find(ep=>(ep.UserData?.PlaybackPositionTicks??0)>0)||eps.Items.find(ep=>!ep.UserData?.Played)||eps.Items[0];if(target){router.replace({pathname:'/player/[id]',params:{id:target.Id}});return}}}catch{}setError('Keine abspielbare Episode gefunden.');return}setItem(x);if(x.Type==='Episode'){
    getNextEpisode(session,x).then(setNextEpisode).catch(()=>{});
    if(x.SeriesId)getSeasons(session,x.SeriesId).then(async result=>{const lists=await Promise.allSettled(result.Items.map(season=>getEpisodes(session,x.SeriesId!,season.Id)));setEpisodeOptions(lists.flatMap(list=>list.status==='fulfilled'?list.value.Items:[]))}).catch(()=>setEpisodeOptions([]));
   }resumeAt.current=(x.UserData?.PlaybackPositionTicks||0)/10_000_000;didResume.current=false;prepare().catch(()=>{})}).catch(()=>setError('Medium konnte nicht geladen werden.'));return()=>{}},[session,id]);
 useEffect(()=>{if(!url||!session||!item)return; stopped.current=false; const method=source?.TranscodingUrl?'Transcode':source?.DirectStreamUrl?'DirectStream':'DirectPlay';
   reportPlaybackStart(session,{ItemId:item.Id,MediaSourceId:source?.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(player.currentTime),PlayMethod:method}).catch(()=>{});
   const interval=setInterval(()=>{const now=Date.now();if(now-lastReport.current<4000)return;lastReport.current=now;reportPlaybackProgress(session,{ItemId:item.Id,MediaSourceId:source?.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(player.currentTime),IsPaused:!player.playing,PlayMethod:method}).catch(()=>{})},5000);
   return()=>{clearInterval(interval);if(!stopped.current){stopped.current=true;reportPlaybackStopped(session,{ItemId:item.Id,MediaSourceId:source?.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(player.currentTime),PlayMethod:method}).catch(()=>{})}}
 },[url,session,item,source?.Id,info?.PlaySessionId]);
 useEffect(()=>{if(url){didResume.current=false;player.replace(url);player.play()}},[url]);
 useEffect(()=>{const sub=player.addListener('statusChange',({status})=>{if(status==='readyToPlay'&&!didResume.current){didResume.current=true;const target=pendingSeek.current??resumeAt.current;pendingSeek.current=null;if(target>0)player.currentTime=target;player.play()}});return()=>sub.remove()},[player]);
 useEffect(()=>{const sub=player.addListener('timeUpdate',({currentTime})=>setPosition(currentTime));return()=>sub.remove()},[player]);
 useEffect(()=>{const sub=player.addListener('playingChange',({isPlaying})=>{setPlaying(isPlaying);if(!isPlaying)setControlsVisible(true)});return()=>sub.remove()},[player]);
 // Playback ticks must not reset the inactivity timer.
 useEffect(()=>{if(!fullscreen||!controlsVisible||!playing||settingsSheet||episodeSheet)return;const timer=setTimeout(()=>setControlsVisible(false),10000);return()=>clearTimeout(timer)},[fullscreen,controlsVisible,playing,settingsSheet,episodeSheet]);
 useEffect(()=>{const sub=player.addListener('playToEnd',()=>{if(autoPlay&&plugins.autoNext&&nextEpisode)router.replace({pathname:'/player/[id]',params:{id:nextEpisode.Id}})});return()=>sub.remove()},[player,autoPlay,nextEpisode]);
 useEffect(()=>{
   const segment=segments.find(candidate=>position>=candidate.StartTicks/10_000_000 &&
     position<candidate.EndTicks/10_000_000);
   if(!segment)return;
   const type=segment.Type.toLowerCase();
   const intro=type.includes('intro')||type.includes('recap');
   const credits=type.includes('outro')||type.includes('credit');
   const enabled=(intro&&plugins.introSkipper&&plugins.autoSkipIntro)||
     (credits&&plugins.creditsSkip&&plugins.autoSkipCredits);
   if(!enabled)return;
   const end=segment.EndTicks/10_000_000;
   const token=`${id}:${segment.StartTicks}:${segment.EndTicks}`;
   if(end<=position||skippedSegment.current===token)return;
   skippedSegment.current=token;
   player.currentTime=end;
 },[segments,position,plugins,id,player]);
 if(!session)return <Redirect href="/connect"/>;
 const showNextPrompt=!!nextEpisode && position>5 &&
   !!item?.RunTimeTicks && (item.RunTimeTicks/10_000_000-position)<=90 &&
   position<(item.RunTimeTicks/10_000_000);
 const streams=source?.MediaStreams||[]; const activeSegment=segments.find(s=>position>=s.StartTicks/10_000_000&&position<s.EndTicks/10_000_000); const segmentType=(activeSegment?.Type||'').toLowerCase(); const canSkip=!!activeSegment&&((plugins.introSkipper&&(segmentType.includes('intro')||segmentType.includes('recap')))||(plugins.creditsSkip&&(segmentType.includes('outro')||segmentType.includes('credit')))); const audios=streams.filter(x=>x.Type==='Audio'); const subs=streams.filter(x=>x.Type==='Subtitle');
 async function selectAudio(index:number){setAudio(index);await prepare(index,subtitle)}
 async function selectSubtitle(index:number|undefined){setSubtitle(index);await prepare(audio,index)}
 async function selectQuality(value:number|undefined){setQuality(value);await prepare(audio,subtitle,value)}
 const duration=Number.isFinite(player.duration)&&player.duration>0?player.duration:(item?.RunTimeTicks??0)/10_000_000;
 const skipBy=(offset:number)=>{player.currentTime=Math.max(0,Math.min(duration||Infinity,(player.currentTime||0)+offset));setControlsVisible(true)};
 const seekTo=(fraction:number)=>{if(duration>0){player.currentTime=Math.min(duration,Math.max(0,fraction)*duration);setControlsVisible(true)}};
 const videoControls=(large:boolean)=>{
 if(!large)return <View style={styles.inlineChrome} pointerEvents="box-none">
   <Pressable accessibilityRole="button" accessibilityLabel={playing?'Wiedergabe pausieren':'Wiedergabe fortsetzen'} style={styles.inlinePlay} onPress={()=>playing?player.pause():player.play()}><Text style={styles.inlinePlayText}>{playing?'Ⅱ':'▶'}</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Vollbild öffnen" onPress={()=>{setFullscreen(true);setControlsVisible(true)}} style={styles.inlineFullscreen}><Text style={styles.inlineFullscreenText}>⛶  Vollbild</Text></Pressable>
 </View>;
 return <View style={[styles.cinematicOverlay,styles.fullOverlay]} pointerEvents="box-none">
   {(!large||controlsVisible)&&<View style={styles.overlayHeader}>
     <Pressable accessibilityRole="button" accessibilityLabel={large?'Vollbild verlassen':'Zurück'} onPress={()=>large?setFullscreen(false):goBack()} style={styles.overlayIcon}><Text style={styles.overlayIconText}>‹</Text></Pressable>
     <View style={{flex:1}}><Text numberOfLines={1} style={styles.overlayTitle}>{item?.SeriesName||item?.Name||'VELARIS'}</Text>{!!item?.SeriesName&&<Text numberOfLines={1} style={styles.overlaySubtitle}>{item.Name}</Text>}</View>
   </View>}
   {(!large||controlsVisible)&&<View style={styles.overlayCenter} pointerEvents="box-none">
     <Pressable accessibilityRole="button" accessibilityLabel="10 Sekunden zurück" onPress={()=>skipBy(-10)} style={styles.overlayCircle}><Text style={styles.overlayControlText}>↶ 10</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel={playing?'Pause':'Abspielen'} onPress={()=>{if(playing)player.pause();else player.play();setControlsVisible(true)}} style={styles.overlayMainCircle}><Text style={styles.overlayMainText}>{playing?'Ⅱ':'▶'}</Text></Pressable>
     <Pressable accessibilityRole="button" accessibilityLabel="10 Sekunden vor" onPress={()=>skipBy(10)} style={styles.overlayCircle}><Text style={styles.overlayControlText}>10 ↷</Text></Pressable>
   </View>}
   {(!large||controlsVisible)&&<View style={styles.overlayBottom}>
     {canSkip&&<Pressable style={styles.overlaySkip} onPress={()=>{if(activeSegment)player.currentTime=activeSegment.EndTicks/10_000_000}}><Text style={styles.overlaySkipText}>{segmentType.includes('intro')?'Intro':segmentType.includes('recap')?'Rückblick':'Abspann'} überspringen ›</Text></Pressable>}
     {showNextPrompt&&nextEpisode&&<Pressable style={styles.overlayNext} onPress={()=>router.replace({pathname:'/player/[id]',params:{id:nextEpisode.Id}})}><Text style={styles.overlayNextText}>Nächste Episode ›</Text></Pressable>}
     <Pressable accessibilityRole="adjustable" accessibilityLabel="Wiedergabeposition" accessibilityValue={{min:0,max:100,now:duration?Math.round(position/duration*100):0}} disabled={!duration} onLayout={e=>setSeekWidth(e.nativeEvent.layout.width)} onPress={e=>seekTo(e.nativeEvent.locationX/seekWidth)} style={styles.overlaySeekTouch}>
       <View style={styles.overlaySeekTrack}><View style={[styles.overlaySeekFill,{width:`${duration?Math.min(100,position/duration*100):0}%`,backgroundColor:accentColor}]}/></View>
     </Pressable>
     <View style={styles.overlayTime}><Text style={styles.overlayTimeText}>{formatTime(position)}</Text><Text style={styles.overlayTimeText}>{formatTime(duration)}</Text></View>
     <View style={styles.overlayTools}>
        <Pressable accessibilityRole="button" accessibilityLabel="Audio und Untertitel auswählen" onPress={()=>setSettingsSheet('tracks')} style={styles.overlayTool}><Text style={styles.overlayToolText}>Audio & UT</Text></Pressable>
       {episodeOptions.length>0&&<Pressable onPress={()=>setEpisodeSheet(true)} style={styles.overlayTool}><Text style={styles.overlayToolText}>Episoden</Text></Pressable>}
       <Pressable onPress={()=>setSettingsSheet('quality')} style={styles.overlayTool}><Text style={styles.overlayToolText}>⚙</Text></Pressable>
       <Pressable accessibilityRole="button" accessibilityLabel={large?'Vollbild verlassen':'Vollbild öffnen'} onPress={()=>{setFullscreen(!large);setControlsVisible(true)}} style={styles.overlayTool}><Text style={styles.overlayToolText}>{large?'⤢':'⛶'}</Text></Pressable>
     </View>
   </View>}
 </View>;
 };
 return <View style={styles.page}><StatusBar hidden={fullscreen} />
   {!fullscreen&&<View style={styles.videoWrap}>
     {url?<VideoView player={player} style={styles.video} nativeControls={false} fullscreenOptions={{enable:false}} allowsPictureInPicture contentFit="contain"/>:<ActivityIndicator color={accentColor}/>}
     {!!url&&videoControls(false)}
   </View>}
   <Modal visible={fullscreen} animationType="fade" supportedOrientations={['portrait','landscape','landscape-left','landscape-right']} statusBarTranslucent navigationBarTranslucent onRequestClose={()=>setFullscreen(false)}>
     <View style={[styles.fullscreenStage,{width:viewportWidth,height:viewportHeight}]}>
       {fullscreen&&url?<VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} fullscreenOptions={{enable:false}} contentFit="contain" allowsPictureInPicture/>:<ActivityIndicator color={accentColor}/>}
        <Pressable accessibilityRole="button" accessibilityLabel={controlsVisible?'Playersteuerung ausblenden':'Playersteuerung einblenden'} style={StyleSheet.absoluteFill} onPress={()=>setControlsVisible(value=>value&&playing?false:true)}/>
       {videoControls(true)}
     </View>
   </Modal>
   <ScrollView contentContainerStyle={styles.body}><Pressable onPress={goBack}><Text style={[styles.back,{color:accentColor}]}>‹ Zurück</Text></Pressable>
   <Text style={styles.title}>{item?.Name||'Wird geladen …'}</Text>
   {!!url&&position>0&&<View style={styles.timeBar}>
    <Text style={styles.timeMeta} accessibilityLabel="Aktuelle Wiedergabezeit">
      {formatTime(position)}{item?.RunTimeTicks?` / ${formatTime(item.RunTimeTicks/10_000_000)}`:''}
    </Text>
    {!!item?.RunTimeTicks&&<Text style={styles.timeRemaining}>
      Noch {formatTime(Math.max(0,item.RunTimeTicks/10_000_000-position))}
    </Text>}
   </View>}
   {!!url&&<View style={styles.seekActions}>
    <Pressable accessibilityRole="button" accessibilityLabel="10 Sekunden zurückspringen"
      onPress={()=>{player.currentTime=Math.max(0,player.currentTime-10)}} style={styles.seekButton}>
      <Text style={styles.seekText}>↶ 10 s</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={player.playing?'Pause':'Wiedergabe fortsetzen'}
      onPress={()=>{if(player.playing)player.pause();else player.play()}} style={[styles.seekButton,{borderColor:accentColor}]}>
      <Text style={styles.seekText}>▶ / ❚❚</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="10 Sekunden vorspringen"
      onPress={()=>{player.currentTime=Math.min(item?.RunTimeTicks?item.RunTimeTicks/10_000_000:player.duration||Infinity,player.currentTime+10)}} style={styles.seekButton}>
      <Text style={styles.seekText}>10 s ↷</Text>
    </Pressable>
   </View>}{!!item?.SeriesName&&<Text style={styles.series}>{item.SeriesName}</Text>}
   {!!error&&<View style={styles.errorPanel}><Text style={styles.error}>{error}</Text>
     <Pressable accessibilityRole="button" style={[styles.retry,{borderColor:accentColor}]} onPress={()=>{void prepare()}}>
      <Text style={styles.retryText}>↻  Erneut versuchen</Text>
     </Pressable>
   </View>}
   {preparing&&<Text style={styles.preparing}>Stream wird vorbereitet …</Text>}
   {!!item&&<Pressable disabled={downloading} style={styles.offlineButton} onPress={async()=>{if(downloaded){await removeDownload(session,item.Id);setDownloaded(false)}else{setDownloading(true);setDownloadProgress(0);setDownloadError('');try{await downloadItem(session,item,setDownloadProgress);setDownloaded(true)}catch(e){setDownloadError(e instanceof Error?e.message:'Download fehlgeschlagen.')}finally{setDownloading(false)}}}}><Text style={styles.offlineText}>{downloaded?'✓ Offline verfügbar':downloading?`⇩ ${Math.round(downloadProgress*100)} %`:'⇩ Für offline herunterladen'}</Text></Pressable>}{!!downloadError&&<Text style={styles.downloadError}>{downloadError}</Text>}
   {!!item&&!!url&&!!source&&plugins.cast&&<CastControls session={session} item={item} source={source} info={info} playbackUrl={url} player={player} />}
   {!!nextEpisode&&<View style={styles.nextBox}><View style={{flex:1}}><Text style={[styles.nextLabel,{color:accentColor}]}>Als Nächstes</Text><Text style={styles.nextTitle}>{nextEpisode.Name}</Text><Text style={styles.nextMeta}>{nextEpisode.SeasonName??''}{nextEpisode.IndexNumber!=null?` · Episode ${nextEpisode.IndexNumber}`:''}</Text></View><Pressable style={styles.nextButton} onPress={()=>router.replace({pathname:'/player/[id]',params:{id:nextEpisode.Id}})}><Text style={styles.nextButtonText}>▶</Text></Pressable></View>}
   {!!nextEpisode&&<Pressable onPress={()=>setAutoPlay(v=>!v)} style={styles.autoRow}><Text style={styles.autoText}>Nächste Episode automatisch abspielen</Text><Text style={[styles.autoState,autoPlay&&styles.autoOn]}>{autoPlay?'AN':'AUS'}</Text></Pressable>}
   <Text style={styles.section}>Wiedergabeoptionen</Text>
   <View style={styles.quickOptions}><Pressable style={styles.quickOption} onPress={()=>setSettingsSheet('tracks')}><Text style={styles.quickOptionText}>◉  Audio & Untertitel</Text></Pressable><Pressable style={styles.quickOption} onPress={()=>setSettingsSheet('quality')}><Text style={styles.quickOptionText}>⚙  Qualität</Text></Pressable>{episodeOptions.length>0&&<Pressable style={styles.quickOption} onPress={()=>setEpisodeSheet(true)}><Text style={styles.quickOptionText}>▦  Episoden</Text></Pressable>}</View>
   <Text style={styles.section}>Streamingqualität</Text>
   <Text style={styles.qualityNote}>Jellyfin entscheidet weiterhin zwischen Direct Play und Transcoding.</Text>
   <View style={styles.options}>{([
     [undefined,'Automatisch'],[4_000_000,'4 Mbit/s'],[8_000_000,'8 Mbit/s'],[12_000_000,'12 Mbit/s']
   ] as const).map(([value,label])=><Pressable key={label} accessibilityRole="button"
     onPress={()=>{void selectQuality(value)}}
     style={[styles.chip,quality===value&&{backgroundColor:accentColor,borderColor:accentColor}]}>
     <Text style={styles.chipText}>{label}</Text></Pressable>)}</View>
   <Text style={styles.section}>Audio</Text><View style={styles.options}>{audios.map(x=><Pressable key={x.Index} onPress={()=>selectAudio(x.Index)} style={[styles.chip,audio===x.Index&&[styles.active,{backgroundColor:accentColor,borderColor:accentColor}]]}><Text style={styles.chipText}>{x.DisplayTitle||x.Language||`Track ${x.Index}`}</Text></Pressable>)}</View>
   <Text style={styles.section}>Untertitel</Text><View style={styles.options}><Pressable onPress={()=>selectSubtitle(undefined)} style={[styles.chip,subtitle===undefined&&[styles.active,{backgroundColor:accentColor,borderColor:accentColor}]]}><Text style={styles.chipText}>Automatisch</Text></Pressable><Pressable onPress={()=>selectSubtitle(-1)} style={[styles.chip,subtitle===-1&&[styles.active,{backgroundColor:accentColor,borderColor:accentColor}]]}><Text style={styles.chipText}>Aus</Text></Pressable>{subs.map(x=><Pressable key={x.Index} onPress={()=>selectSubtitle(x.Index)} style={[styles.chip,subtitle===x.Index&&[styles.active,{backgroundColor:accentColor,borderColor:accentColor}]]}><Text style={styles.chipText}>{x.DisplayTitle||x.Language||`Track ${x.Index}`}</Text></Pressable>)}</View>
   </ScrollView>

   <Modal visible={settingsSheet!==null} transparent animationType="slide" onRequestClose={()=>setSettingsSheet(null)}>
    <View style={styles.sheetBackdrop}><View style={styles.sheet}>
     <View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>VELARIS PLAYER</Text><Text style={styles.sheetTitle}>{settingsSheet==='tracks'?'Audio & Untertitel':'Streamingqualität'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Menü schließen" onPress={()=>setSettingsSheet(null)}><Text style={styles.sheetClose}>✕</Text></Pressable></View>
     <ScrollView style={{maxHeight:470}}>
      {settingsSheet==='tracks'&&<>
       <Text style={styles.sheetSectionTitle}>Audio</Text>
       {audios.length===0&&<Text style={styles.sheetHint}>Keine separat wählbaren Audiospuren verfügbar.</Text>}
       {audios.map(stream=><Pressable key={'a'+stream.Index} accessibilityRole="radio" accessibilityState={{checked:audio===stream.Index||audio===undefined&&stream.Index===audios[0]?.Index}} style={[styles.sheetItem,(audio===stream.Index||audio===undefined&&stream.Index===audios[0]?.Index)&&styles.sheetSelected]} onPress={()=>{void selectAudio(stream.Index);setSettingsSheet(null)}}><Text style={styles.sheetItemText}>{stream.DisplayTitle||stream.Language||`Audiospur ${stream.Index}`}</Text><Text style={{color:accentColor}}>{audio===stream.Index||audio===undefined&&stream.Index===audios[0]?.Index?'✓':''}</Text></Pressable>)}
       <Text style={styles.sheetSectionTitle}>Untertitel</Text>
       <Pressable accessibilityRole="radio" accessibilityState={{checked:subtitle===undefined}} style={[styles.sheetItem,subtitle===undefined&&styles.sheetSelected]} onPress={()=>{void selectSubtitle(undefined);setSettingsSheet(null)}}><Text style={styles.sheetItemText}>Automatisch (Jellyfin)</Text><Text style={{color:accentColor}}>{subtitle===undefined?'✓':''}</Text></Pressable>
       <Pressable accessibilityRole="radio" accessibilityState={{checked:subtitle===-1}} style={[styles.sheetItem,subtitle===-1&&styles.sheetSelected]} onPress={()=>{void selectSubtitle(-1);setSettingsSheet(null)}}><Text style={styles.sheetItemText}>Aus</Text><Text style={{color:accentColor}}>{subtitle===-1?'✓':''}</Text></Pressable>
       {subs.map(stream=><Pressable key={'s'+stream.Index} accessibilityRole="radio" accessibilityState={{checked:subtitle===stream.Index}} style={[styles.sheetItem,subtitle===stream.Index&&styles.sheetSelected]} onPress={()=>{void selectSubtitle(stream.Index);setSettingsSheet(null)}}><Text style={styles.sheetItemText}>{stream.DisplayTitle||stream.Language||`Untertitel ${stream.Index}`}</Text><Text style={{color:accentColor}}>{subtitle===stream.Index?'✓':''}</Text></Pressable>)}
      </>}
      {settingsSheet==='quality'&&([[undefined,'Automatisch'],[4_000_000,'4 Mbit/s'],[8_000_000,'8 Mbit/s'],[12_000_000,'12 Mbit/s']] as const).map(([value,label])=><Pressable key={label} accessibilityRole="radio" accessibilityState={{checked:quality===value}} style={[styles.sheetItem,quality===value&&styles.sheetSelected]} onPress={()=>{void selectQuality(value);setSettingsSheet(null)}}><Text style={styles.sheetItemText}>{label}</Text><Text style={{color:accentColor}}>{quality===value?'✓':''}</Text></Pressable>)}
     </ScrollView>
    </View></View>
   </Modal>
   <Modal visible={episodeSheet} transparent animationType="slide" onRequestClose={()=>setEpisodeSheet(false)}>
    <View style={styles.sheetBackdrop}><View style={styles.sheet}>
     <View style={styles.sheetHeader}><View><Text style={styles.sheetEyebrow}>{item?.SeriesName||'SERIE'}</Text><Text style={styles.sheetTitle}>Episoden</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Episoden schließen" onPress={()=>setEpisodeSheet(false)}><Text style={styles.sheetClose}>✕</Text></Pressable></View>
     <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexGrow:0,marginBottom:10}} contentContainerStyle={{gap:8,paddingVertical:8}}>
      {[...new Set(episodeOptions.map(ep=>ep.ParentIndexNumber??0))].sort((x,y)=>x-y).map(season=><Pressable key={season} accessibilityRole="button" accessibilityState={{selected:(selectedSeason??item?.ParentIndexNumber??0)===season}} onPress={()=>setSelectedSeason(season)} style={[styles.seasonChip,(selectedSeason??item?.ParentIndexNumber??0)===season&&{backgroundColor:accentColor,borderColor:accentColor}]}><Text style={styles.seasonChipText}>{season===0?'Specials':`Staffel ${season}`}</Text></Pressable>)}
     </ScrollView>
     <ScrollView style={{maxHeight:420}}>
      {episodeOptions.filter(ep=>(ep.ParentIndexNumber??0)===(selectedSeason??item?.ParentIndexNumber??episodeOptions[0]?.ParentIndexNumber??0)).sort((x,y)=>(x.IndexNumber??0)-(y.IndexNumber??0)).map(ep=><Pressable key={ep.Id} accessibilityRole="button" accessibilityState={{selected:ep.Id===id}} style={[styles.episodeRow,ep.Id===id&&styles.sheetSelected]} onPress={()=>{setEpisodeSheet(false);if(ep.Id!==id)router.replace({pathname:'/player/[id]',params:{id:ep.Id}})}}>
       {ep.ImageTags?.Primary?<Image source={{uri:getPrimaryImageUrl(session,ep.Id,ep.ImageTags.Primary,240)}} style={styles.episodeArtwork} resizeMode="cover"/>:<View style={styles.episodeNumber}><Text style={styles.episodeNumberText}>{ep.IndexNumber??'–'}</Text></View>}
       <View style={{flex:1}}><Text numberOfLines={2} style={styles.sheetItemText}>{ep.Name||`Episode ${ep.IndexNumber??''}`}</Text><Text style={styles.sheetHint}>{ep.UserData?.Played?'✓ Gesehen':ep.UserData?.PlaybackPositionTicks?'Fortsetzen':`Episode ${ep.IndexNumber??'–'}`}{ep.RunTimeTicks?` · ${Math.round(ep.RunTimeTicks/600_000_000)} Min.`:''}</Text></View><Text style={{color:accentColor,fontSize:19}}>{ep.Id===id?'▶':'›'}</Text>
      </Pressable>)}
     </ScrollView>
    </View></View>
   </Modal>
 </View>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000'},videoWrap:{width:'100%',aspectRatio:16/9,marginTop:48,alignItems:'center',justifyContent:'center',backgroundColor:'#000'},video:{width:'100%',height:'100%'},body:{padding:20,paddingBottom:50,backgroundColor:colors.background,flexGrow:1},back:{color:colors.accent,fontSize:16,fontWeight:'800'},title:{color:colors.text,fontSize:25,fontWeight:'900',marginTop:20},series:{color:colors.muted,marginTop:5},timeMeta:{color:'#DCCFFF',fontSize:12,fontWeight:'700'},timeBar:{marginTop:10,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},timeRemaining:{color:colors.muted,fontSize:12},seekActions:{flexDirection:'row',gap:9,marginTop:12},seekButton:{flex:1,borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:'rgba(35,32,48,.95)',alignItems:'center',justifyContent:'center',paddingVertical:11},seekText:{color:colors.text,fontSize:15,fontWeight:'900'},error:{color:colors.danger,marginBottom:12},errorPanel:{marginTop:14,backgroundColor:colors.surface,padding:14,borderRadius:12},retry:{alignSelf:'flex-start',borderWidth:1,borderRadius:8,padding:10},retryText:{color:colors.text,fontWeight:'900',fontSize:12},preparing:{color:colors.muted,fontSize:12,marginTop:8},qualityNote:{color:colors.muted,fontSize:11,marginBottom:10},section:{color:colors.text,fontSize:17,fontWeight:'800',marginTop:28,marginBottom:10},options:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:18,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border},active:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontSize:12,fontWeight:'700'},skipOverlay:{position:'absolute',right:14,bottom:14,backgroundColor:'rgba(18,18,24,.92)',borderWidth:1,borderColor:'rgba(255,255,255,.72)',borderRadius:16,paddingHorizontal:18,paddingVertical:12},skipText:{color:'#fff',fontSize:12,fontWeight:'900'},nextOverlay:{position:'absolute',right:14,top:14,width:245,minHeight:88,flexDirection:'row',gap:9,backgroundColor:'rgba(18,18,24,.94)',borderColor:'rgba(180,157,255,.52)',borderWidth:1,borderRadius:16,padding:11},nextArtwork:{width:62,height:68,borderRadius:5,backgroundColor:colors.surfaceAlt},nextInfo:{flex:1,justifyContent:'center'},nextOverlayLabel:{color:'#aaa',fontSize:8,fontWeight:'900'},nextOverlayTitle:{color:'#fff',fontSize:11,fontWeight:'800',marginTop:3},offlineButton:{height:42,borderRadius:6,backgroundColor:'#202020',borderWidth:1,borderColor:'#333',alignItems:'center',justifyContent:'center',marginTop:14},offlineText:{color:'#fff',fontSize:12,fontWeight:'800'},downloadError:{color:colors.danger,fontSize:11,marginTop:8},nextBox:{marginTop:24,padding:14,borderRadius:12,backgroundColor:'#171717',flexDirection:'row',alignItems:'center',gap:12},nextLabel:{color:colors.accent,fontSize:10,fontWeight:'900',textTransform:'uppercase'},nextTitle:{color:'#fff',fontSize:14,fontWeight:'800',marginTop:3},nextMeta:{color:colors.muted,fontSize:10,marginTop:3},nextButton:{width:42,height:42,borderRadius:21,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},nextButtonText:{color:'#000',fontSize:16},autoRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:12},autoText:{color:'#ccc',fontSize:12},autoState:{color:'#777',fontSize:11,fontWeight:'900'},autoOn:{color:colors.accent},
 inlineChrome:{...StyleSheet.absoluteFill,justifyContent:'center',alignItems:'center'},inlinePlay:{height:54,width:54,borderRadius:30,backgroundColor:'#fffce9',justifyContent:'center',alignItems:'center'},inlinePlayText:{fontSize:25,fontWeight:'900',color:'#15151b'},inlineFullscreen:{position:'absolute',right:10,bottom:10,paddingHorizontal:10,paddingVertical:7,backgroundColor:'#111b',borderRadius:10},inlineFullscreenText:{fontSize:11,color:'#fff',fontWeight:'900'},
 cinematicOverlay:{...StyleSheet.absoluteFill,justifyContent:'space-between'},fullscreenStage:{flex:1,backgroundColor:'#000'},fullOverlay:{paddingTop:20,paddingBottom:15},overlayHeader:{flexDirection:'row',alignItems:'center',gap:14,paddingHorizontal:20,paddingTop:10,paddingBottom:22,backgroundColor:'transparent'},overlayIcon:{width:48,height:48,alignItems:'center',justifyContent:'center',backgroundColor:'#0006',borderRadius:24},overlayIconText:{color:'#fff',fontSize:31,lineHeight:36},overlayTitle:{color:'#fff',fontSize:16,fontWeight:'900'},overlaySubtitle:{color:'#dedbe6',fontSize:11},overlayCenter:{position:'absolute',top:'39%',left:0,right:0,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:26},overlayCircle:{height:58,width:68,justifyContent:'center',alignItems:'center',backgroundColor:'#0007',borderRadius:32},overlayMainCircle:{height:76,width:76,justifyContent:'center',alignItems:'center',borderRadius:40,backgroundColor:'#fff'},overlayMainText:{color:'#111',fontSize:28,fontWeight:'900'},overlayControlText:{color:'#fff',fontSize:15,fontWeight:'900'},overlayBottom:{paddingHorizontal:20,paddingBottom:16,backgroundColor:'transparent'},overlaySeekTouch:{height:24,justifyContent:'center'},overlaySeekTrack:{height:5,borderRadius:3,backgroundColor:'#ffffff66'},overlaySeekFill:{height:5,borderRadius:3},overlayTime:{flexDirection:'row',justifyContent:'space-between'},overlayTimeText:{fontSize:11,color:'#fff',fontWeight:'700'},overlayTools:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:10,gap:6},overlayTool:{minHeight:44,minWidth:48,alignItems:'center',justifyContent:'center',borderRadius:12,backgroundColor:'#ffffff1c',paddingHorizontal:10},overlayToolText:{fontSize:11,color:'#fff',fontWeight:'800'},overlaySkip:{alignSelf:'flex-end',backgroundColor:'#111c',borderColor:'#ffffff70',borderWidth:1,borderRadius:11,padding:9,marginBottom:6},overlaySkipText:{color:'#fff',fontWeight:'800',fontSize:11},overlayNext:{alignSelf:'flex-end',backgroundColor:'#252036cc',borderRadius:10,padding:9,marginBottom:6},overlayNextText:{color:'#fff',fontSize:11,fontWeight:'800'},
 quickOptions:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:12},quickOption:{backgroundColor:'#242230',borderWidth:1,borderColor:'#ffffff25',borderRadius:17,paddingHorizontal:14,paddingVertical:12},quickOptionText:{color:'#fff',fontWeight:'800',fontSize:12},
 sheetEyebrow:{color:'#b7accf',fontSize:10,fontWeight:'900',letterSpacing:2,marginBottom:4},sheetSectionTitle:{color:'#fff',fontSize:14,fontWeight:'900',marginTop:18,marginBottom:10},sheetHint:{color:'#a7a1b4',fontSize:11,marginTop:5},sheetSelected:{backgroundColor:'#ffffff13',borderRadius:13,paddingHorizontal:10},seasonChip:{borderRadius:25,backgroundColor:'#292633',borderWidth:1,borderColor:'#ffffff20',paddingHorizontal:15,paddingVertical:11},seasonChipText:{color:'#fff',fontSize:12,fontWeight:'800'},episodeRow:{minHeight:72,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,paddingHorizontal:8,borderBottomWidth:1,borderBottomColor:'#ffffff13'},episodeArtwork:{width:96,height:54,borderRadius:9,backgroundColor:'#ffffff17'},episodeNumber:{width:48,height:48,backgroundColor:'#ffffff15',borderRadius:12,alignItems:'center',justifyContent:'center'},episodeNumberText:{color:'#fff',fontWeight:'900',fontSize:17},sheetBackdrop:{flex:1,backgroundColor:'#000a',justifyContent:'flex-end'},sheet:{backgroundColor:'#191723',borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:20,paddingTop:18,paddingBottom:40,borderWidth:1,borderColor:'#ffffff22'},sheetHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',paddingBottom:14},sheetTitle:{color:'#fff',fontWeight:'900',fontSize:23},sheetClose:{color:'#fff',fontSize:22,padding:8},sheetItem:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderTopColor:'#ffffff16',gap:12},sheetItemText:{flex:1,color:'#fff',fontSize:14,fontWeight:'700'}});
