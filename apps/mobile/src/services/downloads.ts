import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { JellyfinItem, Session } from '@/types/jellyfin';

export type OfflineItem={id:string;profileId:string;name:string;seriesName?:string;seasonName?:string;indexNumber?:number;type?:string;uri:string;size:number;container:string;downloadedAt:string};
const KEY='velaris.downloads.v1';
const dir=new Directory(Paths.document,'velaris-downloads');
async function all():Promise<OfflineItem[]>{const raw=await SecureStore.getItemAsync(KEY);if(!raw)return[];try{return JSON.parse(raw)}catch{return[]}}
async function save(v:OfflineItem[]){await SecureStore.setItemAsync(KEY,JSON.stringify(v))}
export function profileId(s:Session){return s.serverId+':'+s.user.Id}
export async function getDownloads(s:Session){const list=(await all()).filter(x=>x.profileId===profileId(s));const valid:OfflineItem[]=[];let dirty=false;for(const x of list){try{if(new File(x.uri).exists)valid.push(x);else dirty=true}catch{dirty=true}}if(dirty){const others=(await all()).filter(x=>x.profileId!==profileId(s));await save([...others,...valid])}return valid}
export async function isDownloaded(s:Session,id:string){return (await getDownloads(s)).some(x=>x.id===id)}
function safeContainer(item:JellyfinItem){const raw=(item.MediaSources?.[0]?.Container||item.Container||'mp4').split(',')[0].trim().toLowerCase();return /^[a-z0-9]{2,5}$/.test(raw)?raw:'mp4'}
export async function downloadItem(s:Session,item:JellyfinItem,onProgress?:(v:number)=>void){
 if(!dir.exists)dir.create({intermediates:true});
 const ext=safeContainer(item);
 const dest=new File(dir,`${profileId(s).replace(/[^a-z0-9]/gi,'_')}_${item.Id}.${ext}`);
 if(dest.exists)dest.delete();
 const url=`${s.serverUrl}/Videos/${item.Id}/stream?static=true&api_key=${encodeURIComponent(s.accessToken)}`;
 const task=File.createDownloadTask(url,dest,{headers:{'X-Emby-Token':s.accessToken},onProgress:({bytesWritten,totalBytes})=>onProgress?.(totalBytes>0?Math.min(1,bytesWritten/totalBytes):0)});
 try{
  const file=await task.downloadAsync();
  if(!file)throw new Error('Download wurde unterbrochen.');
  const entry:OfflineItem={id:item.Id,profileId:profileId(s),name:item.Name,seriesName:item.SeriesName,seasonName:item.SeasonName,indexNumber:item.IndexNumber,type:item.Type,uri:file.uri,size:file.size??0,container:ext,downloadedAt:new Date().toISOString()};
  const list=(await all()).filter(x=>!(x.profileId===entry.profileId&&x.id===entry.id));
  list.push(entry);await save(list);onProgress?.(1);return entry;
 }catch(e){if(dest.exists)dest.delete();throw e}
}
export async function removeDownload(s:Session,id:string){const list=await all();const found=list.find(x=>x.profileId===profileId(s)&&x.id===id);if(found){try{const file=new File(found.uri);if(file.exists)file.delete()}catch{}}await save(list.filter(x=>!(x.profileId===profileId(s)&&x.id===id)))}
export function formatBytes(n:number){if(!Number.isFinite(n)||n<=0)return'Größe unbekannt';if(n<1024*1024)return`${Math.max(1,Math.round(n/1024))} KB`;if(n<1024*1024*1024)return`${(n/1024/1024).toFixed(1)} MB`;return`${(n/1024/1024/1024).toFixed(2)} GB`}
