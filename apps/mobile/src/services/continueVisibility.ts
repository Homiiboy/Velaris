import * as SecureStore from 'expo-secure-store';
import type { Session } from '@/types/jellyfin';

// Local presentation preference only. Never change Jellyfin's resume position.
const key=(session:Session)=>'velaris.hiddenResume.v1.'+session.serverId+'.'+session.user.Id;

export async function getHiddenResume(session:Session):Promise<string[]> {
  try {
    const raw=await SecureStore.getItemAsync(key(session));
    if(!raw)return [];
    const items:unknown=JSON.parse(raw);
    return Array.isArray(items)?items.filter((id):id is string=>typeof id==='string'):[];
  } catch { return []; }
}

export async function hideResumeItem(session:Session,id:string):Promise<void> {
  const previous=await getHiddenResume(session);
  await SecureStore.setItemAsync(key(session),JSON.stringify([...new Set([...previous,id])]));
}

export async function clearHiddenResume(session:Session):Promise<void> {
  await SecureStore.deleteItemAsync(key(session));
}
