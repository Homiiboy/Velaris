import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getCollectionItems, getItem } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';

export default function CollectionScreen(){
 const {id}=useLocalSearchParams<{id:string}>(); const {session}=useAuth();
 const [collection,setCollection]=useState<JellyfinItem|null>(null),[items,setItems]=useState<JellyfinItem[]>([]),[loading,setLoading]=useState(true);
 useEffect(()=>{if(!session||!id)return;Promise.all([getItem(session,id),getCollectionItems(session,id)]).then(([c,r])=>{setCollection(c);setItems(r.Items)}).finally(()=>setLoading(false))},[session,id]);
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
  <View style={styles.header}><Pressable hitSlop={12} onPress={()=>router.back()}><Text style={styles.back}>‹</Text></Pressable><View style={styles.heading}><Text numberOfLines={1} style={styles.title}>{collection?.Name??'Sammlung'}</Text><Text style={styles.count}>{items.length} Filme</Text></View><View style={{width:36}}/></View>
  {loading?<ActivityIndicator style={{marginTop:50}} color={colors.accent}/>:<FlatList data={items} numColumns={3} contentContainerStyle={styles.content} columnWrapperStyle={styles.row} renderItem={({item})=><MediaCard item={item} session={session} width={112}/>} keyExtractor={i=>i.Id}/>}
 </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000000'},header:{paddingTop:50,height:105,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{color:'#fff',fontSize:36,lineHeight:38},heading:{flex:1,alignItems:'center'},title:{color:'#fff',fontSize:22,fontWeight:'900'},count:{color:colors.muted,fontSize:11,marginTop:3},content:{padding:12,paddingBottom:40},row:{justifyContent:'space-between',marginBottom:14}});
