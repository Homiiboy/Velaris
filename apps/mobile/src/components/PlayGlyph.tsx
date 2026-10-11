import { View } from 'react-native';

/**
 * Reusable geometric play symbol. The optical center of the triangle sits
 * at the center of this square; unlike the font glyph ▶ it won't drift with
 * Android/iOS typefaces. Parent controls the circular outline/background.
 */
export function PlayGlyph({size=18,color='#FFFFFF'}:{size?:number;color?:string}){
 const triangleHeight=size*0.9;
 const triangleWidth=size*0.76;
 return <View accessible={false} pointerEvents="none"
   style={{width:size,height:size,alignItems:'center',justifyContent:'center'}}>
  <View style={{
   width:0,height:0,
   borderTopWidth:triangleHeight/2,borderBottomWidth:triangleHeight/2,
   borderLeftWidth:triangleWidth,
   borderTopColor:'transparent',borderBottomColor:'transparent',
   borderLeftColor:color,
   transform:[{translateX:-triangleWidth/3}]
  }}/>
 </View>;
}
