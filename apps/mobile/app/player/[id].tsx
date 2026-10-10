import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '@/context/AuthContext';
import { buildPlaybackUrl, getEpisodes, getItem, getMediaSegments, normalizeMediaSegments, getNextEpisode, getPlaybackInfo, getSeasons, reportPlaybackProgress, reportPlaybackStart, reportPlaybackStopped } from '@/services/jellyfin';
import type { JellyfinItem, JellyfinMediaSource, JellyfinPlaybackInfo } from '@/types/jellyfin';
import { colors } from '@/theme';
import { defaultPluginSettings,loadPluginSettings,type PluginSettings } from '@/services/pluginSettings';
import { CastControls } from '@/components/CastControls';
import { downloadItem, isDownloaded, removeDownload } from '@/services/downloads';

const ticks=(seconds:number)=>Math.max(0,Math.floor(seconds*10_000_000));

export default function PlayerScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
 const goBack=()=>{if(router.canGoBack())router.back();else router.replace('/(tabs)/home')};
 const [downloaded,setDownloaded]=useState(false); const [downloading,setDownloading]=useState(false); const [downloadProgress,setDownloadProgress]=useState(0); const [downloadError,setDownloadError]=useState(''); const [item,setItem]=useState<JellyfinItem|null>(null); const [info,setInfo]=useState<JellyfinPlaybackInfo|null>(null); const [url,setUrl]=useState('');
 const [plugins,setPlugins]=useState<PluginSettings>(defaultPluginSettings); const [segments,setSegments]=useState<{Type:string;StartTicks:number;EndTicks:number}[]>([]); const [position,setPosition]=useState(0); const [audio,setAudio]=useState<number|undefined>(); const [subtitle,setSubtitle]=useState<number|undefined>(); const [error,setError]=useState(''); const [nextEpisode,setNextEpisode]=useState<JellyfinItem|null>(null); const [autoPlay,setAutoPlay]=useState(true);
 const lastReport=useRef(0); const stopped=useRef(false); const resumeAt=useRef(0); const didResume=useRef(false);
 const source: JellyfinMediaSource|undefined=info?.MediaSources?.[0];
 const player=useVideoPlayer(url||null,p=>{p.timeUpdateEventInterval=5;p.loop=false;});

 async function prepare(a=audio,s=subtitle){
  if(!session||!id)return; setError('');
  try{const media=await getPlaybackInfo(session,id,a,s);setInfo(media);setUrl(buildPlaybackUrl(session,id,media));}
  catch(e){
   // Jellyfin can return 500 from PlaybackInfo even though the static video stream itself is available.
   // Fall back to the same authenticated direct stream endpoint used by downloads instead of blocking playback.
   setInfo(null);
   const p=new URLSearchParams({static:'true',api_key:session.accessToken});
   setUrl(`${session.serverUrl}/Videos/${id}/stream?${p}`);
   setError('');
  }
 }
 useEffect(()=>{loadPluginSettings().then(setPlugins)},[]);
 useEffect(()=>{if(session&&id)isDownloaded(session,id).then(setDownloaded)},[session,id]);
 useEffect(()=>{if(!session||!id)return;getMediaSegments(session,id).then(x=>setSegments(normalizeMediaSegments(x))).catch(()=>setSegments([]));getItem(session,id).then(async x=>{if(x.Type==='Series'){try{const seasons=await getSeasons(session,x.Id);const firstSeason=seasons.Items[0];if(firstSeason){const eps=await getEpisodes(session,x.Id,firstSeason.Id);const target=eps.Items.find(ep=>(ep.UserData?.PlaybackPositionTicks??0)>0)||eps.Items.find(ep=>!ep.UserData?.Played)||eps.Items[0];if(target){router.replace({pathname:'/player/[id]',params:{id:target.Id}});return}}}catch{}setError('Keine abspielbare Episode gefunden.');return}setItem(x);if(x.Type==='Episode')getNextEpisode(session,x).then(setNextEpisode).catch(()=>{});resumeAt.current=(x.UserData?.PlaybackPositionTicks||0)/10_000_000;didResume.current=false;prepare().catch(()=>{})}).catch(()=>setError('Medium konnte nicht geladen werden.'));return()=>{}},[session,id]);
 useEffect(()=>{if(!url||!session||!item)return; stopped.current=false; const method=source?.TranscodingUrl?'Transcode':source?.DirectStreamUrl?'DirectStream':'DirectPlay';
   reportPlaybackStart(session,{ItemId:item.Id,MediaSourceId:source?.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(player.currentTime),PlayMethod:method}).catch(()=>{});
   const interval=setInterval(()=>{const now=Date.now();if(now-lastReport.current<4000)return;lastReport.current=now;reportPlaybackProgress(session,{ItemId:item.Id,MediaSourceId:source?.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(player.currentTime),IsPaused:!player.playing,PlayMethod:method}).catch(()=>{})},5000);
   return()=>{clearInterval(interval);if(!stopped.current){stopped.current=true;reportPlaybackStopped(session,{ItemId:item.Id,MediaSourceId:source?.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(player.currentTime),PlayMethod:method}).catch(()=>{})}}
 },[url,session,item,source?.Id,info?.PlaySessionId]);
 useEffect(()=>{if(url){didResume.current=false;player.replace(url);player.play()}},[url]);
 useEffect(()=>{const sub=player.addListener('statusChange',({status})=>{if(status==='readyToPlay'&&!didResume.current){didResume.current=true;if(resumeAt.current>0)player.currentTime=resumeAt.current;player.play()}});return()=>sub.remove()},[player]);
 useEffect(()=>{const sub=player.addListener('timeUpdate',({currentTime})=>setPosition(currentTime));return()=>sub.remove()},[player]);
 useEffect(()=>{const sub=player.addListener('playToEnd',()=>{if(autoPlay&&plugins.autoNext&&nextEpisode)router.replace({pathname:'/player/[id]',params:{id:nextEpisode.Id}})});return()=>sub.remove()},[player,autoPlay,nextEpisode]);
 if(!session)return <Redirect href="/connect"/>;
 const streams=source?.MediaStreams||[]; const activeSegment=segments.find(s=>position>=s.StartTicks/10_000_000&&position<s.EndTicks/10_000_000); const segmentType=(activeSegment?.Type||'').toLowerCase(); const canSkip=!!activeSegment&&((plugins.introSkipper&&(segmentType.includes('intro')||segmentType.includes('recap')))||(plugins.creditsSkip&&(segmentType.includes('outro')||segmentType.includes('credit')))); const audios=streams.filter(x=>x.Type==='Audio'); const subs=streams.filter(x=>x.Type==='Subtitle');
 async function selectAudio(index:number){setAudio(index);await prepare(index,subtitle)}
 async function selectSubtitle(index:number|undefined){setSubtitle(index);await prepare(audio,index)}
 return <View style={styles.page}>
   <View style={styles.videoWrap}>{url?<VideoView player={player} style={styles.video} nativeControls allowsFullscreen allowsPictureInPicture />:<ActivityIndicator color={colors.accent}/>} {canSkip&&<Pressable style={styles.skipOverlay} onPress={()=>{if(activeSegment)player.currentTime=activeSegment.EndTicks/10_000_000}}><Text style={styles.skipText}>{segmentType.includes('intro')?'Intro überspringen':segmentType.includes('recap')?'Rückblick überspringen':'Abspann überspringen'}  ›</Text></Pressable>}{!!nextEpisode&&position>5&&<Pressable style={styles.nextOverlay} onPress={()=>router.replace({pathname:'/player/[id]',params:{id:nextEpisode.Id}})}><Text style={styles.nextOverlayLabel}>ALS NÄCHSTES</Text><Text numberOfLines={1} style={styles.nextOverlayTitle}>▶  {nextEpisode.Name}</Text></Pressable>}</View>
   <ScrollView contentContainerStyle={styles.body}><Pressable onPress={goBack}><Text style={styles.back}>‹ Zurück</Text></Pressable>
   <Text style={styles.title}>{item?.Name||'Wird geladen …'}</Text>{!!item?.SeriesName&&<Text style={styles.series}>{item.SeriesName}</Text>}
   {!!error&&<Text style={styles.error}>{error}</Text>}
   {!!item&&<Pressable disabled={downloading} style={styles.offlineButton} onPress={async()=>{if(downloaded){await removeDownload(session,item.Id);setDownloaded(false)}else{setDownloading(true);setDownloadProgress(0);setDownloadError('');try{await downloadItem(session,item,setDownloadProgress);setDownloaded(true)}catch(e){setDownloadError(e instanceof Error?e.message:'Download fehlgeschlagen.')}finally{setDownloading(false)}}}}><Text style={styles.offlineText}>{downloaded?'✓ Offline verfügbar':downloading?`⇩ ${Math.round(downloadProgress*100)} %`:'⇩ Für offline herunterladen'}</Text></Pressable>}{!!downloadError&&<Text style={styles.downloadError}>{downloadError}</Text>}
   {!!item&&!!url&&!!source&&plugins.cast&&<CastControls session={session} item={item} source={source} info={info} playbackUrl={url} player={player} />}
   {!!nextEpisode&&<View style={styles.nextBox}><View style={{flex:1}}><Text style={styles.nextLabel}>Als Nächstes</Text><Text style={styles.nextTitle}>{nextEpisode.Name}</Text><Text style={styles.nextMeta}>{nextEpisode.SeasonName??''}{nextEpisode.IndexNumber!=null?` · Episode ${nextEpisode.IndexNumber}`:''}</Text></View><Pressable style={styles.nextButton} onPress={()=>router.replace({pathname:'/player/[id]',params:{id:nextEpisode.Id}})}><Text style={styles.nextButtonText}>▶</Text></Pressable></View>}
   {!!nextEpisode&&<Pressable onPress={()=>setAutoPlay(v=>!v)} style={styles.autoRow}><Text style={styles.autoText}>Nächste Episode automatisch abspielen</Text><Text style={[styles.autoState,autoPlay&&styles.autoOn]}>{autoPlay?'AN':'AUS'}</Text></Pressable>}
   <Text style={styles.section}>Audio</Text><View style={styles.options}>{audios.map(x=><Pressable key={x.Index} onPress={()=>selectAudio(x.Index)} style={[styles.chip,audio===x.Index&&styles.active]}><Text style={styles.chipText}>{x.DisplayTitle||x.Language||`Track ${x.Index}`}</Text></Pressable>)}</View>
   <Text style={styles.section}>Untertitel</Text><View style={styles.options}><Pressable onPress={()=>selectSubtitle(undefined)} style={[styles.chip,subtitle===undefined&&styles.active]}><Text style={styles.chipText}>Aus</Text></Pressable>{subs.map(x=><Pressable key={x.Index} onPress={()=>selectSubtitle(x.Index)} style={[styles.chip,subtitle===x.Index&&styles.active]}><Text style={styles.chipText}>{x.DisplayTitle||x.Language||`Track ${x.Index}`}</Text></Pressable>)}</View>
   </ScrollView>
 </View>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000'},videoWrap:{width:'100%',aspectRatio:16/9,marginTop:48,alignItems:'center',justifyContent:'center',backgroundColor:'#000'},video:{width:'100%',height:'100%'},body:{padding:20,paddingBottom:50,backgroundColor:colors.background,flexGrow:1},back:{color:colors.accent,fontSize:16,fontWeight:'800'},title:{color:colors.text,fontSize:25,fontWeight:'900',marginTop:20},series:{color:colors.muted,marginTop:5},error:{color:colors.danger,marginTop:16},section:{color:colors.text,fontSize:17,fontWeight:'800',marginTop:28,marginBottom:10},options:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:13,paddingVertical:9,borderRadius:18,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border},active:{backgroundColor:colors.accent,borderColor:colors.accent},chipText:{color:colors.text,fontSize:12,fontWeight:'700'},skipOverlay:{position:'absolute',right:14,bottom:14,backgroundColor:'rgba(18,18,18,.9)',borderWidth:1,borderColor:'#fff',borderRadius:3,paddingHorizontal:16,paddingVertical:10},skipText:{color:'#fff',fontSize:12,fontWeight:'900'},nextOverlay:{position:'absolute',right:14,top:14,maxWidth:190,backgroundColor:'rgba(18,18,18,.88)',borderRadius:3,paddingHorizontal:12,paddingVertical:9},nextOverlayLabel:{color:'#aaa',fontSize:8,fontWeight:'900'},nextOverlayTitle:{color:'#fff',fontSize:11,fontWeight:'800',marginTop:3},offlineButton:{height:42,borderRadius:6,backgroundColor:'#202020',borderWidth:1,borderColor:'#333',alignItems:'center',justifyContent:'center',marginTop:14},offlineText:{color:'#fff',fontSize:12,fontWeight:'800'},downloadError:{color:colors.danger,fontSize:11,marginTop:8},nextBox:{marginTop:24,padding:14,borderRadius:12,backgroundColor:'#171717',flexDirection:'row',alignItems:'center',gap:12},nextLabel:{color:colors.accent,fontSize:10,fontWeight:'900',textTransform:'uppercase'},nextTitle:{color:'#fff',fontSize:14,fontWeight:'800',marginTop:3},nextMeta:{color:colors.muted,fontSize:10,marginTop:3},nextButton:{width:42,height:42,borderRadius:21,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},nextButtonText:{color:'#000',fontSize:16},autoRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:12},autoText:{color:'#ccc',fontSize:12},autoState:{color:'#777',fontSize:11,fontWeight:'900'},autoOn:{color:colors.accent}});
