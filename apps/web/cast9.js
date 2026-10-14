/* Velaris Web Google Cast sender — default media receiver, no custom receiver. */
const P9_CAST_RECEIVER_ID='CC1AD845';
let p9CastAvailable=false;
const p9CastReadyListeners=new Set();
function p9CastNotifyReady(){for(const callback of p9CastReadyListeners){try{callback()}catch{}}}
window.__onGCastApiAvailable=isAvailable=>{
 p9CastAvailable=!!isAvailable;
 if(p9CastAvailable&&window.cast?.framework&&window.chrome?.cast){
  try{
   window.cast.framework.CastContext.getInstance().setOptions({
    receiverApplicationId:P9_CAST_RECEIVER_ID,
    autoJoinPolicy:window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
   });
  }catch(error){p9CastAvailable=false;console.warn('Velaris Cast initialisation failed',error?.message)}
 }
 p9CastNotifyReady();
};
function p9CastSupported(){
 return p9CastAvailable&&!!window.cast?.framework&&!!window.chrome?.cast;
}
function p9CastController({item,account,getUrl,getStart,onStatus,onStarted,onPosition,onStopped}){
 let closed=false,active=false,hasLoaded=false,loading=false,lastTime=0,reportTimer=null;
 let remote=null,controller=null,castContext=null,stateListener=null,remoteListener=null;
 const canUse=()=>!closed&&p9CastSupported();
 const status=message=>{if(!closed)onStatus(message)};
 const connected=()=>!!castContext?.getCurrentSession();
 const cleanTimer=()=>{if(reportTimer){clearInterval(reportTimer);reportTimer=null}};
 const currentTime=()=>remote&&Number.isFinite(remote.currentTime)?Math.max(0,remote.currentTime):lastTime;
 const notifyPosition=()=>{if(!active)return;lastTime=currentTime();onPosition(lastTime)};
 const disconnected=()=>{
  if(!active&&!hasLoaded)return;
  const position=currentTime();
  cleanTimer();active=false;hasLoaded=false;loading=false;
  onStopped(position);
  status('Chromecast getrennt. Lokale Wiedergabe kann fortgesetzt werden.');
 };
 const handleRemoteChange=()=>{
  if(closed)return;
  if(active){
   notifyPosition();
   status('Wiedergabe auf '+(castContext?.getCurrentSession()?.getCastDevice()?.friendlyName||'Chromecast')
    +(remote?.isPaused?' · pausiert':''));
  }else if(!connected()&&hasLoaded)disconnected();
 };
 const handleSessionChange=()=>{
  if(closed)return;
  if(!connected()){disconnected();return}
  if(loading||active)return;
  status('Chromecast verbunden. Tippe auf „Cast“, um den Film zu übertragen.');
 };
 const ready=()=>{
  if(!canUse()||castContext)return;
  try{
   castContext=window.cast.framework.CastContext.getInstance();
   remote=new window.cast.framework.RemotePlayer();
   controller=new window.cast.framework.RemotePlayerController(remote);
   stateListener=()=>handleSessionChange();
   remoteListener=()=>handleRemoteChange();
   castContext.addEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,stateListener);
   controller.addEventListener(window.cast.framework.RemotePlayerEventType.ANY_CHANGE,remoteListener);
   status('Chromecast verfügbar');
  }catch(error){status('Chromecast konnte nicht initialisiert werden: '+(error?.message||'Fehler'))}
 };
 p9CastReadyListeners.add(ready);
 ready();
 const castStart=async()=>{
  if(!canUse()){status('Google Cast ist in diesem Browser nicht verfügbar. Nutze Chrome auf einem kompatiblen Gerät.');return false}
  ready();
  if(loading)return false;
  loading=true;
  try{
   // requestSession must be invoked from the actual Cast button click.
   if(!connected())await castContext.requestSession();
   const session=castContext.getCurrentSession();
   if(!session)throw Error('Kein Chromecast verbunden.');
   const url=getUrl();
   if(!url||!/^https?:\/\//i.test(url))throw Error('Kein gültiger Jellyfin-Stream vorhanden.');
   // The receiver must reach Jellyfin itself, and cannot borrow the sender's Tailscale tunnel.
   if(/\.ts\.net(?::\d+)?\//i.test(url))status('Der Fernseher benötigt ebenfalls Zugriff auf dein Tailscale-Netz.');
   const isHls=/\.m3u8(?:\?|$)/i.test(url);
   const media=new window.chrome.cast.media.MediaInfo(url,isHls?'application/x-mpegURL':'video/mp4');
   media.streamType=window.chrome.cast.media.StreamType.BUFFERED;
   const metadata=new window.chrome.cast.media.GenericMediaMetadata();
   metadata.title=item.Name||'Velaris';
   metadata.subtitle=item.SeriesName||String(item.ProductionYear||'');
   media.metadata=metadata;
   if(Number.isFinite(item.RunTimeTicks))media.duration=item.RunTimeTicks/10000000;
   const request=new window.chrome.cast.media.LoadRequest(media);
   request.autoplay=true;
   request.currentTime=Math.max(0,Number(getStart())||0);
   await session.loadMedia(request);
   if(closed)return false;
   active=true;hasLoaded=true;lastTime=request.currentTime;
   onStarted(lastTime);
   status('Wiedergabe auf '+(session.getCastDevice()?.friendlyName||'Chromecast'));
   cleanTimer();
   reportTimer=setInterval(notifyPosition,5000);
   return true;
  }catch(error){
   if(!closed)status('Cast fehlgeschlagen: '+(error?.message||error||'Verbindung prüfen')+'. Prüfe, ob der Fernseher Jellyfin selbst erreichen kann.');
   return false;
  }finally{loading=false}
 };
 const toggle=()=>{
  if(!active||!controller)return;
  controller.playOrPause();
 };
 const seek=offset=>{
  if(!active||!controller||!remote)return;
  remote.currentTime=Math.max(0,currentTime()+offset);
  controller.seek();
 };
 const stop=()=>{
  if(!active)return;
  const position=currentTime();
  try{controller?.stop()}catch{}
  cleanTimer();active=false;hasLoaded=false;
  onStopped(position);
  status('Chromecast-Wiedergabe beendet');
 };
 const close=()=>{
  if(closed)return;
  // Closing Velaris player does not stop TV playback; disconnect UI listeners.
  closed=true;cleanTimer();p9CastReadyListeners.delete(ready);
  if(castContext&&stateListener)castContext.removeEventListener(window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,stateListener);
  if(controller&&remoteListener)controller.removeEventListener(window.cast.framework.RemotePlayerEventType.ANY_CHANGE,remoteListener);
 };
 return {start:castStart,toggle,seek,stop,close,isCasting:()=>active,currentTime,remotePaused:()=>!!remote?.isPaused,available:canUse};
}
