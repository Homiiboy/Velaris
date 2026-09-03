/** Velaris v0.0.6 — Library / Discover enhancement patch */
(() => {
    'use strict';

    if (window.__VELARIS_V006_PATCH__) return;
    window.__VELARIS_V006_PATCH__ = true;

    const VERSION = '0.0.6';
    const q = (root, selector) => root?.querySelector?.(selector) || null;
    const qa = (root, selector) => root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
    const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
    let timer = 0;
    let observer = null;

    const isVisible = node => {
        if (!node || !node.isConnected) return false;
        if (node.classList?.contains('hide')) return false;
        const style = getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden';
    };

    function getActivePage() {
        const candidates = qa(document, '.page,[data-role="page"]')
            .filter(isVisible)
            .filter(page => !page.closest('.dialog,.actionSheet'));
        return candidates.at(-1) || null;
    }

    function isExcludedPage(page) {
        if (!page) return true;
        return Boolean(
            page.matches('.homePage,.loginPage,.selectServerPage,.videoOsdPage,.nowPlayingPage') ||
            q(page, '.homePage,.detailPagePrimaryContainer,.itemDetailPage,.videoPlayerContainer,.videoOsdPage,.loginPage,.selectServerPage')
        );
    }

    function cardImage(card) {
        const img = q(card, 'img');
        if (img?.currentSrc || img?.src) return img.currentSrc || img.src;
        const box = q(card, '.cardImageContainer,.cardImage');
        const bg = box ? getComputedStyle(box).backgroundImage : '';
        const match = bg && bg !== 'none' ? bg.match(/url\(["']?(.*?)["']?\)/) : null;
        return match?.[1] || '';
    }

    function libraryCards(page) {
        return qa(page, '.card').filter(isVisible);
    }

    function looksLikeLibrary(page) {
        if (!page || isExcludedPage(page)) return false;
        const cards = libraryCards(page);
        const path = `${location.pathname}${location.hash}`.toLowerCase();
        const routeSignal = /movies|tv|series|shows|library|items|collections|favorites|genres|studios|persons|years/.test(path);
        const domSignal = Boolean(q(page, '.itemsContainer,.vertical-wrap,.viewSettings,.viewControls,.alphaPicker,.paging,.listPaging'));
        return cards.length >= 2 && (routeSignal || domSignal);
    }

    function titleInfo(page) {
        const nativeTitle = qa(page, '.pageTitle').find(isVisible) || null;
        const activeTab = qa(document, '.headerTabs .emby-tab-button-active,.headerTabs [aria-selected="true"]').find(isVisible) || null;
        const heading = nativeTitle || activeTab || qa(page, '.sectionTitle').find(isVisible) || null;
        let title = text(heading);
        const route = `${location.pathname}${location.hash}`.toLowerCase();

        if (!title || title.length > 50) {
            if (/movie/.test(route)) title = 'Filme';
            else if (/tv|series|show/.test(route)) title = 'Serien';
            else if (/favorite/.test(route)) title = 'Favoriten';
            else if (/collection/.test(route)) title = 'Sammlungen';
            else title = 'Mediathek';
        }

        const normalized = title.toLowerCase();
        let eyebrow = 'Velaris Collection';
        let subtitle = 'Deine Mediathek in einer ruhigen, cineastischen Übersicht.';
        if (/film|movie/.test(normalized)) subtitle = 'Alle Filme — neu inszeniert für schnelles Stöbern und Entdecken.';
        else if (/serie|show|tv/.test(normalized)) subtitle = 'Serien, Staffeln und Welten — übersichtlich an einem Ort.';
        else if (/favorit|favorite/.test(normalized)) subtitle = 'Deine persönlichen Favoriten, direkt griffbereit.';
        else if (/sammlung|collection/.test(normalized)) subtitle = 'Kuratiere und entdecke zusammengehörige Titel.';
        else if (/genre/.test(normalized)) subtitle = 'Entdecke deine Mediathek nach Genres und Stimmungen.';

        return { title, eyebrow, subtitle, nativeTitle };
    }

    function bestContentRoot(page) {
        const tabs = qa(page, '.pageTabContent').filter(isVisible);
        if (tabs.length) return tabs.at(-1);
        return q(page, '.content-primary,.content') || page;
    }

    function createHero(page) {
        const root = bestContentRoot(page);
        let hero = q(root, ':scope > .velaris-library-hero');
        if (hero) return hero;

        hero = document.createElement('section');
        hero.className = 'velaris-library-hero';
        hero.innerHTML = `
            <div class="velaris-library-hero__glow" aria-hidden="true"></div>
            <div class="velaris-library-hero__copy">
                <div class="velaris-library-hero__eyebrow"></div>
                <h1 class="velaris-library-hero__title"></h1>
                <p class="velaris-library-hero__subtitle"></p>
                <div class="velaris-library-hero__stats">
                    <span class="velaris-library-hero__count"></span>
                    <span class="velaris-library-hero__mode">Library View</span>
                </div>
            </div>
            <div class="velaris-library-hero__art" aria-hidden="true">
                <div class="velaris-library-hero__tile" data-tile="0"></div>
                <div class="velaris-library-hero__tile" data-tile="1"></div>
                <div class="velaris-library-hero__tile" data-tile="2"></div>
            </div>`;
        root.prepend(hero);
        return hero;
    }

    function updateHero(page, cards) {
        const hero = createHero(page);
        const info = titleInfo(page);
        q(hero, '.velaris-library-hero__eyebrow').textContent = info.eyebrow;
        q(hero, '.velaris-library-hero__title').textContent = info.title;
        q(hero, '.velaris-library-hero__subtitle').textContent = info.subtitle;
        q(hero, '.velaris-library-hero__count').textContent = `${cards.length} Titel`;

        if (info.nativeTitle) info.nativeTitle.classList.add('velaris-library-native-title');

        const images = cards.map(cardImage).filter(Boolean).slice(0, 3);
        qa(hero, '.velaris-library-hero__tile').forEach((tile, index) => {
            const image = images[index];
            tile.classList.toggle('is-empty', !image);
            tile.style.backgroundImage = image ? `url("${image.replace(/"/g, '%22')}")` : '';
        });

        hero.dataset.velarisFingerprint = `${info.title}|${cards.length}|${images.join('|')}`;
    }

    function enhanceToolbar(page) {
        const buttons = qa(page, 'button,.emby-button').filter(button => {
            if (!isVisible(button) || button.closest('.velaris-library-hero')) return false;
            const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${text(button)}`.toLowerCase();
            return /filter|sort|view|layout|anzeige|ansicht|sortier|filtern|grid|list/.test(label);
        });

        buttons.forEach(button => button.classList.add('velaris-library-tool'));

        const candidates = [q(page, '.viewSettings'), q(page, '.viewControls'), ...buttons.map(button => button.parentElement)].filter(Boolean);
        const toolbar = candidates
            .filter(node => !node.closest('.velaris-library-hero'))
            .sort((a, b) => qa(b, '.velaris-library-tool').length - qa(a, '.velaris-library-tool').length)[0];

        if (toolbar) toolbar.classList.add('velaris-library-toolbar');
    }

    function enhanceGrid(page) {
        const containers = qa(page, '.itemsContainer,.vertical-wrap').filter(isVisible);
        let grid = null;
        let maxCards = 0;

        containers.forEach(container => {
            const count = qa(container, '.card').length;
            if (count > maxCards) {
                maxCards = count;
                grid = container;
            }
        });

        if (!grid || maxCards < 2) return;
        grid.classList.add('velaris-library-grid');
        qa(grid, '.card').forEach(card => card.classList.add('velaris-library-card'));
    }

    function enhanceAuxiliary(page) {
        qa(page, '.alphaPicker').forEach(node => node.classList.add('velaris-library-alpha'));
        qa(page, '.paging,.listPaging').forEach(node => node.classList.add('velaris-library-paging'));
        qa(page, '.noItemsMessage,.emptyMessage,.noItems').forEach(node => node.classList.add('velaris-library-empty'));
    }

    function cleanupInactive() {
        qa(document, '.velaris-library-page').forEach(page => {
            if (!isVisible(page)) page.classList.remove('velaris-library-page','velaris-library-has-hero');
        });
        if (!qa(document, '.velaris-library-page').some(isVisible)) document.body?.classList.remove('velaris-library-active');
    }

    function enhanceLibrary() {
        cleanupInactive();
        const page = getActivePage();
        if (!looksLikeLibrary(page)) return;

        const cards = libraryCards(page);
        page.classList.add('velaris-library-page','velaris-library-has-hero');
        page.dataset.velarisLibraryVersion = VERSION;
        document.body?.classList.add('velaris-library-active');
        document.documentElement.dataset.velarisLibraryVersion = VERSION;

        updateHero(page, cards);
        enhanceToolbar(page);
        enhanceGrid(page);
        enhanceAuxiliary(page);
    }

    function schedule(delay = 100) {
        clearTimeout(timer);
        timer = window.setTimeout(enhanceLibrary, delay);
    }

    function boot() {
        enhanceLibrary();
        observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) schedule();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        addEventListener('hashchange', () => schedule(45), { passive: true });
        addEventListener('popstate', () => schedule(45), { passive: true });
        addEventListener('resize', () => schedule(120), { passive: true });

        window.VelarisLibrary = Object.freeze({
            version: VERSION,
            refresh: enhanceLibrary,
            stop() {
                observer?.disconnect();
                observer = null;
                clearTimeout(timer);
            }
        });
        console.info(`[Velaris Library] v${VERSION} active`);
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', boot, { once: true })
        : boot();
})();
