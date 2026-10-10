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
check(Object.keys(brand.navigation).join(',')==='home,movies,series,anime,animeMovies,collections','Navigation contract changed');
const sum=file=>crypto.createHash('sha256').update(read(file)).digest('hex');
for(const [source,target] of pairs){
  try{check(sum(source)===sum(target),'Asset differs: '+source+' -> '+target)}
  catch(e){errors.push('Asset missing: '+source+' -> '+target)}
}
check(text('apps/mobile/src/theme.ts').includes('velaris-design/brand.json'),'Mobile is not connected to the brand contract');
check(text('apps/tv/app/build.gradle.kts').includes('packages/velaris-design'),'TV does not package shared brand JSON');
check(text('apps/tv/app/src/main/java/com/novarion/velaristv/MainActivity.kt').includes('saveJellyfinProfile'),'TV profiles are not Jellyfin-backed');
check(text('apps/mobile/src/services/session.ts').includes('profileLimit'),'Mobile profile limit is not shared');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('Velaris unified contract and '+pairs.length+' asset mappings validated.');
