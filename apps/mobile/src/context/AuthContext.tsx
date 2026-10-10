import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@/types/jellyfin';
import { authenticate } from '@/services/jellyfin';
import { addProfile, clearSession, loadProfiles, loadSession, switchProfile as selectStoredProfile, type VelarisProfile } from '@/services/session';

type AuthContextValue={session:Session|null;loading:boolean;profiles:VelarisProfile[];signIn:(serverUrl:string,username:string,password:string)=>Promise<void>;signOut:()=>Promise<void>;switchProfile:(id:string)=>Promise<void>;refreshProfiles:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|null>(null);

export function AuthProvider({children}:PropsWithChildren){
 const[session,setSession]=useState<Session|null>(null),[profiles,setProfiles]=useState<VelarisProfile[]>([]),[loading,setLoading]=useState(true);
 const refreshProfiles=async()=>setProfiles(await loadProfiles());
 useEffect(()=>{Promise.all([loadSession(),loadProfiles()]).then(([s,p])=>{setSession(s);setProfiles(p)}).finally(()=>setLoading(false))},[]);
 const value=useMemo<AuthContextValue>(()=>({session,loading,profiles,refreshProfiles,
  signIn:async(serverUrl,username,password)=>{const next=await authenticate(serverUrl,username,password);await addProfile(next);setSession(next);setProfiles(await loadProfiles())},
  signOut:async()=>{await clearSession();setSession(null);setProfiles(await loadProfiles())},
  switchProfile:async(id)=>{const next=await selectStoredProfile(id);setSession(next);setProfiles(await loadProfiles())}
 }),[session,loading,profiles]);
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value}
