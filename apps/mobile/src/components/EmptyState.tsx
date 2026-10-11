import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme';

export function EmptyState({title,message,onRetry}:{
 title:string;message:string;onRetry?:()=>void
}){
 return <View style={styles.wrap}>
  <View style={styles.emblem}><Text style={styles.monogram}>V</Text></View>
  <Text style={styles.heading}>{title}</Text>
  <Text style={styles.description}>{message}</Text>
  {!!onRetry&&<Pressable accessibilityRole="button" accessibilityLabel="Erneut versuchen"
   style={({pressed})=>[styles.retry,pressed&&styles.pressed]}
   onPress={onRetry}>
    <Text style={styles.retryText}>Erneut versuchen</Text>
   </Pressable>}
 </View>;
}
const styles=StyleSheet.create({
 wrap:{alignItems:'center',justifyContent:'center',paddingHorizontal:24,paddingVertical:44},
 emblem:{width:58,height:58,borderRadius:18,backgroundColor:'#242035',
  borderWidth:1,borderColor:'#6453A2',alignItems:'center',justifyContent:'center',marginBottom:22},
 monogram:{color:'#D6C7FF',fontSize:34,fontWeight:'900'},
 heading:{color:colors.text,fontSize:19,fontWeight:'900',textAlign:'center'},
 description:{color:colors.muted,fontSize:13,lineHeight:20,textAlign:'center',marginTop:10,maxWidth:320},
 retry:{height:43,marginTop:23,paddingHorizontal:22,borderRadius:10,backgroundColor:colors.accent,
  justifyContent:'center',alignItems:'center',minWidth:175},
 retryText:{color:colors.text,fontSize:13,fontWeight:'800'},
 pressed:{opacity:.82,transform:[{scale:.985}]}
});
