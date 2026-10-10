import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MediaCard } from '@/components/MediaCard';
import { getPrimaryImageUrl } from '@/services/jellyfin';
import type { JellyfinItem, Session } from '@/types/jellyfin';
import { colors } from '@/theme';

function ContinueCard({item,session}:{item:JellyfinItem;session:Session}){
 const progress=Math.max(0,Math.min(100,item.UserData?.PlayedPercentage ?? (
  item.RunTimeTicks && item.UserData?.PlaybackPositionTicks
   ? item.UserData.PlaybackPositionTicks/item.RunTimeTicks*100 : 0
 )));
 const subtitle=item.Type==='Episode'
  ? [item.SeriesName,item.ParentIndexNumber!=null&&item.IndexNumber!=null?`S${item.ParentIndexNumber} · E${item.IndexNumber}`:undefined].filter(Boolean).join('  •  ')
  : item.Name;
 return <Pressable style={({pressed})=>[styles.continueCard,{opacity:pressed?.75:1}]} onPress={()=>router.push({pathname:'/player/[id]',params:{id:item.Id}})}>
  <View style={styles.thumbWrap}>
   <Image source={{uri:getPrimaryImageUrl(session,item.Id,item.PrimaryImageTag??item.ImageTags?.Primary)}} style={styles.thumb} resizeMode="cover"/>
   <View style={styles.playBubble}><Text style={styles.playIcon}>▶</Text></View>
   <View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${progress}%`}]} /></View>
  </View>
  <Text numberOfLines={1} style={styles.continueTitle}>{item.Type==='Episode'?item.Name:item.Name}</Text>
  {!!subtitle&&item.Type==='Episode'&&<Text numberOfLines={1} style={styles.continueMeta}>{subtitle}</Text>}
 </Pressable>;
}

export function MediaRow({ title, items, session, continueWatching=false, topTen=false }: { title: string; items: JellyfinItem[]; session: Session; continueWatching?: boolean; topTen?: boolean }) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.slice(0,topTen?10:items.length).map((item,index) => continueWatching
          ? <ContinueCard key={item.Id} item={item} session={session}/>
          : topTen ? <View key={item.Id} style={styles.topTenCard}><Text style={styles.rank}>{index+1}</Text><MediaCard item={item} session={session} width={116} showFavorite={false}/></View>
          : <MediaCard key={item.Id} item={item} session={session} />)}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  section:{marginBottom:24},
  title:{color:colors.text,fontSize:18,fontWeight:'800',paddingHorizontal:14,marginBottom:10},
  row:{paddingHorizontal:14,gap:7},
  continueCard:{width:220},
  thumbWrap:{width:220,aspectRatio:16/9,backgroundColor:'#151515',borderRadius:3,overflow:'hidden'},
  thumb:{width:'100%',height:'100%'},
  playBubble:{position:'absolute',left:'50%',top:'50%',marginLeft:-19,marginTop:-19,width:38,height:38,borderRadius:19,borderWidth:2,borderColor:'rgba(255,255,255,.9)',backgroundColor:'rgba(0,0,0,.48)',alignItems:'center',justifyContent:'center'},
  playIcon:{color:'#fff',fontSize:15,marginLeft:2},
  progressTrack:{position:'absolute',left:0,right:0,bottom:0,height:4,backgroundColor:'rgba(255,255,255,.28)'},
  progressFill:{height:4,backgroundColor:'#E50914'},
  continueTitle:{color:'#fff',fontSize:12,fontWeight:'700',marginTop:7},
  continueMeta:{color:'#8C8C8C',fontSize:10,marginTop:2},
  topTenCard:{width:170,height:174,flexDirection:'row',alignItems:'flex-end',overflow:'hidden'},
  rank:{width:58,color:'#000',fontSize:112,lineHeight:130,fontWeight:'900',letterSpacing:-9,textShadowColor:'#fff',textShadowRadius:3,textShadowOffset:{width:0,height:0},marginRight:-5,marginBottom:-5}
});
