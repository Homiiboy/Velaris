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
