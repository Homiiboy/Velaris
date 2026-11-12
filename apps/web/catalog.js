/* Jellyfin catalog: complete paging and library-backed categories. */
const VELARIS_PAGE_SIZE=200;
const VELARIS_CATEGORY_KEYS=['movies','series','anime','animeMovies','animation','cartoons'];
function velarisFold(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
}
function velarisLibraryKind(view){
 const name=velarisFold(view?.Name);
 const aliases={
  animeMovies:['animefilme','animemovies','animefilms','animemovie','animefilm'],
  anime:['anime','animes','animeserien','animeseries'],
  animation:['animation','animations','animationsfilme','animationsserien'],
  cartoons:['cartoons','cartoon','zeichentrick','zeichentrickfilme','zeichentrickserien'],
  movies:['filme','film','movies','movie','kinofilme'],
  series:['serien','serie','series','tvshows','tvseries','shows']
 };
 for(const kind of VELARIS_CATEGORY_KEYS)if(aliases[kind].includes(name))return kind;
 if(view?.CollectionType==='movies')return 'movies';
 if(view?.CollectionType==='tvshows')return 'series';
 return null;
}
async function velarisPaged(fetchPage,limit=VELARIS_PAGE_SIZE){
 const results=[],seen=new Set();let start=0,total=null;
 for(let page=0;page<500;page++){
  const response=await fetchPage(start,limit);
  const items=Array.isArray(response?.Items)?response.Items:[];
  const supplied=response?.TotalRecordCount==null?NaN:Number(response.TotalRecordCount);
  if(Number.isFinite(supplied)&&supplied>=0)total=supplied;
  let added=0;
  for(const item of items){
   if(!item?.Id||seen.has(String(item.Id)))continue;
   seen.add(String(item.Id));results.push(item);added++;
  }
  start+=items.length;
  if(!items.length||!added||(total!==null&&start>=total)||(total===null&&items.length<limit))break;
 }
 return results;
}
function velarisIsAnime(item){
 return [...(item.Genres||[]),...(item.Tags||[])].some(v=>/anime/i.test(String(v)));
}
function velarisBuildCategories(items,libraries){
 const buckets=Object.fromEntries(VELARIS_CATEGORY_KEYS.map(k=>[k,new Set()]));
 const mapped=new Set();
 for(const library of libraries||[]){
  if(!library.kind)continue;
  for(const item of library.items||[]){
   if(!item?.Id)continue;
   // Jellyfin library membership wins over genre guesses.
   const id=String(item.Id);
   if(library.kind==='movies'&&item.Type!=='Movie')continue;
   if(library.kind==='series'&&item.Type!=='Series')continue;
   if(library.kind==='anime'&&item.Type!=='Series')continue;
   if(library.kind==='animeMovies'&&item.Type!=='Movie')continue;
   if(!['Movie','Series'].includes(item.Type))continue;
   mapped.add(id);buckets[library.kind].add(id);
  }
 }
 // For nonstandard/unmapped libraries, keep all titles visible using fallback
 // metadata. Never reassign a known library title because of genre names.
 for(const item of items||[]){
  if(!item?.Id||mapped.has(String(item.Id)))continue;
  const anime=velarisIsAnime(item);
  const kind=item.Type==='Movie'?(anime?'animeMovies':'movies'):
   item.Type==='Series'?(anime?'anime':'series'):null;
  if(kind)buckets[kind].add(String(item.Id));
 }
 const result={};
 for(const kind of VELARIS_CATEGORY_KEYS)result[kind]=(items||[])
  .filter(item=>buckets[kind].has(String(item.Id)))
  .sort((a,b)=>String(a.SortName||a.Name||'').localeCompare(String(b.SortName||b.Name||''),'de',{sensitivity:'base',numeric:true}));
 return result;
}
