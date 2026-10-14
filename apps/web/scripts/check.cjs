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
