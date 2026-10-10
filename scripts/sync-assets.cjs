const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pairs=require('./asset-map.json');
for(const [source,target] of pairs){
  const src=path.join(root,source),dest=path.join(root,target);
  if(!fs.existsSync(src))throw Error('Missing central asset: '+source);
  fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.copyFileSync(src,dest);
  console.log(source+' -> '+target);
}
console.log('Unified Velaris assets synchronized.');
