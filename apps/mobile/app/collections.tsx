import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getCollections } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';
import { VelarisHeader } from '@/components/VelarisHeader';

export default function CollectionsScreen(){
 const {session}=useAuth();const {width:screenWidth}=useWindowDimensions();const cardWidth=Math.floor((screenWidth-48)/3); const [items,setItems]=useState<JellyfinItem[]>([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{if(session)getCollections(session).then(r=>setItems(r.Items)).finally(()=>setLoading(false))},[session]);
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
  <VelarisHeader scope="collections" back/><Text style={styles.title}>Sammlungen</Text>
  {loading?<ActivityIndicator style={{marginTop:50}} color={colors.accent}/>:<FlatList data={items} numColumns={3} contentContainerStyle={styles.content} columnWrapperStyle={styles.row}
   ListEmptyComponent={<Text style={styles.empty}>Keine Sammlungen in Jellyfin gefunden.</Text>}
   renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth} showMeta={false}/>} keyExtractor={i=>i.Id}/>}
 </View>;
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000000'},header:{paddingTop:50,height:96,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{color:'#fff',fontSize:36,lineHeight:38},title:{color:'#fff',fontSize:27,fontWeight:'900',marginHorizontal:16,marginTop:16,marginBottom:8},content:{padding:12,paddingBottom:40},row:{justifyContent:'space-between',marginBottom:14},empty:{color:colors.muted,textAlign:'center',marginTop:50}});
