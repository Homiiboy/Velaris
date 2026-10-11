import { useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getPrimaryImageUrl, setFavorite } from '@/services/jellyfin';
import type { JellyfinItem, Session } from '@/types/jellyfin';
import { colors } from '@/theme';
import { watchedLabel } from '@/services/watchStatus';

export function MediaCard({ item, session, width = 128, showMeta = false, showFavorite = true, onFavoriteChange }: { item: JellyfinItem; session: Session; width?: number; showMeta?: boolean; showFavorite?: boolean; onFavoriteChange?: (favorite:boolean)=>void }) {
  const [imageFailed,setImageFailed]=useState(false);
  const [favorite,setFavoriteState]=useState(!!item.UserData?.IsFavorite);
  const [saving,setSaving]=useState(false);
  const scale=useRef(new Animated.Value(1)).current;
  const press=(to:number)=>Animated.spring(scale,{toValue:to,useNativeDriver:true,speed:30,bounciness:4}).start();
  const imageTag=item.PrimaryImageTag ?? item.ImageTags?.Primary;
  const toggleFavorite=async()=>{
    if(saving||item.Type==='BoxSet')return;
    const next=!favorite; setFavoriteState(next); setSaving(true);
    try{await setFavorite(session,item.Id,next);item.UserData={...item.UserData,IsFavorite:next};onFavoriteChange?.(next)}
    catch{setFavoriteState(!next)}
    finally{setSaving(false)}
  };
  return (
    <Pressable
      onPressIn={()=>press(.985)} onPressOut={()=>press(1)}
      onPress={() => item.Type === 'BoxSet' ? router.push({ pathname: '/collection/[id]', params: { id: item.Id } }) : router.push({ pathname: '/details/[id]', params: { id: item.Id } })}
      accessibilityRole="button"
      accessibilityLabel={item.Name}
      style={{width}}
    >
      <Animated.View style={{transform:[{scale}],width}}><View style={[styles.posterShell,{width,height:Math.round(width*1.5)}]}>
       {!imageFailed ? <Image source={{ uri: getPrimaryImageUrl(session, item.Id, imageTag) }} onError={()=>setImageFailed(true)} style={styles.poster} resizeMode="contain" /> :
        <View style={[styles.poster, styles.placeholder]}><Text style={styles.logo}>VELARIS</Text></View>}
       {!!watchedLabel(item)&&<View style={styles.watchedBadge}><Text style={styles.watchedText}>✓ {watchedLabel(item)}</Text></View>}
       {showFavorite&&item.Type!=='BoxSet'&&<Pressable hitSlop={8} onPress={(e)=>{e.stopPropagation();toggleFavorite()}} accessibilityRole="button" accessibilityLabel={favorite?'Aus Meine Liste entfernen':'Zu Meine Liste hinzufügen'} style={styles.heart}><Text style={[styles.heartText,favorite&&styles.heartActive]}>{favorite?'♥':'♡'}</Text></Pressable>}
      </View></Animated.View>
      <Text numberOfLines={1} style={styles.name}>{item.Name}</Text>
      {showMeta&&<Text numberOfLines={1} style={styles.meta}>{item.ProductionYear ?? (item.Type === 'Series' ? 'Serie' : item.Type === 'Episode' ? 'Episode' : 'Film')}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  poster:{width:'100%',height:'100%',backgroundColor:colors.surfaceAlt},
  posterShell:{borderRadius:colors.posterRadius,overflow:'hidden',backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:'rgba(255,255,255,0.15)'},
  placeholder:{alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},
  logo:{color:colors.accent,fontWeight:'900',fontSize:11,letterSpacing:2},
  watchedBadge:{position:'absolute',left:5,bottom:6,backgroundColor:'rgba(8,8,13,.88)',paddingHorizontal:7,paddingVertical:4,borderRadius:5,borderWidth:1,borderColor:colors.success},
  watchedText:{color:colors.success,fontSize:10,fontWeight:'900'},
  heart:{position:'absolute',right:7,top:7,width:30,height:30,borderRadius:15,backgroundColor:'rgba(0,0,0,.78)',borderWidth:1,borderColor:'rgba(255,255,255,.3)',alignItems:'center',justifyContent:'center'},
  heartText:{color:'#fff',fontSize:21,lineHeight:25,includeFontPadding:false,textAlign:'center'},heartActive:{color:'#fff'},
  name:{color:colors.text,fontWeight:'700',fontSize:12,marginTop:7,letterSpacing:.1},
  meta:{color:colors.muted,fontSize:10,marginTop:3},
});
