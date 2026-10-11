import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getLibraryItems, type MediaLibraryKind } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';
import { VelarisHeader } from '@/components/VelarisHeader';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';

export function LibraryCategoryScreen({kind,title,description}:{kind:MediaLibraryKind;title:string;description:string}) {
 const {session}=useAuth();
 const {width:screenWidth}=useWindowDimensions();
 const cardWidth=Math.floor((screenWidth-42)/3);
 const [items,setItems]=useState<JellyfinItem[]>([]);
 const [loading,setLoading]=useState(true);
 const [loadError,setLoadError]=useState(false);
 const [retryKey,setRetryKey]=useState(0);
 useFocusEffect(useCallback(()=>{
   if(!session)return;
   let cancelled=false;
   setLoading(true);
   setLoadError(false);
   getLibraryItems(session,kind).then(r=>{if(!cancelled)setItems(r.Items)}).catch(()=>{
     if(!cancelled){setItems([]);setLoadError(true)}
   }).finally(()=>{if(!cancelled)setLoading(false)});
   return ()=>{cancelled=true};
 },[session,kind,retryKey]));
 if(!session)return <Redirect href="/connect"/>;
 return <View style={{flex:1,backgroundColor:colors.background}}><VelarisHeader scope={kind}/>
 {loading?<LoadingSkeleton variant="library" columns={3}/>:<FlatList style={styles.page} contentContainerStyle={styles.content}
   data={items} numColumns={3} columnWrapperStyle={styles.row}
   ListHeaderComponent={<View style={styles.header}><Text style={styles.eyebrow}>VELARIS</Text>
      <View style={styles.titleRow}><Text style={styles.title}>{title}</Text><Text style={styles.count}>{items.length}</Text></View>
      <Text style={styles.sub}>{description}</Text></View>}
   ListEmptyComponent={<EmptyState
      title={loadError?'Mediathek nicht erreichbar':'Noch keine Titel'}
      message={loadError?'Prüfe die Verbindung zu Jellyfin und versuche es erneut.':`Prüfe, ob in Jellyfin eine Bibliothek namens „${title}“ vorhanden ist.`}
      onRetry={()=>setRetryKey(value=>value+1)}/>} 
   renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth}/>}
   keyExtractor={item=>item.Id}/>}</View>;
}
const styles=StyleSheet.create({
 page:{backgroundColor:colors.background},content:{padding:12,paddingTop:10,paddingBottom:30},
 row:{justifyContent:'space-between',marginBottom:17},header:{marginBottom:22},
 eyebrow:{color:colors.muted,fontSize:9,fontWeight:'900',letterSpacing:2.5,marginBottom:4},
 titleRow:{flexDirection:'row',alignItems:'center',gap:9},
 title:{color:colors.text,fontSize:29,fontWeight:'900',letterSpacing:-.5},
 count:{color:colors.muted,fontSize:12,fontWeight:'800',marginTop:7},
 sub:{color:colors.muted,marginTop:6},empty:{color:colors.muted,padding:20,lineHeight:22}
});
