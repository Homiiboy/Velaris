/* Velaris Desktop Cinematic Player 3.0
 * Visual chrome layered over the proven Jellyfin playback/Chromecast controller.
 * Scoped to mouse/keyboard desktop. No changes to iPhone PWA or stream negotiation.
 */
function velarisInstallDesktopPlayer(root,video,item){
 if(!root||!video||!window.matchMedia('(min-width:850px) and (pointer:fine)').matches)return;
 root.classList.add('p44-desktop-player');
 const panel=document.createElement('section');
 panel.className='p44-controls';
 panel.setAttribute('aria-label','Velaris Wiedergabesteuerung');
 panel.innerHTML='<div class="p44-seek-line"><span class="p44-now">0:00</span><input class="p44-seek" type="range" min="0" max="1000" step="1" value="0" aria-label="Wiedergabeposition"><span class="p44-duration">–:––</span></div><div class="p44-control-row"><div class="p44-buttons"><button class="p44-jump-back" aria-label="10 Sekunden zurück">↶ 10</button><button class="p44-play" aria-label="Pause oder Wiedergabe">▶</button><button class="p44-jump-forward" aria-label="10 Sekunden vor">10 ↷</button><span class="p44-title"></span></div><div class="p44-tools"><button class="p44-tracks" aria-label="Untertitel und Audiospuren">Audio / Untertitel</button><button class="p44-quality" aria-label="Streamingqualität">⚙ Qualität</button><button class="p44-fullscreen" aria-label="Vollbild">⛶ Vollbild</button></div></div>';
 root.appendChild(panel);
 const q=selector=>panel.querySelector(selector);
 const format=seconds=>{if(!Number.isFinite(seconds))return '–:––';const t=Math.max(0,Math.floor(seconds)),h=Math.floor(t/3600),m=Math.floor(t%3600/60),s=String(t%60).padStart(2,'0');return h?h+':'+String(m).padStart(2,'0')+':'+s:m+':'+s};
 const current=()=>video.currentTime||0;
 let timer=null,dragging=false,dialog=null;
 const show=()=>{if(!root.isConnected)return;root.classList.remove('p44-controls-hidden');clearTimeout(timer);if(!video.paused&&!dialog)timer=setTimeout(()=>root.classList.add('p44-controls-hidden'),4200)};
 const update=()=>{if(!root.isConnected){clearTimeout(timer);return}const duration=Number.isFinite(video.duration)?video.duration:0;const p=duration?Math.min(100,Math.max(0,current()/duration*100)):0;if(!dragging)q('.p44-seek').value=String(Math.round(p*10));q('.p44-seek').style.setProperty('--p44-progress',p+'%');q('.p44-now').textContent=format(current());q('.p44-duration').textContent=format(duration);q('.p44-play').textContent=video.paused?'▶':'Ⅱ'};
 const closeDialog=()=>{dialog?.remove();dialog=null;show()};
 const openDialog=(heading,options)=>{closeDialog();dialog=document.createElement('div');dialog.className='p44-track-dialog';const title=document.createElement('h2');title.textContent=heading;dialog.appendChild(title);const close=document.createElement('button');close.textContent='✕';close.className='p44-close-dialog';close.setAttribute('aria-label','Schließen');close.onclick=closeDialog;dialog.appendChild(close);for(const option of options){const button=document.createElement('button');button.className='p44-track-option';button.textContent=option.name;button.onclick=()=>{option.action();closeDialog()};dialog.appendChild(button)}root.appendChild(dialog);show();close.focus()};
 const seek=seconds=>{if(Number.isFinite(video.duration)&&video.duration>0)video.currentTime=Math.min(video.duration,Math.max(0,seconds));show();update()};
 const toggle=()=>{const original=root.querySelector('#p9-toggle');if(original)original.click();else if(video.paused)video.play().catch(()=>{});else video.pause();show()};
 q('.p44-title').textContent=item?.SeriesName?item.SeriesName+' · '+item.Name:item?.Name||'VELARIS';
 q('.p44-play').onclick=toggle;
 q('.p44-jump-back').onclick=()=>{root.querySelector('#p9-rewind')?.click();show()};
 q('.p44-jump-forward').onclick=()=>{root.querySelector('#p9-forward')?.click();show()};
 q('.p44-quality').onclick=()=>{root.querySelector('#p9-quality-button')?.click();show()};
 q('.p44-seek').addEventListener('input',()=>{dragging=true;const duration=video.duration;const fraction=Number(q('.p44-seek').value)/1000;q('.p44-now').textContent=format(duration*fraction);q('.p44-seek').style.setProperty('--p44-progress',fraction*100+'%');show()});
 q('.p44-seek').addEventListener('change',()=>{dragging=false;seek(video.duration*Number(q('.p44-seek').value)/1000)});
 q('.p44-seek').addEventListener('pointerup',()=>{dragging=false;update()});
 q('.p44-fullscreen').onclick=()=>{if(document.fullscreenElement===root){document.exitFullscreen?.().catch(()=>{})}else if(root.requestFullscreen){root.requestFullscreen().catch(()=>{})}show()};
 document.addEventListener('fullscreenchange',()=>{if(root.isConnected)q('.p44-fullscreen').textContent=document.fullscreenElement===root?'⤢ Vollbild verlassen':'⛶ Vollbild'});
 q('.p44-tracks').onclick=()=>{
  const rows=[],audio=video.audioTracks,subs=video.textTracks;
  if(audio?.length)for(let i=0;i<audio.length;i++){const track=audio[i];rows.push({name:'Audio: '+(track.label||track.language||'Spur '+(i+1)),action:()=>{for(let j=0;j<audio.length;j++)audio[j].enabled=i===j}})}
  if(subs?.length){rows.push({name:'Untertitel: Aus',action:()=>{for(const x of subs)x.mode='disabled'}});for(let i=0;i<subs.length;i++){const track=subs[i];rows.push({name:'Untertitel: '+(track.label||track.language||'Spur '+(i+1)),action:()=>{for(let j=0;j<subs.length;j++)subs[j].mode=i===j?'showing':'disabled'}})}}
  if(!rows.length){openDialog('Audio und Untertitel',[{name:'Dieser Stream bietet keine separat auswählbaren Browser-Spuren.',action:()=>{}}]);return}
  openDialog('Audio und Untertitel',rows);
 };
 root.addEventListener('pointermove',show,{passive:true});
 root.addEventListener('focusin',show);
 root.addEventListener('mouseleave',()=>{if(!video.paused&&!dialog){clearTimeout(timer);timer=setTimeout(()=>root.classList.add('p44-controls-hidden'),3200)}});
 const keyboard=e=>{
  if(!root.isConnected){document.removeEventListener('keydown',keyboard);return}
  if(e.target.closest('input,select,textarea,[contenteditable="true"],.p44-track-dialog'))return;
  if(e.key==='Escape'&&dialog){e.preventDefault();closeDialog();return}
  if(e.key===' '||e.key.toLowerCase()==='k'){e.preventDefault();toggle()}
  else if(e.key==='ArrowLeft'){e.preventDefault();root.querySelector('#p9-rewind')?.click();show()}
  else if(e.key==='ArrowRight'){e.preventDefault();root.querySelector('#p9-forward')?.click();show()}
  else if(e.key.toLowerCase()==='f'){e.preventDefault();q('.p44-fullscreen').click()}
 };
 document.addEventListener('keydown',keyboard);
 video.addEventListener('loadedmetadata',()=>{if(root.isConnected)video.controls=false;update()});
 video.addEventListener('timeupdate',update);
 video.addEventListener('play',show);video.addEventListener('pause',show);video.addEventListener('durationchange',update);
 update();show();
}
