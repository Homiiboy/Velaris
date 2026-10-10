import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getCollectionItems, getLatest, getLibraryItems, getCollections, searchInArea, type SearchArea } from '@/services/jellyfin';
import { VelarisHeader } from '@/components/VelarisHeader';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors, design } from '@/theme';

export default function SearchScreen(){
 const {session}=useAuth(); const {width:screenWidth}=useWindowDimensions(); const cardWidth=Math.floor((screenWidth-48)/3); const {scope:rawScope,collectionId}=useLocalSearchParams<{scope?:string;collectionId?:string}>();
 const scopes:SearchArea[]=['home','movies','series','anime','animeMovies','animation','cartoons','collections'];
 const scope:SearchArea=scopes.includes(rawScope as SearchArea)?rawScope as SearchArea:'home';
 const [term,setTerm]=useState(''); const [items,setItems]=useState<JellyfinItem[]>([]); const [popular,setPopular]=useState<JellyfinItem[]>([]);
 useEffect(()=>{if(!session)return;
  const source=collectionId?getCollectionItems(session,collectionId):scope==='home'?getLatest(session):scope==='collections'?getCollections(session):getLibraryItems(session,scope);
  source.then(r=>setPopular(r.Items.slice(0,18))).catch(()=>setPopular([]));
 },[session,scope,collectionId]);
 useEffect(()=>{if(!session||term.trim().length<2){setItems([]);return} const timer=setTimeout(()=>searchInArea(session,term.trim(),scope,collectionId).then(r=>setItems(r.Items)).catch(()=>{}),250);return()=>clearTimeout(timer)},[term,session,scope,collectionId]);
 if(!session)return <Redirect href="/connect"/>;
 const shown=term.trim().length>=2?items:popular;
 return <View style={{flex:1,backgroundColor:colors.background}}><VelarisHeader scope={scope} collectionId={collectionId} back/><FlatList style={styles.page} contentContainerStyle={styles.content} data={shown} numColumns={3} columnWrapperStyle={styles.row}
 ListHeaderComponent={<View><Text style={styles.title}>{scope==='home'?'Suche':`Suche in ${design.navigation[scope]}`}</Text><TextInput value={term} onChangeText={setTerm} placeholder="Serien, Filme, Anime …" placeholderTextColor={colors.muted} style={styles.input}/><Text style={styles.count}>{term.length>=2 ? `${items.length} Ergebnisse` : 'Neu auf Velaris'}</Text></View>}
 renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth}/>} keyExtractor={i=>i.Id}/></View>;
}
const styles=StyleSheet.create({page:{backgroundColor:colors.background},content:{padding:12,paddingTop:10,paddingBottom:30},title:{color:colors.text,fontSize:30,fontWeight:'900',marginBottom:20},input:{height:52,borderRadius:3,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:16,fontSize:16},count:{color:colors.muted,fontSize:12,marginVertical:18},row:{justifyContent:'space-between',marginBottom:14}});
