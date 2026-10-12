import {useCallback,useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Redirect,useFocusEffect} from 'expo-router';
import {useAuth} from '@/context/AuthContext';
import {useVelarisTheme} from '@/context/ThemeContext';
import {VelarisHeader} from '@/components/VelarisHeader';
import {colors} from '@/theme';
import {homeRowOptions,loadHomeRowPreferences,saveHomeRowPreferences,type HomeRowKey,type HomeRowPreferences,defaultRowOrder} from '@/services/homeRows';

export default function HomeCustomizeScreen(){
 const {session}=useAuth();
 const {accentColor}=useVelarisTheme();
 const [settings,setSettings]=useState<HomeRowPreferences>({order:[...defaultRowOrder],hidden:[]});
 const [busy,setBusy]=useState(false);
 useFocusEffect(useCallback(()=>{
  if(!session)return;
  let active=true;
  loadHomeRowPreferences(session).then(value=>{if(active)setSettings(value)});
  return()=>{active=false};
 },[session]));
 if(!session)return <Redirect href="/connect"/>;
 const persist=async(next:HomeRowPreferences)=>{setSettings(next);setBusy(true);try{await saveHomeRowPreferences(session,next)}finally{setBusy(false)}};
 const toggle=(key:HomeRowKey)=>void persist({...settings,hidden:settings.hidden.includes(key)?settings.hidden.filter(v=>v!==key):[...settings.hidden,key]});
 const move=(key:HomeRowKey,direction:-1|1)=>{
  const order=[...settings.order];const index=order.indexOf(key),target=index+direction;
  if(index<0||target<0||target>=order.length)return;
  [order[index],order[target]]=[order[target],order[index]];
  void persist({...settings,order});
 };
 return <View style={styles.page}><VelarisHeader back/><ScrollView contentContainerStyle={styles.content}>
 <Text style={styles.title}>Startseite anpassen</Text>
 <Text style={styles.hint}>Reihen ein- und ausblenden oder mit den Pfeilen sortieren. Die Auswahl gilt nur für dieses Jellyfin-Profil.</Text>
 {settings.order.map((key,index)=>{
  const row=homeRowOptions.find(value=>value.key===key);
  if(!row)return null;
  const visible=!settings.hidden.includes(key);
  return <View key={key} style={styles.row}>
   <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{checked:visible}} onPress={()=>toggle(key)} style={styles.toggle}>
    <View style={[styles.box,visible&&{borderColor:accentColor,backgroundColor:accentColor}]}>
     {visible&&<Text style={styles.check}>✓</Text>}
    </View><Text numberOfLines={1} style={[styles.label,!visible&&styles.disabled]}>{row.label}</Text>
   </Pressable>
   <Pressable accessibilityLabel={`${row.label} nach oben`} accessibilityRole="button" disabled={busy||index===0} onPress={()=>move(key,-1)} style={styles.arrow}><Text style={[styles.arrowText,{color:index===0?colors.muted:accentColor}]}>↑</Text></Pressable>
   <Pressable accessibilityLabel={`${row.label} nach unten`} accessibilityRole="button" disabled={busy||index===settings.order.length-1} onPress={()=>move(key,1)} style={styles.arrow}><Text style={[styles.arrowText,{color:index===settings.order.length-1?colors.muted:accentColor}]}>↓</Text></Pressable>
  </View>;
 })}
 <Pressable style={styles.reset} onPress={()=>void persist({order:[...defaultRowOrder],hidden:[]})}><Text style={styles.resetText}>Standard wiederherstellen</Text></Pressable>
 </ScrollView></View>;
}
const styles=StyleSheet.create({
 page:{flex:1,backgroundColor:colors.background},content:{padding:18,paddingBottom:60},
 title:{fontSize:28,color:colors.text,fontWeight:'900',marginTop:18},hint:{color:colors.muted,fontSize:13,lineHeight:20,marginTop:12,marginBottom:18},
 row:{backgroundColor:colors.surface,borderRadius:12,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'center',marginBottom:9,minHeight:62,paddingHorizontal:12},
 toggle:{flex:1,flexDirection:'row',alignItems:'center',gap:11,minHeight:60},
 box:{width:22,height:22,borderWidth:2,borderRadius:5,borderColor:colors.muted,alignItems:'center',justifyContent:'center'},
 check:{color:'#08080D',fontWeight:'900'},label:{color:colors.text,fontWeight:'800',fontSize:13,flexShrink:1},disabled:{opacity:.5},
 arrow:{width:36,height:46,alignItems:'center',justifyContent:'center'},arrowText:{fontSize:23,fontWeight:'900'},
 reset:{marginTop:22,borderRadius:12,borderWidth:1,borderColor:colors.border,paddingVertical:16,alignItems:'center'},
 resetText:{color:colors.text,fontWeight:'800'}
});
