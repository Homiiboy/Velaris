import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors, design } from '@/theme';

const Icon=({symbol,color,size=20}:{symbol:string;color:ColorValue;size?:number})=><Text style={{color,fontSize:size,fontWeight:'800'}}>{symbol}</Text>;

export default function TabLayout(){
 return <Tabs screenOptions={{
  headerShown:false,
  tabBarStyle:{backgroundColor:colors.background,borderTopColor:colors.border,height:72,paddingTop:6},
  tabBarActiveTintColor:'#fff',tabBarInactiveTintColor:'#8C8C8C',
  tabBarLabelStyle:{fontSize:9,fontWeight:'700',marginBottom:6}
 }}>
  <Tabs.Screen name="movies" options={{title:design.navigation.movies,tabBarIcon:({color})=><Icon symbol="▶" color={color}/>}}/>
  <Tabs.Screen name="series" options={{title:design.navigation.series,tabBarIcon:({color})=><Icon symbol="▣" color={color}/>}}/>
  <Tabs.Screen name="home" options={{title:design.navigation.home,tabBarIcon:({color})=><Icon symbol="⌂" color={color} size={22}/>}}/>
  <Tabs.Screen name="anime" options={{title:design.navigation.anime,tabBarIcon:({color})=><Icon symbol="✦" color={color}/>}}/>
  <Tabs.Screen name="anime-movies" options={{title:design.navigation.animeMovies,tabBarIcon:({color})=><Icon symbol="◆" color={color}/>}}/>
  <Tabs.Screen name="search" options={{title:'Suche',href:null}}/>
  <Tabs.Screen name="profile" options={{title:'Profil',href:null}}/>
 </Tabs>
}
