import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { shouldShowProfilePicker } from '@/services/session';
import { colors } from '@/theme';

export default function Index() {
  const { session, loading, profiles } = useAuth();
  const [picker,setPicker]=useState<boolean|null>(null);
  useEffect(()=>{if(!loading)shouldShowProfilePicker().then(setPicker)},[loading]);
  if (loading||picker===null) return <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>;
  if(!session)return <Redirect href="/connect"/>;
  return <Redirect href={profiles.length>1&&picker ? '/profiles' : '/(tabs)/home'} />;
}
const styles=StyleSheet.create({center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:colors.background}});
