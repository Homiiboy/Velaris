import type { JellyfinItem } from '@/types/jellyfin';

// Treat Jellyfin's user data as authoritative. Never assume a resolution,
// "new" release, or watched status when the server has not supplied it.
export function playbackPercent(item:JellyfinItem):number {
 if(item.UserData?.Played)return 100;
 const ticks=item.UserData?.PlaybackPositionTicks??0;
 const duration=item.RunTimeTicks??0;
 const calculated=duration>0&&ticks>0?(ticks/duration)*100:0;
 const reported=item.UserData?.PlayedPercentage??0;
 return Math.max(0,Math.min(100,Math.max(calculated,reported)));
}

export function hasResumeProgress(item:JellyfinItem):boolean {
 const progress=playbackPercent(item);
 return !item.UserData?.Played && progress>0 && progress<99.5;
}

export function minutesRemaining(item:JellyfinItem):number|null {
 const duration=item.RunTimeTicks??0;
 if(duration<=0 || !hasResumeProgress(item))return null;
 const played=item.UserData?.PlaybackPositionTicks??0;
 const fraction=Math.max(played/duration,playbackPercent(item)/100);
 const minutes=Math.ceil((duration*(1-Math.min(1,fraction)))/600_000_000);
 return minutes>0?minutes:null;
}

export function episodeCode(item:JellyfinItem):string|null {
 if(item.Type!=='Episode')return null;
 const season=item.ParentIndexNumber;
 const episode=item.IndexNumber;
 if(season==null||episode==null||season<0||episode<=0)return null;
 return `S${season}:E${episode}`;
}

export function statusBadge(item:JellyfinItem):{text:string;kind:'watched'|'resume'}|null {
 if(item.UserData?.Played) {
  switch(item.Type){
   case 'Movie':return {text:'GESEHEN',kind:'watched'};
   case 'Episode':return {text:'FOLGE GESEHEN',kind:'watched'};
   case 'Series':return {text:'SERIE GESEHEN',kind:'watched'};
   case 'Season':return {text:'STAFFEL GESEHEN',kind:'watched'};
   default:return null;
  }
 }
 if(hasResumeProgress(item))return {text:'FORTSETZEN',kind:'resume'};
 return null;
}
