import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getLatest, searchItems } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';

export default function SearchScreen(){
 const {session}=useAuth(); const [term,setTerm]=useState(''); const [items,setItems]=useState<JellyfinItem[]>([]); const [popular,setPopular]=useState<JellyfinItem[]>([]);
 useEffect(()=>{if(session)getLatest(session).then(r=>setPopular(r.Items.slice(0,18))).catch(()=>{})},[session]);
 useEffect(()=>{if(!session||term.trim().length<2){setItems([]);return} const timer=setTimeout(()=>searchItems(session,term.trim()).then(r=>setItems(r.Items)).catch(()=>{}),250);return()=>clearTimeout(timer)},[term,session]);
 if(!session)return <Redirect href="/connect"/>;
 const shown=term.trim().length>=2?items:popular;
 return <FlatList style={styles.page} contentContainerStyle={styles.content} data={shown} numColumns={3} columnWrapperStyle={styles.row}
 ListHeaderComponent={<View><Text style={styles.title}>Suche</Text><TextInput value={term} onChangeText={setTerm} placeholder="Serien, Filme, Anime …" placeholderTextColor={colors.muted} style={styles.input}/><Text style={styles.count}>{term.length>=2 ? `${items.length} Ergebnisse` : 'Neu auf Velaris'}</Text></View>}
 renderItem={({item})=><MediaCard item={item} session={session} width={112}/>} keyExtractor={i=>i.Id}/>;
}
const styles=StyleSheet.create({page:{backgroundColor:colors.background},content:{padding:12,paddingTop:54,paddingBottom:30},title:{color:colors.text,fontSize:30,fontWeight:'900',marginBottom:20},input:{height:52,borderRadius:3,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:16,fontSize:16},count:{color:colors.muted,fontSize:12,marginVertical:18},row:{justifyContent:'space-between',marginBottom:14}});
