import { jellyfinAuthorizationHeader } from '@/lib/device';
import type { JellyfinAuthResponse,JellyfinItem,JellyfinItemsResponse,JellyfinPlaybackInfo,JellyfinServerInfo,Session } from '@/types/jellyfin';
export function normalizeServerUrl(value:string){let v=value.trim().replace(/\/+$/,'');if(v&&!/^https?:\/\//i.test(v))v='http://'+v;return v;}
async function request<T>(url:string,init?:RequestInit,timeout=12000):Promise<T>{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{...init,signal:controller.signal});if(!response.ok){let detail='';try{detail=(await response.text()).trim()}catch{}const suffix=detail?`: ${detail.slice(0,500)}`:'';const e=new Error(`Jellyfin request failed (${response.status})${suffix}`);(e as Error&{status?:number}).status=response.status;throw e;}if(response.status===204)return undefined as T;return response.json() as Promise<T>;}catch(e){if(e instanceof Error&&e.name==='AbortError')throw new Error('Server nicht erreichbar. Bitte Adresse und Netzwerk prüfen.');throw e;}finally{clearTimeout(timer);}}
function authHeaders(s:Session){return{Authorization:jellyfinAuthorizationHeader(),'X-Emby-Token':s.accessToken};}
function itemFields(){return'Overview,Genres,PrimaryImageAspectRatio,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks,MediaStreams,MediaSources,Container,ImageTags,BackdropImageTags,DateCreated';}
export async function getPublicSystemInfo(u:string){return request<JellyfinServerInfo>(`${normalizeServerUrl(u)}/System/Info/Public`,undefined,8000);}
export async function authenticate(u:string,username:string,password:string):Promise<Session>{const base=normalizeServerUrl(u),auth=await request<JellyfinAuthResponse>(`${base}/Users/AuthenticateByName`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:jellyfinAuthorizationHeader()},body:JSON.stringify({Username:username.trim(),Pw:password})});return{serverUrl:base,accessToken:auth.AccessToken,user:auth.User,serverId:auth.ServerId};}
async function getItems(s:Session,v:Record<string,string>){const p=new URLSearchParams({Fields:itemFields(),EnableImages:'true',ImageTypeLimit:'1',EnableImageTypes:'Primary,Backdrop',EnableUserData:'true',...v});return request<JellyfinItemsResponse>(`${s.serverUrl}/Users/${s.user.Id}/Items?${p}`,{headers:authHeaders(s)});}
export function getLibrary(s:Session){return getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series',SortBy:'SortName',SortOrder:'Ascending',Limit:'300'});}
export function getLatest(s:Session){return getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series',SortBy:'DateCreated',SortOrder:'Descending',Limit:'30'});}
export type MediaLibraryKind='movies'|'series'|'anime'|'animeMovies';
type JellyfinView={Id:string;Name:string;CollectionType?:string};
type JellyfinViewsResponse={Items:JellyfinView[];TotalRecordCount?:number};

export async function getMediaLibraries(s:Session){
 return request<JellyfinViewsResponse>(`${s.serverUrl}/Users/${s.user.Id}/Views`,{headers:authHeaders(s)});
}
function normalizeLibraryName(name:string){return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');}
function libraryAliases(kind:MediaLibraryKind){
 switch(kind){
  case 'movies': return ['filme','movies','movie'];
  case 'series': return ['serien','series','tvshows','shows'];
  case 'anime': return ['anime','animes','animeserien','animeseries'];
  case 'animeMovies': return ['animemovies','animefilme','animefilms','animefilme'];
 }
}
function findLibrary(views:JellyfinView[],kind:MediaLibraryKind){
 const aliases=libraryAliases(kind);
 return views.find(v=>aliases.includes(normalizeLibraryName(v.Name)));
}
export async function getLibraryItems(s:Session,kind:MediaLibraryKind){
 const views=await getMediaLibraries(s);
 const library=findLibrary(views.Items,kind);
 if(!library) return {Items:[],TotalRecordCount:0} as JellyfinItemsResponse;
 const include=kind==='movies'||kind==='animeMovies'?'Movie':'Series';
 return getItems(s,{ParentId:library.Id,Recursive:'true',IncludeItemTypes:include,SortBy:'SortName',SortOrder:'Ascending',Limit:'300'});
}
export function getMovies(s:Session){return getLibraryItems(s,'movies');}
export function getSeries(s:Session){return getLibraryItems(s,'series');}
export function getAnime(s:Session){return getLibraryItems(s,'anime');}
export function getAnimeMovies(s:Session){return getLibraryItems(s,'animeMovies');}
export function searchItems(s:Session,t:string){return getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series,Episode',SearchTerm:t,Limit:'60'});}
export async function getGenres(s:Session){const r=await getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series',Limit:'500'});return [...new Set(r.Items.flatMap(i=>i.Genres??[]))].filter(Boolean).sort((a,b)=>a.localeCompare(b));}
export function getGenreItems(s:Session,genre:string){return getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series',Genres:genre,SortBy:'CommunityRating,SortName',SortOrder:'Descending',Limit:'200'});}
export function getFavorites(s:Session){return getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series',Filters:'IsFavorite',SortBy:'SortName',SortOrder:'Ascending',Limit:'100'});}
export async function setFavorite(s:Session,id:string,favorite:boolean){return request<unknown>(`${s.serverUrl}/Users/${s.user.Id}/FavoriteItems/${id}`,{method:favorite?'POST':'DELETE',headers:authHeaders(s)});}
export function getPlayedItems(s:Session){return getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series',Filters:'IsPlayed',SortBy:'DatePlayed',SortOrder:'Descending',Limit:'20'});}
export function getRecommendations(s:Session,genres:string[],excludeId?:string){const genreIds=genres.slice(0,2).join('|');return getItems(s,{Recursive:'true',IncludeItemTypes:'Movie,Series',SortBy:'CommunityRating,Random',SortOrder:'Descending',Limit:'30',...(genreIds?{Genres:genreIds}:{}),...(excludeId?{ExcludeItemIds:excludeId}:{})});}
export function getCollections(s:Session){return getItems(s,{IncludeItemTypes:'BoxSet',Recursive:'true',SortBy:'SortName',SortOrder:'Ascending',Limit:'200'});}
export function getCollectionItems(s:Session,id:string){return getItems(s,{ParentId:id,Recursive:'true',IncludeItemTypes:'Movie',SortBy:'SortName',SortOrder:'Ascending',Limit:'300'});}
export function getResumeItems(s:Session){const p=new URLSearchParams({UserId:s.user.Id,MediaTypes:'Video',Limit:'30',Fields:itemFields(),EnableImages:'true',ImageTypeLimit:'1',EnableImageTypes:'Primary,Backdrop',EnableUserData:'true'});return request<JellyfinItemsResponse>(`${s.serverUrl}/Items/Resume?${p}`,{headers:authHeaders(s)});}
export function getItem(s:Session,id:string){return request<JellyfinItem>(`${s.serverUrl}/Users/${s.user.Id}/Items/${id}`,{headers:authHeaders(s)});}
export function getSeasons(s:Session,id:string){const p=new URLSearchParams({UserId:s.user.Id,Fields:itemFields(),EnableImages:'true'});return request<JellyfinItemsResponse>(`${s.serverUrl}/Shows/${id}/Seasons?${p}`,{headers:authHeaders(s)});}
export function getEpisodes(s:Session,seriesId:string,seasonId:string){const p=new URLSearchParams({UserId:s.user.Id,SeasonId:seasonId,Fields:itemFields(),EnableImages:'true'});return request<JellyfinItemsResponse>(`${s.serverUrl}/Shows/${seriesId}/Episodes?${p}`,{headers:authHeaders(s)});}
export type MediaSegment={Id?:string;ItemId?:string;Type:string;StartTicks:number;EndTicks:number};
export async function getMediaSegments(s:Session,id:string){try{return await request<{Items?:MediaSegment[]} | MediaSegment[]>(`${s.serverUrl}/MediaSegments/${id}`,{headers:authHeaders(s)});}catch{return [] as MediaSegment[]}}
export function normalizeMediaSegments(value:{Items?:MediaSegment[]}|MediaSegment[]){return Array.isArray(value)?value:(value.Items??[])}
export async function getNextEpisode(s:Session,item:JellyfinItem){if(item.Type!=='Episode'||!item.SeriesId)return null;const p=new URLSearchParams({UserId:s.user.Id,Fields:itemFields(),EnableImages:'true'});const r=await request<JellyfinItemsResponse>(`${s.serverUrl}/Shows/${item.SeriesId}/Episodes?${p}`,{headers:authHeaders(s)});const i=r.Items.findIndex(x=>x.Id===item.Id);return i>=0&&i<r.Items.length-1?r.Items[i+1]:null;}
export async function getPlaybackInfo(s:Session,id:string,a?:number,sub?:number){const body:any={UserId:s.user.Id,AutoOpenLiveStream:true,EnableDirectPlay:true,EnableDirectStream:true,EnableTranscoding:true};if(a!==undefined)body.AudioStreamIndex=a;if(sub!==undefined)body.SubtitleStreamIndex=sub;return request<JellyfinPlaybackInfo>(`${s.serverUrl}/Items/${id}/PlaybackInfo?UserId=${s.user.Id}`,{method:'POST',headers:{...authHeaders(s),'Content-Type':'application/json'},body:JSON.stringify(body)});}
export function buildPlaybackUrl(s:Session,id:string,info:JellyfinPlaybackInfo){const source=info.MediaSources?.[0];if(!source)throw new Error('Keine abspielbare Medienquelle gefunden.');const relative=source.TranscodingUrl||source.DirectStreamUrl;if(relative)return relative.startsWith('http')?relative:`${s.serverUrl}${relative}`;const p=new URLSearchParams({static:'true',mediaSourceId:source.Id,api_key:s.accessToken});return`${s.serverUrl}/Videos/${id}/stream?${p}`;}
type PlaybackEvent={ItemId:string;MediaSourceId?:string;PlaySessionId?:string;PositionTicks:number;IsPaused?:boolean;IsMuted?:boolean;PlayMethod?:'DirectPlay'|'DirectStream'|'Transcode'};
async function playbackEvent(s:Session,path:string,e:PlaybackEvent){await request<void>(`${s.serverUrl}${path}`,{method:'POST',headers:{...authHeaders(s),'Content-Type':'application/json'},body:JSON.stringify(e)});}
export function reportPlaybackStart(s:Session,e:PlaybackEvent){return playbackEvent(s,'/Sessions/Playing',e);}export function reportPlaybackProgress(s:Session,e:PlaybackEvent){return playbackEvent(s,'/Sessions/Playing/Progress',e);}export function reportPlaybackStopped(s:Session,e:PlaybackEvent){return playbackEvent(s,'/Sessions/Playing/Stopped',e);}
export function getPrimaryImageUrl(s:Session,id:string,tag?:string){const p=new URLSearchParams({maxWidth:'600',quality:'92',api_key:s.accessToken});if(tag)p.set('tag',tag);return`${s.serverUrl}/Items/${id}/Images/Primary?${p}`;}export function getBackdropUrl(s:Session,item:JellyfinItem){const p=new URLSearchParams({maxWidth:'1200',quality:'90',api_key:s.accessToken});if(item.BackdropImageTags?.[0])p.set('tag',item.BackdropImageTags[0]);return`${s.serverUrl}/Items/${item.Id}/Images/Backdrop/0?${p}`;}
