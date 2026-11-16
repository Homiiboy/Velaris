import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors, design } from '@/theme';

const categories=[
 {key:'home',href:'/(tabs)/home'},
 {key:'movies',href:'/(tabs)/movies'},
 {key:'series',href:'/(tabs)/series'},
 {key:'anime',href:'/(tabs)/anime'},
 {key:'animeMovies',href:'/(tabs)/anime-movies'},
 {key:'animation',href:'/(tabs)/animation'},
 {key:'cartoons',href:'/(tabs)/cartoons'},
 {key:'favorites',href:'/favorites'},
 {key:'collections',href:'/collections'},
] as const;

export default function CategoriesScreen(){
 const {session}=useAuth();
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
   <View style={styles.heading}>
     <Text style={styles.title}>Kategorien</Text>
     <Pressable accessibilityRole="button" accessibilityLabel="Kategorien schließen" onPress={()=>router.replace('/(tabs)/home')} style={styles.close}><Text style={styles.closeText}>✕</Text></Pressable>
   </View>
   <ScrollView contentContainerStyle={styles.grid}>
     {categories.map(({key,href})=>{
       const color=design.categoryAccents[key];
       return <Pressable key={key} accessibilityRole="button" accessibilityLabel={design.navigation[key]} onPress={()=>router.push(href as any)} style={styles.tile}>
         <View style={[styles.marker,{backgroundColor:color}]}/>
         <Text style={styles.tileText}>{design.navigation[key]}</Text>
       </Pressable>;
     })}
   </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.background,paddingTop:56},
 heading:{paddingHorizontal:18,paddingBottom:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 title:{fontSize:26,color:colors.text,fontWeight:'900'},
 close:{width:44,height:44,backgroundColor:'#292B37',borderRadius:10,alignItems:'center',justifyContent:'center'},
 closeText:{fontSize:20,color:colors.text},
 grid:{paddingHorizontal:16,paddingBottom:40,flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:10},
 tile:{width:'48.5%',minHeight:96,backgroundColor:'#20222E',borderColor:'#343442',borderWidth:1,borderRadius:13,padding:14,justifyContent:'space-between'},
 marker:{height:4,width:25,borderRadius:3},
 tileText:{color:colors.text,fontWeight:'800',fontSize:14}
});
