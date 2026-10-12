import { useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { MediaCard } from '@/components/MediaCard';
import { getPrimaryImageUrl, getBackdropUrl } from '@/services/jellyfin';
import type { JellyfinItem, Session } from '@/types/jellyfin';
import { colors } from '@/theme';
import { episodeTitle } from '@/services/episodeTitles';
import { PlayGlyph } from '@/components/PlayGlyph';
import { playbackPercent,minutesRemaining,episodeCode } from '@/services/playbackPresentation';

function ContinueCard({item,session,onHide}:{item:JellyfinItem;session:Session;onHide?: (id:string)=>void}){
 const [focused,setFocused]=useState(false);
 const scale=useRef(new Animated.Value(1)).current;
 const animate=(toValue:number)=>Animated.spring(scale,{
  toValue,speed:26,bounciness:2,useNativeDriver:true
 }).start();
 const focus=(value:boolean)=>{setFocused(value);animate(value?1.015:1)};
 const progress=playbackPercent(item);
 const remaining=minutesRemaining(item);
 const code=episodeCode(item);
 const hasBackdrop=!!item.BackdropImageTags?.length;
 const thumbnailUri=hasBackdrop?getBackdropUrl(session,item):getPrimaryImageUrl(session,item.Id,item.PrimaryImageTag??item.ImageTags?.Primary);
 const subtitle=item.Type==='Episode'
  ? [item.SeriesName,code].filter(Boolean).join('  ·  ')
  : item.ProductionYear?.toString()??'';
 const durationText=remaining!=null?`Noch ${remaining} Min.`:null;
 return <Pressable accessibilityRole="button" accessibilityLabel={`${item.Name} fortsetzen`}
  onFocus={()=>focus(true)} onBlur={()=>focus(false)}
  onHoverIn={()=>focus(true)} onHoverOut={()=>focus(false)}
  onPressIn={()=>animate(0.985)} onPressOut={()=>animate(focused?1.015:1)}
  style={styles.continueCard}
  onLongPress={()=>onHide&&Alert.alert('Weiterschauen',`${item.Name} aus dieser Reihe ausblenden? Dein Jellyfin-Fortschritt bleibt gespeichert.`,[
    {text:'Abbrechen',style:'cancel'},{text:'Ausblenden',onPress:()=>onHide(item.Id)}])}
  onPress={()=>router.push({pathname:'/player/[id]',params:{id:item.Id}})}>
  <Animated.View style={[styles.continueLift,{transform:[{scale}],
    shadowOpacity:focused?0.3:0.06,elevation:focused?7:1}]}>
  <View style={[styles.thumbWrap,focused&&styles.thumbFocused]}>
   <Image source={{uri:thumbnailUri}} style={styles.thumb} resizeMode={hasBackdrop?'cover':'contain'}/>
   <View style={styles.resumeBadge}><Text style={styles.resumeBadgeText}>FORTSETZEN</Text></View>
   <View style={styles.playBubble}><PlayGlyph size={17}/></View>
   {progress>0&&progress<100&&<View style={styles.progressTrack}><View style={[styles.progressFill,{width:`${progress}%`}]} /></View>}
  </View>
  <Text numberOfLines={1} style={[styles.continueTitle,focused&&styles.continueTitleFocused]}>{item.Type==='Episode'?episodeTitle(item):item.Name}</Text>
  {!!subtitle&&<Text numberOfLines={1} style={styles.continueMeta}>{subtitle}</Text>}
  {!!durationText&&<Text numberOfLines={1} style={styles.remainingText}>{durationText}</Text>}
  </Animated.View>
 </Pressable>;
}

export function MediaRow({ title, items, session, continueWatching=false, topTen=false, onHide }: { title: string; items: JellyfinItem[]; session: Session; continueWatching?: boolean; topTen?: boolean; onHide?: (id:string)=>void }) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {items.slice(0,topTen?10:items.length).map((item,index) => continueWatching
          ? <ContinueCard key={item.Id} item={item} session={session} onHide={onHide}/>
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
  resumeBadge:{position:'absolute',top:9,left:9,backgroundColor:'rgba(35,24,70,.92)',
   borderWidth:1,borderColor:'rgba(180,157,255,.76)',paddingHorizontal:9,paddingVertical:5,borderRadius:6},
  resumeBadgeText:{color:'#E6DEFF',fontSize:9,fontWeight:'900',letterSpacing:0.7},
  playBubble:{position:'absolute',left:'50%',top:'50%',marginLeft:-20,marginTop:-20,width:40,height:40,borderRadius:20,borderWidth:2,borderColor:'rgba(255,255,255,.92)',backgroundColor:'rgba(8,8,13,.62)',alignItems:'center',justifyContent:'center'},

  progressTrack:{position:'absolute',left:0,right:0,bottom:0,height:4,backgroundColor:'rgba(255,255,255,.28)'},
  progressFill:{height:4,backgroundColor:colors.progress},
  continueTitle:{color:colors.text,fontSize:13,fontWeight:'800',marginTop:9},
  continueTitleFocused:{color:'#E5DCFF'},
  continueMeta:{color:colors.muted,fontSize:11,marginTop:4},
  remainingText:{color:'#DCCFFF',fontSize:11,fontWeight:'700',marginTop:4},
  topTenCard:{width:187,height:218,flexDirection:'row',alignItems:'flex-start',paddingTop:2},
  rank:{width:67,color:colors.background,fontSize:110,lineHeight:174,fontWeight:'900',letterSpacing:-9,textShadowColor:'rgba(255,255,255,0.95)',textShadowRadius:2,textShadowOffset:{width:0,height:0},marginRight:-3}
});
