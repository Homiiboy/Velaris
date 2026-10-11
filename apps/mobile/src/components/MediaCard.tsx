import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { getPrimaryImageUrl, setFavorite } from '@/services/jellyfin';
import type { JellyfinItem, Session } from '@/types/jellyfin';
import { colors } from '@/theme';
import { playbackPercent,hasResumeProgress,statusBadge } from '@/services/playbackPresentation';

export function MediaCard({ item, session, width = 128, showMeta = false, showFavorite = true, onFavoriteChange }: { item: JellyfinItem; session: Session; width?: number; showMeta?: boolean; showFavorite?: boolean; onFavoriteChange?: (favorite:boolean)=>void }) {
  const [imageFailed,setImageFailed]=useState(false);
  const [favorite,setFavoriteState]=useState(!!item.UserData?.IsFavorite);
  const [saving,setSaving]=useState(false);
  const [highlighted,setHighlighted]=useState(false);
  const scale=useRef(new Animated.Value(1)).current;
  const detailOpacity=useRef(new Animated.Value(0)).current;
  const artworkOpacity=useRef(new Animated.Value(0)).current;
  const animateScale=(value:number)=>Animated.spring(scale,{
    toValue:value,useNativeDriver:true,speed:24,bounciness:2
  }).start();
  const setFocus=(value:boolean)=>{
    setHighlighted(value);
    animateScale(value?1.02:1);
    Animated.timing(detailOpacity,{toValue:value?1:0,duration:150,useNativeDriver:true}).start();
  };
  const imageTag=item.PrimaryImageTag ?? item.ImageTags?.Primary;
  useEffect(()=>{
    setImageFailed(false);
    artworkOpacity.setValue(0);
  },[item.Id,imageTag,artworkOpacity]);
  const meta=[item.Type==='Series'?'SERIE':item.Type==='BoxSet'?'SAMMLUNG':'FILM',
    item.ProductionYear].filter(Boolean).join('  ·  ');
  const badge=statusBadge(item);
  const progress=hasResumeProgress(item)?playbackPercent(item):0;
  const toggleFavorite=async()=>{
    if(saving||item.Type==='BoxSet')return;
    const next=!favorite; setFavoriteState(next); setSaving(true);
    try{await setFavorite(session,item.Id,next);item.UserData={...item.UserData,IsFavorite:next};onFavoriteChange?.(next)}
    catch{setFavoriteState(!next)}
    finally{setSaving(false)}
  };
  return (
    <Pressable
      onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
      onHoverIn={()=>setFocus(true)} onHoverOut={()=>setFocus(false)}
      onPressIn={()=>animateScale(.98)} onPressOut={()=>animateScale(highlighted?1.02:1)}
      onPress={() => item.Type === 'BoxSet' ? router.push({ pathname: '/collection/[id]', params: { id: item.Id } }) : router.push({ pathname: '/details/[id]', params: { id: item.Id } })}
      accessibilityRole="button"
      accessibilityLabel={item.Name}
      style={{width}}
    >
      <Animated.View style={[styles.cardLift,{
        transform:[{scale}],width,
        shadowOpacity:highlighted?0.32:0.08,
        elevation:highlighted?8:1
      }]}><View style={[styles.posterShell,highlighted&&styles.posterFocused,
        {width,height:Math.round(width*1.5)}]}>
       {!imageFailed ? <Animated.Image source={{ uri: getPrimaryImageUrl(session, item.Id, imageTag) }}
          onLoad={()=>Animated.timing(artworkOpacity,{
            toValue:1,duration:260,useNativeDriver:true
          }).start()}
          onError={()=>setImageFailed(true)}
          style={[styles.poster,{opacity:artworkOpacity}]} resizeMode="contain" /> :
        <View style={[styles.poster, styles.placeholder]}><Text style={styles.logo}>VELARIS</Text></View>}
       <Animated.View pointerEvents="none" style={[styles.focusMeta,{opacity:detailOpacity}]}>
        <Text numberOfLines={1} style={styles.focusMetaText}>{meta}</Text>
       </Animated.View>
       {!!badge&&<View style={[styles.statusBadge,badge.kind==='watched'?styles.watchedBadge:styles.resumeBadge]}>
         <Text style={[styles.statusText,badge.kind==='watched'?styles.watchedText:styles.resumeText]}>
          {badge.kind==='watched'?'✓  ':''}{badge.text}
         </Text>
       </View>}
       {progress>0&&<View pointerEvents="none" style={styles.progressTrack}>
        <View style={[styles.progressFill,{width:`${progress}%`}]}/>
       </View>}
       {showFavorite&&item.Type!=='BoxSet'&&<Pressable hitSlop={8} onPress={(e)=>{e.stopPropagation();toggleFavorite()}} accessibilityRole="button" accessibilityLabel={favorite?'Aus Meine Liste entfernen':'Zu Meine Liste hinzufügen'} style={styles.heart}><Text style={[styles.heartText,favorite&&styles.heartActive]}>{favorite?'♥':'♡'}</Text></Pressable>}
      </View></Animated.View>
      <Text numberOfLines={1} style={[styles.name,highlighted&&styles.nameFocused]}>{item.Name}</Text>
      {showMeta&&<Text numberOfLines={1} style={styles.meta}>{item.ProductionYear ?? (item.Type === 'Series' ? 'Serie' : item.Type === 'Episode' ? 'Episode' : 'Film')}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  cardLift:{shadowColor:colors.accent,shadowRadius:15,shadowOffset:{width:0,height:5}},
  poster:{width:'100%',height:'100%',backgroundColor:colors.surfaceAlt},
  posterShell:{borderRadius:colors.posterRadius,overflow:'hidden',backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:'rgba(255,255,255,0.15)'},
  posterFocused:{borderColor:'#DCCFFF',borderWidth:2},
  focusMeta:{position:'absolute',left:6,right:35,top:7,
    borderRadius:5,paddingHorizontal:7,paddingVertical:5,
    backgroundColor:'rgba(8,8,13,.88)'},
  focusMetaText:{color:colors.text,fontWeight:'900',fontSize:9,letterSpacing:.4},
  placeholder:{alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border},
  logo:{color:colors.accent,fontWeight:'900',fontSize:11,letterSpacing:2},
  statusBadge:{position:'absolute',left:6,bottom:9,maxWidth:'93%',paddingHorizontal:7,paddingVertical:5,borderRadius:5,borderWidth:1},
  watchedBadge:{backgroundColor:'rgba(12,37,25,.92)',borderColor:colors.success},
  resumeBadge:{backgroundColor:'rgba(35,24,70,.92)',borderColor:'rgba(180,157,255,.76)'},
  statusText:{fontSize:9,fontWeight:'900',letterSpacing:.25},
  watchedText:{color:colors.success},
  resumeText:{color:'#E6DEFF'},
  progressTrack:{position:'absolute',left:0,right:0,bottom:0,height:3,backgroundColor:'rgba(255,255,255,.28)'},
  progressFill:{height:3,backgroundColor:colors.progress},
  heart:{position:'absolute',right:7,top:7,width:30,height:30,borderRadius:15,backgroundColor:'rgba(0,0,0,.78)',borderWidth:1,borderColor:'rgba(255,255,255,.3)',alignItems:'center',justifyContent:'center'},
  heartText:{color:'#fff',fontSize:21,lineHeight:25,includeFontPadding:false,textAlign:'center'},heartActive:{color:'#fff'},
  name:{color:colors.text,fontWeight:'700',fontSize:12,marginTop:8,letterSpacing:.1},
  nameFocused:{color:'#E5DCFF'},
  meta:{color:colors.muted,fontSize:10,marginTop:3},
});
