/* Velaris Cast Bridge: iPhone PWA -> authenticated ZimaOS -> LAN Chromecast. */
const VelarisCastBridge=(()=>{
 const escText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function call(account,path,data){
  const response=await fetch('/api/cast/'+path,{
   method:data?'POST':'GET',
   headers:{'X-Velaris-Jellyfin-Token':account.token,...(data?{'Content-Type':'application/json'}:{})},
   ...(data?{body:JSON.stringify(data)}:{})
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(json.error||'Cast Bridge HTTP '+response.status);
  return json;
 }
 function open(item,account){
  document.getElementById('velaris-cast-dialog')?.remove();
  // Keep this modal independently positioned even if an older PWA CSS file
  // is cached by iOS Safari. Scoped styles are installed once.
  if(!document.getElementById('velaris-cast-modal-styles')){
   const style=document.createElement('style');
   style.id='velaris-cast-modal-styles';
   style.textContent=`
    #velaris-cast-dialog{position:fixed!important;inset:0!important;z-index:2147483000!important;
      display:flex!important;align-items:center!important;justify-content:center!important;
      box-sizing:border-box!important;width:100vw!important;height:100dvh!important;
      margin:0!important;padding:calc(env(safe-area-inset-top) + 16px) 16px calc(env(safe-area-inset-bottom) + 16px)!important;
      background:rgba(3,3,10,.86)!important;overflow:hidden!important;overscroll-behavior:contain!important}
    #velaris-cast-dialog .velaris-cast-panel{position:relative!important;box-sizing:border-box!important;
      display:flex!important;flex-direction:column!important;gap:14px!important;
      width:min(100%,520px)!important;max-height:calc(100dvh - 48px)!important;
      min-width:0!important;margin:0!important;padding:20px!important;
      border:1px solid rgba(188,164,255,.4)!important;border-radius:20px!important;
      background:#171421!important;color:#fff!important;
      box-shadow:0 24px 80px rgba(0,0,0,.7)!important;
      overflow-y:auto!important;overscroll-behavior:contain!important;
      -webkit-overflow-scrolling:touch!important}
    #velaris-cast-dialog .velaris-cast-panel header{position:static!important;
      display:flex!important;flex-direction:row!important;align-items:center!important;
      justify-content:space-between!important;gap:12px!important;padding:0!important;
      background:transparent!important;min-height:0!important}
    #velaris-cast-dialog .velaris-cast-panel h2{font-size:19px!important;line-height:1.25!important;
      margin:0!important;color:#fff!important;letter-spacing:normal!important}
    #velaris-cast-dialog .velaris-cast-panel .hint{font-size:13px!important;line-height:1.45!important;
      color:#c9c3d7!important;margin:0!important}
    #velaris-cast-dialog #velaris-cast-feedback{font-size:14px!important;line-height:1.5!important;
      color:#dccfff!important;overflow-wrap:anywhere!important}
    #velaris-cast-dialog #velaris-cast-devices{display:grid!important;gap:8px!important}
    #velaris-cast-dialog #velaris-cast-devices button{width:100%!important;text-align:left!important}
    #velaris-cast-dialog #velaris-cast-controls:not([hidden]){display:flex!important;flex-wrap:wrap!important;gap:8px!important}
    #velaris-cast-dialog #velaris-cast-controls[hidden]{display:none!important}
    @media(max-width:440px){#velaris-cast-dialog .velaris-cast-panel{padding:16px!important}}
   `;
   document.head.appendChild(style);
  }
  const overlay=document.createElement('div');
  overlay.id='velaris-cast-dialog';
  overlay.className='velaris-cast-overlay';
  overlay.innerHTML='<section class="velaris-cast-panel" role="dialog" aria-modal="true" aria-labelledby="velaris-cast-title">'
   +'<header><h2 id="velaris-cast-title">Auf Chromecast abspielen</h2><button type="button" id="velaris-cast-close" class="secondary">Schließen</button></header>'
   +'<p class="hint">Wähle einen Chromecast in deinem Heimnetz. Der Fernseher braucht keine Jellyfin-App.</p>'
   +'<div id="velaris-cast-feedback" role="status" aria-live="polite">Chromecast-Geräte werden gesucht …</div>'
   +'<div id="velaris-cast-devices"></div>'
   +'<div id="velaris-cast-controls" hidden><button id="velaris-cast-pause" class="secondary">Pause</button>'
   +'<button id="velaris-cast-resume" class="secondary">Weiter</button>'
   +'<button id="velaris-cast-back" class="secondary">−30 s</button>'
   +'<button id="velaris-cast-next" class="secondary">+30 s</button>'
   +'<button id="velaris-cast-stop" class="secondary">Stopp</button>'
   +'<p id="velaris-cast-position" class="hint"></p></div>'
   +'<p class="hint">ZimaOS und Chromecast müssen im selben Netzwerk sein. Der Chromecast muss die lokale Jellyfin-Adresse erreichen können.</p>'
   +'</section>';
  const oldBodyOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';
  document.body.appendChild(overlay);
  const devices=overlay.querySelector('#velaris-cast-devices'),feedback=overlay.querySelector('#velaris-cast-feedback');
  const controls=overlay.querySelector('#velaris-cast-controls'),positionNode=overlay.querySelector('#velaris-cast-position');
  let selected=null,position=0,closed=false,interval=null;
  const info=value=>{if(!closed)feedback.textContent=value};
  const onKeyDown=event=>{if(event.key==='Escape')close()};
  const close=()=>{if(closed)return;closed=true;if(interval)clearInterval(interval);
   document.removeEventListener('keydown',onKeyDown);document.body.style.overflow=oldBodyOverflow;overlay.remove()};
  document.addEventListener('keydown',onKeyDown);
  overlay.querySelector('#velaris-cast-close').focus();
  overlay.querySelector('#velaris-cast-close').onclick=close;
  overlay.onclick=event=>{if(event.target===overlay)close()};
  const updateStatus=async()=>{
   if(closed||!selected)return;
   try{
    const result=await call(account,'status');
    if(closed)return;
    const entry=result.sessions?.find(x=>x.deviceId===selected);
    if(!entry){controls.hidden=true;selected=null;info('Keine aktive Cast-Sitzung.');return}
    position=entry.position||0;
    positionNode.textContent=(entry.name||'Chromecast')+' · '+(entry.state||'Unbekannt')+' · '+Math.floor(position)+' s';
   }catch(error){info('Status: '+error.message)}
  };
  const control=async(action,extra={})=>{
   if(!selected)return;
   try{
    await call(account,'control',{deviceId:selected,action,...extra});
    if(action==='stop'){selected=null;controls.hidden=true;info('Cast-Wiedergabe beendet.')}
    else await updateStatus();
   }catch(error){info('Steuerung fehlgeschlagen: '+error.message)}
  };
  overlay.querySelector('#velaris-cast-pause').onclick=()=>control('pause');
  overlay.querySelector('#velaris-cast-resume').onclick=()=>control('resume');
  overlay.querySelector('#velaris-cast-back').onclick=()=>control('seek',{position:Math.max(0,position-30)});
  overlay.querySelector('#velaris-cast-next').onclick=()=>control('seek',{position:position+30});
  overlay.querySelector('#velaris-cast-stop').onclick=()=>control('stop');
  const loadDevices=async()=>{
   try{
    const result=await call(account,'devices');
    if(closed)return;
    devices.replaceChildren();
    if(!result.devices?.length){
     info('Kein Chromecast gefunden. Prüfe, ob Chromecast und ZimaOS im selben Heimnetz sind.');
     return;
    }
    info(result.devices.length+' Chromecast-Gerät(e) gefunden. Wähle eines aus.');
    for(const device of result.devices){
     const button=document.createElement('button');
     button.type='button';button.className='secondary velaris-cast-device';
     button.textContent=device.name||'Chromecast';
     button.onclick=async()=>{
      devices.querySelectorAll('button').forEach(b=>b.disabled=true);
      info('Starte '+(item.Name||'Film')+' auf '+(device.name||'Chromecast')+' …');
      try{
       const result=await call(account,'play',{deviceId:device.id,itemId:item.Id});
       if(closed)return;
       selected=device.id;controls.hidden=false;
       info('Wiedergabeauftrag an '+escText(result.device||device.name)+' gesendet. Prüfe das Bild am Fernseher.');
       await updateStatus();
       if(!interval)interval=setInterval(updateStatus,5000);
      }catch(error){
       if(!closed)info('Cast fehlgeschlagen: '+error.message);
      }finally{if(!closed)devices.querySelectorAll('button').forEach(b=>b.disabled=false)}
     };
     devices.appendChild(button);
    }
   }catch(error){if(!closed)info('Cast Bridge nicht erreichbar: '+error.message+'. Prüfe den Docker-Container velaris-cast-bridge.')}
  };
  void loadDevices();
 }
 return {open};
})();
