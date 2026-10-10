import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getSeries } from '@/services/jellyfin';
import { MediaCard } from '@/components/MediaCard';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors } from '@/theme';

export default function SeriesScreen(){
 const {session}=useAuth(); const {width:screenWidth}=useWindowDimensions(); const cardWidth=Math.floor((screenWidth-42)/3); const [items,setItems]=useState<JellyfinItem[]>([]);
 useEffect(()=>{if(session)getSeries(session).then(r=>setItems(r.Items)).catch(()=>{})},[session]);
 if(!session)return <Redirect href="/connect"/>;
 return <FlatList style={styles.page} contentContainerStyle={styles.content} data={items} numColumns={3} columnWrapperStyle={styles.row}
 ListHeaderComponent={<View style={styles.header}><Text style={styles.eyebrow}>VELARIS</Text><View style={styles.titleRow}><Text style={styles.title}>Serien</Text><Text style={styles.count}>{items.length}</Text></View><Text style={styles.sub}>Alle Serien auf deinem Server</Text></View>}
 renderItem={({item})=><MediaCard item={item} session={session} width={cardWidth}/>} keyExtractor={i=>i.Id}/>;
}
const styles=StyleSheet.create({page:{backgroundColor:colors.background},content:{padding:12,paddingTop:52,paddingBottom:30},row:{justifyContent:'space-between',marginBottom:17},header:{marginBottom:22},eyebrow:{color:'#777',fontSize:9,fontWeight:'900',letterSpacing:2.5,marginBottom:4},titleRow:{flexDirection:'row',alignItems:'center',gap:9},title:{color:colors.text,fontSize:29,fontWeight:'900',letterSpacing:-.5},count:{color:'#777',fontSize:12,fontWeight:'800',marginTop:7},sub:{color:colors.muted,marginTop:6}});
