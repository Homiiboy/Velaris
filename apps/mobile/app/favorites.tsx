import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useVelarisTheme } from '@/context/ThemeContext';
import { getFavorites } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import { VelarisHeader } from '@/components/VelarisHeader';
import { colors, design } from '@/theme';
import type { JellyfinItem } from '@/types/jellyfin';

export default function FavoritesScreen(){
 const {session}=useAuth();
 const {accentColor}=useVelarisTheme();
 const {width}=useWindowDimensions();
 const [items,setItems]=useState<JellyfinItem[]>([]);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState(false);
 const cardWidth=Math.max(95,Math.floor((width-52)/3));
 useFocusEffect(useCallback(()=>{
  let active=true;
  if(session){
   setBusy(true);setError(false);
   getFavorites(session).then(result=>{if(active)setItems(result.Items)})
    .catch(()=>{if(active){setItems([]);setError(true)}})
    .finally(()=>{if(active)setBusy(false)});
  }
  return()=>{active=false};
 },[session]));
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
   <VelarisHeader scope="favorites" back/>
   <Text style={styles.title}>VELARIS MEINE LISTE</Text>
   {busy?<ActivityIndicator color={accentColor} style={styles.loading}/>:
    <FlatList data={items} numColumns={3} keyExtractor={item=>item.Id}
     contentContainerStyle={styles.content} columnWrapperStyle={styles.row}
     ListEmptyComponent={<Text style={styles.empty}>{error?'Favoriten konnten nicht geladen werden.':'Noch keine Filme oder Serien in deiner Liste.'}</Text>}
     renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth} showMeta={false}/>}/>}
 </View>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.background},
 title:{color:design.categoryAccents.favorites,fontSize:25,fontWeight:'900',marginHorizontal:16,marginTop:16,marginBottom:12},
 loading:{marginTop:60},
 content:{paddingHorizontal:12,paddingBottom:40},
 row:{justifyContent:'space-between',marginBottom:14},
 empty:{color:colors.muted,textAlign:'center',marginTop:55,paddingHorizontal:20}
});
