const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p));
const text=p=>read(p).toString('utf8');
const brand=JSON.parse(text('packages/velaris-design/brand.json'));
const pairs=require('./asset-map.json');
const errors=[];
const check=(condition,message)=>{if(!condition)errors.push(message)};
check(brand.name==='VELARIS','Brand name mismatch');
check(brand.profiles.maxProfiles===5,'Profile limit must match on mobile and TV');
check(brand.avatars.length===4,'Expected four shared avatars');
check(['home','movies','series','anime','animeMovies','collections','animation','cartoons'].every(k=>!!brand.navigation[k]),'Missing shared navigation labels');
check(brand.defaultServerUrl==='http://192.168.0.74:8097','Unexpected Jellyfin default server address');
const ordered=brand.navigationOrder.filter(k=>k!=='home').map(k=>brand.navigation[k]);
check(ordered.length===7 && ordered.join('|')===[...ordered].sort((a,b)=>a.localeCompare(b,'de')).join('|'),'Categories must stay alphabetically ordered');
const sum=file=>crypto.createHash('sha256').update(read(file)).digest('hex');
for(const [source,target] of pairs){
  try{check(sum(source)===sum(target),'Asset differs: '+source+' -> '+target)}
  catch(e){errors.push('Asset missing: '+source+' -> '+target)}
}
check(text('apps/mobile/src/theme.ts').includes('velaris-design/brand.json'),'Mobile is not connected to the brand contract');
check(text('apps/tv/app/build.gradle.kts').includes('packages/velaris-design'),'TV does not package shared brand JSON');
check(text('apps/tv/app/src/main/java/com/novarion/velaristv/MainActivity.kt').includes('saveJellyfinProfile'),'TV profiles are not Jellyfin-backed');
check(text('apps/mobile/src/services/session.ts').includes('profileLimit'),'Mobile profile limit is not shared');

// Design parity: two visual families, one shared category order and palette.
const mobileLayout=brand.layouts.mobile;
const desktopLayout=brand.layouts.tvDesktop;
check(mobileLayout?.bottomTabs?.join('|')==='movies|series|home|anime|animeMovies','Native/PWA bottom-tab contract changed');
check(mobileLayout?.categoryOrder?.join('|')===desktopLayout?.categoryOrder?.join('|'),'Mobile and TV category orders differ');
check(brand.navigation.favorites==='Meine Liste','Shared My List category missing');
const webMain=text('apps/web/main.js');
const webStyles=text('apps/web/style.css');
const mobileHeader=text('apps/mobile/src/components/VelarisHeader.tsx');
const mobileHome=text('apps/mobile/app/(tabs)/home.tsx');
const tvMain=text('apps/tv/app/src/main/java/com/novarion/velaristv/MainActivity.kt');
check(webMain.includes("const VELARIS_MOBILE_TABS=['movies','series','home','anime','animeMovies']"),'PWA five bottom tabs do not match Expo');
check(webMain.includes('VELARIS_CATEGORIES') && webMain.includes('mobile-categories'), 'PWA categories strip missing');
check(webStyles.includes('.shell>.mobile-navigation') && webStyles.includes('.shell>.desktop-navigation'), 'PWA responsive navigation CSS missing');
check(mobileHeader.includes("key:'favorites',label:design.navigation.favorites,href:'/favorites'"), 'Native My List navigation missing');
check(text('apps/mobile/app/favorites.tsx').includes('getFavorites(session)'), 'Native My List route missing');
check(mobileHome.includes("alignItems: 'flex-start', width:'100%'"),'Mobile hero must align with PWA');
check(tvMain.includes('"Meine Liste" to navButton("Meine Liste"){showFavorites()}'), 'TV My List navigation missing');
const categoryOrder=desktopLayout.categoryOrder;
for(const key of categoryOrder){
 check(brand.categoryAccents[key], 'Missing category accent: '+key);
}
const nativeOrder=['home','movies','series','anime','animeMovies','animation','cartoons','favorites','collections'];
const mobilePositions=nativeOrder.map(key=>mobileHeader.indexOf("key:'"+key+"'"));
check(mobilePositions.every(x=>x>=0)&&mobilePositions.every((x,i)=>i===0||x>mobilePositions[i-1]),'Native mobile category order differs from design contract');
const tvNames=['"home"','"movies"','"series"','"anime"','"animeMovies"','"animation"','"cartoons"','"Meine Liste"','"collections"'];
const tvNavSection=tvMain.slice(tvMain.indexOf('        listOf('),tvMain.indexOf('        ).forEach { (label,button) ->'));
const tvPositions=tvNames.map(name=>tvNavSection.indexOf(name));
check(tvPositions.every(x=>x>=0)&&tvPositions.every((x,i)=>i===0||x>tvPositions[i-1]),'TV navigation differs from desktop category order');

if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Velaris unified contract and '+pairs.length+' asset mappings validated.');
