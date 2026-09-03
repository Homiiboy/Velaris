/** Velaris v0.2.0 — Series Experience */
(() => {
    'use strict';

    if (window.__VELARIS_V020_PATCH__) return;
    window.__VELARIS_V020_PATCH__ = true;

    const VERSION = '0.2.0';
    const ENHANCE_DELAY = 110;
    const FIELDS = 'Overview,PrimaryImageAspectRatio,ImageTags,BackdropImageTags,ParentBackdropImageTags,RunTimeTicks,PremiereDate,ProductionYear';

    let observer = null;
    let enhanceTimer = 0;
    let loadToken = 0;
    let state = freshState();

    const q = (root, selector) => root?.querySelector?.(selector) || null;
    const qa = (root, selector) => root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
    const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();

    function freshState() {
        return {
            seriesId: '',
            series: null,
            seasons: [],
            selectedSeasonId: '',
            episodeCache: new Map(),
            nextUp: null
        };
    }

    function apiClient() {
        return window.ApiClient || window.apiClient || null;
    }

    function currentUserId(api = apiClient()) {
        try {
            return api?.getCurrentUserId?.() || api?._currentUser?.Id || api?.currentUser?.Id || '';
        } catch {
            return '';
        }
    }

    function hashParams() {
        const hash = location.hash || '';
        const queryIndex = hash.indexOf('?');
        const query = queryIndex >= 0 ? hash.slice(queryIndex + 1) : location.search.replace(/^\?/, '');
        return new URLSearchParams(query);
    }

    function currentItemId() {
        return hashParams().get('id') || '';
    }

    function detailsHash(itemId) {
        const params = hashParams();
        const next = new URLSearchParams();
        next.set('id', itemId);
        const serverId = params.get('serverId') || params.get('serverid');
        if (serverId) next.set('serverId', serverId);
        return `#!/details?${next.toString()}`;
    }

    function openItem(item) {
        if (!item?.Id) return;
        location.hash = detailsHash(item.Id);
    }

    function imageUrl(api, item, type = 'Primary', maxWidth = 1100) {
        if (!api || !item?.Id || typeof api.getImageUrl !== 'function') return '';
        try {
            const tag = type === 'Primary'
                ? item.ImageTags?.Primary
                : item.ImageTags?.[type] || item[`${type}ImageTag`];
            return api.getImageUrl(item.Id, {
                type,
                maxWidth,
                quality: 90,
                tag
            });
        } catch {
            return '';
        }
    }

    function ticksToMinutes(ticks) {
        const value = Number(ticks || 0);
        return value > 0 ? Math.max(1, Math.round(value / 600000000)) : 0;
    }

    function episodeCode(item) {
        const season = Number.isFinite(item?.ParentIndexNumber) ? item.ParentIndexNumber : null;
        const episode = Number.isFinite(item?.IndexNumber) ? item.IndexNumber : null;
        if (season == null && episode == null) return 'Episode';
        if (season === 0 && episode != null) return `Special ${episode}`;
        if (season != null && episode != null) return `S${String(season).padStart(2, '0')} · E${String(episode).padStart(2, '0')}`;
        if (episode != null) return `E${String(episode).padStart(2, '0')}`;
        return `Staffel ${season}`;
    }

    function dateLabel(value) {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        try {
            return new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
        } catch {
            return '';
        }
    }

    function playedPercent(item) {
        if (item?.UserData?.Played) return 100;
        const value = Number(item?.UserData?.PlayedPercentage || 0);
        return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    }

    function seasonLabel(season) {
        if (season?.IndexNumber === 0) return 'Specials';
        if (season?.Name) return season.Name;
        if (Number.isFinite(season?.IndexNumber)) return `Staffel ${season.IndexNumber}`;
        return 'Staffel';
    }

    function seasonSortValue(season) {
        const index = Number(season?.IndexNumber);
        if (!Number.isFinite(index)) return 9000;
        return index === 0 ? 9999 : index;
    }

    function seasonProgress(season) {
        const total = Number(season?.ChildCount || 0);
        const unplayed = Number(season?.UserData?.UnplayedItemCount);
        if (!total || !Number.isFinite(unplayed)) return null;
        const watched = Math.max(0, total - unplayed);
        return {
            total,
            watched,
            percent: Math.round((watched / total) * 100)
        };
    }

    function hub() {
        return q(document, '.velaris-series-hub');
    }

    function clearSeriesState() {
        state = freshState();
        document.body?.classList.remove('velaris-series-ready', 'velaris-series-loading');
        document.documentElement.removeAttribute('data-velaris-series-version');
        q(document, '.velaris-series-hub')?.remove();
    }

    function ensureHub(series) {
        let root = hub();
        if (root) return root;

        const secondary = q(document, '.detailPageSecondaryContainer');
        const primary = q(document, '.detailPagePrimaryContainer');
        const anchor = secondary || primary?.parentElement;
        if (!anchor) return null;

        root = document.createElement('section');
        root.className = 'velaris-series-hub';
        root.setAttribute('aria-label', 'Velaris Serienübersicht');
        root.innerHTML = `
            <header class="velaris-series-hub__header">
                <div class="velaris-series-hub__copy">
                    <span class="velaris-series-hub__eyebrow">Velaris Series</span>
                    <h2>Staffeln & Episoden</h2>
                    <p>Deine Serie als zusammenhängende Watch Experience.</p>
                </div>
                <div class="velaris-series-hub__stats" aria-label="Serienstatistik"></div>
            </header>
            <section class="velaris-series-next" hidden>
                <div class="velaris-series-next__art" aria-hidden="true"></div>
                <div class="velaris-series-next__shade" aria-hidden="true"></div>
                <div class="velaris-series-next__copy">
                    <span class="velaris-series-next__eyebrow">Als Nächstes</span>
                    <span class="velaris-series-next__code"></span>
                    <h3 class="velaris-series-next__title"></h3>
                    <p class="velaris-series-next__overview"></p>
                    <div class="velaris-series-next__meta"></div>
                    <button type="button" class="velaris-series-next__button emby-button">Folge öffnen</button>
                </div>
            </section>
            <div class="velaris-series-seasons-wrap">
                <div class="velaris-series-section-head">
                    <div><span>Staffeln</span><strong class="velaris-series-season-current"></strong></div>
                    <span class="velaris-series-season-summary"></span>
                </div>
                <div class="velaris-series-seasons" role="tablist" aria-label="Staffeln"></div>
            </div>
            <section class="velaris-series-episodes" aria-live="polite">
                <div class="velaris-series-episodes__head">
                    <div><span class="velaris-series-episodes__eyebrow">Episode Guide</span><h3 class="velaris-series-episodes__title">Episoden</h3></div>
                    <span class="velaris-series-episodes__progress"></span>
                </div>
                <div class="velaris-series-episodes__state">Episoden werden geladen …</div>
                <div class="velaris-series-episodes__grid"></div>
            </section>`;

        if (secondary) secondary.prepend(root);
        else anchor.appendChild(root);

        root.dataset.seriesId = series.Id;
        return root;
    }

    function renderStats(series, seasons) {
        const target = q(hub(), '.velaris-series-hub__stats');
        if (!target) return;
        const episodeCount = seasons.reduce((sum, season) => sum + Number(season?.ChildCount || 0), 0);
        const bits = [
            ['Staffeln', seasons.length],
            ['Episoden', episodeCount || '—']
        ];
        target.replaceChildren();
        bits.forEach(([label, value]) => {
            const pill = document.createElement('span');
            pill.className = 'velaris-series-stat';
            const strong = document.createElement('strong');
            strong.textContent = String(value);
            const copy = document.createElement('span');
            copy.textContent = label;
            pill.append(strong, copy);
            target.appendChild(pill);
        });
        if (series?.Status) {
            const status = document.createElement('span');
            status.className = 'velaris-series-stat velaris-series-stat--status';
            status.textContent = series.Status;
            target.appendChild(status);
        }
    }

    function renderNextUp(item) {
        const root = q(hub(), '.velaris-series-next');
        if (!root) return;
        if (!item) {
            root.hidden = true;
            return;
        }

        const api = apiClient();
        const art = imageUrl(api, item, 'Primary', 1400);
        root.hidden = false;
        root.classList.toggle('is-complete', Boolean(item.UserData?.Played));
        const artEl = q(root, '.velaris-series-next__art');
        artEl.style.backgroundImage = art ? `url("${art.replace(/"/g, '%22')}")` : '';
        artEl.classList.toggle('is-placeholder', !art);
        q(root, '.velaris-series-next__code').textContent = episodeCode(item);
        q(root, '.velaris-series-next__title').textContent = item.Name || 'Nächste Folge';
        q(root, '.velaris-series-next__overview').textContent = item.Overview || 'Bereit, wenn du es bist.';

        const meta = [];
        const minutes = ticksToMinutes(item.RunTimeTicks);
        if (minutes) meta.push(`${minutes} Min.`);
        if (item.ProductionYear) meta.push(String(item.ProductionYear));
        const progress = playedPercent(item);
        if (progress > 0 && progress < 100) meta.push(`${Math.round(progress)} % gesehen`);
        q(root, '.velaris-series-next__meta').textContent = meta.join(' · ');

        const button = q(root, '.velaris-series-next__button');
        button.onclick = () => openItem(item);
    }

    function renderSeasonTabs() {
        const root = hub();
        const tabs = q(root, '.velaris-series-seasons');
        if (!tabs) return;
        tabs.replaceChildren();

        for (const season of state.seasons) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'velaris-series-season emby-button';
            button.dataset.seasonId = season.Id;
            button.setAttribute('role', 'tab');
            button.setAttribute('aria-selected', season.Id === state.selectedSeasonId ? 'true' : 'false');
            button.classList.toggle('is-active', season.Id === state.selectedSeasonId);

            const label = document.createElement('strong');
            label.textContent = seasonLabel(season);
            const meta = document.createElement('span');
            const progress = seasonProgress(season);
            meta.textContent = progress ? `${progress.watched}/${progress.total} gesehen` : `${season.ChildCount || '—'} Folgen`;
            button.append(label, meta);

            if (progress) {
                const track = document.createElement('span');
                track.className = 'velaris-series-season__progress';
                const fill = document.createElement('span');
                fill.style.width = `${progress.percent}%`;
                track.appendChild(fill);
                button.appendChild(track);
            }

            button.addEventListener('click', () => selectSeason(season.Id));
            tabs.appendChild(button);
        }
    }

    function renderSeasonHeader(season, episodes = []) {
        const root = hub();
        if (!root || !season) return;
        q(root, '.velaris-series-season-current').textContent = seasonLabel(season);
        const progress = seasonProgress(season);
        q(root, '.velaris-series-season-summary').textContent = progress
            ? `${progress.percent}% abgeschlossen`
            : `${episodes.length || season.ChildCount || 0} Episoden`;
        q(root, '.velaris-series-episodes__title').textContent = seasonLabel(season);

        const played = episodes.filter(item => item?.UserData?.Played).length;
        const partial = episodes.filter(item => {
            const percent = playedPercent(item);
            return percent > 0 && percent < 100;
        }).length;
        const status = q(root, '.velaris-series-episodes__progress');
        if (episodes.length) {
            const bits = [`${played}/${episodes.length} gesehen`];
            if (partial) bits.push(`${partial} begonnen`);
            status.textContent = bits.join(' · ');
        } else {
            status.textContent = '';
        }
    }

    function episodeMeta(item) {
        const bits = [];
        const minutes = ticksToMinutes(item.RunTimeTicks);
        const date = dateLabel(item.PremiereDate);
        if (minutes) bits.push(`${minutes} Min.`);
        if (date) bits.push(date);
        return bits.join(' · ');
    }

    function episodeCard(item) {
        const api = apiClient();
        const card = document.createElement('article');
        card.className = 'velaris-episode-card';
        card.dataset.itemId = item.Id || '';
        const percent = playedPercent(item);
        if (item.UserData?.Played) card.classList.add('is-played');
        else if (percent > 0) card.classList.add('is-progress');

        const artButton = document.createElement('button');
        artButton.type = 'button';
        artButton.className = 'velaris-episode-card__art emby-button';
        artButton.setAttribute('aria-label', `${item.Name || 'Episode'} öffnen`);
        const image = imageUrl(api, item, 'Primary', 900);
        if (image) artButton.style.backgroundImage = `url("${image.replace(/"/g, '%22')}")`;
        else artButton.classList.add('is-placeholder');
        artButton.addEventListener('click', () => openItem(item));

        const code = document.createElement('span');
        code.className = 'velaris-episode-card__code';
        code.textContent = episodeCode(item);
        artButton.appendChild(code);

        if (item.UserData?.Played) {
            const watched = document.createElement('span');
            watched.className = 'velaris-episode-card__watched';
            watched.textContent = '✓ Gesehen';
            artButton.appendChild(watched);
        }

        if (percent > 0 && percent < 100) {
            const progress = document.createElement('span');
            progress.className = 'velaris-episode-card__progress';
            const fill = document.createElement('span');
            fill.style.width = `${percent}%`;
            progress.appendChild(fill);
            artButton.appendChild(progress);
        }

        const body = document.createElement('div');
        body.className = 'velaris-episode-card__body';
        const header = document.createElement('div');
        header.className = 'velaris-episode-card__head';
        const title = document.createElement('h4');
        title.textContent = item.Name || 'Episode';
        const meta = document.createElement('span');
        meta.textContent = episodeMeta(item);
        header.append(title, meta);

        const overview = document.createElement('p');
        overview.textContent = item.Overview || 'Für diese Episode ist noch keine Beschreibung hinterlegt.';

        const action = document.createElement('button');
        action.type = 'button';
        action.className = 'velaris-episode-card__action emby-button';
        action.textContent = percent > 0 && percent < 100 ? 'Fortsetzen' : 'Öffnen';
        action.addEventListener('click', () => openItem(item));

        body.append(header, overview, action);
        card.append(artButton, body);
        return card;
    }

    function renderEpisodes(season, episodes) {
        const root = hub();
        const grid = q(root, '.velaris-series-episodes__grid');
        const status = q(root, '.velaris-series-episodes__state');
        if (!grid || !status) return;

        renderSeasonHeader(season, episodes);
        grid.replaceChildren();
        status.classList.remove('is-error');

        if (!episodes.length) {
            status.hidden = false;
            status.textContent = season?.IndexNumber === 0
                ? 'Keine Specials in dieser Staffel gefunden.'
                : 'Für diese Staffel wurden keine Episoden gefunden.';
            return;
        }

        status.hidden = true;
        const fragment = document.createDocumentFragment();
        episodes.forEach(item => fragment.appendChild(episodeCard(item)));
        grid.appendChild(fragment);
    }

    function setEpisodeLoading(season) {
        const root = hub();
        const status = q(root, '.velaris-series-episodes__state');
        const grid = q(root, '.velaris-series-episodes__grid');
        if (status) {
            status.hidden = false;
            status.classList.remove('is-error');
            status.textContent = `${seasonLabel(season)} wird geladen …`;
        }
        grid?.replaceChildren();
        renderSeasonHeader(season, []);
    }

    function setEpisodeError(season) {
        const root = hub();
        const status = q(root, '.velaris-series-episodes__state');
        if (!status) return;
        status.hidden = false;
        status.classList.add('is-error');
        status.textContent = `${seasonLabel(season)} konnte nicht geladen werden. Die native Jellyfin-Ansicht bleibt darunter verfügbar.`;
        document.body?.classList.remove('velaris-series-ready');
    }

    async function fetchEpisodes(seriesId, seasonId) {
        if (state.episodeCache.has(seasonId)) return state.episodeCache.get(seasonId);
        const api = apiClient();
        const userId = currentUserId(api);
        if (!api || !userId || typeof api.getEpisodes !== 'function') return [];

        const result = await api.getEpisodes(seriesId, {
            seasonId,
            userId,
            UserId: userId,
            Fields: FIELDS,
            EnableUserData: true,
            IsVirtualUnaired: false,
            IsMissing: false
        });
        const episodes = Array.isArray(result?.Items) ? result.Items : [];
        state.episodeCache.set(seasonId, episodes);
        return episodes;
    }

    async function selectSeason(seasonId, options = {}) {
        const season = state.seasons.find(item => item.Id === seasonId);
        if (!season) return;
        state.selectedSeasonId = seasonId;
        renderSeasonTabs();
        setEpisodeLoading(season);

        const token = ++loadToken;
        try {
            const episodes = await fetchEpisodes(state.seriesId, seasonId);
            if (token !== loadToken || state.selectedSeasonId !== seasonId) return;
            renderEpisodes(season, episodes);

            if (!state.nextUp) {
                const candidate = episodes.find(item => !item?.UserData?.Played) || episodes[0] || null;
                if (candidate) renderNextUp(candidate);
            }

            if (!options.silent) {
                const activeTab = qa(hub(), '[data-season-id]').find(node => node.dataset.seasonId === seasonId);
                activeTab?.focus?.({ preventScroll: true });
            }
        } catch (error) {
            if (token !== loadToken) return;
            console.warn('[Velaris Series] Episode loading failed.', error);
            setEpisodeError(season);
        }
    }

    async function loadNextUp(series) {
        const api = apiClient();
        const userId = currentUserId(api);
        if (!api || !userId || typeof api.getNextUpEpisodes !== 'function') return null;
        try {
            const result = await api.getNextUpEpisodes({
                SeriesId: series.Id,
                UserId: userId,
                Limit: 1,
                Fields: FIELDS,
                EnableUserData: true
            });
            return Array.isArray(result?.Items) ? result.Items[0] || null : null;
        } catch (error) {
            console.debug('[Velaris Series] Next Up unavailable.', error);
            return null;
        }
    }

    async function loadSeries(itemId) {
        const api = apiClient();
        const userId = currentUserId(api);
        if (!api || !userId || typeof api.getItem !== 'function') return;

        const request = ++loadToken;
        document.body?.classList.add('velaris-series-loading');

        try {
            const item = await api.getItem(userId, itemId);
            if (request !== loadToken) return;
            if (item?.Type !== 'Series') {
                clearSeriesState();
                return;
            }

            if (state.seriesId !== item.Id) state = freshState();
            state.seriesId = item.Id;
            state.series = item;

            const root = ensureHub(item);
            if (!root) return;

            const seasonsResult = typeof api.getSeasons === 'function'
                ? await api.getSeasons(item.Id, {
                    userId,
                    UserId: userId,
                    Fields: 'ItemCounts,Overview,PrimaryImageAspectRatio,ImageTags',
                    EnableUserData: true
                })
                : { Items: [] };
            if (request !== loadToken) return;

            state.seasons = (Array.isArray(seasonsResult?.Items) ? seasonsResult.Items : [])
                .filter(season => season?.Id)
                .sort((a, b) => seasonSortValue(a) - seasonSortValue(b));

            renderStats(item, state.seasons);
            state.nextUp = await loadNextUp(item);
            if (request !== loadToken) return;
            renderNextUp(state.nextUp);

            const preferredSeasonId = state.nextUp?.SeasonId;
            const defaultSeason = state.seasons.find(season => season.Id === preferredSeasonId)
                || state.seasons.find(season => season.IndexNumber !== 0)
                || state.seasons[0];

            state.selectedSeasonId = defaultSeason?.Id || '';
            renderSeasonTabs();

            if (defaultSeason) await selectSeason(defaultSeason.Id, { silent: true });
            else {
                const status = q(root, '.velaris-series-episodes__state');
                if (status) status.textContent = 'Für diese Serie wurden keine Staffeln gefunden.';
            }

            document.body?.classList.add('velaris-series-ready');
            document.body?.classList.remove('velaris-series-loading');
            document.documentElement.dataset.velarisSeriesVersion = VERSION;
        } catch (error) {
            if (request !== loadToken) return;
            document.body?.classList.remove('velaris-series-loading', 'velaris-series-ready');
            console.warn('[Velaris Series] Could not build Series Hub.', error);
            window.VelarisShell?.toast?.('Series Hub konnte nicht geladen werden.', { type: 'error' });
        }
    }

    function decorateNativeEpisodeSurfaces() {
        const page = q(document, '.itemDetailPage,.velaris-detail-page');
        if (!page) return;
        qa(page, '#childrenCollapsible,#listChildrenCollapsible,.nextUpSection,.moreFromSeasonSection')
            .forEach(section => section.classList.add('velaris-series-native-surface'));
        qa(page, '.listItem,.card').forEach(card => {
            const haystack = `${text(card)} ${card.getAttribute?.('aria-label') || ''}`;
            if (/S\d+|E\d+|episode|folge/i.test(haystack)) card.classList.add('velaris-native-episode');
        });
    }

    function enhance() {
        decorateNativeEpisodeSurfaces();
        const itemId = currentItemId();
        const detailPage = q(document, '.itemDetailPage,.detailPagePrimaryContainer');
        if (!itemId || !detailPage) {
            if (state.seriesId) clearSeriesState();
            return;
        }

        if (state.seriesId && state.seriesId === itemId && hub()?.isConnected) {
            document.documentElement.dataset.velarisSeriesVersion = VERSION;
            return;
        }

        loadSeries(itemId);
    }

    function scheduleEnhance(delay = ENHANCE_DELAY) {
        window.clearTimeout(enhanceTimer);
        enhanceTimer = window.setTimeout(enhance, delay);
    }

    function boot() {
        enhance();
        observer = new MutationObserver(mutations => {
            if (mutations.some(m => m.addedNodes.length || m.removedNodes.length)) scheduleEnhance();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        addEventListener('hashchange', () => {
            loadToken++;
            if (state.seriesId && currentItemId() !== state.seriesId) clearSeriesState();
            scheduleEnhance(70);
        }, { passive: true });
        addEventListener('popstate', () => scheduleEnhance(70), { passive: true });
        addEventListener('velaris:route-settled', () => scheduleEnhance(40));

        window.VelarisSeries = Object.freeze({
            version: VERSION,
            refresh: () => {
                loadToken++;
                state = freshState();
                q(document, '.velaris-series-hub')?.remove();
                scheduleEnhance(0);
            },
            selectSeason,
            current() {
                return {
                    seriesId: state.seriesId,
                    seasonId: state.selectedSeasonId,
                    seasons: state.seasons.length
                };
            },
            stop() {
                observer?.disconnect();
                observer = null;
                window.clearTimeout(enhanceTimer);
                loadToken++;
            }
        });

        console.info(`[Velaris Series] v${VERSION} active`);
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', boot, { once: true })
        : boot();
})();
