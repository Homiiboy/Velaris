import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getCollectionItems, getLatest, getLibraryItems, getCollections, searchInArea, getPersonItems, type SearchArea } from '@/services/jellyfin';
import { VelarisHeader } from '@/components/VelarisHeader';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors, design } from '@/theme';
import { useVelarisTheme } from '@/context/ThemeContext';

export default function SearchScreen(){
 const {session}=useAuth(); const {accentColor}=useVelarisTheme();
 const {width:screenWidth}=useWindowDimensions(); const cardWidth=Math.floor((screenWidth-48)/3);
 const {scope:rawScope,collectionId,term:initialTerm,person}=useLocalSearchParams<{scope?:string;collectionId?:string;term?:string;person?:string}>();
 const scopes:SearchArea[]=['home','movies','series','anime','animeMovies','animation','cartoons','collections'];
 const scope:SearchArea=scopes.includes(rawScope as SearchArea)?rawScope as SearchArea:'home';
 const [term,setTerm]=useState(initialTerm??''); const [recent,setRecent]=useState<string[]>([]); const [items,setItems]=useState<JellyfinItem[]>([]); const [popular,setPopular]=useState<JellyfinItem[]>([]);
 const [filter,setFilter]=useState<'all'|'movies'|'series'|'unwatched'>('all');
 const [year,setYear]=useState<number|null>(null);
 const historyKey=session?'velaris.search.history.'+session.serverId+'.'+session.user.Id:'';
 useEffect(()=>{
  if(!historyKey)return;
  let active=true;
  SecureStore.getItemAsync(historyKey).then(raw=>{
   if(!active)return;
   try{setRecent(raw?JSON.parse(raw) as string[]:[])}catch{setRecent([])}
  }).catch(()=>{});
  return()=>{active=false};
 },[historyKey]);
 const remember=(query:string)=>{
  if(!historyKey||query.length<2)return;
  const next=[query,...recent.filter(value=>value.toLowerCase()!==query.toLowerCase())].slice(0,6);
  setRecent(next);
  void SecureStore.setItemAsync(historyKey,JSON.stringify(next)).catch(()=>{});
 };
 useEffect(()=>{if(!session)return;
  const source=collectionId?getCollectionItems(session,collectionId):scope==='home'?getLatest(session):scope==='collections'?getCollections(session):getLibraryItems(session,scope);
  source.then(r=>setPopular(r.Items.slice(0,18))).catch(()=>setPopular([]));
 },[session,scope,collectionId]);
 useEffect(()=>{
  if(!session||term.trim().length<2){setItems([]);return}
  let active=true;
  const timer=setTimeout(()=>{
    const request=person && term.trim()===person
      ?getPersonItems(session,person)
      :searchInArea(session,term.trim(),scope,collectionId);
    request.then(result=>{if(active)setItems(result.Items)}).catch(()=>{if(active)setItems([])});
  },250);
  return()=>{active=false;clearTimeout(timer)};
 },[term,session,scope,collectionId,person]);
 if(!session)return <Redirect href="/connect"/>;
 const candidates=term.trim().length>=2?items:popular;
 const availableYears=[...new Set(candidates.map(item=>item.ProductionYear).filter((v):v is number=>typeof v==='number'))].sort((a,b)=>b-a).slice(0,15);
 const shown=candidates.filter(item=>
   (filter==='all'||filter==='movies'&&item.Type==='Movie'||filter==='series'&&item.Type==='Series'||filter==='unwatched'&&!item.UserData?.Played) &&
   (year===null||item.ProductionYear===year));
 return <View style={{flex:1,backgroundColor:colors.background}}><VelarisHeader scope={scope} collectionId={collectionId} back/><FlatList style={styles.page} contentContainerStyle={styles.content} data={shown} numColumns={3} columnWrapperStyle={styles.row}
 ListHeaderComponent={<View><Text style={styles.title}>{person&&term.trim()===person?`Filme mit ${person}`:scope==='home'?'Suche':`Suche in ${design.navigation[scope]}`}</Text><TextInput value={term} onChangeText={setTerm} returnKeyType="search"
   onSubmitEditing={()=>remember(term.trim())}
   placeholder="Serien, Filme, Anime …" placeholderTextColor={colors.muted} style={[styles.input,{borderColor:accentColor}]}/>
 {term.trim().length<2&&!!recent.length&&<View style={styles.recentGroup}>
  <Text style={styles.recentTitle}>ZULETZT GESUCHT</Text>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
   {recent.map(value=><Pressable key={value} onPress={()=>setTerm(value)} style={styles.yearChip}>
    <Text style={styles.filterText}>⌕  {value}</Text></Pressable>)}
  </ScrollView>
 </View>}
 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
  {([['all','Alle'],['movies','Filme'],['series','Serien'],['unwatched','Ungesehen']] as const).map(([key,label])=>
   <Pressable key={key} accessibilityRole="button" accessibilityState={{selected:filter===key}}
    onPress={()=>setFilter(key)} style={[styles.filter,filter===key&&{backgroundColor:accentColor,borderColor:accentColor}]}>
    <Text style={styles.filterText}>{label}</Text>
   </Pressable>)}
 </ScrollView>
 {!!availableYears.length&&<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
  <Pressable onPress={()=>setYear(null)} style={[styles.yearChip,year===null&&{borderColor:accentColor}]}><Text style={styles.filterText}>Alle Jahre</Text></Pressable>
  {availableYears.map(value=><Pressable key={value} onPress={()=>setYear(year===value?null:value)}
    style={[styles.yearChip,year===value&&{borderColor:accentColor}]}><Text style={styles.filterText}>{value}</Text></Pressable>)}
 </ScrollView>}
 <Text style={styles.count}>{term.length>=2 ? `${shown.length} Ergebnisse` : 'Neu auf Velaris'}</Text></View>}
 renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth}/>} keyExtractor={i=>i.Id}/></View>;
}
const styles=StyleSheet.create({page:{backgroundColor:colors.background},content:{padding:12,paddingTop:10,paddingBottom:30},title:{color:colors.text,fontSize:30,fontWeight:'900',marginBottom:20},input:{height:52,borderRadius:3,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border,color:colors.text,paddingHorizontal:16,fontSize:16},count:{color:colors.muted,fontSize:12,marginVertical:18},recentGroup:{marginTop:13},recentTitle:{color:colors.muted,fontSize:11,fontWeight:'900',letterSpacing:1.2},filters:{gap:8,paddingVertical:10},filter:{backgroundColor:colors.surfaceAlt,borderColor:colors.border,borderWidth:1,borderRadius:18,paddingHorizontal:14,paddingVertical:9},filterText:{color:colors.text,fontSize:12,fontWeight:'800'},yearChip:{backgroundColor:colors.surface,borderColor:colors.border,borderWidth:1,borderRadius:15,paddingHorizontal:12,paddingVertical:7},row:{justifyContent:'space-between',marginBottom:14}});
