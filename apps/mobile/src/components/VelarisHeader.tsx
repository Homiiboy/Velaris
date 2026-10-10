import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, design } from '@/theme';
import { useAuth } from '@/context/AuthContext';
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

/** Same visual/navigation contract on every mobile media screen. */
export function VelarisHeader({scope='home',collectionId,home=false,overlay=false,back=false}:Props) {
  const scroller=useRef<ScrollView>(null);
  const {session}=useAuth();
  const [profile,setProfile]=useState<VelarisProfile | null>(null);
  const [genres,setGenres]=useState<string[]>([]);
  const [genresOpen,setGenresOpen]=useState(false);
  const [contentWidth,setContentWidth]=useState(0);
  const [viewportWidth,setViewportWidth]=useState(0);
  const [scrollX,setScrollX]=useState(0);
  const rightAvailable=contentWidth-viewportWidth-scrollX>12;
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
        {back&&<Pressable hitSlop={10} accessibilityLabel="Zurück" onPress={()=>router.canGoBack()?router.back():router.replace('/(tabs)/home')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>}
        <Pressable onPress={()=>router.push('/(tabs)/home')} accessibilityLabel="Velaris Startseite">
          <Text style={styles.brand}><Text style={styles.brandPurple}>VEL</Text>ARIS</Text>
        </Pressable>
      </View>
      <View style={styles.actions}>
        <Pressable accessibilityLabel={`Suche in ${sectionName}`} hitSlop={10} onPress={search}>
          <Text style={styles.action}>⌕</Text>
        </Pressable>
        {home&&<>
          <Pressable accessibilityLabel="Downloads" hitSlop={10} onPress={()=>router.push('/downloads')}>
            <Text style={styles.smallAction}>⇩</Text>
          </Pressable>
          <Pressable accessibilityLabel="Einstellungen" hitSlop={10} onPress={()=>router.push('/(tabs)/profile')}>
            <Text style={styles.smallAction}>⚙</Text>
          </Pressable>
          <Pressable accessibilityLabel="Profil" hitSlop={10} onPress={()=>router.push('/profiles')}>
            <View style={styles.avatar}>
              <Image source={profile?.photoUri?{uri:profile.photoUri}:AVATARS[(profile?.avatar??0)%AVATARS.length]} style={styles.avatarImage}/>
            </View>
          </Pressable>
        </>}
      </View>
    </View>
    <View style={styles.strip}>
      <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onLayout={e=>setViewportWidth(e.nativeEvent.layout.width)}
        onContentSizeChange={(w)=>setContentWidth(w)}
        onScroll={e=>setScrollX(e.nativeEvent.contentOffset.x)}
        scrollEventThrottle={40}
        contentContainerStyle={styles.stripContent}>
        {menu.map(item=><Pressable key={item.key}
          accessibilityRole="button" accessibilityState={{selected:scope===item.key}}
          onPress={()=>router.push(item.href as any)}
          style={[styles.chip,scope===item.key&&styles.activeChip]}>
          <Text style={styles.chipText}>{item.label}</Text>
        </Pressable>)}
        {home&&<Pressable style={[styles.chip,genresOpen&&styles.activeChip]} onPress={()=>setGenresOpen(v=>!v)}>
          <Text style={styles.chipText}>Genres</Text>
        </Pressable>}
      </ScrollView>
      {rightAvailable&&<Pressable accessibilityLabel="Weitere Kategorien" style={styles.more}
        onPress={()=>scroller.current?.scrollTo({x:Math.min(contentWidth-viewportWidth,scrollX+195),animated:true})}>
        <Text style={styles.moreText}>›</Text>
      </Pressable>}
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
  back:{fontSize:31,color:colors.text,fontWeight:'600',lineHeight:34},
  brand:{fontSize:20,color:colors.text,fontWeight:'900',letterSpacing:2.2},
  brandPurple:{color:colors.accent},
  actions:{flexDirection:'row',alignItems:'center',gap:16},
  action:{fontSize:30,color:colors.text,fontWeight:'700'},
  smallAction:{fontSize:20,color:colors.text,fontWeight:'700'},
  avatar:{width:31,height:31,borderRadius:7,overflow:'hidden',borderWidth:1,borderColor:colors.border},
  avatarImage:{width:'100%',height:'100%'},
  strip:{marginTop:13,height:40,position:'relative'},
  stripContent:{paddingLeft:16,paddingRight:65,gap:9,alignItems:'center'},
  chip:{height:32,borderRadius:18,paddingHorizontal:13,borderWidth:1,borderColor:'rgba(255,255,255,.36)',justifyContent:'center',backgroundColor:'rgba(20,20,27,.45)'},
  activeChip:{borderColor:colors.accent,backgroundColor:colors.surfaceAlt},
  chipText:{color:colors.text,fontWeight:'700',fontSize:12},
  more:{position:'absolute',right:0,top:0,bottom:0,width:48,alignItems:'center',justifyContent:'center',backgroundColor:'rgba(8,8,13,.97)',borderLeftWidth:1,borderLeftColor:colors.border},
  moreText:{fontSize:32,fontWeight:'700',color:colors.accent,lineHeight:35},
  genreDropdown:{position:'absolute',right:16,top:130,width:240,borderWidth:1,borderColor:colors.border,backgroundColor:colors.surface,borderRadius:12,maxHeight:340,zIndex:30},
  genreHeading:{color:colors.text,padding:13,fontWeight:'800'},
  genreScroll:{maxHeight:290},
  genreItem:{paddingHorizontal:15,paddingVertical:12,borderTopWidth:1,borderTopColor:colors.border},
  genreText:{color:colors.text,fontSize:13}
});
