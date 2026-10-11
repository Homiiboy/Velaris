import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors, profileLimit } from '@/theme';
import { getLatest, getPrimaryImageUrl } from '@/services/jellyfin';

const AVATARS=[
 require('../assets/AvatarRot.png'),
 require('../assets/AvatarBlau.png'),
 require('../assets/AvatarRobbeWeiss.png'),
 require('../assets/AvatarRobbeGrau.png')
];
export default function ProfilesScreen(){
 const {session,profiles,switchProfile}=useAuth();
 const [posters,setPosters]=useState<string[]>([]);
 useEffect(()=>{
  let current=true;
  if(!session){setPosters([]);return;}
  // Background art is decorative; network failures must never block profile selection.
  setPosters([]);
  getLatest(session).then(result=>{
   if(!current)return;
   const images=result.Items
    .filter(item=>item.Id&&(item.ImageTags?.Primary||item.PrimaryImageTag))
    .slice(0,20)
    .map(item=>getPrimaryImageUrl(session,item.Id,item.ImageTags?.Primary??item.PrimaryImageTag,240,72));
   setPosters(images);
  }).catch(()=>{if(current)setPosters([])});
  return ()=>{current=false;};
 },[session?.serverUrl,session?.user.Id,session?.accessToken]);
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}>
 <View style={styles.posterBackdrop} pointerEvents="none" accessible={false}>
  <View style={styles.posterGrid}>
   {posters.map((url,i)=><Image key={i} source={{uri:url}} style={styles.poster} resizeMode="cover"/>)}
  </View>
  <View style={styles.posterScrim}/>
  <View style={styles.profileScrim}/>
 </View>
 <Text style={styles.brand}>VELARIS</Text><Text style={styles.title}>Wer schaut gerade?</Text>
 <View style={styles.grid}>{profiles.map(p=><Pressable key={p.id} style={({pressed})=>[styles.profile,pressed&&styles.profilePressed]} onPress={async()=>{await switchProfile(p.id);router.replace('/(tabs)/home')}}>
  <View style={styles.avatar}>{p.photoUri?<Image source={{uri:p.photoUri}} style={styles.photo}/>:<Image source={AVATARS[p.avatar%AVATARS.length]} style={styles.photo}/>}</View>
  <Text numberOfLines={1} style={styles.name}>{p.name}</Text>
 </Pressable>)}
 {profiles.length<profileLimit&&<Pressable style={styles.profile} onPress={()=>router.push({pathname:'/login',params:{serverUrl:session.serverUrl,serverName:'Jellyfin',addingProfile:'1'}})}><View style={[styles.avatar,styles.add]}><Text style={styles.plus}>＋</Text></View><Text style={styles.name}>Profil hinzufügen</Text></Pressable>}</View>
 <Pressable style={styles.manage} onPress={()=>router.push('/(tabs)/profile')}><Text style={styles.manageText}>Profile verwalten</Text></Pressable>
 </View>
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.background,paddingHorizontal:20,paddingTop:100,alignItems:'center'},
 posterBackdrop:{position:'absolute',top:0,left:0,right:0,bottom:0,overflow:'hidden'},
 posterGrid:{width:'126%',marginLeft:'-13%',flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:8,transform:[{rotate:'-7deg'}],opacity:0.8},
 poster:{width:102,height:150,borderRadius:6,backgroundColor:colors.surface},
 posterScrim:{position:'absolute',top:0,left:0,right:0,bottom:0,backgroundColor:'rgba(8,8,13,0.63)'},
 profileScrim:{position:'absolute',top:'20%',bottom:'19%',left:0,right:0,backgroundColor:'rgba(8,8,13,0.27)'},
 brand:{color:colors.text,fontSize:19,fontWeight:'900',letterSpacing:5},
 title:{color:colors.text,fontSize:31,fontWeight:'900',marginTop:60,marginBottom:45,letterSpacing:-.6,textAlign:'center'},
 grid:{width:'100%',flexDirection:'row',flexWrap:'wrap',justifyContent:'center',columnGap:22,rowGap:28},
 profile:{width:134,alignItems:'center'},
 profilePressed:{opacity:.74,transform:[{scale:.97}]},
 avatar:{width:118,height:118,borderRadius:colors.posterRadius,backgroundColor:colors.surface,borderWidth:2,borderColor:'rgba(255,255,255,.20)',alignItems:'center',justifyContent:'center',overflow:'hidden'},
 photo:{width:'100%',height:'100%'},
 name:{color:colors.muted,fontSize:14,fontWeight:'700',marginTop:12,maxWidth:134,textAlign:'center'},
 add:{borderColor:'rgba(255,255,255,.38)',borderStyle:'dashed'},
 plus:{color:colors.text,fontSize:51,fontWeight:'300'},
 manage:{marginTop:56,borderWidth:1,borderColor:'rgba(255,255,255,.45)',borderRadius:8,paddingHorizontal:24,height:44,justifyContent:'center'},
 manageText:{color:colors.text,fontSize:12,fontWeight:'800',letterSpacing:1.2}
});
