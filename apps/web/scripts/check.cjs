#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const f of ['index.html','main.js','catalog.js','player9.js','cast9.js','style.css','sw.js','manifest.webmanifest','icon.svg','Dockerfile','nginx.conf','cast-bridge.js','cast-bridge/server.py','cast-bridge/Dockerfile','cast-bridge/requirements.txt']){
 assert(fs.existsSync(path.join(root,f)), 'Missing '+f);
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.start_url,'./');
assert(manifest.icons.some(i=>i.src==='icon.svg'));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const file of ['main.js','player9.js','style.css','manifest.webmanifest','icon.svg'])assert(html.includes(file),'index missing '+file);
const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
for(const file of ['index.html','main.js','style.css','manifest.webmanifest','icon.svg'])assert(sw.includes(file),'service worker missing '+file);
console.log('Velaris Web: asset, manifest and service-worker checks passed.');

// Release-polish regression guards for the web-only runtime.
const runtime=fs.readFileSync(path.join(root,'main.js'),'utf8');
const player=fs.readFileSync(path.join(root,'player9.js'),'utf8');
for(const token of ['activeView(revision,account.userId)','viewRevision++','p8Collection','function logout'])assert(runtime.includes(token),'release guard missing: '+token);
for(const token of ['const doClose=','p9Play(target)','video.removeAttribute(\'src\')','p9NextEpisode','p9Segments'])assert(player.includes(token),'player guard missing: '+token);

// UI action wiring guard: the hero player and all main interactive surfaces must remain usable.
const playerScriptIndex=html.indexOf('<script src="./player9.js" defer>');
const mainScriptIndex=html.indexOf('<script src="./main.js" defer>');
assert(playerScriptIndex>=0&&mainScriptIndex>playerScriptIndex,'Player and app scripts must share the classic script global scope in order');
for(const token of [
 'mount.onclick=event=>','dots.onclick=event=>','data-hero-action="play"','data-hero-action="details"',
 'function profilePicker()','[data-profile]','add-profile','remove-profile',
 'data-tab','data-item','function p8Customize()','data-move','data-color','data-toggle',
 'function searchUI()','function detail(id)','season-select','data-episode','detail-play',
 'p8-collection-back','p8-play','p8-detail','p8-fav',
 'heroAction=async(action,item)','EnableUserData=true&IsMissing=false'
]) assert(runtime.includes(token),'UI action wiring missing: '+token);
for(const token of ['#p9-close','#p9-rewind','#p9-forward','#p9-toggle','#p9-quality-button','#p9-retry','#p9-next-start','#p9-skip'])assert(player.includes(token),'player action missing: '+token);
const stylesheet=fs.readFileSync(path.join(root,'style.css'),'utf8');
assert(stylesheet.includes('.hero-stage .hero-copy .actions button'),'Hero buttons need a foreground hit area');
console.log('Velaris Web: UI action wiring checks passed.');

// Series episode taps must reach the player without awaiting a Jellyfin request.
assert(runtime.includes('const episodesById=new Map(episodes.map(ep=>[String(ep.Id),ep]))'),'Episode detail must reuse loaded Jellyfin results');
assert(runtime.includes('const ep=episodesById.get(b.dataset.episode)'),'Episode click must resolve immediately');
assert(runtime.includes('try{play(ep)}'),'Episode playback must start inside the click handler');
assert(!runtime.includes("b.onclick=async()=>"),'Episode click must not await a request before opening the player');
console.log('Velaris Web: direct episode playback wiring passed.');

/* Regression coverage for profile navigation, optional home rows and next-episode ordering. */
assert(runtime.includes('function profilePicker(){stopHero();viewRevision++'),'Profile picker must invalidate pending page loads');
assert(runtime.includes('function auth(){stopHero();viewRevision++'),'Login must invalidate pending page loads');
assert(runtime.includes('Promise.allSettled(['),'Optional Jellyfin rows must not break the full library');
assert(player.includes('p9NextEpisode(item,currentSession)'),'Next episode must use the original player profile');

const vm=require('node:vm');
const sandbox={
 api:async(_path,_opts,account)=>{
  assert.equal(account.userId,'test-user');
  return {Items:[
   {Id:'episode-3',Type:'Episode',ParentIndexNumber:1,IndexNumber:3},
   {Id:'episode-1',Type:'Episode',ParentIndexNumber:1,IndexNumber:1},
   {Id:'episode-2',Type:'Episode',ParentIndexNumber:1,IndexNumber:2},
   {Id:'episode-4',Type:'Episode',ParentIndexNumber:1,IndexNumber:4,IsMissing:true}
  ]};
 },
 session:()=>({userId:'test-user',url:'https://example.invalid'}),
 encodeURIComponent
};
vm.createContext(sandbox);
vm.runInContext(player,sandbox,{filename:'player9.js'});
(async()=>{
 const next=await vm.runInContext("p9NextEpisode({Id:'episode-1',SeriesId:'series-1'})",sandbox);
 assert.equal(next?.Id,'episode-2','Next episode must be ordered, even when Jellyfin results are unsorted');
 const last=await vm.runInContext("p9NextEpisode({Id:'episode-3',SeriesId:'series-1'})",sandbox);
 assert.equal(last,null,'Unavailable episodes must be skipped');
 console.log('Velaris Web: player and profile regression checks passed.');
})().catch(error=>{console.error(error);process.exitCode=1});

/* Playback contract from the native Expo app, adapted for HTML video elements. */
for(const token of [
 "async function p9PlaybackInfo(item,quality,account)",
 "EnableDirectPlay:true,EnableDirectStream:true,EnableTranscoding:true",
 "media?.MediaSources?.[0]",
 "source?.TranscodingUrl",
 "source?.DirectStreamUrl",
 "MediaSourceId:playbackInfo?.MediaSources?.[0]?.Id",
 "PlaySessionId:playbackInfo?.PlaySessionId",
 "const hls=/\\.m3u8(?:\\?|$)/i.test(negotiated);"
])assert(player.includes(token),'Mobile playback negotiation missing: '+token);
const negotiatedSandbox={
 api:async(path,options,account)=>{
  assert.equal(account.userId,'test-user');
  assert.match(path,/PlaybackInfo/);
  assert.equal(options.method,'POST');
  const body=JSON.parse(options.body);
  assert.equal(body.EnableTranscoding,true);
  return {PlaySessionId:'play-session',MediaSources:[{Id:'media-source',TranscodingUrl:'/Videos/movie-1/master.m3u8?MediaSourceId=media-source'}]};
 },
 base:account=>account.url,
 session:()=>({userId:'test-user',url:'https://jellyfin.example',token:'test-token'}),
 URL,URLSearchParams,encodeURIComponent
};
vm.createContext(negotiatedSandbox);
vm.runInContext(player,negotiatedSandbox,{filename:'player9.js'});
(async()=>{
 const info=await vm.runInContext("p9PlaybackInfo({Id:'movie-1'},'auto',session())",negotiatedSandbox);
 assert.equal(info.PlaySessionId,'play-session');
 const url=vm.runInContext("p9Stream({Id:'movie-1'},'auto',session(),"+JSON.stringify(info)+")",negotiatedSandbox);
 assert.match(url,/master\.m3u8/);
 assert.match(url,/api_key=test-token/);
 const mp4=vm.runInContext("p9Stream({Id:'movie-1'},'auto',session(),"+JSON.stringify(info)+",true)",negotiatedSandbox);
 assert.match(mp4,/stream\.mp4/);
 assert.match(mp4,/MediaSourceId=media-source/);
 assert.match(mp4,/PlaySessionId=play-session/);
 // A TS/MKV source with no negotiated URL must select HLS, never a raw
 // browser-incompatible stream or immediate MP4-only fallback.
 const mkv={PlaySessionId:'mkv-session',MediaSources:[{Id:'mkv-source',Container:'mkv',SupportsDirectPlay:true}]};
 const mkvUrl=vm.runInContext("p9Stream({Id:'movie-1'},'auto',session(),"+JSON.stringify(mkv)+")",negotiatedSandbox);
 assert.match(mkvUrl,/master\.m3u8/);
 assert.match(mkvUrl,/TranscodingContainer=ts/);
 assert.match(mkvUrl,/MediaSourceId=mkv-source/);
 const ts={MediaSources:[{Id:'ts-source',Container:'ts'}]};
 const tsUrl=vm.runInContext("p9Stream({Id:'movie-1'},'auto',session(),"+JSON.stringify(ts)+")",negotiatedSandbox);
 assert.match(tsUrl,/master\.m3u8/);
 console.log('Velaris Web: negotiated playback URLs passed.');
})().catch(error=>{console.error(error);process.exitCode=1});

/* HLS integration safety guards: library must load before the player and
 * every active engine must be cleaned up when the user closes playback. */
const hlsScriptIndex=html.indexOf('hls.js@1.7.3/dist/hls.min.js');
assert(hlsScriptIndex>=0&&hlsScriptIndex<playerScriptIndex,'hls.js must load before player9.js');
for(const token of [
 "const mseHls=()=>",
 "new Hls({",
 "xhrSetup:xhr=>xhr.setRequestHeader('X-Emby-Token',currentSession.token)",
 "Hls.Events.MANIFEST_PARSED",
 "Hls.Events.ERROR",
 "hlsEngine.destroy()",
 "streamGeneration++",
 "if(!fallback){"
])assert(player.includes(token),'HLS browser playback or cleanup guard missing: '+token);
console.log('Velaris Web: HLS browser playback wiring passed.');

assert(player.includes(String.raw`const isHls=/\.m3u8(?:\?|$)/i.test(url)`),'HLS stream detector must match .m3u8 with query parameters');

/* Startup optimization must not change negotiated HLS or the MP4 fallback.
 * PlaybackInfo is cached in memory only and invalidated after 20 seconds. */
for(const token of [
 'const P9_INFO_CACHE=new Map()',
 'now-cached.at<20000',
 'return cached.promise',
 'startFragPrefetch:true',
 'try{media=await p9Warmup(item,currentSession,quality)}'
])assert(player.includes(token),'Safe playback warmup guard missing: '+token);
for(const token of [
 'if(canPlay)void p9Warmup(item,account).catch(()=>{})',
 "b.addEventListener('pointerenter',warm,{once:true})",
 "b.addEventListener('focus',warm,{once:true})",
 'try{play(ep)}'
])assert(runtime.includes(token),'Detail/episode playback warmup guard missing: '+token);
console.log('Velaris Web: quick-start warmup guards passed.');

/* Diagnose the slow-start stage without leaking any auth tokens or URLs. */
for(const token of [
 'startupAt=performance.now()',
 'infoReadyAt=performance.now()',
 'mediaRequestedAt=performance.now()',
 "hlsEngine.on(Hls.Events.MANIFEST_PARSED",
 "video.addEventListener('loadeddata',reportStartup",
 'streamToFirstFrameSeconds',
 'playbackInfoSeconds',
 "playerMessage(detail)"
])assert(player.includes(token),'Player timing diagnostic missing: '+token);
console.log('Velaris Web: player startup diagnostics wiring passed.');

/* Google Cast SDK and sender contract. It must not break HLS local playback. */
const castSender=fs.readFileSync(path.join(root,'cast9.js'),'utf8');
const castScriptIndex=html.indexOf('<script src="./cast9.js" defer>');
assert(castScriptIndex>=0&&castScriptIndex<playerScriptIndex,'Cast controller must load before player');
assert(!html.includes('cast_sender.js?loadCastFramework=1'),'Google Cast SDK must not block iPhone page load');
assert(castSender.includes("script.src='https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1'"),'SDK must be loaded only on eligible clients');
assert(castSender.includes('if(!p9CastClientEligible())return;'),'Cast SDK must not load on Safari/iOS');
assert(sw.includes('cast9.js'),'Cast sender script must be included in the PWA shell');
for(const token of [
 "window.__onGCastApiAvailable=isAvailable=>",
 "receiverApplicationId:P9_CAST_RECEIVER_ID",
 "window.cast.framework.CastContext.getInstance()",
 "await castContext.requestSession()",
 "new window.chrome.cast.media.MediaInfo(",
 "new window.chrome.cast.media.LoadRequest(media)",
 "await session.loadMedia(request)",
 "controller.playOrPause()",
 "controller.seek()",
 "controller?.stop()",
 "p9CastReadyListeners.delete(ready)"
])assert(castSender.includes(token),'Missing Cast sender lifecycle contract: '+token);
for(const token of [
 "id=\"p9-cast-button\"",
 "id=\"p9-cast-stop\"",
 "castCtrl=p9CastController({",
 "video.pause();castStop.hidden=false",
 "castCtrl?.close()",
 "castCtrl?.isCasting()",
 "report('Stopped',position)"
])assert(player.includes(token),'Cast player integration missing: '+token);
new vm.Script(castSender,{filename:'cast9.js'});
new vm.Script(player,{filename:'player9.js'});
console.log('Velaris Web: Google Cast sender and local HLS syntax checks passed.');

/* Safari playback regression: no unsupported Cast SDK request, and a visible
 * manual start when native autoplay is delayed or blocked. */
for(const token of [
 "if(!p9CastClientEligible())castButton.hidden=true",
 "if(isIos){retry.hidden=false;retry.textContent='▶ Wiedergabe starten'}",
 "startupTimer=setTimeout(",
 "if(isIos&&sourceUrl&&video.paused){",
 "clearStartupTimer();retry.hidden=true",
 "const isHls=/\\.m3u8(?:\\?|$)/i.test(url)"
])assert(player.includes(token),'iPhone playback regression guard missing: '+token);
assert(castSender.includes("!/iPad|iPhone|iPod|Android/i.test(ua)"),'No Cast SDK on iOS');
console.log('Velaris Web: Safari HLS and Cast isolation guards passed.');

/* Jellyfin catalog completeness and folder-based category regression tests. */
const catalogScript=fs.readFileSync(path.join(root,'catalog.js'),'utf8');
new vm.Script(catalogScript,{filename:'catalog.js'});
const catContext={console,URLSearchParams};
vm.createContext(catContext);
vm.runInContext(catalogScript,catContext,{filename:'catalog.js'});
assert(html.includes('<script src="./catalog.js" defer>'),'Catalog helper must load before main UI');
assert(html.indexOf('catalog.js')<html.indexOf('<script src="./main.js"'),'Catalog script order is wrong');
assert(sw.includes('catalog.js'),'PWA must cache catalog helper');
assert(runtime.includes("velarisPaged((start,limit)=>page("),'Main library must be paginated');
assert(runtime.includes('velarisBuildCategories(items,successful)'),'Categories must use Jellyfin library membership');
assert(!runtime.includes('Limit=250'),'Main catalog must not be truncated to 250 results');
for(const [library,expected] of [
 ['Anime Filme','animeMovies'],['Anime','anime'],['Filme','movies'],
 ['Serien','series'],['Animation','animation'],['Cartoons','cartoons']
]){
 const result=vm.runInContext("velarisLibraryKind({Name:"+JSON.stringify(library)+"})",catContext);
 assert.equal(result,expected,library+' mapping mismatch');
}
const memberCases=[
 {Id:'film1',Name:'Film',Type:'Movie',Genres:['Anime']},
 {Id:'animeFilm1',Name:'Anime Film',Type:'Movie',Genres:['Action']},
 {Id:'series1',Name:'Serie',Type:'Series',Genres:['Anime']},
 {Id:'anime1',Name:'Anime Serie',Type:'Series',Genres:[]},
 {Id:'animation1',Name:'Animation',Type:'Movie',Genres:[]},
 {Id:'fallback1',Name:'Unbekannte Serie',Type:'Series',Genres:['Anime']}
];
const libraryMembership=[
 {kind:'movies',items:[memberCases[0]]},
 {kind:'animeMovies',items:[memberCases[1]]},
 {kind:'series',items:[memberCases[2]]},
 {kind:'anime',items:[memberCases[3]]},
 {kind:'animation',items:[memberCases[4]]}
];
catContext.members=memberCases;catContext.libraries=libraryMembership;
const categorized=vm.runInContext('velarisBuildCategories(members,libraries)',catContext);
const titles=key=>Array.from(categorized[key],x=>x.Id);
assert.deepEqual(titles('movies'),['film1'],'Known movie folder must override anime genre');
assert.deepEqual(titles('animeMovies'),['animeFilm1'],'Anime film folder must override missing tags');
assert.deepEqual(titles('series'),['series1'],'Known series folder must override anime genre');
assert.deepEqual(titles('anime'),['anime1','fallback1'],'Unmapped anime series use metadata fallback');
assert.deepEqual(titles('animation'),['animation1']);
(async()=>{
 const all=Array.from({length:437},(_,i)=>({Id:'id-'+i}));
 catContext.pages=(start,limit)=>({Items:all.slice(start,start+limit),TotalRecordCount:all.length});
 const paged=await vm.runInContext('velarisPaged(pages,200)',catContext);
 assert.equal(paged.length,437,'Pagination must return all 437 items');
 assert.equal(paged[436].Id,'id-436');
 console.log('Velaris Web: library category mapping and pagination passed.');
})().catch(error=>{console.error(error);process.exitCode=1});

/* Main screen should render as soon as Jellyfin delivers the first page.
 * Loading category memberships, the rest of the catalog or favorites must not
 * keep the skeleton visible indefinitely. */
for(const token of [
 "const first=await page(",
 "state.items=initial;",
 "state.categories=velarisBuildCategories(initial,initialLibraries);",
 "render();",
 "void (async()=>{",
 "state.items=Array.from(combined.values());",
 "let firstViewRevision=viewRevision;",
 "state.categories=velarisBuildCategories(state.items,[...initialLibraries,...libraries]);"
])assert(runtime.includes(token),'Progressive catalog loading guard missing: '+token);
assert(runtime.indexOf('state.items=initial;')<runtime.indexOf('const memberships=await Promise.allSettled(recognized.map'),'First page must render before library membership lookup');
assert(catalogScript.includes('response?.TotalRecordCount==null?NaN'),'Missing total record count must not be interpreted as zero');
(async()=>{
 const many=Array.from({length:405},(_,i)=>({Id:'no-total-'+i}));
 catContext.withoutTotal=(start,limit)=>({Items:many.slice(start,start+limit),TotalRecordCount:null});
 const result=await vm.runInContext('velarisPaged(withoutTotal,200)',catContext);
 assert.equal(result.length,405,'Catalog with null TotalRecordCount must still paginate');
 console.log('Velaris Web: progressive display and null-count pagination passed.');
})().catch(error=>{console.error(error);process.exitCode=1});

/* iOS native playback must keep the first video.play() in the tap gesture.
 * No PlaybackInfo await is allowed before setting the Safari media URL. */
for(const token of [
 'if(isIos&&nativeHls){',
 'activateStream(p9Stream(item,quality,currentSession,null),position)',
 'video.src=url;',
 'video.load();',
 'tryPlay();',
 "retry.dataset.forceMp4=isIos?'1':''",
 "if(isIos&&nativeHls&&(retry.dataset.forceMp4==='1'"
])assert(player.includes(token),'Safari synchronous playback or fallback missing: '+token);
const iosPathStart=player.indexOf('if(isIos&&nativeHls){',player.indexOf('const source=async'));
const iosPathEnd=player.indexOf('\n  clearStartupTimer();',iosPathStart+10);
const iosPath=player.slice(iosPathStart,iosPathEnd);
assert(iosPath.includes('activateStream('),'iOS should start native HLS immediately');
assert(!iosPath.includes('await '),'iOS must not await a network request before playback');
console.log('Velaris Web: synchronous iPhone HLS start regression guards passed.');

/* Safari regression diagnostics: the player must surface meaningful video
 * readiness states and attempt one MP4 fallback when native HLS stalls. */
for(const token of [
 'id="p9-diagnostics"',
 "diagnostics.textContent='Player: '+stage",
 'video.networkState',
 'video.readyState',
 "stageUpdate('Stream angefordert')",
 "stageUpdate('Safari-HLS wird geladen'",
 'if(isIos&&!fallback){',
 "p9Stream(item,quality,currentSession,playbackInfo,true)",
 "playerMessage('Safari: MP4-Ersatzstream wird geladen …')",
 "for(const eventName of ['loadstart','loadedmetadata','loadeddata','canplay','waiting','stalled','suspend','emptied'])"
])assert(player.includes(token),'Safari diagnostics / stalled-HLS recovery missing: '+token);
console.log('Velaris Web: Safari media state diagnosis and automatic recovery guards passed.');

/* Jellyfin 10.11.11 regression: /Users/{id}/Items?Recursive=true
 * can return zero although /Items returns actual library titles. */
for(const token of [
 "let globalItemsFallback=false;",
 "const globalPath='/Items?'+query;",
 "if(globalItemsFallback)return api(globalPath,{},account);",
 "const primary=await api(root+'?'+query,{},account);",
 "const alternative=await api(globalPath,{},account);",
 "if((alternative.Items||[]).length){",
 "globalItemsFallback=true;",
 "return alternative;"
])assert(runtime.includes(token),'Jellyfin empty user-scoped catalog fallback missing: '+token);
assert(runtime.indexOf("const first=await page(")>runtime.indexOf("let globalItemsFallback=false;"),
 'Fallback must be enabled before the first page is requested');
console.log('Velaris Web: Jellyfin 10.11 empty user-scoped catalog fallback guards passed.');

/* Recover real Jellyfin media after a zero-result global query by inspecting
 * the authenticated user's library folders; do not erase folder results when
 * the delayed global query also returns zero. */
for(const token of [
 "query.set('UserId',account.userId);",
 "const views=await api('/Users/'+u+'/Views',{},account);",
 "api('/Items?'+new URLSearchParams({...extra,UserId:account.userId",
 "initial=Array.from(unique.values());",
 "state.catalogStatus+=' Bibliotheksabfrage: '",
 "state.items=Array.from(combined.values());",
 "state.categories=velarisBuildCategories(state.items,[...initialLibraries,...libraries]);",
 "id=\\\"catalog-status\\\""
])assert(runtime.includes(token),'Folder-first Jellyfin catalog recovery missing: '+token);
console.log('Velaris Web: user-bound Jellyfin folder recovery guards passed.');

/* The production nginx image MUST include every local script from index.html.
 * The Dockerfile previously omitted catalog.js and cast9.js even while the
 * main application and index.html were at the newest version. */
const dockerfile=fs.readFileSync(path.join(root,'Dockerfile'),'utf8');
const localScripts=Array.from(html.matchAll(/<script[^>]+src="(\.\/[^"]+)"[^>]*><\/script>/g),match=>match[1].slice(2));
const dockerCopy=dockerfile.match(/^COPY\s+([^\n]+)\s+\/usr\/share\/nginx\/html\//m);
assert(dockerCopy,'Dockerfile must copy static assets into nginx');
const copied=new Set(dockerCopy[1].trim().split(/\s+/));
for(const localScript of localScripts)assert(copied.has(localScript),
 'Production Docker image is missing '+localScript);
for(const asset of ['index.html','style.css','manifest.webmanifest','sw.js','icon.svg']){
 assert(copied.has(asset),'Production Docker image is missing '+asset);
}
console.log('Velaris Web: Docker production asset parity passed.');

/* Safari: request Jellyfin's real MediaSourceId and PlaySessionId asynchronously
 * while preserving immediate play in the original user gesture. */
for(const token of [
 "media?.MediaSources?.[0]||item.MediaSources?.[0]",
 "const iosGeneration=streamGeneration;",
 "void p9Warmup(item,currentSession,quality).then(info=>{",
 "playbackInfo=info;",
 "p9Stream(item,quality,currentSession,info,true)",
 "castButton.style.display='none'"
])assert(player.includes(token),'iOS Jellyfin negotiated fallback missing: '+token);
const safariSource=player.slice(player.indexOf('if(isIos&&nativeHls){',player.indexOf('const source=async')),player.indexOf('\n  clearStartupTimer();',player.indexOf('if(isIos&&nativeHls){',player.indexOf('const source=async'))+10));
assert(!safariSource.includes('await '),'Native iOS player must remain gesture synchronous');
console.log('Velaris Web: iOS source negotiation and fallback checks passed.');

/* Regression rollback: iPhone must use the working pre-Chromecast player,
 * without disabling Chromecast for desktop browsers. */
const classic=fs.readFileSync(path.join(root,'player9-classic.js'),'utf8');
assert(html.includes('<script src="./player9-classic.js" defer></script>'),'Load pre-Cast player before current player');
assert(classic.includes('const p9PlayClassic=(()=>{'),'Pre-Cast implementation must be isolated');
assert(classic.includes('return p9Play;'),'Pre-Cast implementation must expose its own play entrypoint');
assert(player.includes("typeof p9PlayClassic==='function')return p9PlayClassic(item)"),'iPhone playback must use classic player');
assert(!classic.includes('p9CastController('),'Classic player must not require Cast SDK');
assert(sw.includes('player9-classic.js'),'PWA must cache classic player');
console.log('Velaris Web: iPhone pre-Chromecast player rollback checks passed.');

/* AirPlay must be opt-in only when WebKit reports a nearby receiver.
 * It must never replace the proven iPhone stream creation code. */
for(const token of [
 'id="p9-airplay-button" type="button" hidden',
 "typeof video.webkitShowPlaybackTargetPicker==='function'",
 "'webkitplaybacktargetavailabilitychanged'",
 "event?.availability==='available'",
 "video.webkitShowPlaybackTargetPicker()"
])assert(classic.includes(token),'iPhone optional AirPlay control missing: '+token);
assert(classic.includes('return base(account)+\'/Videos/\'+id+\'/master.m3u8?\'+params'),
 'Original iOS HLS stream request unexpectedly changed');
console.log('Velaris Web: safe optional AirPlay and original stream regression guards passed.');

/* Separate Chromecast bridge must not change working iPhone player. */
const bridgeUi=fs.readFileSync(path.join(root,'cast-bridge.js'),'utf8');
const bridgePy=fs.readFileSync(path.join(root,'cast-bridge/server.py'),'utf8');
const bridgeNginx=fs.readFileSync(path.join(root,'nginx.conf'),'utf8');
const bridgeCompose=fs.readFileSync(path.join(root,'compose.yaml'),'utf8');
for(const token of ["X-Velaris-Jellyfin-Token","/api/cast/","velaris-cast-dialog","itemId:item.Id","'control'"]){
 assert(bridgeUi.includes(token),'Cast Bridge web UI missing '+token);
}
for(const token of ['jellyfin_get("/Users/Me", token)','device_for(device_id, user_id','_ACTIVE[device_id] = user_id','JELLYFIN_CAST_URL','pychromecast.get_chromecasts(','cast.media_controller.play_media(']){
 assert(bridgePy.includes(token),'Cast Bridge access control or discovery missing '+token);
}
assert(html.includes('cast-bridge.js'),'Cast Bridge browser script missing');
assert(runtime.includes('VelarisCastBridge.open(item,account)'),'Cast Bridge details action missing');
assert(runtime.includes('velaris-cast-open'),'Cast Bridge details button missing');
assert(bridgeNginx.includes('location /api/cast/')&&bridgeNginx.includes('host.docker.internal:8766'),'Nginx Cast Bridge proxy missing');
assert(bridgeCompose.includes('network_mode: host')&&bridgeCompose.includes('host.docker.internal:host-gateway'),'Docker Cast Bridge discovery routing missing');
console.log('Velaris Web: authenticated LAN Cast Bridge guards passed.');
