import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { colors, profileLimit } from '@/theme';
import { useVelarisTheme } from '@/context/ThemeContext';
import { getBackdropUrl, getLatest } from '@/services/jellyfin';
import { updateProfileAvatar, updateProfilePhoto, type VelarisProfile } from '@/services/session';

const AVATARS=[
 require('../assets/AvatarRot.png'),
 require('../assets/AvatarBlau.png'),
 require('../assets/AvatarRobbeWeiss.png'),
 require('../assets/AvatarRobbeGrau.png')
];
const LABELS=['Rot','Blau','Weiße Robbe','Graue Robbe'];
type Hero={id:string;name:string;year?:number;description?:string;image:string};

export default function ProfilesScreen(){
 const {session,profiles,switchProfile,refreshProfiles}=useAuth();
 const {accentColor,display}=useVelarisTheme();
 const [heroes,setHeroes]=useState<Hero[]>([]);
 const [slide,setSlide]=useState(0);
 const [editing,setEditing]=useState(false);
 const [selected,setSelected]=useState<VelarisProfile|null>(null);
 const [saving,setSaving]=useState(false);
 const fade=useRef(new Animated.Value(1)).current;

 useEffect(()=>{
  let mounted=true;
  setHeroes([]);setSlide(0);fade.setValue(1);
  if(!session)return;
  getLatest(session).then(result=>{
   if(!mounted)return;
   const seen=new Set<string>();
   setHeroes(result.Items.filter(item=>{
    if(!item.Id||!item.BackdropImageTags?.length||seen.has(item.Id))return false;
    seen.add(item.Id);return true;
   }).slice(0,7).map(item=>({
    id:item.Id,name:item.Name,year:item.ProductionYear,description:item.Overview,
    image:getBackdropUrl(session,item)
   })));
  }).catch(()=>{if(mounted)setHeroes([])});
  return ()=>{mounted=false};
 },[session?.serverUrl,session?.user.Id,session?.accessToken,fade]);

 useEffect(()=>{
  if(heroes.length<2||!display.autoHero)return;
  const timer=setInterval(()=>{
   Animated.timing(fade,{toValue:0,duration:display.animations?400:0,useNativeDriver:true}).start(({finished})=>{
    if(!finished)return;
    setSlide(index=>(index+1)%heroes.length);
    Animated.timing(fade,{toValue:1,duration:display.animations?600:0,useNativeDriver:true}).start();
   });
  },8500);
  return ()=>{clearInterval(timer);fade.stopAnimation()};
 },[heroes,fade,display.autoHero,display.animations]);

 async function selectAvatar(i:number){
  if(!selected||saving)return;
  setSaving(true);
  try{await updateProfileAvatar(selected.id,i);await refreshProfiles();setSelected(null)}
  catch{Alert.alert('Fehler','Der Avatar konnte nicht gespeichert werden.')}
  finally{setSaving(false)}
 }
 async function uploadPhoto(){
  if(!selected||saving)return;
  try{
   const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
   if(!permission.granted){Alert.alert('Fotos freigeben','Erlaube Velaris den Zugriff auf deine Galerie.');return}
   const result=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.85
   });
   if(result.canceled||!result.assets[0]?.uri)return;
   setSaving(true);
   await updateProfilePhoto(selected.id,result.assets[0].uri);
   await refreshProfiles();setSelected(null);
  }catch{Alert.alert('Fehler','Das Profilbild konnte nicht gespeichert werden.')}
  finally{setSaving(false)}
 }

 if(!session)return <Redirect href="/connect"/>;
 const hero=heroes[slide];
 return <View style={styles.page}>
  <View style={styles.hero} pointerEvents="none" accessibilityElementsHidden>
   {hero&&<Animated.Image source={{uri:hero.image}} resizeMode="cover" style={[styles.heroImage,{opacity:fade}]}/>}
   <View style={styles.heroShade}/>
   <View style={styles.heroBottomShade}/>
   {hero&&<Animated.View style={[styles.heroCaption,{opacity:fade}]}>
    <Text style={[styles.eyebrow,{color:accentColor}]}>JETZT AUF VELARIS</Text>
    <Text numberOfLines={2} style={styles.heroTitle}>{hero.name}</Text>
    {!!hero.year&&<Text style={styles.heroYear}>{hero.year}</Text>}
    <Text numberOfLines={3} style={styles.heroDescription}>{hero.description??''}</Text>
    <Text style={styles.dots}>{heroes.map((_,i)=>i===slide?'●':'○').join('  ')}</Text>
   </Animated.View>}
  </View>
  <View style={styles.rail}>
   <Text style={[styles.brand,{color:accentColor}]}>VELARIS</Text>
   <Text style={styles.title}>Wer schaut gerade?</Text>
   <Text style={styles.hint}>{editing?'Avatar zum Bearbeiten auswählen':'Wähle dein Profil'}</Text>
   <ScrollView style={styles.profilesScroll} contentContainerStyle={styles.profileList} showsVerticalScrollIndicator={false}>
    {profiles.map(p=><Pressable key={p.id}
      accessibilityLabel={editing?'Avatar für '+p.name+' bearbeiten':'Als '+p.name+' schauen'}
      style={({pressed})=>[styles.profile,pressed&&styles.profilePressed]}
      onPress={async()=>{
       if(editing){setSelected(p);return}
       try{await switchProfile(p.id);router.replace('/(tabs)/home')}
       catch{Alert.alert('Fehler','Profilwechsel fehlgeschlagen.')}
      }}>
      <View style={styles.avatar}><Image
       source={p.photoUri?{uri:p.photoUri}:AVATARS[(p.avatar??0)%AVATARS.length]}
       style={styles.photo}/></View>
      <Text numberOfLines={1} style={styles.name}>{p.name}</Text>
      {editing&&<Text style={styles.editPencil}>✎</Text>}
    </Pressable>)}
    {profiles.length<profileLimit&&<Pressable style={styles.profile}
      onPress={()=>router.push({pathname:'/login',params:{
       serverUrl:session.serverUrl,serverName:'Jellyfin',addingProfile:'1'
      }})}>
      <View style={[styles.avatar,styles.add]}><Text style={styles.plus}>＋</Text></View>
      <Text style={styles.name}>Profil hinzufügen</Text>
    </Pressable>}
   </ScrollView>
   <Pressable style={styles.manage} onPress={()=>setEditing(v=>!v)}>
    <Text style={styles.manageText}>{editing?'✓  Fertig':'✎  Profile bearbeiten'}</Text>
   </Pressable>
  </View>
  {selected&&<View style={styles.modalBackdrop}>
   <View style={styles.editor}>
    <Text style={styles.editorHeading}>Avatar ändern</Text>
    <Text style={styles.editorSubtitle}>{selected.name}</Text>
    <View style={styles.avatarChoices}>
     {AVATARS.map((src,i)=><Pressable key={i} style={({pressed})=>[styles.choice,pressed&&styles.choicePressed]} disabled={saving}
       onPress={()=>selectAvatar(i)}>
       <Image source={src} style={styles.choiceImage}/>
       <Text style={styles.choiceName}>{LABELS[i]}</Text>
     </Pressable>)}
    </View>
    <Pressable style={styles.uploadButton} disabled={saving} onPress={uploadPhoto}>
     <Text style={styles.uploadText}>Eigenes Bild auswählen</Text>
    </Pressable>
    <Pressable style={styles.cancel} onPress={()=>setSelected(null)} disabled={saving}>
     <Text style={styles.cancelText}>Abbrechen</Text>
    </Pressable>
   </View>
  </View>}
 </View>
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.background},
 hero:{position:'absolute',top:0,bottom:0,left:0,right:0,overflow:'hidden'},
 heroImage:{width:'100%',height:'100%'},
 heroShade:{position:'absolute',top:0,bottom:0,left:0,width:'75%',backgroundColor:'rgba(8,8,13,0.74)'},
 heroBottomShade:{position:'absolute',left:0,right:0,bottom:0,height:'35%',backgroundColor:'rgba(8,8,13,0.60)'},
 heroCaption:{position:'absolute',left:'53%',right:16,bottom:35},
 eyebrow:{fontSize:10,color:colors.accent,fontWeight:'900',letterSpacing:1.1,marginBottom:7},
 heroTitle:{color:colors.text,fontSize:22,fontWeight:'900',marginBottom:5},
 heroYear:{color:colors.muted,fontSize:12,marginBottom:4},
 heroDescription:{color:colors.text,fontSize:11,lineHeight:16},
 dots:{color:colors.text,fontSize:15,marginTop:14},
 rail:{width:'53%',minWidth:188,maxWidth:330,flex:1,paddingTop:65,paddingBottom:24,paddingLeft:20,paddingRight:10,backgroundColor:'rgba(8,8,13,0.50)'},
 brand:{fontSize:18,color:colors.accent,letterSpacing:3,fontWeight:'900',marginBottom:28},
 title:{fontSize:25,color:colors.text,fontWeight:'900',lineHeight:31,marginBottom:9},
 hint:{fontSize:12,color:colors.muted,marginBottom:17},
 profilesScroll:{flex:1},
 profileList:{paddingBottom:12,gap:8},
 profile:{height:70,flexDirection:'row',alignItems:'center',borderRadius:12,paddingHorizontal:6,backgroundColor:'rgba(30,29,40,.76)'},
 profilePressed:{backgroundColor:'rgba(83,70,132,.7)',transform:[{scale:0.985}]},
 avatar:{width:54,height:54,overflow:'hidden',borderRadius:10,borderWidth:1,borderColor:'rgba(255,255,255,.3)',backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},
 photo:{width:'100%',height:'100%'},
 name:{flex:1,color:colors.text,fontSize:13,fontWeight:'700',paddingLeft:10},
 editPencil:{color:colors.accent,fontSize:17,paddingHorizontal:3},
 add:{borderStyle:'dashed'},
 plus:{fontSize:28,color:colors.text},
 manage:{height:43,borderWidth:1,borderColor:'rgba(255,255,255,.45)',borderRadius:8,alignItems:'center',justifyContent:'center',marginTop:10},
 manageText:{color:colors.text,fontWeight:'800',fontSize:12},
 modalBackdrop:{position:'absolute',top:0,bottom:0,left:0,right:0,backgroundColor:'rgba(0,0,0,.85)',justifyContent:'center',alignItems:'center',paddingHorizontal:20},
 editor:{width:'100%',maxWidth:390,padding:22,borderRadius:18,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
 editorHeading:{fontSize:25,fontWeight:'900',color:colors.text,textAlign:'center'},
 editorSubtitle:{fontSize:14,color:colors.muted,marginTop:4,textAlign:'center'},
 avatarChoices:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',columnGap:12,rowGap:16,marginTop:22},
 choice:{width:113,alignItems:'center',paddingVertical:5,borderRadius:12},
 choicePressed:{backgroundColor:'rgba(124,92,252,.22)',transform:[{scale:0.97}]},
 choiceImage:{width:84,height:84,borderRadius:12},
 choiceName:{color:colors.muted,marginTop:7,fontSize:12,fontWeight:'700',textAlign:'center'},
 uploadButton:{marginTop:22,backgroundColor:colors.accent,borderRadius:9,paddingVertical:13,alignItems:'center'},
 uploadText:{color:colors.text,fontWeight:'800'},
 cancel:{paddingVertical:14,alignItems:'center'},
 cancelText:{color:colors.muted,fontWeight:'700'}
});
