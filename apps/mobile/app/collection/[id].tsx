import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, ImageBackground, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getBackdropUrl, getCollectionItems, getItem, getPrimaryImageUrl } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';
import { VelarisHeader } from '@/components/VelarisHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { CinematicShade } from '@/components/CinematicShade';
import { useVelarisTheme } from '@/context/ThemeContext';

export default function CollectionScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
 const {accentColor}=useVelarisTheme();
 const {width:screenWidth}=useWindowDimensions(); const cardWidth=Math.floor((screenWidth-48)/3);
 const [error,setError]=useState('');
 const [retryKey,setRetryKey]=useState(0);
 const [collection,setCollection]=useState<JellyfinItem|null>(null),[items,setItems]=useState<JellyfinItem[]>([]),[loading,setLoading]=useState(true);
 useFocusEffect(useCallback(()=>{
   if(!session||!id)return;
   let active=true;setLoading(true);setError('');
   Promise.all([getItem(session,id),getCollectionItems(session,id)]).then(([c,r])=>{
     if(active){setCollection(c);setItems(r.Items)}
   }).catch(()=>{
     if(active){setItems([]);setError('Die Sammlung konnte nicht geladen werden.')}
   }).finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false};
 },[session,id,retryKey]));
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
  <VelarisHeader scope="collections" collectionId={id} back/>
 {collection&&<ImageBackground
   source={{uri:collection.BackdropImageTags?.length?getBackdropUrl(session,collection):getPrimaryImageUrl(session,collection.Id,collection.PrimaryImageTag??collection.ImageTags?.Primary)}}
   resizeMode="cover" style={styles.collectionHero}>
  <CinematicShade variant="details"/>
  <View style={styles.heroCopy}>
   <Text style={[styles.heroEyebrow,{color:accentColor}]}>VELARIS KOLLEKTION</Text>
   <Text numberOfLines={2} style={styles.heroName}>{collection.Name}</Text>
   {!!collection.Overview&&<Text numberOfLines={3} style={styles.heroOverview}>{collection.Overview}</Text>}
   <Text style={styles.heroCount}>{items.length} Titel · Chronologische Reihenfolge</Text>
  </View>
 </ImageBackground>}
 {!collection&&<View style={styles.heading}><Text numberOfLines={1} style={styles.title}>Sammlung</Text></View>}
  {loading?<LoadingSkeleton variant="library" columns={3}/>:<FlatList data={items} numColumns={3}
    contentContainerStyle={styles.content} columnWrapperStyle={styles.row}
    ListEmptyComponent={<EmptyState
      title={error?'Sammlung nicht erreichbar':'Diese Sammlung ist leer'}
      message={error||'Hier erscheinen Filme und Serien, sobald Jellyfin sie dieser Sammlung zuordnet.'}
      onRetry={()=>setRetryKey(value=>value+1)}/>} 
    renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth}/>} keyExtractor={i=>i.Id}/>}
 </View>;
}
const styles=StyleSheet.create({collectionHero:{minHeight:235,backgroundColor:colors.surface,justifyContent:'flex-end'},heroCopy:{paddingHorizontal:22,paddingTop:45,paddingBottom:22},heroEyebrow:{fontSize:11,fontWeight:'900',letterSpacing:2,marginBottom:8},heroName:{fontSize:29,fontWeight:'900',color:colors.text},heroOverview:{fontSize:12,lineHeight:19,color:'#E6E3ED',marginTop:7},heroCount:{fontSize:12,color:colors.muted,marginTop:9,fontWeight:'800'},page:{flex:1,backgroundColor:colors.background},header:{paddingTop:50,height:105,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{color:'#fff',fontSize:36,lineHeight:38},heading:{alignItems:'flex-start',paddingHorizontal:20,marginTop:20,marginBottom:12},title:{color:colors.text,fontSize:24,fontWeight:'900',letterSpacing:-.4},count:{color:colors.muted,fontSize:11,marginTop:3},content:{padding:12,paddingBottom:40},row:{justifyContent:'space-between',marginBottom:18},empty:{color:colors.muted,textAlign:'center',marginTop:40,paddingHorizontal:22}});
