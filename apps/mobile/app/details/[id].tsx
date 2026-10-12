import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ImageBackground, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getBackdropUrl, getEpisodes, getItem, getPrimaryImageUrl, getSeasons, setFavorite } from '@/services/jellyfin';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';
import { useVelarisTheme } from '@/context/ThemeContext';
import { VelarisHeader } from '@/components/VelarisHeader';
import { PlayGlyph } from '@/components/PlayGlyph';
import { CinematicShade } from '@/components/CinematicShade';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { downloadItem, isDownloaded, removeDownload } from '@/services/downloads';
import { allEpisodesWatched, isWatched } from '@/services/watchStatus';
import { episodeHeading } from '@/services/episodeTitles';
import { episodeCode,hasResumeProgress,minutesRemaining,playbackPercent,statusBadge } from '@/services/playbackPresentation';

export default function DetailsScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
 const {accentColor,display}=useVelarisTheme();
 const goBack=()=>{if(router.canGoBack())router.back();else router.replace('/(tabs)/home')};
 const fade=useRef(new Animated.Value(0)).current;
 const [loadFailed,setLoadFailed]=useState(false);
 const [loadRevision,setLoadRevision]=useState(0);
 const [downloading,setDownloading]=useState(false),[downloaded,setDownloaded]=useState(false),[downloadProgress,setDownloadProgress]=useState(0),[downloadError,setDownloadError]=useState(''); const [item,setItem]=useState<JellyfinItem|null>(null),[favorite,setFavoriteState]=useState(false),[seasons,setSeasons]=useState<JellyfinItem[]>([]),[episodesBySeason,setEpisodesBySeason]=useState<Record<string,JellyfinItem[]>>({}),[seriesComplete,setSeriesComplete]=useState(false),[season,setSeason]=useState(''),[seasonMenu,setSeasonMenu]=useState(false);
 useEffect(()=>{Animated.timing(fade,{toValue:1,duration:display.animations?350:0,useNativeDriver:true}).start()},[fade,display.animations]);
 useEffect(()=>{if(session&&id)isDownloaded(session,id).then(setDownloaded)},[session,id]);
 // Refresh after returning from the player. A series is complete ONLY if
 // each known season has episodes and every episode is marked played by Jellyfin.
 useFocusEffect(useCallback(()=>{
   if(!session||!id)return;
   let active=true;
   setLoadFailed(false);
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
   }).catch(()=>{if(active){setLoadFailed(true);setItem(null)}});
   return ()=>{active=false};
 },[session,id,loadRevision]));
 const episodes=episodesBySeason[season]??[];
 const completedSeasons=new Set(seasons.filter(s=>allEpisodesWatched(episodesBySeason[s.Id]??[])).map(s=>s.Id));
 if(!session)return <Redirect href="/connect"/>;
 if(!item)return <View style={styles.loading}>
  {loadFailed?
   <View style={styles.detailsError}>
    <EmptyState title="Details nicht erreichbar"
      message="Velaris konnte die Informationen von Jellyfin nicht laden."
      onRetry={()=>setLoadRevision(value=>value+1)}/>
   </View>:
   <LoadingSkeleton variant="details"/>}
  <VelarisHeader overlay back/>
 </View>;
 const mins=item.RunTimeTicks?Math.round(item.RunTimeTicks/600000000):undefined, tag=item.PrimaryImageTag??item.ImageTags?.Primary;
 const remaining=minutesRemaining(item);
 const isResumable=hasResumeProgress(item);
 const source=item.MediaSources?.[0];
 const video=source?.MediaStreams?.find(stream=>stream.Type==='Video');
 const sound=source?.MediaStreams?.find(stream=>stream.Type==='Audio');
 const quality=[
   video?.Width && video.Width>=3800?'4K':video?.Height && video.Height>=1080?'Full HD':video?.Height && video.Height>=720?'HD':null,
   video?.VideoRangeType?.toLowerCase().includes('dolbyvision')?'Dolby Vision':
      video?.VideoRange && video.VideoRange.toUpperCase()!=='SDR'?'HDR':null,
   sound?.Channels && sound.Channels>=6?'5.1 Audio':null,
   source?.MediaStreams?.some(stream=>stream.Type==='Subtitle')?'Untertitel':null
 ].filter((badge):badge is string=>!!badge);
 const people=item.People?.filter(person=>person.Name).slice(0,12)??[];
 return <Animated.View style={{flex:1,opacity:fade}}><ScrollView style={styles.page}><ImageBackground source={{uri:item.BackdropImageTags?.length?getBackdropUrl(session,item):getPrimaryImageUrl(session,item.Id,tag)}} style={styles.hero} imageStyle={{opacity:.90}}>
 <CinematicShade variant="details"/></ImageBackground>
 <View style={styles.body}>
 <Text style={[styles.eyebrow,{color:accentColor}]}>{item.Type==='Series'?'SERIE AUF VELARIS':item.Type==='Episode'?'EPISODE AUF VELARIS':'FILM AUF VELARIS'}</Text>
 <Text style={styles.title}>{item.Name}</Text>{(item.Type==='Series'?seriesComplete:isWatched(item))&&<Text style={styles.watchedBanner}>✓ {item.Type==='Series'?'Serie vollständig gesehen':'Bereits gesehen'}</Text>}<Text style={styles.meta}>{[
  item.ProductionYear,
  item.Type==='Series'?'Serie':item.Type==='Episode'?'Episode':'Film',
  item.Type!=='Series'&&mins?`${mins} Min.`:null,
  item.OfficialRating,
  item.CommunityRating?`★ ${item.CommunityRating.toFixed(1)}`:null
 ].filter(Boolean).join('   ·   ')}</Text>
 {!!quality.length&&<View style={styles.qualityRow}>{quality.map(label=><Text key={label} style={[styles.qualityBadge,{borderColor:accentColor}]}>{label}</Text>)}</View>}
 <View style={styles.mainActions}><Pressable accessibilityRole="button" accessibilityLabel={item.UserData?.PlaybackPositionTicks?'Fortsetzen':'Abspielen'} style={({pressed})=>[styles.play,pressed&&styles.pressed]} onPress={()=>router.push({pathname:'/player/[id]',params:{id:item.Id}})}><PlayGlyph size={19} color="#08090B"/><Text style={styles.playText}>{item.UserData?.PlaybackPositionTicks?'Fortsetzen':'Abspielen'}</Text></Pressable><Pressable style={styles.favorite} onPress={async()=>{const next=!favorite;setFavoriteState(next);try{await setFavorite(session,item.Id,next);item.UserData={...item.UserData,IsFavorite:next}}catch{setFavoriteState(!next)}}}><Text style={[styles.favoriteIcon,favorite&&styles.favoriteActive]}>{favorite?'♥':'♡'}</Text><Text style={styles.favoriteLabel}>Meine Liste</Text></Pressable></View>{isResumable&&remaining!=null&&<Text style={styles.resumeHint}>
  ▶ Fortsetzen · Noch {remaining} Min.
 </Text>}{item.Type!=='Series'&&<Pressable disabled={downloading} style={styles.download} onPress={async()=>{if(downloaded){await removeDownload(session,item.Id);setDownloaded(false);return}setDownloading(true);setDownloadProgress(0);setDownloadError('');try{await downloadItem(session,item,setDownloadProgress);setDownloaded(true)}catch(e){setDownloadError(e instanceof Error?e.message:'Download fehlgeschlagen.')}finally{setDownloading(false)}}}><Text style={styles.downloadText}>{downloaded?'✓ Heruntergeladen':downloading?`⇩ ${Math.round(downloadProgress*100)} %`:'⇩ Herunterladen'}</Text></Pressable>}{!!downloadError&&<Text style={styles.downloadError}>{downloadError}</Text>}
 {!!item.Genres?.length&&<Text numberOfLines={2} style={styles.genres}>{item.Genres.slice(0,5).join('   ·   ')}</Text>}
 {!!people.length&&<View style={styles.castSection}><Text style={[styles.storyLabel,{color:accentColor}]}>CAST & CREW</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.castRow}>
   {people.map((person,index)=><Pressable key={person.Id??`${person.Name}-${index}`} style={styles.castCard}
    accessibilityRole="button" accessibilityLabel={`Nach ${person.Name} suchen`}
    onPress={()=>router.push({pathname:'/(tabs)/search',params:{scope:'home',term:person.Name,person:person.Name}})}>
    <Text numberOfLines={2} style={styles.castName}>{person.Name}</Text>
    <Text numberOfLines={2} style={styles.castRole}>{person.Role??person.Type??'Mitwirkende'}</Text>
   </Pressable>)}
  </ScrollView>
 </View>}
 {!!item.Overview&&<View style={styles.storySection}>
  <Text style={[styles.storyLabel,{color:accentColor}]}>HANDLUNG</Text>
  <Text style={styles.overview}>{item.Overview}</Text>
 </View>}
 {item.Type==='Series'&&<View style={styles.series}><View style={styles.seriesHeading}>
  <Text style={styles.sectionTitle}>Episoden</Text>
  {!!seasons.length&&<Text style={styles.episodeCount}>{seasons.length} {seasons.length===1?'Staffel':'Staffeln'}</Text>}
 </View><View style={styles.seasonDropdownWrap}><Pressable accessibilityRole="button" accessibilityLabel="Staffel auswählen" style={styles.seasonDropdown} onPress={()=>setSeasonMenu(v=>!v)}><Text style={styles.seasonDropdownText}>{completedSeasons.has(season)?'✓  ':''}{seasons.find(s=>s.Id===season)?.Name??'Staffel auswählen'}</Text> </Pressable>{seasonMenu&&<ScrollView nestedScrollEnabled style={styles.seasonMenu}>{seasons.map(s=><Pressable key={s.Id} onPress={()=>{setSeason(s.Id);setSeasonMenu(false)}} style={[styles.seasonMenuItem,season===s.Id&&styles.seasonMenuItemActive]}><Text style={[styles.seasonMenuText,season===s.Id&&styles.seasonMenuTextActive]}>{completedSeasons.has(s.Id)?'✓  ':''}{s.Name}</Text>{season===s.Id&&<Text style={styles.seasonCheck}>✓</Text>}</Pressable>)}</ScrollView>}</View>
 {season&&!Object.prototype.hasOwnProperty.call(episodesBySeason,season)&&<Text style={styles.episodeLoading}>Folgen werden geladen …</Text>}
 {episodes.map(ep=>{
 const progress=playbackPercent(ep);
 const remainingTime=minutesRemaining(ep);
 const badge=statusBadge(ep);
 const code=episodeCode(ep);
 return <Pressable key={ep.Id} onPress={()=>router.push({pathname:'/player/[id]',params:{id:ep.Id}})} accessibilityRole="button" accessibilityLabel={`Folge ${episodeHeading(ep)} abspielen`} style={({pressed})=>[styles.episode,pressed&&styles.episodePressed]}><View style={styles.epThumbWrap}><ImageBackground source={{uri:getPrimaryImageUrl(session,ep.Id,ep.PrimaryImageTag??ep.ImageTags?.Primary)}} style={styles.epThumb} resizeMode="cover"><View style={styles.epPlayBubble}><PlayGlyph size={14}/></View>{!!badge&&<View style={[styles.epWatched,badge.kind==='resume'&&styles.epResume]}>
 <Text style={[styles.epWatchedText,badge.kind==='resume'&&styles.epResumeText]}>
  {badge.kind==='watched'?'✓  ':''}{badge.text}
 </Text>
 </View>}{progress>0&&progress<100&&<View style={styles.epProgress}><View style={[styles.epProgressFill,{width:`${progress}%`}]}/></View>}</ImageBackground></View><View style={{flex:1}}><Text style={styles.epName}>{isWatched(ep)?'✓  ':''}{episodeHeading(ep)}</Text>
 {(code||remainingTime!=null)&&<Text numberOfLines={1} style={styles.epMeta}>
  {[code,remainingTime!=null?`Noch ${remainingTime} Min.`:null].filter(Boolean).join('   ·   ')}
 </Text>}
 <Text numberOfLines={2} style={styles.epOverview}>{ep.Overview||'Keine Beschreibung verfügbar.'}</Text></View></Pressable>})}</View>}</View></ScrollView><VelarisHeader overlay back/></Animated.View>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},loading:{flex:1,backgroundColor:colors.background},detailsError:{paddingTop:112,flex:1,justifyContent:'center'},hero:{height:410,backgroundColor:colors.surfaceAlt},backButton:{width:40,height:40,borderRadius:20,backgroundColor:'rgba(0,0,0,.6)',alignItems:'center',justifyContent:'center'},back:{color:'#fff',fontSize:32,lineHeight:34},body:{paddingHorizontal:20,paddingTop:18,paddingBottom:70,marginTop:-100,backgroundColor:'rgba(8,8,13,.93)'},
eyebrow:{color:colors.accent,fontSize:11,fontWeight:'900',letterSpacing:1.4,marginBottom:9},
title:{color:colors.text,fontSize:33,lineHeight:39,fontWeight:'900',letterSpacing:-0.7},watchedBanner:{color:colors.success,fontWeight:'900',fontSize:13,marginTop:9},meta:{color:'#EBE9F3',fontSize:13,marginTop:11,lineHeight:20,fontWeight:'700'},mainActions:{flexDirection:'row',gap:12,marginTop:23},play:{flex:1,height:50,borderRadius:9,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',flexDirection:'row',gap:10},pressed:{opacity:0.83,transform:[{scale:0.985}]},favorite:{width:92,height:50,borderRadius:9,backgroundColor:'#242424',alignItems:'center',justifyContent:'center'},favoriteIcon:{color:'#fff',fontSize:20,lineHeight:20},favoriteActive:{color:'#fff'},favoriteLabel:{color:'#fff',fontSize:9,fontWeight:'700',marginTop:2},playText:{color:'#08090B',fontSize:16,fontWeight:'900'},
resumeHint:{color:'#DCCFFF',fontSize:12,fontWeight:'800',marginTop:10},download:{height:46,borderRadius:9,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center',marginTop:10},downloadText:{color:'#fff',fontSize:13,fontWeight:'800'},downloadError:{color:colors.danger,fontSize:11,marginTop:8},storySection:{marginTop:27,paddingTop:19,borderTopWidth:1,borderTopColor:colors.border},
qualityRow:{flexDirection:'row',flexWrap:'wrap',gap:7,marginTop:15},qualityBadge:{color:colors.text,fontSize:10,fontWeight:'900',borderRadius:6,borderWidth:1,paddingHorizontal:8,paddingVertical:5,backgroundColor:colors.surface},castSection:{marginTop:27},castRow:{gap:10,paddingVertical:8},castCard:{width:136,padding:13,backgroundColor:colors.surface,borderRadius:12,borderWidth:1,borderColor:colors.border},castName:{color:colors.text,fontWeight:'900',fontSize:13},castRole:{color:colors.muted,fontSize:11,marginTop:6},storyLabel:{fontSize:11,fontWeight:'900',letterSpacing:1.5,color:colors.accent,marginBottom:11},
overview:{color:'#E6E3ED',fontSize:14,lineHeight:22},
genres:{color:'#C5BFDB',fontSize:12,fontWeight:'700',marginTop:13,lineHeight:19},
series:{marginTop:34},
seriesHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:16},
sectionTitle:{color:colors.text,fontSize:20,fontWeight:'900'},
episodeCount:{color:colors.muted,fontSize:12,fontWeight:'700'},seasonDropdownWrap:{marginBottom:18,zIndex:5,alignItems:'flex-start'},episodeLoading:{color:colors.muted,fontSize:13,marginVertical:16},seasonDropdown:{height:50,paddingHorizontal:17,borderRadius:10,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:'#59546F',flexDirection:'row',alignItems:'center',justifyContent:'space-between',minWidth:175},seasonDropdownText:{color:'#fff',fontSize:14,fontWeight:'800'},seasonChevron:{color:'#fff',fontSize:22,fontWeight:'800'},seasonMenu:{marginTop:7,maxHeight:255,minWidth:205,borderRadius:8,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},seasonMenuItem:{height:44,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:'#292929'},seasonMenuItemActive:{backgroundColor:'#2a2a2a'},seasonMenuText:{color:'#ddd',fontSize:13,fontWeight:'700'},seasonMenuTextActive:{color:'#fff'},seasonCheck:{color:'#fff',fontSize:14,fontWeight:'900'},episode:{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:16,paddingHorizontal:8,borderRadius:11,borderBottomWidth:1,borderBottomColor:colors.border},episodePressed:{backgroundColor:'rgba(124,92,252,.13)',opacity:.90},epThumbWrap:{width:128,aspectRatio:16/9,borderRadius:8,overflow:'hidden',backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:'rgba(255,255,255,.1)'},epThumb:{width:'100%',height:'100%',alignItems:'center',justifyContent:'center'},epPlayBubble:{width:32,height:32,borderRadius:16,backgroundColor:'rgba(8,8,13,.62)',borderWidth:1.5,borderColor:'rgba(255,255,255,.92)',alignItems:'center',justifyContent:'center'},epWatched:{position:'absolute',right:5,top:5,paddingHorizontal:7,paddingVertical:4,
 backgroundColor:'rgba(12,37,25,.92)',borderColor:colors.success,borderWidth:1,borderRadius:5},
epResume:{backgroundColor:'rgba(35,24,70,.92)',borderColor:'rgba(180,157,255,.76)'},
epWatchedText:{color:colors.success,fontSize:9,fontWeight:'900'},
epResumeText:{color:'#E6DEFF'},epProgress:{position:'absolute',left:0,right:0,bottom:0,height:3,backgroundColor:'rgba(255,255,255,.25)'},epProgressFill:{height:3,backgroundColor:'#E50914'},epName:{color:colors.text,fontSize:14,fontWeight:'800'},
epMeta:{color:'#DCCFFF',fontSize:11,fontWeight:'700',marginTop:4},
epOverview:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:4}});
