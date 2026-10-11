import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { colors } from '@/theme';

export default function LoginScreen() {
  const params = useLocalSearchParams<{ serverUrl: string; serverName?: string; addingProfile?: string }>();
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function login() {
    if (!params.serverUrl) return;
    setError('');
    setBusy(true);
    try {
      await signIn(params.serverUrl, username, password);
      router.replace('/(tabs)/home');
    } catch (e) {
      const status = (e as Error & { status?: number }).status;
      setError(status === 401 ? 'Benutzername oder Passwort ist falsch.' : 'Anmeldung fehlgeschlagen. Bitte versuche es erneut.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{params.addingProfile==='1'?'NEUES PROFIL AUF':'VERBUNDEN MIT'}</Text>
        <Text style={styles.title}>{params.addingProfile==='1'?'Profil hinzufügen':(params.serverName || 'Jellyfin')}</Text>
        <Text style={styles.server}>{params.serverUrl}</Text>
      </View>
      <View style={styles.card}>
        <TextInput value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="Benutzername" placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Passwort" placeholderTextColor={colors.muted} style={styles.input} onSubmitEditing={login} />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Anmelden"
            disabled={busy || !username.trim()} onPress={login}
            style={({pressed})=>[styles.button,styles.primary,pressed&&styles.pressed,
              (busy||!username.trim())&&styles.disabled]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Anmelden</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Zurück"
            disabled={busy} onPress={()=>router.back()}
            style={({pressed})=>[styles.button,styles.secondary,pressed&&styles.pressed,busy&&styles.disabled]}>
            <Text style={styles.buttonText}>Zurück</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
  header: { marginBottom: 28 },
  eyebrow: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800', marginTop: 8 },
  server: { color: colors.muted, fontSize: 14, marginTop: 8 },
  card: { gap: 12, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 22, padding: 20 },
  input: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, borderRadius: 14, color: colors.text, paddingHorizontal: 16, height: 52, fontSize: 16 },
  error: { color: colors.danger, lineHeight: 20 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  button: { flex: 1, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: '#777088' },
  pressed: { opacity: 0.83, transform: [{scale: 0.985}] },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
