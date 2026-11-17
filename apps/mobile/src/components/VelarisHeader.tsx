import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, design } from '@/theme';
import { useAuth } from '@/context/AuthContext';
import { useVelarisTheme } from '@/context/ThemeContext';
import { getGenres, type MediaLibraryKind } from '@/services/jellyfin';
import { getActiveProfile, type VelarisProfile } from '@/services/session';

export type SearchScope = MediaLibraryKind | 'collections' | 'favorites' | 'home';
type Props = { scope?: SearchScope; collectionId?: string; home?: boolean; overlay?: boolean; back?: boolean };
const menu: { key: SearchScope; label: string; href: string }[] = [
  {key:'home',label:design.navigation.home,href:'/(tabs)/home'},
  {key:'movies',label:design.navigation.movies,href:'/(tabs)/movies'},
  {key:'series',label:design.navigation.series,href:'/(tabs)/series'},
  {key:'anime',label:design.navigation.anime,href:'/(tabs)/anime'},
  {key:'animeMovies',label:design.navigation.animeMovies,href:'/(tabs)/anime-movies'},
  {key:'animation',label:design.navigation.animation,href:'/(tabs)/animation'},
  {key:'cartoons',label:design.navigation.cartoons,href:'/(tabs)/cartoons'},
  {key:'favorites',label:design.navigation.favorites,href:'/favorites'},
  {key:'collections',label:design.navigation.collections,href:'/collections'},
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
  const sectionAccents = design.categoryAccents;
  const sectionKey = scope === 'animeMovies' ? 'animeMovies' : scope;
  const sectionAccent = sectionKey in sectionAccents ? sectionAccents[sectionKey as keyof typeof sectionAccents] : accentColor;
  const lightAccent = !['home'].includes(scope);
  const [profile,setProfile]=useState<VelarisProfile | null>(null);
  const [genres,setGenres]=useState<string[]>([]);
  const [genresOpen,setGenresOpen]=useState(false);
  const [categoriesOpen,setCategoriesOpen]=useState(false);
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
    getActiveProfile().then(p=>setProfile(p??null));
    if(home&&session)getGenres(session).then(setGenres).catch(()=>setGenres([]));
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
          <Text numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.brand,{color:sectionAccent}]}>VELARIS{scope!=='home'?' '+String(design.navigation[scope] ?? scope).toLocaleUpperCase('de-DE'):''}</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Suche in ${sectionName}`}
          style={({pressed})=>[styles.actionTouch,pressed&&styles.actionTouchPressed]} onPress={search}>
          <SearchGlyph/>
        </Pressable>
        {home&&<Pressable accessibilityRole="button" accessibilityLabel="Downloads"
            style={({pressed})=>[styles.actionTouch,pressed&&styles.actionTouchPressed]}
            onPress={()=>router.push('/downloads')}>
            <Text style={styles.smallAction}>⇩</Text>
          </Pressable>}
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
      </View>
    </View>
    <Pressable style={styles.categoryTrigger} accessibilityRole="button" accessibilityLabel="Alle Kategorien öffnen" onPress={()=>setCategoriesOpen(true)}>
      <View style={[styles.categoryDot,{backgroundColor:sectionAccent}]}/><Text style={styles.categoryTriggerText}>Alle Kategorien</Text><Text style={styles.categoryChevron}>⌄</Text>
    </Pressable>
    <Modal visible={categoriesOpen} transparent animationType="slide" onRequestClose={()=>setCategoriesOpen(false)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <View style={styles.modalHead}><Text style={styles.modalTitle}>Kategorien</Text><Pressable onPress={()=>setCategoriesOpen(false)} accessibilityLabel="Kategorien schließen" accessibilityRole="button" style={styles.modalClose}><Text style={styles.modalCloseText}>✕</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.categoryGrid} nestedScrollEnabled>
            {menu.map(item=><Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} onPress={()=>{setCategoriesOpen(false);router.push(item.href as any)}} style={[styles.categoryTile,scope===item.key&&{borderColor:design.categoryAccents[item.key as keyof typeof design.categoryAccents]}]}>
              <View style={[styles.categoryTileMarker,{backgroundColor:design.categoryAccents[item.key as keyof typeof design.categoryAccents]}]}/>
              <Text style={styles.categoryTileText}>{item.label}</Text>
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  overlay:{position:'absolute',top:0,left:0,right:0,backgroundColor:'rgba(8,8,13,.77)'},
  top:{height:40,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
  wordmarkArea:{flexDirection:'row',alignItems:'center',gap:8,flex:1,minWidth:0},
  back:{fontSize:31,color:colors.text,fontWeight:'600',lineHeight:36,textAlign:'center',includeFontPadding:false},
  brand:{fontSize:18,color:colors.text,fontWeight:'900',letterSpacing:1.0,flexShrink:1},
  brandPurple:{color:colors.accent},
  actions:{flexDirection:'row',alignItems:'center',gap:1,flexShrink:0},
  actionTouch:{width:37,height:40,borderRadius:12,alignItems:'center',justifyContent:'center'},
  actionTouchPressed:{backgroundColor:'rgba(124,92,252,.22)',transform:[{scale:0.96}]},
  smallAction:{fontSize:23,color:colors.text,fontWeight:'700',lineHeight:28,textAlign:'center',includeFontPadding:false},
  searchGlyph:{width:26,height:26},
  searchRing:{position:'absolute',left:3,top:2,width:16,height:16,borderRadius:8,borderWidth:2,borderColor:colors.text},
  searchHandle:{position:'absolute',left:17,top:18,width:10,height:2,backgroundColor:colors.text,borderRadius:1,transform:[{rotate:'45deg'}]},
  avatar:{width:31,height:31,borderRadius:7,overflow:'hidden',borderWidth:1,borderColor:colors.border},
  avatarImage:{width:'100%',height:'100%'},
  categoryTrigger:{marginHorizontal:16,marginTop:14,minHeight:46,paddingHorizontal:14,borderRadius:18,backgroundColor:'rgba(28,26,39,.88)',borderWidth:1,borderColor:'#343645',flexDirection:'row',alignItems:'center',gap:10},
  categoryDot:{width:8,height:8,borderRadius:4},
  categoryTriggerText:{color:colors.text,fontWeight:'800',fontSize:14,flex:1},
  categoryChevron:{color:colors.text,fontSize:22},
  modalBackdrop:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(5,5,9,0.78)'},
  modalPanel:{maxHeight:'90%',backgroundColor:'#191724',borderTopLeftRadius:28,borderTopRightRadius:28,paddingHorizontal:16,paddingTop:16,paddingBottom:35},
  modalHead:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12},
  modalTitle:{fontSize:22,color:colors.text,fontWeight:'900'},
  modalClose:{width:44,height:44,alignItems:'center',justifyContent:'center',backgroundColor:'#292B37',borderRadius:10},
  modalCloseText:{fontSize:20,color:colors.text},
  categoryGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,paddingBottom:14},
  categoryTile:{width:'48%',minHeight:88,padding:14,backgroundColor:'rgba(255,255,255,.07)',borderColor:'rgba(255,255,255,.16)',borderWidth:1,borderRadius:20,justifyContent:'space-between'},
  categoryTileMarker:{width:24,height:4,borderRadius:3},
  categoryTileText:{color:colors.text,fontWeight:'800',fontSize:13},
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
