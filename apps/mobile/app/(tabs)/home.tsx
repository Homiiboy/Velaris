import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getBackdropUrl, getFavorites, getGenres, getLatest, getPlayedItems, getRecommendations, getResumeItems } from '@/services/jellyfin';
import { MediaRow } from '@/components/MediaRow';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors, design } from '@/theme';
import { getActiveProfile, type VelarisProfile } from '@/services/session';

export default function HomeScreen() {
  const { session } = useAuth();
  const [latest, setLatest] = useState<JellyfinItem[]>([]);
  const [resume, setResume] = useState<JellyfinItem[]>([]);
  const [favorites,setFavorites]=useState<JellyfinItem[]>([]);
  const [recommended,setRecommended]=useState<JellyfinItem[]>([]);
  const [becauseTitle,setBecauseTitle]=useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeProfile,setActiveProfile]=useState<VelarisProfile|null>(null); const [categoryMenu,setCategoryMenu]=useState(false); const [genres,setGenres]=useState<string[]>([]);
  const entrance=useRef(new Animated.Value(0)).current;
  const avatarSymbols=['⚙','◈','✦','◆','🦭'];
  const load = useCallback(async () => {
    if (!session) return;
    const [a,b,c,d]=await Promise.allSettled([getResumeItems(session),getLatest(session),getFavorites(session),getPlayedItems(session)]);
    if(a.status==='fulfilled')setResume(a.value.Items);
    if(b.status==='fulfilled')setLatest(b.value.Items);
    if(c.status==='fulfilled')setFavorites(c.value.Items);
    if(d.status==='fulfilled'&&d.value.Items[0]){
      const watched=d.value.Items[0]; setBecauseTitle(watched.Name);
      try{const rec=await getRecommendations(session,watched.Genres??[],watched.Id);setRecommended(rec.Items)}catch{}
    }else{setRecommended([]);setBecauseTitle('')}
  },[session]);
  useEffect(()=>{load();if(session)getGenres(session).then(setGenres).catch(()=>setGenres([]));getActiveProfile().then(p=>setActiveProfile(p??null));Animated.timing(entrance,{toValue:1,duration:450,useNativeDriver:true}).start()},[load,session]);
  const hero=useMemo(()=>latest.find(i=>i.BackdropImageTags?.length)||latest[0],[latest]);
  if(!session)return <Redirect href="/connect"/>;
  return <ScrollView style={styles.page} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async()=>{setRefreshing(true);await load();setRefreshing(false)}} tintColor={colors.accent}/>}>
    <View style={styles.top}><Text style={styles.brand}>VELARIS</Text><View style={styles.actions}><Pressable hitSlop={12} onPress={()=>router.push('/downloads')}><Text style={styles.downloadIcon}>⇩</Text></Pressable><Pressable hitSlop={12} onPress={()=>router.push('/collections')}><Text style={styles.collectionIcon}>▣</Text></Pressable><Pressable hitSlop={12} onPress={()=>router.push('/(tabs)/search')}><Text style={styles.action}>⌕</Text></Pressable><Pressable hitSlop={12} onPress={()=>router.push('/(tabs)/profile')}><View style={styles.avatar}>{activeProfile?.photoUri?<Image source={{uri:activeProfile.photoUri}} style={styles.avatarPhoto}/>:<Text style={styles.avatarText}>{avatarSymbols[activeProfile?.avatar??0]??activeProfile?.name?.slice(0,1).toUpperCase()??'V'}</Text>}</View></Pressable></View></View><View style={styles.quickNav}><Pressable style={styles.navChip} onPress={()=>setCategoryMenu(v=>!v)}><Text style={styles.navChipText}>Kategorien</Text></Pressable></View>{categoryMenu&&<View style={styles.categoryMenu}><Text style={styles.categoryHeading}>Genres</Text><ScrollView style={styles.categoryScroll} nestedScrollEnabled>{genres.map(g=><Pressable key={g} style={styles.categoryItem} onPress={()=>{setCategoryMenu(false);router.push({pathname:'/genre/[name]',params:{name:g}})}}><Text style={styles.categoryText}>{g}</Text><Text style={styles.categoryArrow}>›</Text></Pressable>)}</ScrollView></View>}
    <Animated.View style={{opacity:entrance,transform:[{translateY:entrance.interpolate({inputRange:[0,1],outputRange:[12,0]})}]}}>{hero&&<ImageBackground source={{uri:getBackdropUrl(session,hero)}} style={styles.hero} imageStyle={styles.heroImage}>
      <View style={styles.shade}><View style={styles.heroContent}><Text numberOfLines={2} style={styles.heroTitle}>{hero.Name}</Text>
      <Text style={styles.heroMeta}>{[hero.ProductionYear,hero.Type==='Series'?'Serie':'Film'].filter(Boolean).join('  •  ')}</Text>
      {!!hero.Genres?.length&&<Text numberOfLines={1} style={styles.heroGenres}>{hero.Genres.slice(0,3).join('  •  ')}</Text>}
      <View style={styles.heroButtons}><Pressable style={styles.play} onPress={()=>router.push({pathname:'/player/[id]',params:{id:hero.Id}})}><Text style={styles.playText}>▶  Abspielen</Text></Pressable>
      <Pressable style={styles.info} onPress={()=>router.push({pathname:'/details/[id]',params:{id:hero.Id}})}><Text style={styles.infoText}>ⓘ  Mehr Infos</Text></Pressable></View></View></View>
    </ImageBackground>}
    <View style={styles.rows}>
      <MediaRow title={design.homeRows.topTen} items={recommended.length?recommended:latest} session={session} topTen/>
      <MediaRow title={design.homeRows.resume} items={resume} session={session} continueWatching/>
      <MediaRow title={design.homeRows.favorites} items={favorites} session={session}/>
      {!!becauseTitle&&<MediaRow title={`${design.homeRows.becausePrefix} „${becauseTitle}“ gesehen hast`} items={recommended} session={session}/>}
      <MediaRow title={design.homeRows.latest} items={latest} session={session}/>
    </View></Animated.View>
  </ScrollView>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:'#050505'},
 top:{position:'absolute',zIndex:6,top:0,left:0,right:0,paddingTop:48,paddingHorizontal:14,height:92,flexDirection:'row',alignItems:'center',justifyContent:'space-between',backgroundColor:'rgba(0,0,0,.38)'},
 brand:{color:'#FFFFFF',fontSize:17,fontWeight:'900',letterSpacing:4},
 quickNav:{position:'absolute',zIndex:6,top:94,left:14,right:14,flexDirection:'row',gap:8},navChip:{height:34,paddingHorizontal:15,borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,.65)',alignItems:'center',justifyContent:'center',backgroundColor:'rgba(0,0,0,.22)'},navChipText:{color:'#fff',fontSize:12,fontWeight:'700'},
 categoryMenu:{position:'absolute',zIndex:10,top:134,left:120,right:14,maxHeight:360,backgroundColor:'rgba(0,0,0,.72)',borderRadius:18,borderWidth:1,borderColor:'rgba(255,255,255,.65)',overflow:'hidden'},categoryHeading:{color:'#fff',fontSize:16,fontWeight:'900',paddingHorizontal:16,paddingTop:14,paddingBottom:10},categoryScroll:{maxHeight:305},categoryItem:{height:43,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderTopColor:'rgba(255,255,255,.12)'},categoryText:{color:'#eee',fontSize:13,fontWeight:'700'},categoryArrow:{color:'#888',fontSize:20},
 actions:{flexDirection:'row',alignItems:'center',gap:17},downloadIcon:{color:'#fff',fontSize:21,fontWeight:'900'},collectionIcon:{color:'#fff',fontSize:20,fontWeight:'800'},action:{color:'#fff',fontSize:25,fontWeight:'800'},
 avatar:{width:30,height:30,borderRadius:7,backgroundColor:colors.accent,alignItems:'center',justifyContent:'center',overflow:'hidden'},avatarPhoto:{width:'100%',height:'100%'},avatarText:{color:'#fff',fontWeight:'900',fontSize:12},
 hero:{height:590,justifyContent:'flex-end',backgroundColor:'#111'},heroImage:{opacity:.94},
 shade:{flex:1,justifyContent:'flex-end',backgroundColor:'rgba(0,0,0,.18)'},
 heroContent:{paddingHorizontal:14,paddingBottom:38,paddingTop:90,backgroundColor:'rgba(5,5,5,.24)'},
 heroTitle:{color:'#fff',fontSize:38,lineHeight:41,fontWeight:'900',letterSpacing:-1},
 heroMeta:{color:'#fff',fontSize:14,fontWeight:'700',marginTop:9},
 heroGenres:{color:'#D7D7D7',fontSize:12,fontWeight:'600',marginTop:7},
 heroButtons:{flexDirection:'row',gap:9,marginTop:20},
 play:{flex:1,height:44,borderRadius:4,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},playText:{color:'#080808',fontSize:14,fontWeight:'900'},
 info:{flex:1,height:44,borderRadius:4,backgroundColor:'rgba(88,88,88,.82)',alignItems:'center',justifyContent:'center'},infoText:{color:'#fff',fontSize:14,fontWeight:'800'},
 rows:{paddingTop:12,paddingBottom:12}
});
