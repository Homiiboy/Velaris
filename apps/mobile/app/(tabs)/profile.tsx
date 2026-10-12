import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { getActiveProfile, updateProfileAvatar, updateProfilePhoto } from '@/services/session';
import { VelarisHeader } from '@/components/VelarisHeader';
import { colors, profileLimit } from '@/theme';
import { accentOptions, useVelarisTheme } from '@/context/ThemeContext';

const AVATARS=[{image:require('../../assets/AvatarRot.png'),label:'Rot'},{image:require('../../assets/AvatarBlau.png'),label:'Blau'},
 {image:require('../../assets/AvatarRobbeWeiss.png'),label:'Weiße Robbe'},
 {image:require('../../assets/AvatarRobbeGrau.png'),label:'Graue Robbe'}];

export default function ProfileScreen(){
 const {accent,accentColor,display,setAccent,setDisplay}=useVelarisTheme();
 const {session,profiles,switchProfile,refreshProfiles}=useAuth();const[avatar,setAvatar]=useState(0);const[photoUri,setPhotoUri]=useState<string|undefined>();
 useEffect(()=>{getActiveProfile().then(p=>{setAvatar(p?.avatar??0);setPhotoUri(p?.photoUri)})},[session]);
 if(!session)return <Redirect href="/connect"/>;
 const activeId=session.serverId+':'+session.user.Id;
 async function pickPhoto(){const r=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:.85});if(!r.canceled){const uri=r.assets[0].uri;setPhotoUri(uri);await updateProfilePhoto(activeId,uri);await refreshProfiles()}}
 return <View style={{flex:1,backgroundColor:colors.background}}><VelarisHeader back/><ScrollView style={styles.page} contentContainerStyle={styles.content}><Text style={styles.title}>Profile</Text>
 <View style={styles.current}><View style={styles.avatar}>{photoUri?<Image source={{uri:photoUri}} style={styles.photo}/>:<Image source={AVATARS[avatar%AVATARS.length].image} style={styles.photo}/>}</View><View><Text style={styles.name}>{session.user.Name}</Text><Text style={styles.server}>{session.serverUrl}</Text></View></View>
 <Text style={styles.section}>Profilbild</Text><Pressable style={styles.photoButton} onPress={pickPhoto}><Text style={styles.photoButtonText}>Foto aus Galerie auswählen</Text></Pressable><Text style={styles.or}>oder Avatar auswählen</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatars}>{AVATARS.map((a,i)=><Pressable key={a.label} onPress={async()=>{setAvatar(i);setPhotoUri(undefined);await updateProfileAvatar(activeId,i);await refreshProfiles()}} style={[styles.avatarChoice,avatar===i&&styles.selected]}><Image source={a.image} style={styles.choiceImage}/><Text numberOfLines={2} style={styles.choiceLabel}>{a.label}</Text></Pressable>)}</ScrollView>
 <Text style={styles.section}>Darstellung</Text>
 <Text style={styles.settingsSub}>Akzentfarbe – der dunkle Hintergrund und der Verlauf bleiben unverändert.</Text>
 <View style={styles.accentChoices}>{accentOptions.map(choice=><Pressable key={choice.key}
   accessibilityRole="radio" accessibilityState={{selected:accent===choice.key}}
   accessibilityLabel={`Theme ${choice.label}`}
   onPress={()=>{void setAccent(choice.key)}}
   style={[styles.accentChoice,{borderColor:accent===choice.key?choice.color:colors.border}]}>
   <View style={[styles.accentSwatch,{backgroundColor:choice.color}]}>{accent===choice.key&&<Text style={styles.accentTick}>✓</Text>}</View>
   <Text style={styles.accentLabel}>{choice.label}</Text>
 </Pressable>)}</View>
 <Text style={styles.settingsSub}>Vorschau: <Text style={{color:accentColor,fontWeight:'900'}}>VELARIS</Text></Text>
 {([
   ['autoHero','Highlights automatisch wechseln'],
   ['animations','Sanfte Animationen'],
   ['previews','Poster-Vorschau bei Fokus']
 ] as const).map(([key,label])=><Pressable key={key}
   accessibilityRole="switch" accessibilityState={{checked:display[key]}}
   onPress={()=>{void setDisplay({...display,[key]:!display[key]})}}
   style={styles.displayRow}><Text style={styles.settingsTitle}>{label}</Text>
   <Text style={[styles.displayState,{color:display[key]?accentColor:colors.muted}]}>{display[key]?'AN':'AUS'}</Text>
 </Pressable>)}
 <Text style={styles.section}>Einstellungen</Text><Pressable style={styles.settingsRow} onPress={()=>router.push('/downloads')}><View><Text style={styles.settingsTitle}>Downloads</Text><Text style={styles.settingsSub}>Offline gespeicherte Filme und Episoden</Text></View><Text style={styles.chevron}>›</Text></Pressable><Pressable style={styles.settingsRow} onPress={()=>router.push('/plugins')}><View><Text style={styles.settingsTitle}>Plugins</Text><Text style={styles.settingsSub}>Intro Skipper, Credits, Autoplay und Cast</Text></View><Text style={styles.chevron}>›</Text></Pressable><Text style={styles.section}>Profile auf diesem Gerät</Text>{profiles.map(p=><Pressable key={p.id} onPress={async()=>{await switchProfile(p.id);router.replace('/(tabs)/home')}} style={[styles.profile,p.id===activeId&&styles.profileActive]}><View style={styles.smallAvatar}>{p.photoUri?<Image source={{uri:p.photoUri}} style={styles.smallPhoto}/>:<Image source={AVATARS[p.avatar%AVATARS.length].image} style={styles.smallPhoto}/>}</View><View style={{flex:1}}><Text style={styles.profileName}>{p.name}</Text><Text numberOfLines={1} style={styles.profileServer}>{p.session.serverUrl}</Text></View>{p.id===activeId&&<Text style={styles.activeText}>Aktiv</Text>}</Pressable>)}
 {profiles.length<profileLimit&&<Pressable style={styles.add} onPress={()=>router.push({pathname:'/login',params:{serverUrl:session.serverUrl,serverName:'Jellyfin',addingProfile:'1'}})}><Text style={styles.addPlus}>＋</Text><Text style={styles.addText}>Neues Profil hinzufügen</Text></Pressable>}
 <Text style={styles.limit}>{profiles.length}/{profileLimit} Profile</Text></ScrollView></View>
}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{padding:18,paddingTop:14,paddingBottom:50},brand:{color:'#FFFFFF',fontWeight:'900',letterSpacing:5},title:{color:colors.text,fontSize:30,fontWeight:'900',marginTop:18},current:{flexDirection:'row',alignItems:'center',gap:16,marginTop:30},avatar:{width:78,height:78,borderRadius:8,backgroundColor:'#181818',borderWidth:2,borderColor:'#FFFFFF',alignItems:'center',justifyContent:'center'},avatarIcon:{fontSize:38},name:{color:'#fff',fontSize:22,fontWeight:'900'},server:{color:colors.muted,fontSize:12,marginTop:5,maxWidth:230},section:{color:'#fff',fontSize:17,fontWeight:'900',marginTop:32,marginBottom:13},avatars:{gap:10},avatarChoice:{width:92,height:112,borderRadius:6,backgroundColor:'#181818',borderWidth:1,borderColor:'#2b2b2b',alignItems:'center',justifyContent:'center',padding:7},selected:{borderColor:'#FFFFFF',borderWidth:2},choiceIcon:{fontSize:35},choiceImage:{width:64,height:64,borderRadius:8},choiceLabel:{color:'#ddd',fontSize:10,textAlign:'center',marginTop:8},profile:{height:70,borderRadius:12,backgroundColor:'#151515',padding:10,marginBottom:9,flexDirection:'row',alignItems:'center',gap:12,borderWidth:1,borderColor:'#222'},profileActive:{borderColor:'#FFFFFF'},smallAvatar:{width:48,height:48,borderRadius:10,backgroundColor:'#242424',alignItems:'center',justifyContent:'center'},smallIcon:{fontSize:24},profileName:{color:'#fff',fontSize:15,fontWeight:'800'},profileServer:{color:colors.muted,fontSize:10,marginTop:4},activeText:{color:'#FFFFFF',fontSize:11,fontWeight:'800'},add:{height:60,borderRadius:12,borderWidth:1,borderStyle:'dashed',borderColor:'#555',flexDirection:'row',alignItems:'center',justifyContent:'center',gap:8,marginTop:4},addPlus:{color:'#fff',fontSize:25},addText:{color:'#fff',fontWeight:'700'},limit:{color:colors.muted,fontSize:11,textAlign:'center',marginTop:12},accentChoices:{flexDirection:'row',flexWrap:'wrap',gap:9,marginTop:12,marginBottom:13},accentChoice:{width:96,paddingVertical:9,paddingHorizontal:6,borderRadius:10,borderWidth:2,alignItems:'center',backgroundColor:colors.surface},accentSwatch:{width:34,height:34,borderRadius:17,alignItems:'center',justifyContent:'center'},accentTick:{fontSize:21,fontWeight:'900',color:'#101016'},accentLabel:{color:colors.text,fontSize:11,fontWeight:'800',marginTop:6},displayRow:{height:49,backgroundColor:colors.surface,borderRadius:10,paddingHorizontal:14,marginTop:7,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},displayState:{fontSize:12,fontWeight:'900'},settingsRow:{height:68,borderRadius:12,backgroundColor:'#151515',borderWidth:1,borderColor:'#252525',paddingHorizontal:15,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},settingsTitle:{color:'#fff',fontSize:15,fontWeight:'800'},settingsSub:{color:colors.muted,fontSize:10,marginTop:4},chevron:{color:'#fff',fontSize:28},photo:{width:'100%',height:'100%',borderRadius:16},smallPhoto:{width:'100%',height:'100%',borderRadius:9},photoButton:{height:48,borderRadius:12,backgroundColor:'#1c1c1c',borderWidth:1,borderColor:'#333',alignItems:'center',justifyContent:'center'},photoButtonText:{color:'#fff',fontWeight:'800'},or:{color:colors.muted,fontSize:11,textAlign:'center',marginVertical:13}});
