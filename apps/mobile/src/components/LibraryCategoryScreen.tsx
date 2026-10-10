import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getLibraryItems, type MediaLibraryKind } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';

export function LibraryCategoryScreen({kind,title,description}:{kind:MediaLibraryKind;title:string;description:string}) {
 const {session}=useAuth();
 const [items,setItems]=useState<JellyfinItem[]>([]);
 const [loading,setLoading]=useState(true);
 useFocusEffect(useCallback(()=>{
   if(!session)return;
   let cancelled=false;
   setLoading(true);
   getLibraryItems(session,kind).then(r=>{if(!cancelled)setItems(r.Items)}).catch(()=>{if(!cancelled)setItems([])})
     .finally(()=>{if(!cancelled)setLoading(false)});
   return ()=>{cancelled=true};
 },[session,kind]));
 if(!session)return <Redirect href="/connect"/>;
 return <FlatList style={styles.page} contentContainerStyle={styles.content}
   data={items} numColumns={3} columnWrapperStyle={styles.row}
   ListHeaderComponent={<View style={styles.header}><Text style={styles.eyebrow}>VELARIS</Text>
      <View style={styles.titleRow}><Text style={styles.title}>{title}</Text><Text style={styles.count}>{items.length}</Text></View>
      <Text style={styles.sub}>{description}</Text></View>}
   ListEmptyComponent={!loading?<Text style={styles.empty}>Noch keine Titel gefunden. Prüfe, ob in Jellyfin eine Bibliothek namens „{title}“ vorhanden ist.</Text>:<Text style={styles.empty}>Wird geladen …</Text>}
   renderItem={({item})=><MediaCard item={item} session={session} width={112}/>}
   keyExtractor={item=>item.Id}/>;
}
const styles=StyleSheet.create({
 page:{backgroundColor:colors.background},content:{padding:12,paddingTop:52,paddingBottom:30},
 row:{justifyContent:'space-between',marginBottom:17},header:{marginBottom:22},
 eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:2.5,marginBottom:4},
 titleRow:{flexDirection:'row',alignItems:'center',gap:9},
 title:{color:colors.text,fontSize:29,fontWeight:'900',letterSpacing:-.5},
 count:{color:colors.muted,fontSize:12,fontWeight:'800',marginTop:7},
 sub:{color:colors.muted,marginTop:6},empty:{color:colors.muted,padding:20,lineHeight:22}
});
