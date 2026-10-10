import { useEffect } from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import { router,useLocalSearchParams } from 'expo-router';
import { VideoView,useVideoPlayer } from 'expo-video';
import { colors } from '@/theme';
export default function OfflinePlayer(){const{uri,name,seriesName}=useLocalSearchParams<{uri:string;name?:string;seriesName?:string}>();const player=useVideoPlayer(uri||null,p=>{p.loop=false});useEffect(()=>{if(uri){player.replace(uri);player.play()}},[uri]);return <View style={s.page}><View style={s.videoWrap}><VideoView player={player} style={s.video} nativeControls fullscreenOptions={{enable:true}} allowsPictureInPicture/></View><View style={s.body}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Downloads</Text></Pressable><Text style={s.title}>{name||'Offline-Wiedergabe'}</Text>{!!seriesName&&<Text style={s.sub}>{seriesName}</Text>}<Text style={s.badge}>✓ Offline</Text></View></View>}
const s=StyleSheet.create({page:{flex:1,backgroundColor:'#000'},videoWrap:{width:'100%',aspectRatio:16/9,marginTop:48,backgroundColor:'#000'},video:{width:'100%',height:'100%'},body:{flex:1,backgroundColor:colors.background,padding:20},back:{color:colors.accent,fontWeight:'800'},title:{color:'#fff',fontSize:24,fontWeight:'900',marginTop:22},sub:{color:colors.muted,marginTop:6},badge:{color:'#8ee8b0',fontWeight:'900',marginTop:18}});
