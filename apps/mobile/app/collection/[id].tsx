import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getCollectionItems, getItem } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';

export default function CollectionScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
 const {width:screenWidth}=useWindowDimensions(); const cardWidth=Math.floor((screenWidth-48)/3);
 const [error,setError]=useState('');
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
 },[session,id]));
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
  <View style={styles.header}><Pressable hitSlop={12} onPress={()=>router.back()}><Text style={styles.back}>‹</Text></Pressable><View style={styles.heading}><Text numberOfLines={1} style={styles.title}>{collection?.Name??'Sammlung'}</Text><Text style={styles.count}>{items.length} Titel</Text></View><View style={{width:36}}/></View>
  {loading?<ActivityIndicator style={{marginTop:50}} color={colors.accent}/>:<FlatList data={items} numColumns={3}
    contentContainerStyle={styles.content} columnWrapperStyle={styles.row}
    ListEmptyComponent={<Text style={styles.empty}>{error||'Diese Sammlung enthält keine verfügbaren Filme oder Serien.'}</Text>}
    renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth}/>} keyExtractor={i=>i.Id}/>}
 </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000000'},header:{paddingTop:50,height:105,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{color:'#fff',fontSize:36,lineHeight:38},heading:{flex:1,alignItems:'center'},title:{color:'#fff',fontSize:22,fontWeight:'900'},count:{color:colors.muted,fontSize:11,marginTop:3},content:{padding:12,paddingBottom:40},row:{justifyContent:'space-between',marginBottom:18},empty:{color:colors.muted,textAlign:'center',marginTop:40,paddingHorizontal:22}});
