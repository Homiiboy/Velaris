/* Velaris YouTube – Web category, personal links, details and player UI.
 * Uses only the authenticated Jellyfin metadata API; never accesses the
 * sidecar directly or puts a Jellyfin/sidecar token into video URLs.
 * Real HTML5 playback remains gated until the secure media delivery phase.
 */
globalThis.VelarisYouTube = (() => {
  const DEMO = 'jNQXAC9IVRw';
  const idPattern = /^[a-zA-Z0-9_-]{11}$/;
  const cache = new Map();
  let generation = 0;
  let currentVideo = null;

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
        '<div class="yt-actions"><button type="button" class="primary" id="yt-play">▶ Player öffnen</button>'+
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
    // The native player controls are ready. Do not attach a signed source URL
    // or Jellyfin token to <video src>. Browser-safe delivery is phase 5.
    document.querySelector('#yt-player')?.remove();
    const wrap=document.createElement('div');
    wrap.className='yt-player';wrap.id='yt-player';
    wrap.innerHTML='<div class="yt-player-top"><button class="secondary" id="yt-player-close" type="button">‹ Zurück</button><strong>'+esc(v.title || 'YouTube')+'</strong></div>'+
      '<video id="yt-video" controls playsinline preload="none" poster="'+esc(thumb(v))+'" aria-label="'+esc(v.title || 'YouTube-Video')+'"></video>'+
      '<div class="yt-player-bottom"><div class="yt-transport"><button id="yt-rewind" type="button" aria-label="10 Sekunden zurück">↶ 10</button><button id="yt-toggle" type="button" disabled aria-label="Abspielen oder pausieren">▶ Start</button><button id="yt-forward" type="button" aria-label="10 Sekunden vor">10 ↷</button></div>'+
      '<p class="yt-player-message" role="status">Player-Oberfläche vorbereitet. Die Browser-Wiedergabe wird erst nach sicherer Authentifizierung des Videostreams freigeschaltet.</p></div>';
    app.append(wrap);
    const video=wrap.querySelector('video');
    const status=wrap.querySelector('.yt-player-message');
    const toggle=wrap.querySelector('#yt-toggle');
    const update=()=>{toggle.textContent=video.paused?'▶ Start':'Ⅱ Pause'};
    toggle.onclick=()=>{if(!video.src)return;video.paused?video.play().catch(()=>{}):video.pause()};
    wrap.querySelector('#yt-rewind').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.max(0,video.currentTime-10);else status.textContent='Spulen ist erst bei einem geladenen Videostream möglich.'};
    wrap.querySelector('#yt-forward').onclick=()=>{if(Number.isFinite(video.duration))video.currentTime=Math.min(video.duration,video.currentTime+10);else status.textContent='Spulen ist erst bei einem geladenen Videostream möglich.'};
    video.onplay=update;video.onpause=update;video.onloadedmetadata=()=>{toggle.disabled=false;update();status.textContent=''};
    const close=()=>{video.pause();video.removeAttribute('src');video.load();wrap.remove();window.removeEventListener('keydown',onKey)};
    const onKey=e=>{if(e.key==='Escape')close()};
    wrap.querySelector('#yt-player-close').onclick=close;
    window.addEventListener('keydown',onKey);
  }

  return {show,details,player};
})();
