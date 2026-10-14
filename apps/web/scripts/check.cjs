#!/usr/bin/env node
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
for(const f of ['index.html','main.js','player9.js','style.css','sw.js','manifest.webmanifest','icon.svg','Dockerfile','nginx.conf']){
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
 console.log('Velaris Web: negotiated playback URLs passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
