import * as SecureStore from 'expo-secure-store';
export type PluginSettings={introSkipper:boolean;creditsSkip:boolean;autoSkipIntro:boolean;autoSkipCredits:boolean;autoNext:boolean;cast:boolean};
const KEY='velaris.pluginSettings.v1';
export const defaultPluginSettings:PluginSettings={introSkipper:true,creditsSkip:true,autoSkipIntro:false,autoSkipCredits:false,autoNext:true,cast:true};
export async function loadPluginSettings():Promise<PluginSettings>{const raw=await SecureStore.getItemAsync(KEY);if(!raw)return defaultPluginSettings;try{return{...defaultPluginSettings,...JSON.parse(raw)}}catch{return defaultPluginSettings}}
export async function savePluginSettings(v:PluginSettings){await SecureStore.setItemAsync(KEY,JSON.stringify(v))}
