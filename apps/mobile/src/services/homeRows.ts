import * as SecureStore from 'expo-secure-store';
import type { Session } from '@/types/jellyfin';

export const homeRowOptions = [
 {key:'topTen',label:'Top 10 für dich'},
 {key:'resume',label:'Weiterschauen'},
 {key:'favorites',label:'Meine Liste'},
 {key:'because',label:'Weil du … gesehen hast'},
 {key:'latest',label:'Kürzlich hinzugefügt'},
 {key:'movieNight',label:'Für deinen Filmabend'},
 {key:'unwatched',label:'Noch nicht angesehen'},
 {key:'upcoming',label:'Demnächst'},
 {key:'popular',label:'Heute beliebt'},
 {key:'hiddenGems',label:'Verborgene Schätze'},
 {key:'short',label:'Kurz und spannend'}
] as const;
export type HomeRowKey = (typeof homeRowOptions)[number]['key'];
export const defaultRowOrder:HomeRowKey[]=homeRowOptions.map(row=>row.key);
export type HomeRowPreferences={order:HomeRowKey[];hidden:HomeRowKey[]};
const storageKey=(s:Session)=>'velaris.homeRows.v1.'+s.serverId+'.'+s.user.Id;
export async function loadHomeRowPreferences(s:Session):Promise<HomeRowPreferences>{
 try {
  const raw=await SecureStore.getItemAsync(storageKey(s));
  if(!raw)return {order:[...defaultRowOrder],hidden:[]};
  const stored=JSON.parse(raw) as Partial<HomeRowPreferences>;
  const valid=(value:unknown):value is HomeRowKey=>typeof value==='string'&&defaultRowOrder.includes(value as HomeRowKey);
  const order=[...new Set((Array.isArray(stored.order)?stored.order:[]).filter(valid))];
  const hidden=[...new Set((Array.isArray(stored.hidden)?stored.hidden:[]).filter(valid))];
  return {order:[...order,...defaultRowOrder.filter(key=>!order.includes(key))],hidden};
 }catch{return {order:[...defaultRowOrder],hidden:[]}}
}
export async function saveHomeRowPreferences(s:Session,settings:HomeRowPreferences){
 await SecureStore.setItemAsync(storageKey(s),JSON.stringify(settings));
}
