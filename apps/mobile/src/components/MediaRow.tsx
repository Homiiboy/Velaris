import { useRef, useState } from 'react';
import { Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MediaCard } from '@/components/MediaCard';
import { getPrimaryImageUrl, getBackdropUrl } from '@/services/jellyfin';
import type { JellyfinItem, Session } from '@/types/jellyfin';
import { colors } from '@/theme';
import { episodeTitle } from '@/services/episodeTitles';
import { PlayGlyph } from '@/components/PlayGlyph';

function ContinueCard({item,session}:{item:JellyfinItem;session:Session}){
 const [focused,setFocused]=useState(false);
 const scale=useRef(new Animated.Value(1)).current;
 const animate=(toValue:number)=>Animated.spring(scale,{
  toValue,speed:26,bounciness:2,useNativeDriver:true
 }).start();
 const focus=(value:boolean)=>{setFocused(value);animate(value?1.015:1)};
 const progress=Math.max(0,Math.min(100,item.UserData?.PlayedPercentage ?? (
  item.RunTimeTicks && item.UserData?.PlaybackPositionTicks
   ? item.UserData.PlaybackPositionTicks/item.RunTimeTicks*100 : 0
 )));
 const hasBackdrop=!!item.BackdropImageTags?.length;
 const thumbnailUri=hasBackdrop?getBackdropUrl(session,item):getPrimaryImageUrl(session,item.Id,item.PrimaryImageTag??item.ImageTags?.Primary);
 const subtitle=item.Type==='Episode'
  ? [item.SeriesName,item.ParentIndexNumber!=null&&item.IndexNumber!=null?`S${item.ParentIndexNumber} · E${item.IndexNumber}`:undefined].filter(Boolean).join('  •  ')
  : item.Name;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${item.Name} fortsetzen`}
  onFocus={()=>focus(true)} onBlur={()=>focus(false)}
  onHoverIn={()=>focus(true)} onHoverOut={()=>focus(false)}
  onPressIn={()=>animate(0.985)} onPressOut={()=>animate(focused?1.015:1)}
  style={styles.continueCard}
  onPress={()=>router.push({pathname:'/player/[id]',params:{id:item.Id}})}>
  <Animated.View style={[styles.continueLift,{transform:[{scale}],
    shadowOpacity:focused?0.3:0.06,elevation:focused?7:1}]}>
  <View style={[styles.thumbWrap,focused&&styles.thumbFocused]}>
   <Image source={{uri:thumbnailUri}} style={styles.thumb} resizeMode={hasBackdrop?'cover':'contain'}/>
   <View style={styles.playBubble}><PlayGlyph size={17}/></View>
   <View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${progress}%`}]} /></View>
  </View>
  <Text numberOfLines={1} style={[styles.continueTitle,focused&&styles.continueTitleFocused]}>{item.Type==='Episode'?episodeTitle(item):item.Name}</Text>
  {!!subtitle&&item.Type==='Episode'&&<Text numberOfLines={1} style={styles.continueMeta}>{subtitle}</Text>}
  </Animated.View>
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
  section:{marginBottom:30},
  title:{color:colors.text,fontSize:20,fontWeight:'900',paddingHorizontal:22,marginBottom:10,letterSpacing:-0.35},
  row:{paddingHorizontal:22,paddingTop:10,paddingBottom:18,gap:16},
  continueCard:{width:238},
  continueLift:{width:238,shadowColor:colors.accent,shadowRadius:15,
    shadowOffset:{width:0,height:5}},
  thumbWrap:{width:238,aspectRatio:16/9,backgroundColor:colors.surfaceAlt,
    borderRadius:colors.posterRadius,overflow:'hidden',borderWidth:1,borderColor:'rgba(255,255,255,.15)'},
  thumbFocused:{borderWidth:2,borderColor:'#DCCFFF'},
  thumb:{width:'100%',height:'100%'},
  playBubble:{position:'absolute',left:'50%',top:'50%',marginLeft:-20,marginTop:-20,width:40,height:40,borderRadius:20,borderWidth:2,borderColor:'rgba(255,255,255,.92)',backgroundColor:'rgba(8,8,13,.62)',alignItems:'center',justifyContent:'center'},

  progressTrack:{position:'absolute',left:0,right:0,bottom:0,height:4,backgroundColor:'rgba(255,255,255,.28)'},
  progressFill:{height:4,backgroundColor:colors.progress},
  continueTitle:{color:colors.text,fontSize:13,fontWeight:'800',marginTop:9},
  continueTitleFocused:{color:'#E5DCFF'},
  continueMeta:{color:colors.muted,fontSize:11,marginTop:3},
  topTenCard:{width:187,height:218,flexDirection:'row',alignItems:'flex-start',paddingTop:2},
  rank:{width:67,color:colors.background,fontSize:110,lineHeight:174,fontWeight:'900',letterSpacing:-9,textShadowColor:'rgba(255,255,255,0.95)',textShadowRadius:2,textShadowOffset:{width:0,height:0},marginRight:-3}
});
