/* Velaris YouTube – Web category, personal links, details and player UI.
 * Uses only the authenticated Jellyfin metadata API; never accesses the
 * sidecar directly or puts a Jellyfin/sidecar token into video URLs.
 * Playback uses short-lived Jellyfin playback tickets; never the user token in the media URL.
 */
globalThis.VelarisYouTube = (() => {
  const DEMO = 'jNQXAC9IVRw';
  const idPattern = /^[a-zA-Z0-9_-]{11}$/;
  const cache = new Map();
  let generation = 0;
  let currentVideo = null;
  let currentPanel = 'for-you';
  function googleHeaders() {
    return {'X-Velaris-Jellyfin-Token': session().token};
  }
  async function googleApi(route, opts={}) {
    const response=await fetch('/api/youtube/'+route,{
      ...opts,
      cache:'no-store',
      headers:{...googleHeaders(),...(opts.headers||{})}
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(data.detail || 'Google OAuth HTTP '+response.status);
    return data;
  }
  function feedCard(v){
    const img=(v.thumbnail && /^https:\/\//.test(v.thumbnail))
      ?v.thumbnail:'https://i.ytimg.com/vi/'+encodeURIComponent(v.id)+'/hqdefault.jpg';
    return '<button class="yt-card" data-yt-feed="'+esc(v.id)+'" type="button" aria-label="'+esc(v.title)+' ansehen">'+
      '<span class="yt-card-art"><img src="'+esc(img)+'" loading="lazy" referrerpolicy="no-referrer" alt=""><span class="yt-play-icon">▶</span></span>'+
      '<span class="yt-card-info"><strong>'+esc(v.title)+'</strong><small>'+esc(v.channel)+'</small></span></button>';
  }
  function googleHub(account,n){
    const heading=app.querySelector('.yt-page .category-heading');
    if(!heading)return;
    heading.insertAdjacentHTML('afterend','<nav class="yt-subtabs" aria-label="YouTube-Ansichten">'+
      '<button data-yt-panel="for-you" type="button">For You</button>'+
      '<button data-yt-panel="subscriptions" type="button">Meine Abos</button>'+
      '<button data-yt-panel="my-videos" type="button">Meine Videos</button></nav>'+
      '<section class="yt-google" id="yt-google"><p class="hint">Google-Verbindung wird geprüft …</p></section>');
    const manual=app.querySelector('.yt-add');
    const library=app.querySelector('.yt-library');
    const hub=app.querySelector('#yt-google');
    function activate(panel){
      currentPanel=panel;
      app.querySelectorAll('[data-yt-panel]').forEach(el=>{
        const selected=el.dataset.ytPanel===panel;
        el.classList.toggle('selected',selected);
        el.setAttribute('aria-current',selected?'page':'false');
      });
      if(manual)manual.hidden=panel!=='my-videos';
      if(library)library.hidden=panel!=='my-videos';
      if(hub)hub.hidden=panel==='my-videos';
    }
    app.querySelectorAll('[data-yt-panel]').forEach(el=>el.onclick=()=>{
      activate(el.dataset.ytPanel);
      if(el.dataset.ytPanel!=='my-videos')loadGoogle();
    });
    activate(currentPanel);
    let fetchGeneration=0;
    async function loadGoogle(){
      if(currentPanel==='my-videos'||!owns(n,account))return;
      const epoch=++fetchGeneration;
      hub.innerHTML='<p class="hint">YouTube-Konto wird geladen …</p>';
      try{
        const status=await googleApi('account');
        if(epoch!==fetchGeneration||!owns(n,account))return;
        if(!status.connected){
          hub.innerHTML='<h2>Dein persönliches YouTube</h2>'+
            '<p class="hint">Verbinde dein Google-Konto, um deine Abonnements und neue Videos hier anzuzeigen.</p>'+
            '<button id="yt-google-connect" class="primary" type="button">Mit Google anmelden</button>'+
            '<p class="yt-feedback" id="yt-google-feedback" role="status"></p>';
          hub.querySelector('#yt-google-connect').onclick=async()=>{
            // Opening the window synchronously keeps popup blockers from blocking it.
            const popup=window.open('about:blank','velaris-google-login','width=620,height=750');
            const output=hub.querySelector('#yt-google-feedback');
            try{
              const result=await googleApi('oauth/start',{method:'POST'});
              if(!/^https:\/\/accounts\.google\.com\//.test(result.authorizationUrl))throw Error('Ungültige Google-Anmeldeadresse');
              if(popup&&!popup.closed)popup.location.href=result.authorizationUrl;
              else output.textContent='Pop-up blockiert. Erlaube Pop-ups für Velaris und versuche es erneut.';
              if(popup){
                output.textContent='Schließe die Google-Anmeldung im neuen Fenster ab und klicke danach auf „Aktualisieren“.';
                const refresh=document.createElement('button');
                refresh.className='secondary';refresh.textContent='Aktualisieren';
                refresh.onclick=loadGoogle;
                output.after(refresh);
              }
            }catch(e){
              if(popup&&!popup.closed)popup.close();
              output.textContent='Google-Anmeldung konnte nicht gestartet werden: '+e.message;
            }
          };
          return;
        }
        hub.innerHTML='<div class="yt-google-top"><h2>'+(currentPanel==='for-you'?'Neue Videos aus deinen Abos':'Meine abonnierten Kanäle')+'</h2>'+
          '<div><button id="yt-google-refresh" class="secondary" type="button">Aktualisieren</button> '+
          '<button id="yt-google-disconnect" class="secondary" type="button">Konto trennen</button></div></div>'+
          '<p class="hint" id="yt-google-hint">Inhalte werden über die offizielle YouTube Data API geladen.</p>'+
          '<div id="yt-google-results" class="yt-grid"></div>';
        hub.querySelector('#yt-google-refresh').onclick=loadGoogle;
        hub.querySelector('#yt-google-disconnect').onclick=async()=>{
          if(!confirm('Google-Konto von diesem Velaris-Profil trennen?'))return;
          try{await googleApi('account',{method:'DELETE'});loadGoogle()}
          catch(e){hub.querySelector('#yt-google-hint').textContent=e.message}
        };
        const data=await googleApi(currentPanel==='for-you'?'for-you':'subscriptions');
        if(epoch!==fetchGeneration||!owns(n,account))return;
        const results=hub.querySelector('#yt-google-results');
        if(!results)return;
        if(currentPanel==='for-you'){
          const videos=data.videos||[];
          results.innerHTML=videos.length?videos.map(feedCard).join(''):'<p class="hint">Aktuell wurden keine neuen Videos gefunden.</p>';
          results.querySelectorAll('[data-yt-feed]').forEach(el=>el.onclick=()=>details(el.dataset.ytFeed));
        }else{
          const channels=data.channels||[];
          results.innerHTML=channels.length?channels.map(c=>
            '<div class="yt-channel"><img loading="lazy" referrerpolicy="no-referrer" src="'+esc(c.thumbnail)+'" alt=""><strong>'+esc(c.title)+'</strong></div>'
          ).join(''):'<p class="hint">Keine Abonnements gefunden.</p>';
        }
      }catch(e){
        if(epoch!==fetchGeneration||!owns(n,account))return;
        hub.innerHTML='<h2>Google-Verbindung nicht verfügbar</h2><p class="hint">'+esc(e.message)+
          '</p><button class="secondary" id="yt-google-retry">Erneut versuchen</button>';
        hub.querySelector('#yt-google-retry').onclick=loadGoogle;
      }
    }
    if(currentPanel!=='my-videos')loadGoogle();
  }


  const key = () => 'velaris-youtube-ids-v1:' + encodeURIComponent(session().url) + ':' + encodeURIComponent(session().userId);
  function ids() {
    try {
      const saved = JSON.parse(localStorage.getItem(key()) || 'null');
      return Array.isArray(saved) ? [...new Set(saved.filter(v => typeof v === 'string' && idPattern.test(v)))].slice(0, 80) : [DEMO];
    } catch { return [DEMO]; }
  }
  function saveIds(values) {
    localStorage.setItem(key(), JSON.stringify([...new Set(values)].slice(0, 80)));
  }
  function parseId(input) {
    const raw = input.trim();
    if (idPattern.test(raw)) return raw;
    try {
      const u = new URL(raw);
      const host = u.hostname.toLowerCase();
      if (u.protocol !== 'https:') return null;
      if (host === 'youtu.be' || host === 'www.youtu.be') {
        const id = u.pathname.split('/')[1];
        return idPattern.test(id) ? id : null;
      }
      if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) {
        const id = u.pathname === '/watch' ? u.searchParams.get('v') :
          u.pathname.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1];
        return idPattern.test(id || '') ? id : null;
      }
    } catch { /* Not a supported YouTube URL. */ }
    return null;
  }
  const duration = s => {
    const t = Math.max(0, Math.floor(Number(s) || 0));
    return t >= 3600 ? [Math.floor(t/3600), Math.floor(t/60)%60, t%60].map((x,i) => i ? String(x).padStart(2,'0') : String(x)).join(':') :
      Math.floor(t/60)+':'+String(t%60).padStart(2,'0');
  };
  const thumb = v => v?.thumbnail && /^https:\/\//.test(v.thumbnail) ? v.thumbnail : 'https://i.ytimg.com/vi/'+encodeURIComponent(v.id)+'/hqdefault.jpg';

  async function metadata(id) {
    if (cache.has(id)) return cache.get(id);
    // Existing api() supplies the Jellyfin user session token as an HTTP header.
    const video = await api('/VelarisYouTube/Videos/' + encodeURIComponent(id));
    if (!video || video.id !== id) throw Error('Videodaten konnten nicht geladen werden');
    cache.set(id, video);
    return video;
  }
  function card(v) {
    return '<button class="yt-card" data-yt-id="'+esc(v.id)+'" type="button" aria-label="'+esc(v.title || v.id)+' ansehen">'+
      '<span class="yt-card-art"><img loading="lazy" referrerpolicy="no-referrer" src="'+esc(thumb(v))+'" alt=""><span class="yt-duration">'+esc(duration(v.duration))+'</span><span class="yt-play-icon">▶</span></span>'+
      '<span class="yt-card-info"><strong>'+esc(v.title || v.id)+'</strong><small>'+esc(v.channel || v.uploader || 'YouTube')+'</small></span></button>';
  }
  function shell(body) {
    state.tab = 'youtube';
    layout(body);
  }
  const owns = (n, account) => generation === n && session()?.userId === account?.userId && state.tab === 'youtube';

  async function show() {
    stopHero();
    const n = ++generation, account = session();
    if (!account) return auth();
    shell('<main class="page yt-page"><header class="category-heading"><h1>VELARIS YOUTUBE</h1><p>Deine Videos – direkt über Jellyfin verbunden</p></header>'+
      '<section class="yt-add"><div><h2>YouTube-Video hinzufügen</h2><p class="hint">Füge einen öffentlichen YouTube-Link oder eine Video-ID hinzu. Videos werden nicht heruntergeladen.</p></div>'+
      '<form id="yt-add-form" class="yt-add-form"><input id="yt-input" type="text" required maxlength="512" placeholder="YouTube-Link oder Video-ID" aria-label="YouTube-Link oder Video-ID"><button class="primary" type="submit">Hinzufügen</button></form><p class="yt-feedback" id="yt-feedback" role="status"></p></section>'+
      '<section class="yt-library"><h2>Meine YouTube-Videos</h2><div class="yt-grid" id="yt-grid"><p class="hint">Videoinformationen werden geladen …</p></div></section></main>');
    googleHub(account,n);
    const grid = app.querySelector('#yt-grid');
    const input = app.querySelector('#yt-input');
    const message = app.querySelector('#yt-feedback');
    app.querySelector('#yt-add-form').onsubmit = async e => {
      e.preventDefault();
      const id = parseId(input.value);
      if (!id) { message.textContent='Bitte einen gültigen YouTube-Link oder eine 11-stellige Video-ID eingeben.'; return; }
      const button = e.currentTarget.querySelector('button');
      button.disabled = true;
      message.textContent='Video wird überprüft …';
      try {
        await metadata(id);
        if (!owns(n,account)) return;
        saveIds([id,...ids()]);
        input.value='';
        show();
      } catch {
        if (owns(n,account)) message.textContent='Video konnte über Jellyfin nicht geladen werden. Prüfe Link und Verbindung.';
      } finally { if (button.isConnected) button.disabled=false; }
    };
    const list = ids();
    if (!list.length) { grid.innerHTML='<p class="hint">Noch keine Videos. Füge oben deinen ersten Link hinzu.</p>'; return; }
    const results = await Promise.allSettled(list.map(metadata));
    if (!owns(n,account) || !grid.isConnected) return;
    const videos=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
    const errors=results.length-videos.length;
    grid.innerHTML = videos.length ? videos.map(card).join('') : '<p class="hint">Videos konnten nicht geladen werden. Bitte überprüfe deine Jellyfin-Verbindung.</p>';
    if(errors)message.textContent=errors+' Video(s) derzeit nicht verfügbar.';
    grid.querySelectorAll('[data-yt-id]').forEach(el=>el.onclick=()=>details(el.dataset.ytId));
  }
  async function details(id) {
    if(!idPattern.test(id))return show();
    const n=++generation,account=session();
    shell('<main class="page yt-page"><button type="button" class="pill" id="yt-back">‹ Zurück</button><p class="hint">Video wird geladen …</p></main>');
    app.querySelector('#yt-back').onclick=show;
    try{
      const v=await metadata(id);
      if(!owns(n,account))return;
      currentVideo=v;
      shell('<main class="page yt-page yt-details"><button type="button" class="pill" id="yt-back">‹ Zurück</button>'+
        '<div class="yt-detail-art"><img referrerpolicy="no-referrer" src="'+esc(thumb(v))+'" alt=""></div>'+
        '<div class="eyebrow">VELARIS YOUTUBE</div><h1>'+esc(v.title || id)+'</h1>'+
        '<div class="yt-meta"><span>'+esc(v.channel || v.uploader || 'YouTube')+'</span><span>'+esc(duration(v.duration))+'</span></div>'+
        '<div class="yt-actions"><button type="button" class="primary" id="yt-play">▶ Abspielen</button>'+
        '<button type="button" class="secondary" id="yt-remove">Aus meiner Liste entfernen</button></div>'+
        '<p class="yt-copy">'+esc(v.description || 'Keine Beschreibung verfügbar.')+'</p></main>');
      app.querySelector('#yt-back').onclick=show;
      app.querySelector('#yt-play').onclick=()=>player(v);
      app.querySelector('#yt-remove').onclick=()=>{saveIds(ids().filter(x=>x!==id));show()};
    }catch{
      if(!owns(n,account))return;
      shell('<main class="page yt-page"><button class="pill" id="yt-back">‹ Zurück</button><p role="alert">Videodetails konnten nicht geladen werden.</p></main>');
      app.querySelector('#yt-back').onclick=show;
    }
  }

  function player(v=currentVideo) {
    if(!v)return show();
    document.querySelector('#yt-player')?.remove();
    const account=session();
    if(!account)return auth();
    const wrap=document.createElement('div');
    wrap.className='yt-player';wrap.id='yt-player';
    wrap.innerHTML='<div class="yt-player-top"><button class="secondary" id="yt-player-close" type="button">‹ Zurück</button><strong>'+esc(v.title || 'YouTube')+'</strong></div>'+
      '<video id="yt-video" controls playsinline preload="metadata" referrerpolicy="no-referrer" poster="'+esc(thumb(v))+'" aria-label="'+esc(v.title || 'YouTube-Video')+'"></video>'+
      '<div class="yt-player-bottom"><div class="yt-transport"><button id="yt-rewind" type="button" aria-label="10 Sekunden zurück">↶ 10</button><button id="yt-toggle" type="button" disabled aria-label="Abspielen oder pausieren">▶ Start</button><button id="yt-forward" type="button" aria-label="10 Sekunden vor">10 ↷</button></div>'+
      '<p class="yt-player-message" role="status">Sichere Wiedergabe wird vorbereitet …</p></div>';
    app.append(wrap);
    const video=wrap.querySelector('video');
    const status=wrap.querySelector('.yt-player-message');
    const toggle=wrap.querySelector('#yt-toggle');
    let closed=false;
    const update=()=>{toggle.textContent=video.paused?'▶ Start':'Ⅱ Pause'};
    const onKey=e=>{if(e.key==='Escape')close()};
    const close=()=>{
      if(closed)return;
      closed=true;
      video.pause();
      video.removeAttribute('src');
      video.load();
      wrap.remove();
      window.removeEventListener('keydown',onKey);
    };
    toggle.onclick=()=>{if(!video.src)return;video.paused?video.play().catch(()=>{status.textContent='Wiedergabe konnte nicht gestartet werden.'}):video.pause()};
    wrap.querySelector('#yt-rewind').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.max(0,video.currentTime-10);else status.textContent='Spulen ist erst nach dem Laden des Videos möglich.'};
    wrap.querySelector('#yt-forward').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+10);else status.textContent='Spulen ist erst nach dem Laden des Videos möglich.'};
    video.onplay=update;video.onpause=update;
    video.onloadedmetadata=()=>{toggle.disabled=false;update();status.textContent=''};
    video.onerror=()=>{if(!closed)status.textContent='Wiedergabe fehlgeschlagen. Prüfe Jellyfin, das Videoformat und die Streaming-Verbindung.'};
    wrap.querySelector('#yt-player-close').onclick=close;
    window.addEventListener('keydown',onKey);

    // Authenticated POST creates a random, video-scoped playback ticket.
    // Its URL is safe to pass to the native HTML5 player: no Jellyfin or
    // sidecar API token appears in the URL or in page markup.
    (async()=>{
      try{
        const result=await api('/VelarisYouTube/Videos/'+encodeURIComponent(v.id)+'/Ticket',{method:'POST'},account);
        if(closed||session()?.userId!==account.userId||session()?.url!==account.url)return;
        if(typeof result?.playbackPath!=='string'||!/^\/VelarisYouTube\/Playback\/[A-F0-9]{64}$/.test(result.playbackPath)){
          throw Error('Ungültige Wiedergabe-Freigabe');
        }
        video.src=base(account)+result.playbackPath;
        video.load();
        status.textContent='Stream wird geladen …';
        // iOS Safari may require the user to tap the native play button
        // because the ticket request runs asynchronously.
        try{await video.play()}catch{
          if(!closed)status.textContent='Zum Starten bitte auf ▶ im Videoplayer tippen.';
        }
      }catch(err){
        if(!closed){status.textContent='Wiedergabe konnte nicht vorbereitet werden: '+(err?.message||'Verbindung fehlgeschlagen');toggle.disabled=true}
      }
    })();
  }

  return {show,details,player};
})();
