import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getGenreItems } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';

export default function GenreScreen(){
 const {name}=useLocalSearchParams<{name:string}>(); const {session}=useAuth(); const [items,setItems]=useState<JellyfinItem[]>([]);
 const genre=Array.isArray(name)?name[0]:name;
 useEffect(()=>{if(session&&genre)getGenreItems(session,genre).then(r=>setItems(r.Items)).catch(()=>setItems([]))},[session,genre]);
 if(!session)return <Redirect href="/connect"/>;
 return <FlatList style={styles.page} contentContainerStyle={styles.content} data={items} numColumns={3} columnWrapperStyle={styles.row}
  ListHeaderComponent={<View style={styles.header}><Pressable onPress={()=>router.replace('/(tabs)/home')} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable><View><Text style={styles.eyebrow}>GENRE</Text><Text style={styles.title}>{genre}</Text><Text style={styles.sub}>{items.length} Titel auf Velaris</Text></View></View>}
  renderItem={({item})=><MediaCard item={item} session={session} width={112}/>} keyExtractor={i=>i.Id}/>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000'},content:{padding:12,paddingTop:54,paddingBottom:36},row:{justifyContent:'space-between',marginBottom:16},header:{marginBottom:24,flexDirection:'row',alignItems:'center',gap:12},back:{width:38,height:38,borderRadius:19,backgroundColor:'#1b1b1b',alignItems:'center',justifyContent:'center'},backText:{color:'#fff',fontSize:30,lineHeight:32},eyebrow:{color:colors.muted,fontSize:10,fontWeight:'900',letterSpacing:2},title:{color:'#fff',fontSize:28,fontWeight:'900',marginTop:2},sub:{color:colors.muted,fontSize:11,marginTop:4}});
