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
  document.body.appendChild(overlay);
  const devices=overlay.querySelector('#velaris-cast-devices'),feedback=overlay.querySelector('#velaris-cast-feedback');
  const controls=overlay.querySelector('#velaris-cast-controls'),positionNode=overlay.querySelector('#velaris-cast-position');
  let selected=null,position=0,closed=false,interval=null;
  const info=value=>{if(!closed)feedback.textContent=value};
  const close=()=>{closed=true;if(interval)clearInterval(interval);overlay.remove()};
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
