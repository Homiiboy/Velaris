/* Shared mobile full-screen controls for Velaris' modern and iOS fallback players.
   Keeps the existing HLS/MP4/Cast pipelines completely unchanged. */
function velarisInstallFullscreenUI(root, video, item) {
 if (!root || !video || !window.matchMedia('(max-width:849px), (pointer:coarse) and (max-height:600px)').matches) return;
 const controls = document.createElement('div');
 controls.className = 'velaris-fullscreen-chrome';
 controls.innerHTML = '<div class="vfc-top"><button type="button" class="vfc-back" aria-label="Player schließen">‹</button><div class="vfc-heading"></div><button type="button" class="vfc-immersive" aria-label="Vollbild einschalten">⛶</button></div>'+
  '<div class="vfc-center"><button type="button" class="vfc-rewind" aria-label="10 Sekunden zurück">↶ 10</button><button type="button" class="vfc-play" aria-label="Wiedergabe anhalten oder starten">▶</button><button type="button" class="vfc-forward" aria-label="10 Sekunden vor">10 ↷</button></div>'+
  '<div class="vfc-bottom"><input type="range" class="vfc-seek" aria-label="Wiedergabeposition" min="0" max="1000" value="0" step="1"><div class="vfc-timing"><span class="vfc-current">0:00</span><span class="vfc-total">0:00</span></div><div class="vfc-actions"><button type="button" class="vfc-episodes" hidden>Episoden</button><button type="button" class="vfc-tracks">Audio / Untertitel</button><button type="button" class="vfc-collapse">Steuerung ausblenden</button></div></div>';
 root.classList.add('vfc-enabled');
 root.appendChild(controls);
 // Keep the proven Safari stream startup path; replace chrome only after metadata arrives.
 video.addEventListener('loadedmetadata',()=>{video.controls=false},{once:true});
 const q=selector=>controls.querySelector(selector);
 const format=seconds=>{const t=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=String(t%60).padStart(2,'0');return h?h+':'+String(m).padStart(2,'0')+':'+s:m+':'+s};
 const AUTO_HIDE_MS=10000;
 let hideTimer=null,sliderActive=false,dialog=null;
 const cancelHide=()=>{if(hideTimer!==null){clearTimeout(hideTimer);hideTimer=null}};
 const scheduleHide=()=>{
  cancelHide();
  if(!root.isConnected||video.paused||video.ended||dialog||sliderActive)return;
  hideTimer=setTimeout(()=>{if(root.isConnected&&!video.paused&&!video.ended&&!dialog&&!sliderActive)root.classList.add('vfc-hidden')},AUTO_HIDE_MS);
 };
 const display=()=>{if(!root.isConnected)return;root.classList.remove('vfc-hidden');scheduleHide()};
 const hide=()=>{if(video.paused||dialog||sliderActive)return;cancelHide();root.classList.add('vfc-hidden')};
 const update=()=>{if(!root.isConnected){clearTimeout(hideTimer);return}const d=Number.isFinite(video.duration)?video.duration:0;if(!sliderActive)q('.vfc-seek').value=d?String(Math.round(video.currentTime/d*1000)):'0';q('.vfc-seek').style.setProperty('--vfc-progress',(d?Math.min(100,video.currentTime/d*100):0)+'%');q('.vfc-current').textContent=format(video.currentTime);q('.vfc-total').textContent=format(d);q('.vfc-play').textContent=video.paused?'▶':'Ⅱ'};
 const closeDialog=()=>{dialog?.remove();dialog=null;display()};
 const openDialog=(title,rows)=>{
  closeDialog();
  dialog=document.createElement('div');dialog.className='vfc-dialog';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',title);
  const heading=document.createElement('h2');heading.textContent=title;dialog.appendChild(heading);
  const close=document.createElement('button');close.type='button';close.className='vfc-dialog-close';close.textContent='✕';close.setAttribute('aria-label','Schließen');close.onclick=closeDialog;dialog.appendChild(close);
  const body=document.createElement('div');body.className='vfc-dialog-body';dialog.appendChild(body);
  for(const entry of rows){
   if(entry.heading){const section=document.createElement('h3');section.className='vfc-dialog-heading';section.textContent=entry.heading;body.appendChild(section);continue}
   const btn=document.createElement('button');btn.type='button';btn.className='vfc-dialog-option';
   if(entry.selected){btn.classList.add('vfc-option-selected');btn.setAttribute('aria-pressed','true')}
   if(entry.disabled){btn.disabled=true;btn.classList.add('vfc-option-disabled')}
   if(entry.art){const thumb=document.createElement('img');thumb.className='vfc-episode-thumb';thumb.src=entry.art;thumb.alt='';thumb.loading='lazy';btn.appendChild(thumb)}
   const name=document.createElement('span');name.textContent=entry.title;btn.appendChild(name);
   if(entry.selected){const tick=document.createElement('span');tick.textContent='✓';tick.className='vfc-option-check';btn.appendChild(tick)}
   if(entry.meta){const sub=document.createElement('small');sub.textContent=entry.meta;name.appendChild(sub)}
   btn.onclick=()=>{if(entry.disabled)return;closeDialog();entry.action?.()};
   body.appendChild(btn);
  }
  root.appendChild(dialog);cancelHide();display();close.focus();
  return body;
 };
 const seek=time=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(0,Math.min(video.duration,time));display()};
 const toggle=()=>{if(video.paused){const p=video.play();p?.catch?.(()=>{})}else video.pause();display()};
 q('.vfc-play').onclick=toggle;
 q('.vfc-rewind').onclick=()=>seek(video.currentTime-10);
 q('.vfc-forward').onclick=()=>seek(video.currentTime+10);
 q('.vfc-seek').addEventListener('input',()=>{sliderActive=true;const d=video.duration;if(Number.isFinite(d))q('.vfc-current').textContent=format(d*Number(q('.vfc-seek').value)/1000);q('.vfc-seek').style.setProperty('--vfc-progress',(Number(q('.vfc-seek').value)/10)+'%');display()});
 q('.vfc-seek').addEventListener('change',()=>{sliderActive=false;seek(video.duration*Number(q('.vfc-seek').value)/1000)});
 q('.vfc-seek').addEventListener('pointerup',()=>{sliderActive=false;update();display()});
 q('.vfc-seek').addEventListener('pointercancel',()=>{sliderActive=false;display()});
 q('.vfc-back').onclick=()=>root.querySelector('#p9-close')?.click();
 q('.vfc-immersive').onclick=()=>{
  root.classList.toggle('vfc-immersive-active');
  const enabled=root.classList.contains('vfc-immersive-active');
  q('.vfc-immersive').textContent=enabled?'⤢':'⛶';
  q('.vfc-immersive').setAttribute('aria-label',enabled?'Vollbild verlassen':'Vollbild einschalten');
  // On Safari PWA the player is already viewport-sized; avoid webkitEnterFullscreen,
  // which would discard our custom controls and can interrupt HLS playback.
  if(enabled&&root.requestFullscreen&&document.fullscreenEnabled)root.requestFullscreen().catch(()=>{});
  if(enabled&&screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{});
  else if(!enabled){if(document.fullscreenElement===root)document.exitFullscreen?.().catch(()=>{});if(screen.orientation?.unlock)try{screen.orientation.unlock()}catch{}}
  display();
 };
 q('.vfc-collapse').onclick=hide;
 // A single tap toggles the chrome; touching controls does not close them.
 root.addEventListener('pointerup',event=>{
  if(event.target!==root&&event.target!==video)return;
  if(root.classList.contains('vfc-hidden'))display();
  else hide();
 });
 root.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog)closeDialog()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&root.isConnected)display()});
 video.addEventListener('timeupdate',update);video.addEventListener('loadedmetadata',update);
 video.addEventListener('durationchange',update);video.addEventListener('play',()=>{update();display()});
 video.addEventListener('pause',()=>{update();display()});video.addEventListener('ended',()=>{cancelHide();display();update()});
 q('.vfc-heading').textContent=item.SeriesName?item.SeriesName+' · '+item.Name:item.Name||'VELARIS';
 const audioLabel=(track,index)=>track.label||track.language||'Spur '+(index+1);
 const subtitleLabel=(track,index)=>track.label||track.language||'Spur '+(index+1);
 q('.vfc-tracks').onclick=()=>{
  const rows=[{heading:'Audio'}];
  const audioTracks=video.audioTracks;
  if(audioTracks?.length){
   for(let i=0;i<audioTracks.length;i++){
    const track=audioTracks[i];
    rows.push({title:audioLabel(track,i),selected:!!track.enabled,action:()=>{
     for(let j=0;j<audioTracks.length;j++)audioTracks[j].enabled=j===i;
    }});
   }
  }else rows.push({title:'Audiospur wird vom Browser verwaltet',disabled:true});
  rows.push({heading:'Untertitel'});
  const subtitleTracks=video.textTracks;
  let shown=false;
  if(subtitleTracks)for(let i=0;i<subtitleTracks.length;i++)if(subtitleTracks[i].mode==='showing')shown=true;
  rows.push({title:'Aus',selected:!shown,action:()=>{if(subtitleTracks)for(let i=0;i<subtitleTracks.length;i++)subtitleTracks[i].mode='disabled'}});
  if(subtitleTracks?.length)for(let i=0;i<subtitleTracks.length;i++){
   const track=subtitleTracks[i];
   rows.push({title:subtitleLabel(track,i),selected:track.mode==='showing',action:()=>{for(let j=0;j<subtitleTracks.length;j++)subtitleTracks[j].mode=j===i?'showing':'disabled'}});
  }
  if(!subtitleTracks?.length)rows.push({title:'Keine separat auswählbaren Untertitel verfügbar',disabled:true});
  openDialog('Audio & Untertitel',rows);
 };
 if(item.SeriesId){
  const episodeButton=q('.vfc-episodes');episodeButton.hidden=false;
  let episodesCache=null;
  const showEpisodes=(episodes,season)=>{
   const seasons=[...new Set(episodes.map(ep=>ep.ParentIndexNumber??0))].sort((a,b)=>a-b);
   const list=episodes.filter(ep=>(ep.ParentIndexNumber??0)===season).sort((a,b)=>(a.IndexNumber??0)-(b.IndexNumber??0));
   const rows=list.length?list.map(ep=>({
    title:'E'+(ep.IndexNumber??'–')+' · '+(ep.Name||'Episode'),
    art:ep.ImageTags?.Primary?image(ep,'Primary',240):'',
    meta:ep.UserData?.Played?'✓ Gesehen':ep.UserData?.PlaybackPositionTicks?'Fortsetzen':'',
    selected:ep.Id===item.Id,
    action:()=>{
     if(ep.Id===item.Id)return;
     root.querySelector('#p9-close')?.click();
     if(typeof p9PlayClassic==='function'&&/iPad|iPhone|iPod/i.test(navigator.userAgent||''))p9PlayClassic(ep);
     else if(typeof p9Play==='function')p9Play(ep);
    }
   })):[{title:'Keine Episoden in dieser Staffel',disabled:true}];
   const body=openDialog('Episoden',rows);
   const navigation=document.createElement('div');navigation.className='vfc-season-tabs';
   for(const value of seasons){
    const button=document.createElement('button');button.type='button';
    button.className='vfc-season-tab'+(value===season?' selected':'');
    button.textContent=value===0?'Specials':'Staffel '+value;
    button.setAttribute('aria-pressed',String(value===season));
    button.onclick=()=>showEpisodes(episodes,value);navigation.appendChild(button);
   }
   dialog.insertBefore(navigation,body);
  };
  episodeButton.onclick=async()=>{
   if(episodesCache){
    const current=episodesCache.find(ep=>ep.Id===item.Id);
    showEpisodes(episodesCache,current?.ParentIndexNumber??episodesCache[0]?.ParentIndexNumber??0);return;
   }
   openDialog('Episoden',[{title:'Episoden werden geladen …',disabled:true}]);
   try{
    const account=session();
    if(!account)throw Error('Keine Anmeldung');
    const data=await api('/Shows/'+encodeURIComponent(item.SeriesId)+'/Episodes?UserId='+encodeURIComponent(account.userId)+'&EnableUserData=true&IsMissing=false',{},account);
    if(!root.isConnected||!dialog)return;
    episodesCache=(data.Items||[]).filter(ep=>ep.Type==='Episode'&&!ep.IsMissing);
    if(!episodesCache.length){openDialog('Episoden',[{title:'Keine Episoden verfügbar',disabled:true}]);return}
    const current=episodesCache.find(ep=>ep.Id===item.Id);
    showEpisodes(episodesCache,current?.ParentIndexNumber??episodesCache[0].ParentIndexNumber??0);
   }catch{
    if(root.isConnected&&dialog)openDialog('Episoden',[{title:'Episoden konnten nicht geladen werden',disabled:true}]);
   }
  };
 }
 update();display();
}
