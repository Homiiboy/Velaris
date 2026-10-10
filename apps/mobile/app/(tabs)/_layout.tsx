import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/theme';

const Icon=({symbol,color,size=20}:{symbol:string;color:string;size?:number})=><Text style={{color,fontSize:size,fontWeight:'800'}}>{symbol}</Text>;

export default function TabLayout(){
 return <Tabs screenOptions={{
  headerShown:false,
  tabBarStyle:{backgroundColor:'#000000',borderTopColor:'#181818',height:72,paddingTop:6},
  tabBarActiveTintColor:'#fff',tabBarInactiveTintColor:'#8C8C8C',
  tabBarLabelStyle:{fontSize:9,fontWeight:'700',marginBottom:6}
 }}>
  <Tabs.Screen name="movies" options={{title:'Filme',tabBarIcon:({color})=><Icon symbol="▶" color={color}/>}}/>
  <Tabs.Screen name="series" options={{title:'Serien',tabBarIcon:({color})=><Icon symbol="▣" color={color}/>}}/>
  <Tabs.Screen name="home" options={{title:'Start',tabBarIcon:({color})=><Icon symbol="⌂" color={color} size={22}/>}}/>
  <Tabs.Screen name="anime" options={{title:'Anime',tabBarIcon:({color})=><Icon symbol="✦" color={color}/>}}/>
  <Tabs.Screen name="anime-movies" options={{title:'Anime Filme',tabBarIcon:({color})=><Icon symbol="◆" color={color}/>}}/>
  <Tabs.Screen name="search" options={{title:'Suche',href:null}}/>
  <Tabs.Screen name="profile" options={{title:'Profil',href:null}}/>
 </Tabs>
}
