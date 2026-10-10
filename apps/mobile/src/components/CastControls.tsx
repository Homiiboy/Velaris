import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { CastButton, MediaPlayerState, useMediaStatus, useRemoteMediaClient, useStreamPosition } from 'react-native-google-cast';
import { VideoAirPlayButton } from 'expo-video';
import type { VideoPlayer } from 'expo-video';
import type { JellyfinItem, JellyfinMediaSource, JellyfinPlaybackInfo, Session } from '@/types/jellyfin';
import { getPrimaryImageUrl, reportPlaybackProgress, reportPlaybackStart, reportPlaybackStopped } from '@/services/jellyfin';
import { colors } from '@/theme';

const ticks=(seconds:number)=>Math.max(0,Math.floor(seconds*10_000_000));

type Props={
 session:Session; item:JellyfinItem; source?:JellyfinMediaSource; info:JellyfinPlaybackInfo|null;
 playbackUrl:string; player:VideoPlayer;
};

export function CastControls({session,item,source,info,playbackUrl,player}:Props){
 const client=useRemoteMediaClient(); const status=useMediaStatus(); const position=useStreamPosition(5); const loaded=useRef('');
 const positionRef=useRef<number|null>(null);
 useEffect(()=>{player.allowsExternalPlayback=true},[player]);
 useEffect(()=>{positionRef.current=position},[position]);

 useEffect(()=>{
   if(!client||!source||!playbackUrl||loaded.current===item.Id)return;
   loaded.current=item.Id; player.pause();
   const start=(item.UserData?.PlaybackPositionTicks||0)/10_000_000;
   const contentType=playbackUrl.includes('.m3u8')||playbackUrl.includes('TranscodingContainer=ts')?'application/x-mpegURL':'video/mp4';
   client.loadMedia({
     autoplay:true,startTime:start,
     mediaInfo:{
       contentUrl:playbackUrl,contentType,
       streamDuration:item.RunTimeTicks?item.RunTimeTicks/10_000_000:undefined,
       metadata:{
         type:'generic',
         title:item.Name,
         subtitle:item.SeriesName||item.ProductionYear?.toString(),
         images:[{url:getPrimaryImageUrl(session,item.Id,item.PrimaryImageTag)}]
       }
     }
   }).then(()=>reportPlaybackStart(session,{ItemId:item.Id,MediaSourceId:source.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(start),PlayMethod:source.TranscodingUrl?'Transcode':source.DirectStreamUrl?'DirectStream':'DirectPlay'})).catch(()=>{loaded.current=''});
 },[client,source?.Id,playbackUrl,item.Id]);

 useEffect(()=>{
   if(!client||position==null||!source)return;
   reportPlaybackProgress(session,{ItemId:item.Id,MediaSourceId:source.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(position),IsPaused:status?.playerState===MediaPlayerState.PAUSED,PlayMethod:source.TranscodingUrl?'Transcode':source.DirectStreamUrl?'DirectStream':'DirectPlay'}).catch(()=>{});
 },[position]);

 useEffect(()=>()=>{const finalPosition=positionRef.current;if(client&&source&&finalPosition!=null)reportPlaybackStopped(session,{ItemId:item.Id,MediaSourceId:source.Id,PlaySessionId:info?.PlaySessionId,PositionTicks:ticks(finalPosition),PlayMethod:source.TranscodingUrl?'Transcode':source.DirectStreamUrl?'DirectStream':'DirectPlay'}).catch(()=>{})},[client,source?.Id]);

 return <View style={styles.wrap}>
   <View style={styles.option}><CastButton style={styles.cast}/><View><Text style={styles.name}>Chromecast / Google TV</Text><Text style={styles.hint}>{client?'Verbunden – Wiedergabe wird am TV gesteuert':'Tippen, um ein Cast-Gerät auszuwählen'}</Text></View></View>
   {Platform.OS==='ios'&&<View style={styles.option}><VideoAirPlayButton style={styles.airplay} tint={colors.text} activeTint={colors.accent}/><View><Text style={styles.name}>AirPlay</Text><Text style={styles.hint}>{player.isExternalPlaybackActive?'AirPlay ist aktiv':'Apple TV oder AirPlay-Fernseher auswählen'}</Text></View></View>}
 </View>;
}
const styles=StyleSheet.create({wrap:{gap:10,marginTop:24},option:{minHeight:58,borderRadius:14,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',paddingHorizontal:14,gap:13},cast:{width:30,height:30,tintColor:colors.text},airplay:{width:30,height:30},name:{color:colors.text,fontWeight:'800',fontSize:14},hint:{color:colors.muted,fontSize:11,marginTop:3}});
