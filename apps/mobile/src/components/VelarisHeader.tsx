import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, design } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useVelarisTheme } from '@/context/ThemeContext';
import { getGenres, type MediaLibraryKind } from '@/services/jellyfin';
import { getActiveProfile, type VelarisProfile } from '@/services/session';

export type SearchScope = MediaLibraryKind | 'collections' | 'home';
type Props = { scope?: SearchScope; collectionId?: string; home?: boolean; overlay?: boolean; back?: boolean };
const menu: { key: SearchScope; label: string; href: string }[] = [
  {key:'home',label:design.navigation.home,href:'/(tabs)/home'},
  {key:'animation',label:design.navigation.animation,href:'/(tabs)/animation'},
  {key:'anime',label:design.navigation.anime,href:'/(tabs)/anime'},
  {key:'animeMovies',label:design.navigation.animeMovies,href:'/(tabs)/anime-movies'},
  {key:'cartoons',label:design.navigation.cartoons,href:'/(tabs)/cartoons'},
  {key:'movies',label:design.navigation.movies,href:'/(tabs)/movies'},
  {key:'collections',label:design.navigation.collections,href:'/collections'},
  {key:'series',label:design.navigation.series,href:'/(tabs)/series'},
];
const AVATARS=[
  require('../../assets/AvatarRot.png'),
  require('../../assets/AvatarBlau.png'),
  require('../../assets/AvatarRobbeWeiss.png'),
  require('../../assets/AvatarRobbeGrau.png'),
];

// A font-independent search icon, centered inside the same touch target
// used by Download, Settings and Profile.
function SearchGlyph(){
 return <View style={styles.searchGlyph} pointerEvents="none">
  <View style={styles.searchRing}/>
  <View style={styles.searchHandle}/>
 </View>;
}

/** Same visual/navigation contract on every mobile media screen. */
export function VelarisHeader({scope='home',collectionId,home=false,overlay=false,back=false}:Props) {
  const scroller=useRef<ScrollView>(null);
  const tabEnds=useRef<number[]>([]);
  const {session}=useAuth();
  const {accentColor}=useVelarisTheme();
  const [profile,setProfile]=useState<VelarisProfile | null>(null);
  const [genres,setGenres]=useState<string[]>([]);
  const [genresOpen,setGenresOpen]=useState(false);
  const [contentWidth,setContentWidth]=useState(0);
  const [viewportWidth,setViewportWidth]=useState(0);
  const [scrollX,setScrollX]=useState(0);
  const rightAvailable=contentWidth-viewportWidth-scrollX>8;
  const scrollToNextTab=()=>{
    const maxX=Math.max(0,contentWidth-viewportWidth);
    const rightEdge=scrollX+viewportWidth-14;
    const nextEnd=tabEnds.current.find(end=>end>rightEdge);
    // Move by whole pills; when reaching the last tab, expose its right edge.
    const target=nextEnd==null?maxX:
      Math.min(maxX,Math.max(scrollX+1,nextEnd-viewportWidth+28));
    scroller.current?.scrollTo({x:target,animated:true});
  };
  const sectionName=scope==='home'?'Velaris':design.navigation[scope];
  useEffect(()=>{
    if(!home)return;
    getActiveProfile().then(p=>setProfile(p??null));
    if(session)getGenres(session).then(setGenres).catch(()=>setGenres([]));
  },[home,session]);
  const search=useCallback(()=>{
    router.push({pathname:'/(tabs)/search',params:{
      scope, ...(collectionId?{collectionId}:{})
    }});
  },[scope,collectionId]);
  return <View style={[styles.header,overlay&&styles.overlay]}>
    <View style={styles.top}>
      <View style={styles.wordmarkArea}>
        {back&&<Pressable accessibilityRole="button" hitSlop={8} accessibilityLabel="Zurück"
          style={({pressed})=>[styles.actionTouch,pressed&&styles.actionTouchPressed]}
          onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/home')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>}
        <Pressable onPress={()=>router.push('/(tabs)/home')} accessibilityLabel="Velaris Startseite">
          <Text style={styles.brand}><Text style={[styles.brandPurple,{color:accentColor}]}>VEL</Text>ARIS</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Suche in ${sectionName}`}
          style={({pressed})=>[styles.actionTouch,pressed&&styles.actionTouchPressed]} onPress={search}>
          <SearchGlyph/>
        </Pressable>
        {home&&<>
          <Pressable accessibilityRole="button" accessibilityLabel="Downloads"
            style={({pressed})=>[styles.actionTouch,pressed&&styles.actionTouchPressed]}
            onPress={()=>router.push('/downloads')}>
            <Text style={styles.smallAction}>⇩</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Einstellungen"
            style={({pressed})=>[styles.actionTouch,pressed&&styles.actionTouchPressed]}
            onPress={()=>router.push('/(tabs)/profile')}>
            <Text style={styles.smallAction}>⚙</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Profil"
            style={({pressed})=>[styles.actionTouch,pressed&&styles.actionTouchPressed]}
            onPress={()=>router.push('/profiles')}>
            <View style={styles.avatar}>
              <Image source={profile?.photoUri?{uri:profile.photoUri}:AVATARS[(profile?.avatar??0)%AVATARS.length]} style={styles.avatarImage}/>
            </View>
          </Pressable>
        </>}
      </View>
    </View>
    <View style={styles.strip}>
      <ScrollView ref={scroller} style={styles.stripScroll} horizontal showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onLayout={e=>setViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w)=>setContentWidth(w)}
        onScroll={e=>setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={40}
        contentContainerStyle={styles.stripContent}>
        {menu.map((item,index)=><Pressable key={item.key}
          onLayout={e=>{const {x,width}=e.nativeEvent.layout;tabEnds.current[index]=x+width;}}
          accessibilityRole="button" accessibilityState={{selected:scope===item.key}}
          onPress={()=>router.push(item.href as any)}
          style={({pressed})=>[styles.chip,scope===item.key&&[styles.activeChip,{backgroundColor:accentColor,shadowColor:accentColor}],pressed&&styles.chipPressed]}>
          <Text style={[styles.chipText,scope===item.key&&styles.activeChipText]}>{item.label}</Text>
        </Pressable>)}
        {home&&<Pressable accessibilityRole="button" accessibilityLabel="Genres"
          style={({pressed})=>[styles.chip,genresOpen&&[styles.activeChip,{backgroundColor:accentColor}],pressed&&styles.chipPressed]}
          onLayout={e=>{const {x,width}=e.nativeEvent.layout;tabEnds.current[menu.length]=x+width;}}
          onPress={()=>setGenresOpen(v=>!v)}>
          <Text style={[styles.chipText,genresOpen&&styles.activeChipText]}>Genres</Text>
        </Pressable>}
        <View style={styles.trailingGap} accessible={false}/>
      </ScrollView>
      <Pressable accessibilityLabel="Weitere Kategorien" accessibilityRole="button"
        disabled={!rightAvailable}
        style={[styles.more,{opacity:rightAvailable?1:0}]}
        onPress={scrollToNextTab}>
        <View style={styles.chevron} pointerEvents="none">
          <View style={[styles.chevronArm,styles.chevronTop]}/>
          <View style={[styles.chevronArm,styles.chevronBottom]}/>
        </View>
      </Pressable>
    </View>
    {home&&genresOpen&&<View style={styles.genreDropdown}>
      <Text style={styles.genreHeading}>Genres</Text>
      <ScrollView style={styles.genreScroll} nestedScrollEnabled>
        {genres.map(g=><Pressable key={g} style={styles.genreItem} onPress={()=>{
          setGenresOpen(false);
          router.push({pathname:'/genre/[name]',params:{name:g}});
        }}><Text style={styles.genreText}>{g}</Text></Pressable>)}
      </ScrollView>
    </View>}
  </View>;
}
const styles=StyleSheet.create({
  header:{backgroundColor:colors.background,paddingTop:46,paddingBottom:12,zIndex:20},
  overlay:{position:'absolute',top:0,left:0,right:0,backgroundColor:'rgba(8,8,13,.89)'},
  top:{height:40,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  wordmarkArea:{flexDirection:'row',alignItems:'center',gap:13},
  back:{fontSize:31,color:colors.text,fontWeight:'600',lineHeight:36,textAlign:'center',includeFontPadding:false},
  brand:{fontSize:20,color:colors.text,fontWeight:'900',letterSpacing:2.2},
  brandPurple:{color:colors.accent},
  actions:{flexDirection:'row',alignItems:'center',gap:3},
  actionTouch:{width:37,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},
  actionTouchPressed:{backgroundColor:'rgba(124,92,252,.22)',transform:[{scale:0.96}]},
  smallAction:{fontSize:23,color:colors.text,fontWeight:'700',lineHeight:28,textAlign:'center',includeFontPadding:false},
  searchGlyph:{width:26,height:26},
  searchRing:{position:'absolute',left:3,top:2,width:16,height:16,borderRadius:8,borderWidth:2,borderColor:colors.text},
  searchHandle:{position:'absolute',left:17,top:18,width:10,height:2,backgroundColor:colors.text,borderRadius:1,transform:[{rotate:'45deg'}]},
  avatar:{width:31,height:31,borderRadius:7,overflow:'hidden',borderWidth:1,borderColor:colors.border},
  avatarImage:{width:'100%',height:'100%'},
  strip:{marginTop:14,height:46,flexDirection:'row',alignItems:'center',paddingRight:14},
  stripScroll:{flex:1},
  stripContent:{paddingLeft:18,paddingRight:12,gap:16,alignItems:'center'},
  trailingGap:{width:20,height:1},
  chip:{height:36,borderRadius:20,paddingHorizontal:15,justifyContent:'center',alignItems:'center',backgroundColor:'transparent'},
  chipPressed:{backgroundColor:'rgba(124,92,252,.16)'},
  activeChip:{backgroundColor:colors.accent,shadowColor:colors.accent,shadowOpacity:0.24,shadowRadius:8,elevation:3},
  chipText:{color:'rgba(255,255,255,0.78)',fontWeight:'700',fontSize:13},
  activeChipText:{color:colors.text,fontWeight:'900'},
  more:{width:42,height:42,marginLeft:8,borderRadius:21,alignItems:'center',justifyContent:'center',flexShrink:0,backgroundColor:'#242132',borderWidth:1,borderColor:'rgba(160,140,255,0.22)'},
  chevron:{width:22,height:22,alignItems:'center',justifyContent:'center'},
  chevronArm:{position:'absolute',left:5,width:11,height:2.5,borderRadius:2,backgroundColor:colors.text},
  chevronTop:{top:7,transform:[{rotate:'45deg'}]},
  chevronBottom:{top:13,transform:[{rotate:'-45deg'}]},
  genreDropdown:{position:'absolute',right:16,top:130,width:240,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:12,maxHeight:340,zIndex:30},
  genreHeading:{color:colors.text,padding:13,fontWeight:'800'},
  genreScroll:{maxHeight:290},
  genreItem:{paddingHorizontal:15,paddingVertical:12,borderTopWidth:1,borderTopColor:colors.border},
  genreText:{color:colors.text,fontSize:13}
});
