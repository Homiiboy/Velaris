import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Redirect, router, useFocusEffect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useVelarisTheme } from '@/context/ThemeContext';
import { getBackdropUrl, getLogoUrl, getFavorites, getLatest, getPlayedItems, getRecommendations, getResumeItems } from '@/services/jellyfin';
import { MediaRow } from '@/components/MediaRow';
import type { JellyfinItem } from '@/types/jellyfin';
import { colors, design } from '@/theme';
import { VelarisHeader } from '@/components/VelarisHeader';
import { PlayGlyph } from '@/components/PlayGlyph';
import { CinematicShade } from '@/components/CinematicShade';
import { LoadingSkeleton } from '@/components/LoadingSkeleton';
import { EmptyState } from '@/components/EmptyState';
import { getHiddenResume, hideResumeItem } from '@/services/continueVisibility';
import {loadHomeRowPreferences,homeRowOptions,defaultRowOrder,type HomeRowKey,type HomeRowPreferences} from '@/services/homeRows';

const AVATARS = [
  require('../../assets/AvatarRot.png'),
  require('../../assets/AvatarBlau.png'),
  require('../../assets/AvatarRobbeWeiss.png'),
  require('../../assets/AvatarRobbeGrau.png'),
];

export default function HomeScreen() {
  const { session } = useAuth();
  const {accentColor,display}=useVelarisTheme();
  const { height } = useWindowDimensions();
  const [latest, setLatest] = useState<JellyfinItem[]>([]);
  const [resume, setResume] = useState<JellyfinItem[]>([]);
  const [hiddenResume,setHiddenResume]=useState<string[]>([]);
  const [rowPreferences,setRowPreferences]=useState<HomeRowPreferences>({order:[...defaultRowOrder],hidden:[]});
  const [favorites, setFavorites] = useState<JellyfinItem[]>([]);
  const [recommended, setRecommended] = useState<JellyfinItem[]>([]);
  const [becauseTitle, setBecauseTitle] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const heroOpacity = useRef(new Animated.Value(1)).current;
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasLoadError, setHasLoadError] = useState(false);
  const entrance = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    if (!session) return;
    const [a, b, c, d] = await Promise.allSettled([
      getResumeItems(session), getLatest(session), getFavorites(session), getPlayedItems(session)
    ]);
    setHasLoadError([a,b,c,d].every(result=>result.status==='rejected'));
    setInitialLoading(false);
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

  useFocusEffect(useCallback(() => {
    // Refresh Jellyfin played flags after returning from the media player.
    load();
    if(session){getHiddenResume(session).then(setHiddenResume).catch(()=>setHiddenResume([]));
      loadHomeRowPreferences(session).then(setRowPreferences).catch(()=>{});
    }
  }, [load, session]));
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [entrance]);

  // Rotate only real backdrop artwork; never replace the hero with an empty image.
  const heroItems = useMemo(() => {
    const withBackdrop = latest.filter(item => !!item.BackdropImageTags?.length);
    return (withBackdrop.length ? withBackdrop : latest).slice(0, 5);
  }, [latest]);
  const hero = heroItems[heroIndex % Math.max(1, heroItems.length)];
  const unwatched=useMemo(()=>latest.filter(item=>!item.UserData?.Played),[latest]);
  const visibleResume=useMemo(()=>resume.filter(item=>!hiddenResume.includes(item.Id)),[resume,hiddenResume]);
  const movies=useMemo(()=>(recommended.length?recommended:latest).filter(item=>item.Type==='Movie'),[recommended,latest]);
  const upcoming=useMemo(()=>latest.filter(item=>item.PremiereDate && Date.parse(item.PremiereDate)>Date.now()),[latest]);
  const popular=useMemo(()=>[...latest].filter(item=>(item.CommunityRating??0)>0).sort((a,b)=>(b.CommunityRating??0)-(a.CommunityRating??0)),[latest]);
  const hiddenGems=useMemo(()=>latest.filter(item=>!item.UserData?.Played && (item.CommunityRating??0)>=7),[latest]);
  const shortFilms=useMemo(()=>latest.filter(item=>item.Type==='Movie' && !!item.RunTimeTicks && item.RunTimeTicks<=100*600_000_000),[latest]);
  const randomMovie=()=>{
    if(!movies.length)return;
    const movie=movies[Math.floor(Math.random()*movies.length)];
    router.push({pathname:'/details/[id]',params:{id:movie.Id}});
  };
  useEffect(() => {
    setHeroIndex(0);
  }, [heroItems]);
  useEffect(() => {
    if (heroItems.length < 2 || !display.autoHero) return;
    const timer = setInterval(() => {
      setHeroIndex(index => (index + 1) % heroItems.length);
    }, 9000);
    return () => clearInterval(timer);
  }, [heroItems.length,display.autoHero]);
  useEffect(() => {
    heroOpacity.setValue(display.animations ? 0 : 1);
    const animation = Animated.timing(heroOpacity, {
      toValue: 1, duration: display.animations ? 550 : 0, useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [hero?.Id, heroOpacity,display.animations]);
  if (!session) return <Redirect href="/connect" />;

  return (
    <View style={styles.page}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={accentColor} onRefresh={async () => {
          setRefreshing(true);
          try { await load(); } finally { setRefreshing(false); }
        }} />}
      >
        {hero ? (
          <View style={[styles.hero, { height: Math.max(565, height * 0.76) }]}>
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroOpacity }]}>
              <ImageBackground source={{ uri: getBackdropUrl(session, hero) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </Animated.View>
            <CinematicShade/>
            <View style={styles.heroContent}>
              <Text style={styles.eyebrow}><Text style={[styles.eyebrowDot,{color:accentColor}]}>●  </Text>{colors.heroLabel}</Text>
              {getLogoUrl(session,hero)?<Image
                source={{uri:getLogoUrl(session,hero)!}}
                resizeMode="contain"
                style={styles.heroLogo}
                accessibilityLabel={hero.Name}
              />:<Text style={styles.heroTitle} numberOfLines={3}>{hero.Name}</Text>}
              <Text style={styles.heroMeta}>{[
                hero.ProductionYear,
                hero.Type === 'Series' ? 'Serie' : 'Film',
                hero.Type!=='Series' && hero.RunTimeTicks ? `${Math.round(hero.RunTimeTicks/600000000)} Min.` : null,
                hero.CommunityRating ? '★ ' + hero.CommunityRating.toFixed(1) : null
              ].filter(Boolean).join('   ·   ')}</Text>
              {!!hero.Genres?.length && <Text style={styles.heroGenres} numberOfLines={1}>{hero.Genres.slice(0, 3).join('   ·   ')}</Text>}
              {!!hero.Overview && <Text style={styles.heroOverview} numberOfLines={3}>{hero.Overview}</Text>}
              <View style={styles.heroButtons}>
                <Pressable accessibilityRole="button" style={({pressed}) => [styles.play, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/player/[id]', params: { id: hero.Id } })}>
                  <PlayGlyph size={17} color="#101016"/><Text style={styles.playText}>Abspielen</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={({pressed}) => [styles.info, pressed && styles.pressed]} onPress={() => router.push({ pathname: '/details/[id]', params: { id: hero.Id } })}>
                  <View style={styles.infoIcon}><Text style={styles.infoIconText}>i</Text></View><Text style={styles.infoText}>Mehr Infos</Text>
                </Pressable>
              </View>
              {heroItems.length > 1 && <View style={styles.heroIndicators} accessibilityRole="radiogroup">
                {heroItems.map((item, index) => (
                  <Pressable
                    key={item.Id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: index === heroIndex }}
                    accessibilityLabel={`Highlight ${index + 1}: ${item.Name}`}
                    onPress={() => setHeroIndex(index)}
                    hitSlop={10}
                    style={[styles.heroDot, index === heroIndex && [styles.heroDotActive,{backgroundColor:accentColor}]]}
                  />
                ))}
              </View>}
            </View>
          </View>
        ) : initialLoading ? <LoadingSkeleton variant="home"/> : <View style={styles.heroEmpty}>
          <EmptyState
            title={hasLoadError?'Verbindung zu Jellyfin fehlgeschlagen':'Bereit für deinen Filmabend?'}
            message={hasLoadError
              ?'Wir konnten deine Mediathek gerade nicht laden. Prüfe die Serververbindung.'
              :'Sobald Jellyfin Filme oder Serien bereitstellt, findest du sie hier.'}
            onRetry={()=>{setInitialLoading(true);void load()}}
          />
        </View>}
        {!initialLoading&&<Animated.View style={[styles.rows, { opacity: entrance }]}>
          {!!movies.length&&<View style={styles.randomBar}>
            <Pressable accessibilityRole="button" accessibilityLabel="Zufälligen Film entdecken"
              onPress={randomMovie} style={({pressed})=>[styles.randomButton,{borderColor:accentColor},pressed&&styles.pressed]}>
              <Text style={styles.randomLabel}>✦  Zufälliger Film</Text>
            </Pressable>
          </View>}
          {rowPreferences.order.filter(key=>!rowPreferences.hidden.includes(key)).map(key=>{
            const data:Record<HomeRowKey,JellyfinItem[]>={
              topTen:popular.length?popular:latest,
              resume:visibleResume,favorites,
              because:recommended,latest,movieNight:movies,
              unwatched,upcoming,popular,hiddenGems,short:shortFilms
            };
            const items=data[key];
            if(!items.length||key==='because'&&!becauseTitle)return null;
            const title=key==='because'?`${design.homeRows.becausePrefix} „${becauseTitle}“ gesehen hast`:
              homeRowOptions.find(row=>row.key===key)?.label??key;
            return <MediaRow key={key} title={title} items={items} session={session}
              topTen={key==='topTen'} continueWatching={key==='resume'}
              onHide={key==='resume'?id=>{void hideResumeItem(session,id).then(()=>setHiddenResume(previous=>[...new Set([...previous,id])])).catch(()=>{})}:undefined} />;
          })}
        </Animated.View>}
      </ScrollView>
      <VelarisHeader home overlay />
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
  quickNav: { marginTop: 17, marginRight: -16, flexGrow: 0 },
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
  heroIndicators: { flexDirection: 'row', justifyContent: 'center', gap: 9, marginBottom: 30 },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.48)' },
  heroDotActive: { width: 23, backgroundColor: colors.text },
  heroEmpty: { minHeight: 315, backgroundColor: colors.background,paddingTop:86 },

  heroContent: { paddingHorizontal: 22, paddingBottom: 56, alignItems: 'center', width:'100%' },
  eyebrow: { color: colors.text, fontSize: 10, fontWeight: '900', letterSpacing: 2.5, marginBottom: 12 },
  eyebrowDot: { color: colors.accent },
  heroLogo:{width:'88%',height:125,maxWidth:430,marginBottom:1},
  heroTitle: { color: colors.text, fontSize: 38, lineHeight: 43, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center' },
  heroMeta: { color: '#EBE9F3', fontSize: 12, fontWeight: '800', marginTop: 13, textAlign:'center' },
  heroGenres: { color: '#C5BFDB', fontSize: 12, fontWeight: '700', marginTop: 8, textAlign:'center' },
  heroOverview: { color: '#E6E3ED', fontSize: 13, lineHeight: 19, marginTop: 12, textAlign:'center', maxWidth:490 },
  heroButtons: { flexDirection: 'row', gap: 12, marginTop: 22, alignSelf: 'stretch' },
  play: { flex: 1, height: 48, borderRadius: 9, backgroundColor: '#FFFFFF', flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1, height: 48, borderRadius: 9, backgroundColor: 'rgba(84,84,92,0.84)', flexDirection: 'row', gap: 9, justifyContent: 'center', alignItems: 'center' },
  infoIcon: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, borderColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  infoIconText: { color: colors.text, fontSize: 12, fontWeight: '900', lineHeight: 14, includeFontPadding: false },
  pressed: { opacity: 0.83, transform:[{scale:0.985}] },
  playText: { color: '#111115', fontSize: 14, fontWeight: '900' },
  infoText: { color: colors.text, fontSize: 14, fontWeight: '800' },
  randomBar:{paddingHorizontal:22,marginTop:8,marginBottom:14},randomButton:{height:45,borderRadius:12,borderWidth:1,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'},randomLabel:{color:colors.text,fontSize:14,fontWeight:'900'},
  rows: { paddingTop: 0, paddingBottom: 30, marginTop: -6 }
});
