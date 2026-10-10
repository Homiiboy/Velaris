import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import type { Session } from '@/types/jellyfin';

export type VelarisProfile={id:string;name:string;avatar:number;photoUri?:string;session:Session};
const PROFILES_KEY='velaris.profiles.v1';
const ACTIVE_KEY='velaris.activeProfile.v1';
const LEGACY_KEY='velaris.jellyfin.session';
const PICKER_KEY='velaris.profilePicker.v1';
export async function loadProfiles():Promise<VelarisProfile[]>{const raw=await SecureStore.getItemAsync(PROFILES_KEY);if(!raw)return [];try{return JSON.parse(raw) as VelarisProfile[]}catch{return []}}
async function persistProfiles(p:VelarisProfile[]){await SecureStore.setItemAsync(PROFILES_KEY,JSON.stringify(p))}
export async function addProfile(session:Session,avatar=0){const profiles=await loadProfiles();const id=session.serverId+':'+session.user.Id;const i=profiles.findIndex(p=>p.id===id);const next={id,name:session.user.Name,avatar,session};if(i>=0)profiles[i]={...profiles[i],session,name:session.user.Name};else{if(profiles.length>=5)throw new Error('Es können maximal 5 Profile angelegt werden.');profiles.push(next)}await persistProfiles(profiles);await SecureStore.setItemAsync(ACTIVE_KEY,id);await SecureStore.setItemAsync(LEGACY_KEY,JSON.stringify(session));return next}
export async function updateProfileAvatar(id:string,avatar:number){const p=await loadProfiles();const x=p.find(v=>v.id===id);if(x){x.avatar=avatar;delete x.photoUri;await persistProfiles(p)}}
export async function updateProfilePhoto(id:string,photoUri:string){const p=await loadProfiles();const x=p.find(v=>v.id===id);if(x){const dir=new Directory(Paths.document,'velaris-profile-images');if(!dir.exists)dir.create({intermediates:true});const ext=(photoUri.split('.').pop()?.split('?')[0]||'jpg').replace(/[^a-z0-9]/gi,'').slice(0,5)||'jpg';const dest=new File(dir,`${id.replace(/[^a-z0-9]/gi,'_')}.${ext}`);if(dest.exists)dest.delete();await new File(photoUri).copy(dest);x.photoUri=dest.uri;await persistProfiles(p)}}
export async function removeProfile(id:string){const p=(await loadProfiles()).filter(v=>v.id!==id);await persistProfiles(p);const a=await SecureStore.getItemAsync(ACTIVE_KEY);if(a===id)await SecureStore.deleteItemAsync(ACTIVE_KEY)}
export async function loadSession():Promise<Session|null>{const p=await loadProfiles();const a=await SecureStore.getItemAsync(ACTIVE_KEY);const x=p.find(v=>v.id===a);if(x)return x.session;const raw=await SecureStore.getItemAsync(LEGACY_KEY);if(!raw)return null;try{return JSON.parse(raw) as Session}catch{return null}}
export async function getActiveProfile(){const p=await loadProfiles();const a=await SecureStore.getItemAsync(ACTIVE_KEY);return p.find(v=>v.id===a)||null}
export async function shouldShowProfilePicker(){return (await SecureStore.getItemAsync(PICKER_KEY))!=='0'}
export async function setProfilePickerEnabled(enabled:boolean){await SecureStore.setItemAsync(PICKER_KEY,enabled?'1':'0')}
export async function switchProfile(id:string){const p=await loadProfiles();const x=p.find(v=>v.id===id);if(!x)throw new Error('Profil nicht gefunden.');await SecureStore.setItemAsync(ACTIVE_KEY,id);await SecureStore.setItemAsync(LEGACY_KEY,JSON.stringify(x.session));return x.session}
export async function saveSession(session:Session){await addProfile(session)}
export async function clearSession(){await SecureStore.deleteItemAsync(LEGACY_KEY);await SecureStore.deleteItemAsync(ACTIVE_KEY)}
