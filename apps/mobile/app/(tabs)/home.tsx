import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { getBackdropUrl, getFavorites, getGenres, getLatest, getPlayedItems, getRecommendations, getResumeItems } from '@/services/jellyfin';
import { MediaRow } from '@/components/MediaRow';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors, design } from '@/theme';
import { getActiveProfile, type VelarisProfile } from '@/services/session';

const AVATARS = [
  require('../../assets/AvatarRot.png'),
  require('../../assets/AvatarBlau.png'),
  require('../../assets/AvatarRobbeWeiss.png'),
  require('../../assets/AvatarRobbeGrau.png'),
];

export default function HomeScreen() {
  const { session } = useAuth();
  const { height } = useWindowDimensions();
  const [latest, setLatest] = useState<JellyfinItem[]>([]);
  const [resume, setResume] = useState<JellyfinItem[]>([]);
  const [favorites, setFavorites] = useState<JellyfinItem[]>([]);
  const [recommended, setRecommended] = useState<JellyfinItem[]>([]);
  const [becauseTitle, setBecauseTitle] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [activeProfile, setActiveProfile] = useState<VelarisProfile | null>(null);
  const [categoryMenu, setCategoryMenu] = useState(false);
  const [genres, setGenres] = useState<string[]>([]);
  const entrance = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!session) return;
    const [a, b, c, d] = await Promise.allSettled([
      getResumeItems(session), getLatest(session), getFavorites(session), getPlayedItems(session)
    ]);
    if (a.status === 'fulfilled') setResume(a.value.Items);
    if (b.status === 'fulfilled') setLatest(b.value.Items);
    if (c.status === 'fulfilled') setFavorites(c.value.Items);
    if (d.status === 'fulfilled' && d.value.Items[0]) {
      const watched = d.value.Items[0];
      setBecauseTitle(watched.Name);
      try { setRecommended((await getRecommendations(session, watched.Genres ?? [], watched.Id)).Items); }
      catch { setRecommended([]); }
    } else {
      setBecauseTitle('');
      setRecommended([]);
    }
  }, [session]);

  useEffect(() => {
    load();
    if (session) getGenres(session).then(setGenres).catch(() => setGenres([]));
    getActiveProfile().then(p => setActiveProfile(p ?? null));
    Animated.timing(entrance, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [load, session, entrance]);

  const hero = useMemo(() => latest.find(i => i.BackdropImageTags?.length) ?? latest[0], [latest]);
  if (!session) return <Redirect href="/connect" />;

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.accent} onRefresh={async () => {
          setRefreshing(true);
          try { await load(); } finally { setRefreshing(false); }
        }} />}
      >
        {hero ? (
          <ImageBackground source={{ uri: getBackdropUrl(session, hero) }} style={[styles.hero, { height: Math.max(565, height * 0.76) }]} resizeMode="cover">
            <View pointerEvents="none" style={styles.topShade} />
            <View pointerEvents="none" style={styles.middleShade} />
            <View pointerEvents="none" style={styles.lowerShade} />
            <View pointerEvents="none" style={styles.bottomShade} />
            <View style={styles.heroContent}>
              <Text style={styles.eyebrow}><Text style={styles.eyebrowDot}>●  </Text>{colors.heroLabel}</Text>
              <Text style={styles.heroTitle} numberOfLines={3}>{hero.Name}</Text>
              <Text style={styles.heroMeta}>{[hero.ProductionYear, hero.Type === 'Series' ? 'Serie' : 'Film', hero.CommunityRating ? '★ ' + hero.CommunityRating.toFixed(1) : null].filter(Boolean).join('   •   ')}</Text>
              {!!hero.Genres?.length && <Text style={styles.heroGenres} numberOfLines={1}>{hero.Genres.slice(0, 3).join('   ·   ')}</Text>}
              <View style={styles.heroButtons}>
                <Pressable accessibilityRole="button" style={({pressed}) => [styles.play, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/player/[id]', params: { id: hero.Id } })}>
                  <Text style={styles.playText}>▶   Abspielen</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={({pressed}) => [styles.info, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/details/[id]', params: { id: hero.Id } })}>
                  <Text style={styles.infoText}>ⓘ   Mehr Infos</Text>
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        ) : <View style={styles.heroEmpty} />}
        <Animated.View style={[styles.rows, { opacity: entrance }]}>
          <MediaRow title={design.homeRows.topTen} items={recommended.length ? recommended : latest} session={session} topTen />
          <MediaRow title={design.homeRows.resume} items={resume} session={session} continueWatching />
          <MediaRow title={design.homeRows.favorites} items={favorites} session={session} />
          {!!becauseTitle && <MediaRow title={`${design.homeRows.becausePrefix} „${becauseTitle}“ gesehen hast`} items={recommended} session={session} />}
          <MediaRow title={design.homeRows.latest} items={latest} session={session} />
        </Animated.View>
      </ScrollView>
      <View style={styles.header}>
        <View style={styles.top}>
          <Text style={styles.brand}>VELARIS<Text style={styles.brandDot}>.</Text></Text>
          <View style={styles.actions}>
            <Pressable accessibilityLabel="Downloads" hitSlop={12} onPress={() => router.push('/downloads')}><Text style={styles.action}>⇩</Text></Pressable>
            <Pressable accessibilityLabel="Sammlungen" hitSlop={12} onPress={() => router.push('/collections')}><Text style={styles.action}>▣</Text></Pressable>
            <Pressable accessibilityLabel="Suche" hitSlop={12} onPress={() => router.push('/(tabs)/search')}><Text style={styles.search}>⌕</Text></Pressable>
            <Pressable accessibilityLabel="Profil" hitSlop={12} onPress={() => router.push('/profiles')}>
              <View style={styles.avatar}><Image source={activeProfile?.photoUri ? { uri: activeProfile.photoUri } : AVATARS[(activeProfile?.avatar ?? 0) % AVATARS.length]} style={styles.avatarPhoto} /></View>
            </Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.quickNav} contentContainerStyle={styles.quickNavContent}>
          <Pressable style={[styles.navChip, categoryMenu && styles.activeChip]} onPress={() => setCategoryMenu(v => !v)}><Text style={styles.navChipText}>Genres  ⌄</Text></Pressable>
          {[
            {label:design.navigation.animation,href:'/(tabs)/animation'},
            {label:design.navigation.anime,href:'/(tabs)/anime'},
            {label:design.navigation.animeMovies,href:'/(tabs)/anime-movies'},
            {label:design.navigation.cartoons,href:'/(tabs)/cartoons'},
            {label:design.navigation.movies,href:'/(tabs)/movies'},
            {label:design.navigation.collections,href:'/collections'},
            {label:design.navigation.series,href:'/(tabs)/series'},
          ].map(destination=><Pressable key={destination.href} style={styles.navChip} onPress={() => router.push(destination.href as any)}><Text style={styles.navChipText}>{destination.label}</Text></Pressable>)}
        </ScrollView>
        {categoryMenu && <View style={styles.categoryMenu}>
          <Text style={styles.categoryHeading}>Genres</Text>
          <ScrollView style={styles.categoryScroll} nestedScrollEnabled>
            {genres.map(g => <Pressable key={g} style={styles.categoryItem} onPress={() => {
              setCategoryMenu(false);
              router.push({ pathname: '/genre/[name]', params: { name: g } });
            }}><Text style={styles.categoryText}>{g}</Text><Text style={styles.categoryArrow}>›</Text></Pressable>)}
          </ScrollView>
        </View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 6, paddingTop: 48, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: 'rgba(8,8,13,0.76)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: colors.text, fontSize: 19, fontWeight: '900', letterSpacing: 3.7 },
  brandDot: { color: colors.accent },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 17 },
  action: { color: colors.text, fontSize: 21, fontWeight: '800' },
  search: { color: colors.text, fontSize: 27, fontWeight: '700' },
  avatar: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', overflow: 'hidden' },
  avatarPhoto: { width: '100%', height: '100%' },
  quickNav: { marginTop: 17, marginRight: -16 },
  quickNavContent: { flexDirection: 'row', gap: 9, paddingRight: 28 },
  navChip: { height: 33, paddingHorizontal: 15, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  activeChip: { backgroundColor: colors.surfaceAlt, borderColor: colors.text },
  navChipText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  categoryMenu: { position: 'absolute', right: 16, top: 135, width: 245, maxHeight: 370, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(20,20,27,0.98)', borderColor: colors.border, borderWidth: 1 },
  categoryHeading: { color: colors.text, fontSize: 15, fontWeight: '900', padding: 16 },
  categoryScroll: { maxHeight: 315 },
  categoryItem: { minHeight: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.border },
  categoryText: { color: colors.text, fontSize: 13 },
  categoryArrow: { color: colors.muted, fontSize: 20 },
  hero: { justifyContent: 'flex-end', backgroundColor: colors.surface },
  heroEmpty: { height: 160, backgroundColor: colors.background },
  topShade: { position: 'absolute', left: 0, right: 0, top: 0, height: 200, backgroundColor: 'rgba(0,0,0,0.30)' },
  middleShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '64%', backgroundColor: 'rgba(0,0,0,0.24)' },
  lowerShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '41%', backgroundColor: 'rgba(0,0,0,0.45)' },
  bottomShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '15%', backgroundColor: 'rgba(8,8,13,0.88)' },
  heroContent: { paddingHorizontal: 20, paddingBottom: 49, alignItems: 'center' },
  eyebrow: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 2.5, marginBottom: 12 },
  eyebrowDot: { color: colors.accent },
  heroTitle: { color: colors.text, fontSize: 40, lineHeight: 44, fontWeight: '900', letterSpacing: -1, textAlign: 'center' },
  heroMeta: { color: '#EEEEF0', fontSize: 12, fontWeight: '800', marginTop: 12 },
  heroGenres: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 9 },
  heroButtons: { flexDirection: 'row', gap: 10, marginTop: 24, alignSelf: 'stretch' },
  play: { flex: 1, height: 47, borderRadius: 7, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, height: 47, borderRadius: 7, backgroundColor: 'rgba(84,84,92,0.84)', justifyContent: 'center', alignItems: 'center' },
  pressed: { opacity: 0.80 },
  playText: { color: '#111115', fontSize: 14, fontWeight: '900' },
  infoText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  rows: { paddingTop: 0, paddingBottom: 30, marginTop: -6 }
});
