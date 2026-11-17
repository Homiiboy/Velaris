import { Tabs } from 'expo-router';
import { Text, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, design } from '@/theme';
import { useVelarisTheme, categoryAccentForRoute } from '@/context/ThemeContext';

const Icon=({symbol,color,size=20}:{symbol:string;color:ColorValue;size?:number})=><Text style={{color,fontSize:size,fontWeight:'800'}}>{symbol}</Text>;

export default function TabLayout(){
 const {accentColor}=useVelarisTheme();
 const safeArea=useSafeAreaInsets();
 return <Tabs screenOptions={{
  headerShown:false,
  tabBarStyle:{position:'absolute',left:16,right:16,bottom:Math.max(12,safeArea.bottom),height:66,paddingTop:7,paddingBottom:7,borderRadius:24,backgroundColor:'rgba(19,18,28,0.94)',borderWidth:1,borderTopWidth:1,borderColor:'rgba(255,255,255,0.16)',shadowColor:'#000',shadowOffset:{width:0,height:9},shadowOpacity:0.48,shadowRadius:24,elevation:20,overflow:'hidden'},
  tabBarItemStyle:{borderRadius:20,marginHorizontal:2},
  tabBarBackground:()=> <View style={{flex:1,backgroundColor:'rgba(20,18,32,0.55)'}}/>,
  tabBarActiveTintColor:accentColor,tabBarInactiveTintColor:colors.muted,
  tabBarLabelStyle:{fontSize:10,fontWeight:'800',marginBottom:1},
  sceneStyle:{backgroundColor:colors.background}
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
