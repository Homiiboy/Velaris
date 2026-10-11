import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

type Variant='home'|'details'|'library';

/** One lightweight native-driven pulse per screen, not an animation per poster. */
export function LoadingSkeleton({variant,columns=3}:{
 variant:Variant;columns?:number
}){
 const opacity=useRef(new Animated.Value(.48)).current;
 useEffect(()=>{
  const cycle=Animated.loop(Animated.sequence([
   Animated.timing(opacity,{toValue:.88,duration:850,useNativeDriver:true}),
   Animated.timing(opacity,{toValue:.48,duration:850,useNativeDriver:true})
  ]));
  cycle.start();
  return ()=>cycle.stop();
 },[opacity]);

 if(variant==='home')return <View style={styles.home} accessible accessibilityLabel="Startseite wird geladen">
  <Animated.View style={[styles.pulse,{opacity}]}>
   <View style={styles.hero}/>
   <View style={styles.heroTitle}/>
   <View style={styles.heroMeta}/>
   <View style={styles.heroActions}>
    <View style={styles.heroButton}/><View style={styles.heroButton}/>
   </View>
   <View style={styles.heading}/>
   <View style={styles.row}>
    {[0,1,2].map(i=><View key={i} style={styles.homePoster}/>)}
   </View>
  </Animated.View>
 </View>;

 if(variant==='details')return <View style={styles.details} accessible accessibilityLabel="Details werden geladen">
  <Animated.View style={[styles.pulse,{opacity}]}>
   <View style={styles.detailHero}/>
   <View style={styles.detailContent}>
    <View style={styles.eyebrow}/>
    <View style={styles.detailTitle}/>
    <View style={styles.detailMeta}/>
    <View style={styles.heroActions}><View style={styles.heroButton}/><View style={styles.heroButton}/></View>
    <View style={styles.copy}/><View style={[styles.copy,{width:'78%'}]}/>
    <View style={styles.heading}/>
   </View>
  </Animated.View>
 </View>;

 return <View style={styles.library} accessible accessibilityLabel="Mediathek wird geladen">
  <Text style={styles.loadingLabel}>INHALTE WERDEN GELADEN</Text>
  <Animated.View style={[styles.pulse,{opacity}]}>
   <View style={styles.libraryHeading}/>
   <View style={styles.librarySub}/>
   <View style={styles.grid}>
    {Array.from({length:6},(_,i)=><View key={i} style={[styles.gridCell,{width:`${100/Math.max(1,columns)-2}%`}]}>
     <View style={styles.gridPoster}/>
     <View style={styles.gridTitle}/>
    </View>)}
   </View>
  </Animated.View>
 </View>;
}
const styles=StyleSheet.create({
 pulse:{width:'100%'},
 home:{backgroundColor:colors.background},
 hero:{height:350,backgroundColor:colors.surfaceAlt},
 heroTitle:{height:33,width:'62%',borderRadius:8,backgroundColor:'#363043',alignSelf:'center',marginTop:-112},
 heroMeta:{height:12,width:'46%',borderRadius:6,backgroundColor:'#2C2935',alignSelf:'center',marginTop:17},
 heroActions:{flexDirection:'row',gap:12,marginTop:23,paddingHorizontal:22},
 heroButton:{flex:1,height:46,borderRadius:9,backgroundColor:'#302D39'},
 heading:{height:23,width:'49%',borderRadius:7,backgroundColor:'#34303E',marginTop:38,marginHorizontal:22},
 row:{flexDirection:'row',gap:14,paddingLeft:22,marginTop:20,overflow:'hidden'},
 homePoster:{height:190,width:126,borderRadius:9,backgroundColor:colors.surfaceAlt},
 details:{flex:1,backgroundColor:colors.background},
 detailHero:{height:295,backgroundColor:colors.surfaceAlt},
 detailContent:{paddingHorizontal:20,marginTop:-32},
 eyebrow:{height:10,width:130,backgroundColor:'#504076',borderRadius:5},
 detailTitle:{height:33,width:'72%',backgroundColor:'#393342',borderRadius:8,marginTop:16},
 detailMeta:{height:12,width:'56%',backgroundColor:'#312D3B',borderRadius:6,marginTop:14},
 copy:{height:12,width:'95%',backgroundColor:'#272631',borderRadius:6,marginTop:16},
 library:{flex:1,paddingHorizontal:14,paddingTop:12,backgroundColor:colors.background},
 loadingLabel:{color:colors.accent,fontSize:10,fontWeight:'900',letterSpacing:1.8,marginBottom:16},
 libraryHeading:{height:30,width:'59%',borderRadius:7,backgroundColor:'#34303E'},
 librarySub:{height:12,width:'79%',borderRadius:6,backgroundColor:'#2A2833',marginTop:15},
 grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:22,marginTop:26},
 gridCell:{marginBottom:5},
 gridPoster:{width:'100%',aspectRatio:2/3,borderRadius:9,backgroundColor:colors.surfaceAlt},
 gridTitle:{height:11,width:'78%',borderRadius:5,backgroundColor:'#302D3A',marginTop:8}
});
