import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors, profileLimit } from '@/theme';

const AVATARS=[
 require('../assets/AvatarRot.png'),
 require('../assets/AvatarBlau.png'),
 require('../assets/AvatarRobbeWeiss.png'),
 require('../assets/AvatarRobbeGrau.png')
];
export default function ProfilesScreen(){
 const {session,profiles,switchProfile}=useAuth();
 if(!session)return <Redirect href="/connect"/>;
 return <View style={styles.page}><Text style={styles.brand}>VELARIS</Text><Text style={styles.title}>Wer schaut gerade?</Text>
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
