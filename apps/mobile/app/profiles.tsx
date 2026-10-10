import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';

const AVATARS=[require('../assets/AvatarRot.png'),require('../assets/AvatarBlau.png')];
export default function ProfilesScreen(){
 const {session,profiles,switchProfile}=useAuth();
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}><Text style={styles.brand}>VELARIS</Text><Text style={styles.title}>Wer schaut gerade?</Text>
 <View style={styles.grid}>{profiles.map(p=><Pressable key={p.id} style={({pressed})=>[styles.profile,pressed&&{opacity:.65}]} onPress={async()=>{await switchProfile(p.id);router.replace('/(tabs)/home')}}>
  <View style={styles.avatar}>{p.photoUri?<Image source={{uri:p.photoUri}} style={styles.photo}/>:<Image source={AVATARS[p.avatar%AVATARS.length]} style={styles.photo}/>}</View>
  <Text numberOfLines={1} style={styles.name}>{p.name}</Text>
 </Pressable>)}
 {profiles.length<5&&<Pressable style={styles.profile} onPress={()=>router.push({pathname:'/login',params:{serverUrl:session.serverUrl,serverName:'Jellyfin',addingProfile:'1'}})}><View style={[styles.avatar,styles.add]}><Text style={styles.plus}>＋</Text></View><Text style={styles.name}>Profil hinzufügen</Text></Pressable>}</View>
 <Pressable style={styles.manage} onPress={()=>router.push('/(tabs)/profile')}><Text style={styles.manageText}>Profile verwalten</Text></Pressable>
 </View>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:'#000',paddingHorizontal:24,paddingTop:70,alignItems:'center'},brand:{color:'#fff',fontSize:16,fontWeight:'900',letterSpacing:5},title:{color:'#fff',fontSize:27,fontWeight:'900',marginTop:50,marginBottom:38},grid:{width:'100%',flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:24},profile:{width:128,alignItems:'center'},avatar:{width:112,height:112,borderRadius:12,backgroundColor:'#1c1c1c',borderWidth:2,borderColor:'transparent',alignItems:'center',justifyContent:'center',overflow:'hidden'},photo:{width:'100%',height:'100%'},symbol:{fontSize:48},name:{color:'#ddd',fontSize:14,fontWeight:'700',marginTop:10,maxWidth:128},add:{borderColor:'#444',borderStyle:'dashed'},plus:{color:'#aaa',fontSize:48,fontWeight:'300'},manage:{marginTop:46,borderWidth:1,borderColor:'#777',paddingHorizontal:22,height:42,justifyContent:'center'},manageText:{color:'#ddd',fontSize:12,fontWeight:'800',letterSpacing:1}});
