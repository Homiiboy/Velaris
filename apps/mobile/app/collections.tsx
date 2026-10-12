import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getCollections } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';
import { VelarisHeader } from '@/components/VelarisHeader';
import { useVelarisTheme } from '@/context/ThemeContext';

export default function CollectionsScreen(){
 const {session}=useAuth();const {accentColor}=useVelarisTheme();const {width:screenWidth}=useWindowDimensions();const cardWidth=Math.floor((screenWidth-48)/3); const [items,setItems]=useState<JellyfinItem[]>([]); const [loading,setLoading]=useState(true);const [error,setError]=useState(false);const [retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!session)return;
  let active=true;
  setLoading(true);setError(false);
  getCollections(session).then(r=>{if(active)setItems(r.Items)})
   .catch(()=>{if(active){setItems([]);setError(true)}})
   .finally(()=>{if(active)setLoading(false)});
  return()=>{active=false};
 },[session,retry]);
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
  <VelarisHeader scope="collections" back/><Text style={styles.title}>Sammlungen</Text>
  {loading?<ActivityIndicator style={{marginTop:50}} color={accentColor}/>:<FlatList data={items} numColumns={3} contentContainerStyle={styles.content} columnWrapperStyle={styles.row}
   ListEmptyComponent={<View style={styles.emptyContainer}>
     <Text style={styles.empty}>{error?'Jellyfin konnte die Sammlungen nicht laden.':'Keine Sammlungen in Jellyfin gefunden.'}</Text>
     {error&&<Pressable accessibilityRole="button" onPress={()=>setRetry(value=>value+1)} style={[styles.retry,{borderColor:accentColor}]}>
       <Text style={styles.retryText}>Erneut versuchen</Text>
     </Pressable>}
    </View>}
   renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth} showMeta={false}/>} keyExtractor={i=>i.Id}/>}
 </View>;
}
const styles=StyleSheet.create({emptyContainer:{alignItems:'center',paddingHorizontal:22},retry:{borderWidth:1,borderRadius:10,padding:12,marginTop:14},retryText:{color:colors.text,fontWeight:'900'},page:{flex:1,backgroundColor:'#000000'},header:{paddingTop:50,height:96,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},back:{color:'#fff',fontSize:36,lineHeight:38},title:{color:'#fff',fontSize:27,fontWeight:'900',marginHorizontal:16,marginTop:16,marginBottom:8},content:{padding:12,paddingBottom:40},row:{justifyContent:'space-between',marginBottom:14},empty:{color:colors.muted,textAlign:'center',marginTop:50}});
