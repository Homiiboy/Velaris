/* Velaris Web UI Pass 9: browser playback controls and smart playback helpers. */
const P9_QUALITY=[['auto','Automatisch'],['4000000','4 Mbit/s'],['8000000','8 Mbit/s'],['12000000','12 Mbit/s'],['20000000','20 Mbit/s']];
function p9Key(){const s=session();return s?'velaris-web-playback-'+encodeURIComponent(s.url)+'-'+encodeURIComponent(s.userId):''}
function p9Prefs(){const defaults={quality:'auto',autoNext:false,skipIntro:false,skipCredits:false};try{const v=JSON.parse(localStorage.getItem(p9Key())||'null');return v?{quality:P9_QUALITY.some(([k])=>k===v.quality)?v.quality:'auto',autoNext:v.autoNext===true,skipIntro:v.skipIntro===true,skipCredits:v.skipCredits===true}:defaults}catch{return defaults}}
function p9Save(v){localStorage.setItem(p9Key(),JSON.stringify(v))}
function p9Settings(){
 stopHero();const prefs=p9Prefs();layout('<main class="page p9-settings"><button id="p9-back" class="pill">‹ Zurück</button><div class="eyebrow">PLAYER & SMART FEATURES</div><h1>Wiedergabe</h1><p class="hint">Die Einstellungen gelten nur für dieses Jellyfin-Profil auf diesem Gerät.</p><label class="p9-field">Maximale Streaming-Bitrate<select id="p9-quality">'+P9_QUALITY.map(([v,n])=>'<option value="'+v+'" '+(v===prefs.quality?'selected':'')+'>'+n+'</option>').join('')+'</select></label><p class="hint">Ein Bitratenlimit wird bei Jellyfin angefordert; die tatsächliche Qualität hängt von Server, Transcoding und Codec ab.</p>'+[['autoNext','Nächste Folge automatisch starten'],['skipIntro','Erkannte Intros automatisch überspringen'],['skipCredits','Erkannten Abspann automatisch überspringen']].map(([k,label])=>'<label class="p9-toggle"><span>'+label+'</span><input type="checkbox" data-p9-setting="'+k+'" '+(prefs[k]?'checked':'')+'></label>').join('')+'<p class="hint">Intro-/Abspann-Skips funktionieren nur mit entsprechenden Jellyfin-MediaSegments-Daten. Ohne Segmente bleibt die Wiedergabe unverändert.</p></main>');app.querySelector('#p9-back').onclick=render;app.querySelector('#p9-quality').onchange=e=>p9Save({...p9Prefs(),quality:e.target.value});app.querySelectorAll('[data-p9-setting]').forEach(e=>e.onchange=()=>p9Save({...p9Prefs(),[e.dataset.p9Setting]:e.checked}))}
function p9Format(seconds){if(!Number.isFinite(seconds))return '–:––';const total=Math.max(0,Math.floor(seconds)),h=Math.floor(total/3600),m=Math.floor(total%3600/60),s=String(total%60).padStart(2,'0');return h? h+':'+String(m).padStart(2,'0')+':'+s:m+':'+s}
// Match the native smartphone client: negotiate playback and use the chosen
// Jellyfin MediaSource, PlaySessionId and server-provided stream URLs.
async function p9PlaybackInfo(item,quality,account){
 const body={UserId:account.userId,AutoOpenLiveStream:true,EnableDirectPlay:true,EnableDirectStream:true,EnableTranscoding:true};
 if(quality!=='auto')body.MaxStreamingBitrate=Number(quality);
 return api('/Items/'+encodeURIComponent(item.Id)+'/PlaybackInfo?UserId='+encodeURIComponent(account.userId),{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
 },account);
}
function p9AuthorizedUrl(url,account){
 const target=new URL(url,base(account)+'/');
 // Jellyfin's native client supplies X-Emby-Token. HTML video elements cannot
 // set that header, so authenticate media URLs using the Jellyfin query token.
 if(target.origin!==new URL(base(account)).origin)throw Error('Jellyfin hat eine externe Stream-Adresse zurückgegeben.');
 if(!target.searchParams.has('api_key')&&!target.searchParams.has('ApiKey'))target.searchParams.set('api_key',account.token);
 return target.href;
}
function p9Stream(item,quality,account,media,preferMp4=false){
 const source=media?.MediaSources?.[0],id=encodeURIComponent(item.Id);
 const transcoding=source?.TranscodingUrl, direct=source?.DirectStreamUrl;
 const params=new URLSearchParams({api_key:account.token,VideoCodec:'h264',AudioCodec:'aac'});
 if(source?.Id)params.set('MediaSourceId',source.Id);
 if(media?.PlaySessionId)params.set('PlaySessionId',media.PlaySessionId);
 if(quality!=='auto')params.set('MaxStreamingBitrate',quality);
 if(preferMp4){
  params.set('static','false');
  return base(account)+'/Videos/'+id+'/stream.mp4?'+params;
 }
 if(transcoding)return p9AuthorizedUrl(transcoding,account);
 // PlaybackInfo may omit TranscodingUrl without a full Jellyfin device
 // profile. Do not feed MKV/TS/AVI containers directly to HTML video:
 // request a H.264/AAC HLS transcode that hls.js can actually consume.
 const browserDirect=/^(mp4|m4v|mov|webm)$/i.test(source?.Container||'')
  &&source?.SupportsDirectPlay!==false;
 if(browserDirect){
  if(direct)return p9AuthorizedUrl(direct,account);
  const directParams=new URLSearchParams({api_key:account.token,static:'true'});
  if(source?.Id)directParams.set('MediaSourceId',source.Id);
  return base(account)+'/Videos/'+id+'/stream?'+directParams;
 }
 if(!media)return base(account)+'/Videos/'+id+'/master.m3u8?'+new URLSearchParams({...Object.fromEntries(params),TranscodingContainer:'ts'});
 params.set('TranscodingContainer','ts');
 return base(account)+'/Videos/'+id+'/master.m3u8?'+params;
}
async function p9NextEpisode(item,account=session()){
 if(!item.SeriesId||!account)return null;
 try{
  const data=await api('/Shows/'+encodeURIComponent(item.SeriesId)+'/Episodes?UserId='+encodeURIComponent(account.userId)+'&Fields=Overview,Genres&EnableUserData=true',{},account);
  const episodes=(data.Items||[]).filter(x=>x.Type==='Episode'&&!x.IsMissing)
   .sort((a,b)=>(a.ParentIndexNumber??0)-(b.ParentIndexNumber??0)||(a.IndexNumber??0)-(b.IndexNumber??0));
  const at=episodes.findIndex(x=>String(x.Id)===String(item.Id));
  return at>=0?episodes[at+1]||null:null;
 }catch{return null}
}
async function p9Segments(item){try{const data=await api('/MediaSegments/'+encodeURIComponent(item.Id));return(data.Items||[]).filter(x=>Number.isFinite(x.StartTicks)&&Number.isFinite(x.EndTicks)&&x.EndTicks>x.StartTicks).map(x=>({type:String(x.Type||'').toLowerCase(),start:x.StartTicks/10000000,end:x.EndTicks/10000000})).sort((a,b)=>a.start-b.start)}catch{return []}}
function p9Play(item){
 stopHero();if(item.Type==='Series')return detail(item.Id);
 const prefs=p9Prefs(),html='<div id="p9-player" class="p9-player" role="region" aria-label="Velaris Videoplayer"><div class="p9-header"><button class="secondary" id="p9-close">‹ Zurück</button><strong>'+esc(item.Name)+'</strong><button class="secondary" id="p9-quality-button" aria-label="Streamingqualität ändern">⚙ Qualität</button></div><video id="p9-video" controls playsinline autoplay preload="metadata" aria-label="'+esc(item.Name)+'"></video><div class="p9-bottom"><div class="p9-transport"><button id="p9-rewind" aria-label="10 Sekunden zurück">↶ 10</button><button id="p9-toggle" aria-label="Pause oder Wiedergabe">❚❚</button><button id="p9-forward" aria-label="10 Sekunden vorwärts">10 ↷</button><span id="p9-clock" aria-live="off">0:00 / –:––</span></div><div id="p9-skip-zone" hidden><button id="p9-skip" class="secondary">Segment überspringen</button></div><div id="p9-next" class="p9-next" hidden></div><div id="p9-message" class="p9-message" role="status">Stream wird geladen …</div><button class="secondary" id="p9-retry" hidden>Erneut versuchen</button></div></div>';
 app.insertAdjacentHTML('beforeend',html);
 const root=app.querySelector('#p9-player'),video=root.querySelector('#p9-video'),clock=root.querySelector('#p9-clock'),note=root.querySelector('#p9-message'),retry=root.querySelector('#p9-retry'),nextBox=root.querySelector('#p9-next'),skipZone=root.querySelector('#p9-skip-zone'),skip=root.querySelector('#p9-skip');
 const currentSession=session();const previous=document.querySelectorAll('#p9-player');for(const old of previous)if(old!==root){const previousVideo=old.querySelector('video');if(previousVideo){previousVideo.pause();previousVideo.removeAttribute('src');previousVideo.load()}old.remove()}let quality=prefs.quality,fallback=false,reloading=false,pendingPosition=(item.UserData?.PlaybackPositionTicks||0)/10000000,stopped=false,reported=0,playbackInfo=null,streamGeneration=0,sourceUrl='',hlsEngine=null,hlsError='',next=null,segments=[],skipSeen=new Set(),nextShown=false,countdown=null,lastNextCountdown=-1;
 const isAlive=()=>root.isConnected&&!stopped&&session()?.userId===currentSession.userId&&session()?.url===currentSession.url;
 const playerMessage=message=>{if(isAlive())note.textContent=message};
 const report=async type=>{if(!isAlive()&&type!=='Stopped')return;const pos=Number.isFinite(video.currentTime)?video.currentTime:0;try{await api('/Sessions/Playing/'+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ItemId:item.Id,PositionTicks:Math.floor(pos*10000000),IsPaused:video.paused,MediaSourceId:playbackInfo?.MediaSources?.[0]?.Id,PlaySessionId:playbackInfo?.PlaySessionId,PlayMethod:playbackInfo?.MediaSources?.[0]?.TranscodingUrl?'Transcode':'DirectStream'})},currentSession)}catch{}};
 const tryPlay=()=>{
  const request=video.play();
  if(request&&typeof request.catch==='function')request.catch(err=>{
   if(!isAlive())return;
   retry.hidden=false;
   playerMessage(err?.name==='NotAllowedError'?'Tippe auf ▶, um die Wiedergabe zu starten.':'Stream konnte nicht gestartet werden: '+(err?.message||'Playerfehler'));
  });
 };
 // Safari plays HLS natively. Chrome/Firefox use hls.js (MediaSource).
 const nativeHls=!!video.canPlayType('application/vnd.apple.mpegurl')||!!video.canPlayType('application/x-mpegURL');
 const mseHls=()=>!!(window.Hls&&typeof window.Hls.isSupported==='function'&&window.Hls.isSupported());
 const resetEngine=()=>{
  if(hlsEngine){hlsEngine.destroy();hlsEngine=null}
  video.pause();
  video.removeAttribute('src');
  video.load();
 };
 const showStreamError=message=>{
  retry.hidden=false;
  playerMessage(message);
 };
 const activateStream=(url,position)=>{
  if(!isAlive())return;
  pendingPosition=Math.max(0,position);
  sourceUrl=url;
  if(!fallback)hlsError='';
  resetEngine();
  const isHls=/\.m3u8(?:\?|$)/i.test(url);
  if(isHls&&!nativeHls&&mseHls()){
   const Hls=window.Hls;
   hlsEngine=new Hls({
    enableWorker:true,
    xhrSetup:xhr=>xhr.setRequestHeader('X-Emby-Token',currentSession.token)
   });
   hlsEngine.on(Hls.Events.MANIFEST_PARSED,()=>{if(isAlive())tryPlay()});
   hlsEngine.on(Hls.Events.ERROR,(_event,data)=>{
    if(!isAlive()||!data?.fatal)return;
    // A fatal HLS issue should never strand the user with a spinner.
    const detail=[data.type,data.details,data.response?.code].filter(Boolean).join(' / ');
    hlsError=detail||'Unbekannter HLS-Fehler';
    console.error('Velaris HLS playback failed', {type:data.type,details:data.details,status:data.response?.code});
    if(!fallback){
     fallback=true;
     try{activateStream(p9Stream(item,quality,currentSession,playbackInfo,true),video.currentTime||pendingPosition)}
     catch(e){showStreamError('HLS-Fehler: '+hlsError+'; '+e.message)}
    }else showStreamError('HLS-Wiedergabe fehlgeschlagen: '+hlsError);
   });
   hlsEngine.attachMedia(video);
   hlsEngine.loadSource(url);
   playerMessage('HLS-Stream wird geladen …');
  }else if(isHls&&!nativeHls){
   showStreamError('HLS-Wiedergabe ist in diesem Browser nicht verfügbar. Bitte die Browser-Verbindung oder hls.js prüfen.');
  }else{
   video.src=url;
   video.load();
   tryPlay();
  }
 };
 const source=async(position=0)=>{
  if(!isAlive())return;
  const generation=++streamGeneration;
  pendingPosition=Math.max(0,position);
  reloading=true;
  retry.hidden=true;
  playerMessage('Jellyfin-Stream wird vorbereitet …');
  let media=null;
  try{media=await p9PlaybackInfo(item,quality,currentSession)}
  catch(error){console.warn('Velaris PlaybackInfo unavailable; trying MP4 fallback',error)}
  if(!isAlive()||generation!==streamGeneration)return;
  playbackInfo=media;
  const mediaSource=media?.MediaSources?.[0];
  try{
   // Safari can play Jellyfin HLS; other browsers need a browser-compatible
   // MP4 response instead of an HLS manifest without an HLS.js engine.
   const negotiated=mediaSource?.TranscodingUrl||mediaSource?.DirectStreamUrl||'';
   const hls=/\.m3u8(?:\?|$)/i.test(negotiated);
   fallback=!nativeHls&&!mseHls()&&(hls||!media);
   activateStream(p9Stream(item,quality,currentSession,media,fallback),pendingPosition);
   playerMessage(fallback?'MP4-Stream wird geladen …':'Jellyfin-Stream wird geladen …');
  }catch(error){
   retry.hidden=false;
   playerMessage('Stream konnte nicht vorbereitet werden: '+(error?.message||'Unbekannter Fehler'));
  }
 };
 const doClose=(reload=true)=>{if(stopped)return;report('Stopped');stopped=true;streamGeneration++;resetEngine();clearInterval(countdown);root.remove();if(reload&&session()?.userId===currentSession.userId&&session()?.url===currentSession.url)load()};
 const playNext=()=>{if(next&&isAlive()){const target=next;doClose(false);p9Play(target)}};
 const renderNext=()=>{if(!next||!isAlive())return;const remain=Number.isFinite(video.duration)?Math.max(0,video.duration-video.currentTime):Infinity;if(remain>90){nextBox.hidden=true;nextShown=false;return}nextShown=true;nextBox.hidden=false;nextBox.innerHTML='<div class="p9-next-info"><span class="eyebrow">ALS NÄCHSTES</span><strong>'+esc(next.Name)+'</strong><small>Staffel '+esc(next.ParentIndexNumber??'–')+' · Folge '+esc(next.IndexNumber??'–')+'</small></div><button class="primary" id="p9-next-start">Nächste Folge'+(prefs.autoNext?' · '+Math.ceil(remain)+'s':'')+'</button>';nextBox.querySelector('#p9-next-start').onclick=playNext};
 const update=()=>{if(!isAlive())return;const duration=Number.isFinite(video.duration)?video.duration:0;clock.textContent=p9Format(video.currentTime)+' / '+p9Format(duration)+(duration?'  ·  -'+p9Format(duration-video.currentTime):'');root.querySelector('#p9-toggle').textContent=video.paused?'▶':'❚❚';const segment=segments.find(x=>video.currentTime>=x.start&&video.currentTime<x.end&&x.end>video.currentTime+0.5&&!skipSeen.has(x.start));if(segment){const isCredits=/credit|outro/i.test(segment.type),isIntro=/intro|recap/i.test(segment.type);skipZone.hidden=false;skip.textContent=(isCredits?'Abspann':isIntro?'Intro / Rückblick':'Segment')+' überspringen';skip.onclick=()=>{video.currentTime=segment.end;skipSeen.add(segment.start)};if((isCredits&&prefs.skipCredits)||(isIntro&&prefs.skipIntro)){skip.onclick();skipZone.hidden=true}}else skipZone.hidden=true;if(next)renderNext();if(video.currentTime-reported>=15){reported=video.currentTime;report('Progress')}};
 video.addEventListener('loadedmetadata',()=>{if(!isAlive())return;if(pendingPosition>0&&Number.isFinite(video.duration)&&pendingPosition<video.duration-4){try{video.currentTime=pendingPosition;pendingPosition=0}catch{}}else if(pendingPosition<=0){pendingPosition=0}reloading=false;update()});
 video.addEventListener('playing',()=>{playerMessage('');report('')});
 video.addEventListener('timeupdate',update);video.addEventListener('pause',()=>{if(!stopped)report('Progress');update()});
 video.addEventListener('ended',()=>{if(!isAlive())return;report('Stopped');if(next&&prefs.autoNext)playNext();else if(next)renderNext()});
 video.addEventListener('error',()=>{if(!isAlive())return;const position=video.currentTime||pendingPosition;if(!fallback){fallback=true;pendingPosition=position;activateStream(p9Stream(item,quality,currentSession,playbackInfo,true),position);playerMessage('Alternativen MP4-Stream versuchen …')}else{retry.hidden=false;playerMessage('Medienfehler '+(video.error?.code||'?')+(hlsError?' · HLS: '+hlsError:'')+' · '+(fallback?'MP4-Ersatzstream':'Jellyfin-Stream')+' konnte nicht abgespielt werden. Bitte Netzwerkstatus der Video-Anfrage prüfen.')}});
 root.querySelector('#p9-close').onclick=()=>doClose();
 root.querySelector('#p9-rewind').onclick=()=>{video.currentTime=Math.max(0,video.currentTime-10)};
 root.querySelector('#p9-forward').onclick=()=>{video.currentTime=Math.min(Number.isFinite(video.duration)?video.duration:Infinity,video.currentTime+10)};
 root.querySelector('#p9-toggle').onclick=()=>video.paused?video.play().catch(()=>{}):video.pause();
 retry.onclick=()=>{
  if(video.readyState>=2 && video.paused){tryPlay();return}
  void source(video.currentTime||pendingPosition);
 };
 root.querySelector('#p9-quality-button').onclick=()=>{const old=root.querySelector('#p9-quality-select');if(old){old.remove();return}const select=document.createElement('select');select.id='p9-quality-select';select.setAttribute('aria-label','Streamingqualität');P9_QUALITY.forEach(([value,label])=>{const opt=document.createElement('option');opt.value=value;opt.textContent=label;select.appendChild(opt)});select.value=quality;root.querySelector('.p9-header').appendChild(select);select.onchange=()=>{const pos=video.currentTime||pendingPosition;quality=select.value;p9Save({...p9Prefs(),quality});select.remove();void source(pos)};select.focus()};
 void source(pendingPosition);
 p9NextEpisode(item,currentSession).then(x=>{if(isAlive()){next=x;update()}});
 p9Segments(item).then(x=>{if(isAlive())segments=x});
}
