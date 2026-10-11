import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getCollectionItems, getItem } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';
import { VelarisHeader } from '@/components/VelarisHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';

export default function CollectionScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
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
  <VelarisHeader scope="collections" collectionId={id} back/><View style={styles.heading}><Text numberOfLines={1} style={styles.title}>{collection?.Name??'Sammlung'}</Text><Text style={styles.count}>{items.length} Titel · nach Erscheinungsjahr</Text></View>
  {loading?<LoadingSkeleton variant="library" columns={3}/>:<FlatList data={items} numColumns={3}
    contentContainerStyle={styles.content} columnWrapperStyle={styles.row}
    ListEmptyComponent={<EmptyState
      title={error?'Sammlung nicht erreichbar':'Diese Sammlung ist leer'}
      message={error||'Hier erscheinen Filme und Serien, sobald Jellyfin sie dieser Sammlung zuordnet.'}
      onRetry={()=>setRetryKey(value=>value+1)}/>} 
    renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth}/>} keyExtractor={i=>i.Id}/>}
 </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},header:{paddingTop:50,height:105,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{color:'#fff',fontSize:36,lineHeight:38},heading:{alignItems:'flex-start',paddingHorizontal:20,marginTop:20,marginBottom:12},title:{color:colors.text,fontSize:24,fontWeight:'900',letterSpacing:-.4},count:{color:colors.muted,fontSize:11,marginTop:3},content:{padding:12,paddingBottom:40},row:{justifyContent:'space-between',marginBottom:18},empty:{color:colors.muted,textAlign:'center',marginTop:40,paddingHorizontal:22}});
