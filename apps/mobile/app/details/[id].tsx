import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getBackdropUrl, getEpisodes, getItem, getPrimaryImageUrl, getSeasons, setFavorite } from '@/services/jellyfin';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';
import { VelarisHeader } from '@/components/VelarisHeader';
import { PlayGlyph } from '@/components/PlayGlyph';
import { CinematicShade } from '@/components/CinematicShade';
import { downloadItem, isDownloaded, removeDownload } from '@/services/downloads';
import { allEpisodesWatched, isWatched } from '@/services/watchStatus';
import { episodeHeading } from '@/services/episodeTitles';

export default function DetailsScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
 const goBack=()=>{if(router.canGoBack())router.back();else router.replace('/(tabs)/home')};
 const fade=useRef(new Animated.Value(0)).current;
 const [downloading,setDownloading]=useState(false),[downloaded,setDownloaded]=useState(false),[downloadProgress,setDownloadProgress]=useState(0),[downloadError,setDownloadError]=useState(''); const [item,setItem]=useState<JellyfinItem|null>(null),[favorite,setFavoriteState]=useState(false),[seasons,setSeasons]=useState<JellyfinItem[]>([]),[episodesBySeason,setEpisodesBySeason]=useState<Record<string,JellyfinItem[]>>({}),[seriesComplete,setSeriesComplete]=useState(false),[season,setSeason]=useState(''),[seasonMenu,setSeasonMenu]=useState(false);
 useEffect(()=>{Animated.timing(fade,{toValue:1,duration:350,useNativeDriver:true}).start()},[]);
 useEffect(()=>{if(session&&id)isDownloaded(session,id).then(setDownloaded)},[session,id]);
 // Refresh after returning from the player. A series is complete ONLY if
 // each known season has episodes and every episode is marked played by Jellyfin.
 useFocusEffect(useCallback(()=>{
   if(!session||!id)return;
   let active=true;
   setEpisodesBySeason({});
   setSeriesComplete(false);
   getItem(session,id).then(async x=>{
     if(!active)return;
     setItem(x);setFavoriteState(!!x.UserData?.IsFavorite);
     if(x.Type!=='Series')return;
     try{
       const seasonsResult=await getSeasons(session,x.Id);
       if(!active)return;
       const available=seasonsResult.Items;
       const defaultSeason=available.find(s=>s.IndexNumber===1)
         ??available.find(s=>(s.IndexNumber??0)>0)??available[0];
       setSeasons(available);
       setSeason(previous=>available.some(s=>s.Id===previous)?previous:(defaultSeason?.Id??''));
       // Fetch season 1 first; stream individual episode lists into the UI
       // instead of waiting for every season's request before showing anything.
       const ordered=defaultSeason?[defaultSeason,...available.filter(s=>s.Id!==defaultSeason.Id)]:available;
       const results=await Promise.allSettled(ordered.map(async current=>{
         const response=await getEpisodes(session,x.Id,current.Id);
         if(active)setEpisodesBySeason(previous=>({...previous,[current.Id]:response.Items}));
         return response.Items;
       }));
       if(active)setSeriesComplete(available.length>0&&results.every(result=>
         result.status==='fulfilled'&&allEpisodesWatched(result.value)));
     }catch{if(active){setSeasons([]);setEpisodesBySeason({});setSeriesComplete(false)}}
   }).catch(()=>{});
   return ()=>{active=false};
 },[session,id]));
 const episodes=episodesBySeason[season]??[];
 const completedSeasons=new Set(seasons.filter(s=>allEpisodesWatched(episodesBySeason[s.Id]??[])).map(s=>s.Id));
 if(!session)return <Redirect href="/connect"/>; if(!item)return <View style={styles.loading}><View style={styles.skeletonHero}/><View style={styles.skeletonBody}><View style={styles.skeletonTitle}/><View style={styles.skeletonMeta}/><View style={styles.skeletonButton}/><View style={styles.skeletonLine}/><View style={styles.skeletonLine}/></View></View>;
 const mins=item.RunTimeTicks?Math.round(item.RunTimeTicks/600000000):undefined, tag=item.PrimaryImageTag??item.ImageTags?.Primary;
 return <Animated.View style={{flex:1,opacity:fade}}><ScrollView style={styles.page}><ImageBackground source={{uri:item.BackdropImageTags?.length?getBackdropUrl(session,item):getPrimaryImageUrl(session,item.Id,tag)}} style={styles.hero} imageStyle={{opacity:.90}}>
 <CinematicShade variant="details"/></ImageBackground>
 <View style={styles.body}>
 <Text style={styles.eyebrow}>{item.Type==='Series'?'SERIE AUF VELARIS':item.Type==='Episode'?'EPISODE AUF VELARIS':'FILM AUF VELARIS'}</Text>
 <Text style={styles.title}>{item.Name}</Text>{(item.Type==='Series'?seriesComplete:isWatched(item))&&<Text style={styles.watchedBanner}>✓ {item.Type==='Series'?'Serie vollständig gesehen':'Bereits gesehen'}</Text>}<Text style={styles.meta}>{[
  item.ProductionYear,
  item.Type==='Series'?'Serie':item.Type==='Episode'?'Episode':'Film',
  item.Type!=='Series'&&mins?`${mins} Min.`:null,
  item.OfficialRating,
  item.CommunityRating?`★ ${item.CommunityRating.toFixed(1)}`:null
 ].filter(Boolean).join('   ·   ')}</Text>
 <View style={styles.mainActions}><Pressable accessibilityRole="button" accessibilityLabel={item.UserData?.PlaybackPositionTicks?'Fortsetzen':'Abspielen'} style={({pressed})=>[styles.play,pressed&&styles.pressed]} onPress={()=>router.push({pathname:'/player/[id]',params:{id:item.Id}})}><PlayGlyph size={19} color="#08090B"/><Text style={styles.playText}>{item.UserData?.PlaybackPositionTicks?'Fortsetzen':'Abspielen'}</Text></Pressable><Pressable style={styles.favorite} onPress={async()=>{const next=!favorite;setFavoriteState(next);try{await setFavorite(session,item.Id,next);item.UserData={...item.UserData,IsFavorite:next}}catch{setFavoriteState(!next)}}}><Text style={[styles.favoriteIcon,favorite&&styles.favoriteActive]}>{favorite?'♥':'♡'}</Text><Text style={styles.favoriteLabel}>Meine Liste</Text></Pressable></View>{item.Type!=='Series'&&<Pressable disabled={downloading} style={styles.download} onPress={async()=>{if(downloaded){await removeDownload(session,item.Id);setDownloaded(false);return}setDownloading(true);setDownloadProgress(0);setDownloadError('');try{await downloadItem(session,item,setDownloadProgress);setDownloaded(true)}catch(e){setDownloadError(e instanceof Error?e.message:'Download fehlgeschlagen.')}finally{setDownloading(false)}}}><Text style={styles.downloadText}>{downloaded?'✓ Heruntergeladen':downloading?`⇩ ${Math.round(downloadProgress*100)} %`:'⇩ Herunterladen'}</Text></Pressable>}{!!downloadError&&<Text style={styles.downloadError}>{downloadError}</Text>}
 {!!item.Genres?.length&&<Text numberOfLines={2} style={styles.genres}>{item.Genres.slice(0,5).join('   ·   ')}</Text>}
 {!!item.Overview&&<View style={styles.storySection}>
  <Text style={styles.storyLabel}>HANDLUNG</Text>
  <Text style={styles.overview}>{item.Overview}</Text>
 </View>}
 {item.Type==='Series'&&<View style={styles.series}><View style={styles.seriesHeading}>
  <Text style={styles.sectionTitle}>Episoden</Text>
  {!!seasons.length&&<Text style={styles.episodeCount}>{seasons.length} {seasons.length===1?'Staffel':'Staffeln'}</Text>}
 </View><View style={styles.seasonDropdownWrap}><Pressable accessibilityRole="button" accessibilityLabel="Staffel auswählen" style={styles.seasonDropdown} onPress={()=>setSeasonMenu(v=>!v)}><Text style={styles.seasonDropdownText}>{completedSeasons.has(season)?'✓  ':''}{seasons.find(s=>s.Id===season)?.Name??'Staffel auswählen'}</Text> </Pressable>{seasonMenu&&<ScrollView nestedScrollEnabled style={styles.seasonMenu}>{seasons.map(s=><Pressable key={s.Id} onPress={()=>{setSeason(s.Id);setSeasonMenu(false)}} style={[styles.seasonMenuItem,season===s.Id&&styles.seasonMenuItemActive]}><Text style={[styles.seasonMenuText,season===s.Id&&styles.seasonMenuTextActive]}>{completedSeasons.has(s.Id)?'✓  ':''}{s.Name}</Text>{season===s.Id&&<Text style={styles.seasonCheck}>✓</Text>}</Pressable>)}</ScrollView>}</View>
 {season&&!Object.prototype.hasOwnProperty.call(episodesBySeason,season)&&<Text style={styles.episodeLoading}>Folgen werden geladen …</Text>}
 {episodes.map(ep=>{const progress=Math.max(0,Math.min(100,ep.UserData?.PlayedPercentage??0));return <Pressable key={ep.Id} onPress={()=>router.push({pathname:'/player/[id]',params:{id:ep.Id}})} style={({pressed})=>[styles.episode,pressed&&{opacity:.65}]}><View style={styles.epThumbWrap}><ImageBackground source={{uri:getPrimaryImageUrl(session,ep.Id,ep.PrimaryImageTag??ep.ImageTags?.Primary)}} style={styles.epThumb} resizeMode="cover"><View style={styles.epPlayBubble}><PlayGlyph size={14}/></View>{isWatched(ep)&&<View style={styles.epWatched}><Text style={styles.epWatchedText}>✓ GESEHEN</Text></View>}{progress>0&&<View style={styles.epProgress}><View style={[styles.epProgressFill,{width:`${progress}%`}]}/></View>}</ImageBackground></View><View style={{flex:1}}><Text style={styles.epName}>{isWatched(ep)?'✓  ':''}{episodeHeading(ep)}</Text><Text numberOfLines={2} style={styles.epOverview}>{ep.Overview||'Keine Beschreibung verfügbar.'}</Text></View></Pressable>})}</View>}</View></ScrollView><VelarisHeader overlay back/></Animated.View>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},loading:{flex:1,backgroundColor:colors.background},skeletonHero:{height:390,backgroundColor:'#171717'},skeletonBody:{padding:16,gap:14},skeletonTitle:{height:34,width:'65%',backgroundColor:'#222',borderRadius:4},skeletonMeta:{height:14,width:'45%',backgroundColor:'#1c1c1c',borderRadius:4},skeletonButton:{height:50,width:'100%',backgroundColor:'#242424',borderRadius:5},skeletonLine:{height:13,width:'92%',backgroundColor:'#191919',borderRadius:4},hero:{height:410,backgroundColor:colors.surfaceAlt},backButton:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(0,0,0,.6)',alignItems:'center',justifyContent:'center'},back:{color:'#fff',fontSize:32,lineHeight:34},body:{paddingHorizontal:20,paddingTop:18,paddingBottom:70,marginTop:-100,backgroundColor:'rgba(8,8,13,.93)'},
eyebrow:{color:colors.accent,fontSize:11,fontWeight:'900',letterSpacing:1.4,marginBottom:9},
title:{color:colors.text,fontSize:33,lineHeight:39,fontWeight:'900',letterSpacing:-0.7},watchedBanner:{color:colors.success,fontWeight:'900',fontSize:13,marginTop:9},meta:{color:'#EBE9F3',fontSize:13,marginTop:11,lineHeight:20,fontWeight:'700'},mainActions:{flexDirection:'row',gap:12,marginTop:23},play:{flex:1,height:50,borderRadius:9,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10},pressed:{opacity:0.83,transform:[{scale:0.985}]},favorite:{width:92,height:50,borderRadius:9,backgroundColor:'#242424',alignItems:'center',justifyContent:'center'},favoriteIcon:{color:'#fff',fontSize:20,lineHeight:20},favoriteActive:{color:'#fff'},favoriteLabel:{color:'#fff',fontSize:9,fontWeight:'700',marginTop:2},playText:{color:'#08090B',fontSize:16,fontWeight:'900'},download:{height:46,borderRadius:9,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center',marginTop:10},downloadText:{color:'#fff',fontSize:13,fontWeight:'800'},downloadError:{color:colors.danger,fontSize:11,marginTop:8},storySection:{marginTop:27,paddingTop:19,borderTopWidth:1,borderTopColor:colors.border},
storyLabel:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.accent,marginBottom:11},
overview:{color:'#E6E3ED',fontSize:14,lineHeight:22},
genres:{color:'#C5BFDB',fontSize:12,fontWeight:'700',marginTop:13,lineHeight:19},
series:{marginTop:34},
seriesHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16},
sectionTitle:{color:colors.text,fontSize:20,fontWeight:'900'},
episodeCount:{color:colors.muted,fontSize:12,fontWeight:'700'},seasonDropdownWrap:{marginBottom:18,zIndex:5,alignItems:'flex-start'},episodeLoading:{color:colors.muted,fontSize:13,marginVertical:16},seasonDropdown:{height:50,paddingHorizontal:17,borderRadius:10,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:'#59546F',flexDirection:'row',alignItems:'center',justifyContent:'space-between',minWidth:175},seasonDropdownText:{color:'#fff',fontSize:14,fontWeight:'800'},seasonChevron:{color:'#fff',fontSize:22,fontWeight:'800'},seasonMenu:{marginTop:7,maxHeight:255,minWidth:205,borderRadius:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},seasonMenuItem:{height:44,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#292929'},seasonMenuItemActive:{backgroundColor:'#2a2a2a'},seasonMenuText:{color:'#ddd',fontSize:13,fontWeight:'700'},seasonMenuTextActive:{color:'#fff'},seasonCheck:{color:'#fff',fontSize:14,fontWeight:'900'},episode:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:16,borderBottomWidth:1,borderBottomColor:colors.border},epThumbWrap:{width:128,aspectRatio:16/9,borderRadius:8,overflow:'hidden',backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:'rgba(255,255,255,.1)'},epThumb:{width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},epPlayBubble:{width:32,height:32,borderRadius:16,backgroundColor:'rgba(8,8,13,.62)',borderWidth:1.5,borderColor:'rgba(255,255,255,.92)',alignItems:'center',justifyContent:'center'},epWatched:{position:'absolute',left:4,bottom:6,paddingHorizontal:6,paddingVertical:3,backgroundColor:'rgba(0,0,0,.85)',borderRadius:4},epWatchedText:{color:colors.success,fontSize:9,fontWeight:'900'},epProgress:{position:'absolute',left:0,right:0,bottom:0,height:3,backgroundColor:'rgba(255,255,255,.25)'},epProgressFill:{height:3,backgroundColor:'#E50914'},epName:{color:colors.text,fontSize:14,fontWeight:'800'},epOverview:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:4}});
