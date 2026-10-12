import { useEffect,useState } from 'react';
import { Pressable,ScrollView,StyleSheet,Text,View } from 'react-native';
import { router } from 'expo-router';
import { VelarisHeader } from '@/components/VelarisHeader';
import { colors } from '@/theme';
import { defaultPluginSettings,loadPluginSettings,savePluginSettings,type PluginSettings } from '@/services/pluginSettings';
const rows:[keyof PluginSettings,string,string][]=[
 ['introSkipper','Intro Skipper','Zeigt „Intro überspringen“, wenn Jellyfin ein Intro-Segment liefert.'],
 ['creditsSkip','Credits / Abspann','Verwendet erkannte Outro-/Credits-Segmente im Player.'],
 ['autoSkipIntro','Intro automatisch überspringen','Überspringt bekannte Intro- und Rückblick-Segmente automatisch.'],
 ['autoSkipCredits','Abspann automatisch überspringen','Überspringt erkannte Outro-/Credits-Segmente automatisch.'],
 ['autoNext','Nächste Episode','Spielt nach einer Episode automatisch die nächste Episode ab.'],
 ['cast','Google Cast','Aktiviert die Cast-Steuerung im Velaris Player.']
];
export default function PluginsScreen(){const[v,setV]=useState(defaultPluginSettings);useEffect(()=>{loadPluginSettings().then(setV)},[]);
 async function toggle(k:keyof PluginSettings){const n={...v,[k]:!v[k]};setV(n);await savePluginSettings(n)}
 return <View style={{flex:1,backgroundColor:colors.background}}><VelarisHeader back/><ScrollView style={s.page} contentContainerStyle={s.body}><Pressable onPress={()=>router.back()}><Text style={s.back}>‹ Einstellungen</Text></Pressable><Text style={s.title}>Plugins</Text><Text style={s.info}>Hier steuerst du die Velaris-Integrationen. Server-Plugins werden dadurch nicht deinstalliert oder deaktiviert.</Text>{rows.map(([k,t,d])=><Pressable key={k} onPress={()=>toggle(k)} style={s.row}><View style={s.text}><Text style={s.name}>{t}</Text><Text style={s.desc}>{d}</Text></View><View style={[s.toggle,v[k]&&s.toggleOn]}><View style={[s.knob,v[k]&&s.knobOn]}/></View></Pressable>)}</ScrollView></View>}
const s=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},body:{padding:24,paddingTop:16,paddingBottom:50},back:{color:colors.accent,fontSize:15,fontWeight:'800'},title:{color:'#fff',fontSize:30,fontWeight:'900',marginTop:22},info:{color:colors.muted,fontSize:12,lineHeight:18,marginTop:9,marginBottom:20},row:{minHeight:82,backgroundColor:'#151515',borderRadius:14,borderWidth:1,borderColor:'#252525',padding:15,marginBottom:10,flexDirection:'row',alignItems:'center',gap:14},text:{flex:1},name:{color:'#fff',fontSize:15,fontWeight:'800'},desc:{color:colors.muted,fontSize:11,lineHeight:16,marginTop:5},toggle:{width:46,height:26,borderRadius:13,backgroundColor:'#333',padding:3},toggleOn:{backgroundColor:colors.accent},knob:{width:20,height:20,borderRadius:10,backgroundColor:'#ddd'},knobOn:{alignSelf:'flex-end',backgroundColor:'#fff'}});
