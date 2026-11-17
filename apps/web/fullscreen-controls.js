/* Shared mobile full-screen controls for Velaris' modern and iOS fallback players.
   Keeps the existing HLS/MP4/Cast pipelines completely unchanged. */
function velarisInstallFullscreenUI(root, video, item) {
 if (!root || !video || !window.matchMedia('(max-width:849px)').matches) return;
 const controls = document.createElement('div');
 controls.className = 'velaris-fullscreen-chrome';
 controls.innerHTML = '<div class="vfc-top"><button type="button" class="vfc-back" aria-label="Player schließen">‹</button><div class="vfc-heading"></div><button type="button" class="vfc-immersive" aria-label="Vollbild einschalten">⛶</button></div>'+
  '<div class="vfc-center"><button type="button" class="vfc-rewind" aria-label="10 Sekunden zurück">↶ 10</button><button type="button" class="vfc-play" aria-label="Wiedergabe anhalten oder starten">▶</button><button type="button" class="vfc-forward" aria-label="10 Sekunden vor">10 ↷</button></div>'+
  '<div class="vfc-bottom"><input type="range" class="vfc-seek" aria-label="Wiedergabeposition" min="0" max="1000" value="0" step="1"><div class="vfc-timing"><span class="vfc-current">0:00</span><span class="vfc-total">0:00</span></div><div class="vfc-actions"><button type="button" class="vfc-episodes" hidden>Episoden</button><button type="button" class="vfc-tracks">Audio / Untertitel</button><button type="button" class="vfc-collapse">Steuerung ausblenden</button></div></div>';
 root.appendChild(controls);
 const q=selector=>controls.querySelector(selector);
 const format=seconds=>{const t=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=String(t%60).padStart(2,'0');return h?h+':'+String(m).padStart(2,'0')+':'+s:m+':'+s};
 let hideTimer=null,locked=false,sliderActive=false,dialog=null;
 const display=()=>{if(!root.isConnected)return;root.classList.remove('vfc-hidden');clearTimeout(hideTimer);if(!video.paused&&!dialog)hideTimer=setTimeout(()=>{root.classList.add('vfc-hidden')},4400)};
 const update=()=>{if(!root.isConnected){clearTimeout(hideTimer);return}const d=Number.isFinite(video.duration)?video.duration:0;if(!sliderActive)q('.vfc-seek').value=d?String(Math.round(video.currentTime/d*1000)):'0';q('.vfc-seek').style.setProperty('--vfc-progress',(d?Math.min(100,video.currentTime/d*100):0)+'%');q('.vfc-current').textContent=format(video.currentTime);q('.vfc-total').textContent=format(d);q('.vfc-play').textContent=video.paused?'▶':'Ⅱ'};
 const closeDialog=()=>{dialog?.remove();dialog=null;display()};
 const openDialog=(title,rows)=>{
  closeDialog();dialog=document.createElement('div');dialog.className='vfc-dialog';const heading=document.createElement('h2');heading.textContent=title;dialog.appendChild(heading);
  const close=document.createElement('button');close.type='button';close.className='vfc-dialog-close';close.textContent='✕';close.setAttribute('aria-label','Schließen');close.onclick=closeDialog;dialog.appendChild(close);
  for(const entry of rows){const btn=document.createElement('button');btn.type='button';btn.className='vfc-dialog-option';btn.textContent=entry.title;btn.onclick=()=>{closeDialog();entry.action()};dialog.appendChild(btn)}
  root.appendChild(dialog);display();
 };
 const seek=time=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.max(0,Math.min(video.duration,time));display()};
 const toggle=()=>{if(video.paused){const p=video.play();p?.catch?.(()=>{})}else video.pause();display()};
 q('.vfc-play').onclick=toggle;
 q('.vfc-rewind').onclick=()=>seek(video.currentTime-10);
 q('.vfc-forward').onclick=()=>seek(video.currentTime+10);
 q('.vfc-seek').addEventListener('input',()=>{sliderActive=true;const d=video.duration;if(Number.isFinite(d))q('.vfc-current').textContent=format(d*Number(q('.vfc-seek').value)/1000);q('.vfc-seek').style.setProperty('--vfc-progress',(Number(q('.vfc-seek').value)/10)+'%');display()});
 q('.vfc-seek').addEventListener('change',()=>{sliderActive=false;seek(video.duration*Number(q('.vfc-seek').value)/1000)});
 q('.vfc-seek').addEventListener('pointerup',()=>{sliderActive=false;update()});
 q('.vfc-back').onclick=()=>root.querySelector('#p9-close')?.click();
 q('.vfc-immersive').onclick=()=>{
  root.classList.toggle('vfc-immersive-active');
  const enabled=root.classList.contains('vfc-immersive-active');
  q('.vfc-immersive').textContent=enabled?'⤢':'⛶';
  q('.vfc-immersive').setAttribute('aria-label',enabled?'Vollbild verlassen':'Vollbild einschalten');
  // On Safari PWA the player is already viewport-sized; avoid webkitEnterFullscreen,
  // which would discard our custom controls and can interrupt HLS playback.
  if(enabled&&screen.orientation?.lock)screen.orientation.lock('landscape').catch(()=>{});
  else if(!enabled&&screen.orientation?.unlock)try{screen.orientation.unlock()}catch{}
  display();
 };
 q('.vfc-collapse').onclick=()=>root.classList.add('vfc-hidden');
 root.addEventListener('pointerdown',event=>{if(event.target===root||event.target===video)display()});
 video.addEventListener('timeupdate',update);video.addEventListener('loadedmetadata',update);
 video.addEventListener('durationchange',update);video.addEventListener('play',()=>{update();display()});
 video.addEventListener('pause',()=>{update();display()});video.addEventListener('ended',update);
 q('.vfc-heading').textContent=item.SeriesName?item.SeriesName+' · '+item.Name:item.Name||'VELARIS';
 q('.vfc-tracks').onclick=()=>{
  const audioTracks=video.audioTracks,subtitleTracks=video.textTracks;
  const rows=[];
  if(audioTracks?.length){for(let i=0;i<audioTracks.length;i++){const track=audioTracks[i];rows.push({title:'Audio: '+(track.label||track.language||'Spur '+(i+1)),action:()=>{for(let j=0;j<audioTracks.length;j++)audioTracks[j].enabled=j===i}})}}
  if(subtitleTracks?.length){rows.push({title:'Untertitel: Aus',action:()=>{for(const track of subtitleTracks)track.mode='disabled'}});for(let i=0;i<subtitleTracks.length;i++){const track=subtitleTracks[i];rows.push({title:'Untertitel: '+(track.label||track.language||'Spur '+(i+1)),action:()=>{for(let j=0;j<subtitleTracks.length;j++)subtitleTracks[j].mode=j===i?'showing':'disabled'}})}}
  if(rows.length)openDialog('Audio und Untertitel',rows);else openDialog('Audio und Untertitel',[{title:'Dieser Stream bietet im Browser keine separat auswählbaren Spuren.',action:()=>{}}]);
 };
 if(item.SeriesId){
  const episodeButton=q('.vfc-episodes');episodeButton.hidden=false;
  episodeButton.onclick=async()=>{
   openDialog('Episoden',[{title:'Episoden werden geladen …',action:()=>{}}]);
   try{
    const account=session();
    const data=await api('/Shows/'+encodeURIComponent(item.SeriesId)+'/Episodes?UserId='+encodeURIComponent(account.userId)+'&EnableUserData=true&IsMissing=false',{},account);
    if(!root.isConnected)return;
    const episodes=(data.Items||[]).filter(ep=>ep.Type==='Episode'&&!ep.IsMissing).sort((a,b)=>(a.ParentIndexNumber??0)-(b.ParentIndexNumber??0)||(a.IndexNumber??0)-(b.IndexNumber??0));
    openDialog('Episoden',episodes.map(ep=>({title:'S'+(ep.ParentIndexNumber??'–')+' E'+(ep.IndexNumber??'–')+' · '+ep.Name,action:()=>{if(ep.Id!==item.Id){root.querySelector('#p9-close')?.click();if(typeof p9PlayClassic==='function'&&/iPad|iPhone|iPod/i.test(navigator.userAgent||''))p9PlayClassic(ep);else if(typeof p9Play==='function')p9Play(ep)}}})));
   }catch{openDialog('Episoden',[{title:'Episoden konnten nicht geladen werden.',action:()=>{}}])}
  };
 }
 update();display();
}
