import { StyleSheet, View } from 'react-native';

/**
 * Shared multi-layer cinema scrim for both the home hero and media details.
 * Uses core React Native views, so it renders on Android, iOS and Expo Go
 * without introducing a native gradient dependency.
 */
export function CinematicShade({variant='home'}:{variant?:'home'|'details'}){
 return <View style={StyleSheet.absoluteFill} pointerEvents="none" accessible={false}>
  <View style={[styles.top,variant==='details'&&styles.detailsTop]}/>
  <View style={styles.middle}/>
  <View style={styles.lower}/>
  <View style={styles.bottom}/>
 </View>;
}
const styles=StyleSheet.create({
 top:{position:'absolute',top:0,left:0,right:0,height:'36%',backgroundColor:'rgba(8,8,13,.40)'},
 detailsTop:{backgroundColor:'rgba(8,8,13,.34)'},
 middle:{position:'absolute',bottom:0,left:0,right:0,height:'74%',backgroundColor:'rgba(8,8,13,.18)'},
 lower:{position:'absolute',bottom:0,left:0,right:0,height:'49%',backgroundColor:'rgba(8,8,13,.38)'},
 bottom:{position:'absolute',bottom:0,left:0,right:0,height:'25%',backgroundColor:'rgba(8,8,13,.74)'}
});
