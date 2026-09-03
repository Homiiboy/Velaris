/** Velaris v0.0.7 — Search & Navigation */
(() => {
    'use strict';

    if (window.__VELARIS_V007_PATCH__) return;
    window.__VELARIS_V007_PATCH__ = true;

    const VERSION = '0.0.7';
    const MIN_QUERY = 2;
    const SEARCH_LIMIT = 36;
    let searchTimer = 0;
    let requestId = 0;
    let activeIndex = -1;
    let lastResults = [];
    let observer = null;

    const q = (root, selector) => root?.querySelector?.(selector) || null;
    const qa = (root, selector) => root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
    const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
    const isEditable = target => Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'));

    function apiClient() {
        return window.ApiClient || window.apiClient || null;
    }

    function currentUserId(api) {
        try {
            return api?.getCurrentUserId?.() || api?._currentUser?.Id || api?.currentUser?.Id || '';
        } catch {
            return '';
        }
    }

    function pageLabel() {
        const page = document.body?.dataset?.velarisPage || '';
        if (page === 'home') return 'Startseite';
        if (page === 'details') return 'Details';
        if (page === 'player') return 'Player';
        if (page === 'library') return 'Bibliothek';
        const heading = text(q(document, '.pageTitle,.sectionTitle,.headerTabs .emby-tab-button-active'));
        return heading || 'Jellyfin';
    }

    function findNativeHomeTarget() {
        const nodes = qa(document, 'a,button,.emby-tab-button,.navMenuOption');
        return nodes.find(node => /^(home|startseite)$/i.test(text(node)) || /home/i.test(node.getAttribute('aria-label') || ''));
    }

    function goHome() {
        const target = findNativeHomeTarget();
        if (target) {
            target.click();
            return;
        }
        if (location.hash !== '#!/home.html') location.hash = '#!/home.html';
    }

    function overlay() {
        return q(document, '.velaris-search');
    }

    function searchInput() {
        return q(document, '.velaris-search__input');
    }

    function setOpen(open) {
        const el = overlay();
        if (!el) return;
        el.classList.toggle('is-open', open);
        el.setAttribute('aria-hidden', open ? 'false' : 'true');
        document.body?.classList.toggle('velaris-search-open', open);
        if (open) {
            window.setTimeout(() => {
                searchInput()?.focus();
                searchInput()?.select();
            }, 30);
        } else {
            activeIndex = -1;
        }
    }

    function closeSearch() {
        setOpen(false);
    }

    function openSearch(initialValue = '') {
        ensureSearchOverlay();
        const input = searchInput();
        if (input && initialValue) input.value = initialValue;
        setOpen(true);
        if (input?.value?.trim().length >= MIN_QUERY) scheduleSearch(input.value);
    }

    function resultTypeLabel(type) {
        if (type === 'Movie') return 'Film';
        if (type === 'Series') return 'Serie';
        if (type === 'Episode') return 'Episode';
        if (type === 'Person') return 'Person';
        return type || 'Titel';
    }

    function groupLabel(type) {
        if (type === 'Movie') return 'Filme';
        if (type === 'Series') return 'Serien';
        if (type === 'Episode') return 'Episoden';
        return 'Weitere Treffer';
    }

    function imageUrl(api, item) {
        try {
            if (!api || !item?.Id) return '';
            if (typeof api.getImageUrl === 'function') {
                return api.getImageUrl(item.Id, {
                    type: 'Primary',
                    maxWidth: 420,
                    quality: 90,
                    tag: item.ImageTags?.Primary
                });
            }
        } catch {}
        return '';
    }

    function itemMeta(item) {
        const bits = [];
        if (item.Type === 'Episode' && item.SeriesName) bits.push(item.SeriesName);
        if (item.ProductionYear) bits.push(String(item.ProductionYear));
        if (item.Type === 'Episode') {
            const ep = [];
            if (Number.isFinite(item.ParentIndexNumber)) ep.push(`S${item.ParentIndexNumber}`);
            if (Number.isFinite(item.IndexNumber)) ep.push(`E${item.IndexNumber}`);
            if (ep.length) bits.push(ep.join(' '));
        }
        return bits.join(' · ');
    }

    function itemTitle(item) {
        if (item.Type === 'Episode') return item.Name || 'Episode';
        return item.Name || 'Ohne Titel';
    }

    function detailHash(item) {
        if (!item?.Id) return '';
        return `#!/details?id=${encodeURIComponent(item.Id)}`;
    }

    function openItem(item) {
        if (!item?.Id) return;
        closeSearch();
        location.hash = detailHash(item);
    }

    function renderSkeleton(message) {
        const body = q(document, '.velaris-search__body');
        if (!body) return;
        body.innerHTML = `<div class="velaris-search__empty"><span class="velaris-search__empty-mark"></span><strong>${message}</strong><span>Filme, Serien und Episoden aus deiner Mediathek durchsuchen.</span></div>`;
        activeIndex = -1;
    }

    function renderError() {
        const body = q(document, '.velaris-search__body');
        if (!body) return;
        body.innerHTML = '<div class="velaris-search__empty"><span class="velaris-search__empty-mark is-error"></span><strong>Suche momentan nicht verfügbar</strong><span>Velaris konnte Jellyfins Such-API nicht erreichen. Die normale Jellyfin-Suche bleibt weiterhin verfügbar.</span></div>';
        activeIndex = -1;
    }

    function filteredResults() {
        const chip = q(document, '.velaris-search__chip.is-active');
        const filter = chip?.dataset?.type || 'All';
        if (filter === 'All') return lastResults;
        return lastResults.filter(item => item.Type === filter);
    }

    function renderResults() {
        const body = q(document, '.velaris-search__body');
        const count = q(document, '.velaris-search__count');
        if (!body || !count) return;

        const items = filteredResults();
        count.textContent = lastResults.length ? `${lastResults.length} Treffer` : '';

        if (!items.length) {
            renderSkeleton(lastResults.length ? 'Keine Treffer in dieser Kategorie' : 'Keine Treffer gefunden');
            return;
        }

        const order = ['Movie', 'Series', 'Episode', 'Other'];
        const groups = new Map();

        for (const item of items) {
            const key = ['Movie', 'Series', 'Episode'].includes(item.Type) ? item.Type : 'Other';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(item);
        }

        body.replaceChildren();
        let globalIndex = 0;

        for (const key of order) {
            const group = groups.get(key);
            if (!group?.length) continue;

            const section = document.createElement('section');
            section.className = 'velaris-search__group';
            const heading = document.createElement('div');
            heading.className = 'velaris-search__group-head';
            heading.innerHTML = `<h3>${groupLabel(key)}</h3><span>${group.length}</span>`;
            section.appendChild(heading);

            const grid = document.createElement('div');
            grid.className = 'velaris-search__grid';

            for (const item of group) {
                const api = apiClient();
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'velaris-search-card';
                card.dataset.index = String(globalIndex++);
                card.setAttribute('aria-label', `${itemTitle(item)} öffnen`);

                const img = imageUrl(api, item);
                const art = document.createElement('span');
                art.className = 'velaris-search-card__art';
                if (img) art.style.backgroundImage = `url("${img.replace(/"/g, '%22')}")`;
                else art.classList.add('is-placeholder');

                const copy = document.createElement('span');
                copy.className = 'velaris-search-card__copy';
                const kind = document.createElement('span');
                kind.className = 'velaris-search-card__type';
                kind.textContent = resultTypeLabel(item.Type);
                const title = document.createElement('strong');
                title.textContent = itemTitle(item);
                const meta = document.createElement('span');
                meta.className = 'velaris-search-card__meta';
                meta.textContent = itemMeta(item) || 'In deiner Mediathek';

                copy.append(kind, title, meta);
                card.append(art, copy);
                card.addEventListener('click', () => openItem(item));
                grid.appendChild(card);
            }

            section.appendChild(grid);
            body.appendChild(section);
        }

        activeIndex = -1;
    }

    async function performSearch(value) {
        const queryValue = value.trim();
        if (queryValue.length < MIN_QUERY) {
            lastResults = [];
            q(document, '.velaris-search__count').textContent = '';
            renderSkeleton('Wonach möchtest du suchen?');
            return;
        }

        const api = apiClient();
        const userId = currentUserId(api);
        if (!api || !userId || typeof api.getItems !== 'function') {
            renderError();
            return;
        }

        const id = ++requestId;
        const body = q(document, '.velaris-search__body');
        body?.classList.add('is-loading');

        try {
            const response = await api.getItems(userId, {
                SearchTerm: queryValue,
                Recursive: true,
                IncludeItemTypes: 'Movie,Series,Episode',
                Limit: SEARCH_LIMIT,
                Fields: 'PrimaryImageAspectRatio,ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,ImageTags'
            });

            if (id !== requestId) return;
            lastResults = Array.isArray(response?.Items) ? response.Items : [];
            renderResults();
        } catch (error) {
            if (id !== requestId) return;
            console.warn('[Velaris Search] search failed', error);
            renderError();
        } finally {
            if (id === requestId) body?.classList.remove('is-loading');
        }
    }

    function scheduleSearch(value) {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => performSearch(value), 260);
    }

    function moveActive(delta) {
        const cards = qa(document, '.velaris-search-card');
        if (!cards.length) return;
        activeIndex = (activeIndex + delta + cards.length) % cards.length;
        cards.forEach((card, index) => card.classList.toggle('is-active', index === activeIndex));
        cards[activeIndex]?.focus({ preventScroll: true });
        cards[activeIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }

    function ensureSearchOverlay() {
        if (overlay()) return;

        const root = document.createElement('div');
        root.className = 'velaris-search';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <button class="velaris-search__backdrop" type="button" aria-label="Suche schließen"></button>
            <section class="velaris-search__panel" role="dialog" aria-modal="true" aria-label="Velaris Suche">
                <header class="velaris-search__header">
                    <div class="velaris-search__brand">
                        <span class="velaris-search__brand-mark"></span>
                        <span>Velaris Search</span>
                    </div>
                    <button class="velaris-search__close emby-button" type="button" aria-label="Suche schließen">×</button>
                </header>
                <div class="velaris-search__field-wrap">
                    <span class="velaris-search__icon">⌕</span>
                    <input class="velaris-search__input" type="search" autocomplete="off" spellcheck="false" placeholder="Filme, Serien und Episoden suchen …" aria-label="Mediathek durchsuchen">
                    <kbd>ESC</kbd>
                </div>
                <div class="velaris-search__toolbar">
                    <div class="velaris-search__chips" role="tablist" aria-label="Ergebnisfilter">
                        <button type="button" class="velaris-search__chip is-active" data-type="All">Alles</button>
                        <button type="button" class="velaris-search__chip" data-type="Movie">Filme</button>
                        <button type="button" class="velaris-search__chip" data-type="Series">Serien</button>
                        <button type="button" class="velaris-search__chip" data-type="Episode">Episoden</button>
                    </div>
                    <span class="velaris-search__count"></span>
                </div>
                <div class="velaris-search__body"></div>
                <footer class="velaris-search__footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> navigieren</span>
                    <span><kbd>Enter</kbd> öffnen</span>
                    <span><kbd>Ctrl</kbd><kbd>K</kbd> Suche</span>
                </footer>
            </section>`;

        q(root, '.velaris-search__backdrop').addEventListener('click', closeSearch);
        q(root, '.velaris-search__close').addEventListener('click', closeSearch);

        const input = q(root, '.velaris-search__input');
        input.addEventListener('input', event => scheduleSearch(event.target.value));
        input.addEventListener('keydown', event => {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                moveActive(1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                moveActive(-1);
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeSearch();
            }
        });

        qa(root, '.velaris-search__chip').forEach(chip => {
            chip.addEventListener('click', () => {
                qa(root, '.velaris-search__chip').forEach(item => item.classList.toggle('is-active', item === chip));
                renderResults();
            });
        });

        document.body.appendChild(root);
        renderSkeleton('Wonach möchtest du suchen?');
    }

    function ensureCommandBar() {
        const header = q(document, '.skinHeader');
        if (!header || q(header, '.velaris-commandbar')) return;

        const bar = document.createElement('nav');
        bar.className = 'velaris-commandbar';
        bar.setAttribute('aria-label', 'Velaris Schnellnavigation');
        bar.innerHTML = `
            <button type="button" class="velaris-commandbar__button emby-button" data-action="home" aria-label="Startseite">
                <span class="velaris-commandbar__glyph">⌂</span><span class="velaris-commandbar__label">Home</span>
            </button>
            <button type="button" class="velaris-commandbar__button velaris-commandbar__button--search emby-button" data-action="search" aria-label="Velaris Suche öffnen">
                <span class="velaris-commandbar__glyph">⌕</span><span class="velaris-commandbar__label">Suche</span><kbd>Ctrl K</kbd>
            </button>
            <span class="velaris-commandbar__context"></span>`;

        q(bar, '[data-action="home"]').addEventListener('click', goHome);
        q(bar, '[data-action="search"]').addEventListener('click', () => openSearch());
        header.appendChild(bar);
    }

    function updateCommandBar() {
        const context = q(document, '.velaris-commandbar__context');
        if (context) context.textContent = pageLabel();

        const page = document.body?.dataset?.velarisPage;
        const home = q(document, '.velaris-commandbar [data-action="home"]');
        home?.classList.toggle('is-active', page === 'home');
    }

    function hijackNativeSearch() {
        const header = q(document, '.skinHeader');
        if (!header) return;
        const buttons = qa(header, 'button,a');
        for (const button of buttons) {
            const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${text(button)}`;
            if (!/search|suche/i.test(label) || button.closest('.velaris-commandbar')) continue;
            if (button.dataset.velarisSearchBound) continue;
            button.dataset.velarisSearchBound = '1';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                openSearch();
            }, true);
        }
    }

    function enhance() {
        if (!document.body) return;
        ensureSearchOverlay();
        ensureCommandBar();
        updateCommandBar();
        hijackNativeSearch();
        document.documentElement.dataset.velarisSearchVersion = VERSION;
    }

    function boot() {
        enhance();

        observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) {
                window.clearTimeout(searchTimer);
                searchTimer = window.setTimeout(enhance, 100);
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        document.addEventListener('keydown', event => {
            if (event.defaultPrevented) return;

            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                openSearch();
                return;
            }

            if (event.key === '/' && !isEditable(event.target) && !overlay()?.classList.contains('is-open')) {
                event.preventDefault();
                openSearch();
                return;
            }

            if (event.key === 'Escape' && overlay()?.classList.contains('is-open')) {
                event.preventDefault();
                closeSearch();
                return;
            }

            if (overlay()?.classList.contains('is-open') && event.key === 'ArrowDown' && !isEditable(event.target)) {
                event.preventDefault();
                moveActive(1);
            } else if (overlay()?.classList.contains('is-open') && event.key === 'ArrowUp' && !isEditable(event.target)) {
                event.preventDefault();
                moveActive(-1);
            }
        }, true);

        addEventListener('hashchange', () => window.setTimeout(() => {
            updateCommandBar();
            if (overlay()?.classList.contains('is-open')) closeSearch();
        }, 60), { passive: true });

        window.VelarisSearch = Object.freeze({
            version: VERSION,
            open: openSearch,
            close: closeSearch,
            refresh: enhance,
            stop() {
                observer?.disconnect();
                observer = null;
            }
        });

        console.info(`[Velaris Search] v${VERSION} active`);
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', boot, { once: true })
        : boot();
})();
