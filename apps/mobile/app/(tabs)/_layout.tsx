import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors, design } from '@/theme';
import { useVelarisTheme, categoryAccentForRoute } from '@/context/ThemeContext';

const Icon=({symbol,color,size=20}:{symbol:string;color:ColorValue;size?:number})=><Text style={{color,fontSize:size,fontWeight:'800'}}>{symbol}</Text>;

export default function TabLayout(){
 const {accentColor}=useVelarisTheme();
 return <Tabs screenOptions={{
  headerShown:false,
  tabBarStyle:{backgroundColor:'rgba(8,8,13,0.98)',borderTopColor:'rgba(255,255,255,.12)',height:76,paddingTop:9,paddingBottom:8},
  tabBarActiveTintColor:accentColor,tabBarInactiveTintColor:colors.muted,
  tabBarLabelStyle:{fontSize:10,fontWeight:'800',marginBottom:3}
 }}>
  <Tabs.Screen name="home" options={{title:'Start',tabBarActiveTintColor:categoryAccentForRoute('home'),tabBarIcon:({color})=><Icon symbol="⌂" color={color} size={22}/>}}/>
  <Tabs.Screen name="categories" options={{title:'Kategorien',tabBarIcon:({color})=><Icon symbol="▦" color={color}/>}}/>
  <Tabs.Screen name="my-list" options={{title:'Meine Liste',tabBarActiveTintColor:design.categoryAccents.favorites,tabBarIcon:({color})=><Icon symbol="♥" color={color}/>}}/>
  <Tabs.Screen name="profile" options={{title:'Profil',tabBarIcon:({color})=><Icon symbol="◉" color={color}/>}}/>
  <Tabs.Screen name="movies" options={{title:design.navigation.movies,href:null}}/>
  <Tabs.Screen name="series" options={{title:design.navigation.series,href:null}}/>
  <Tabs.Screen name="anime" options={{title:design.navigation.anime,href:null}}/>
  <Tabs.Screen name="anime-movies" options={{title:design.navigation.animeMovies,href:null}}/>
  <Tabs.Screen name="animation" options={{title:design.navigation.animation,tabBarActiveTintColor:design.categoryAccents.animation,href:null}}/>
  <Tabs.Screen name="cartoons" options={{title:design.navigation.cartoons,tabBarActiveTintColor:design.categoryAccents.cartoons,href:null}}/>
  <Tabs.Screen name="search" options={{title:'Suche',href:null}}/>
 </Tabs>
}
