/** Velaris v0.0.5 */
(() => {
    'use strict';

    if (window.__VELARIS_V005__) return;
    window.__VELARIS_V005__ = true;

    const VERSION = '0.0.5';
    const HERO_INTERVAL = 11000;
    const rx = {
        continue: /continue\s*watching|weiterschauen|weiter\s*schauen|fortsetzen/i,
        next: /next\s*up|als\s*n[aä]chstes|n[aä]chste\s*folgen/i,
        latest: /latest|recently\s*added|neu\s*hinzugef[uü]gt|zuletzt\s*hinzugef[uü]gt|neueste/i,
        favorites: /favorites?|favoriten/i
    };

    let timer = 0;
    let observer = null;
    let heroItems = [];
    let heroIndex = 0;
    let heroRotation = 0;
    let heroFingerprint = '';
    let heroVisible = true;

    const q = (root, selector) => root?.querySelector?.(selector) || null;
    const qa = (root, selector) => root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
    const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();
    const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    function detectPage() {
        const body = document.body;
        if (!body) return 'unknown';

        let page = 'browse';
        if (q(document, '.homePage')) page = 'home';
        else if (q(document, '.detailPagePrimaryContainer,.itemDetailPage')) page = 'details';
        else if (q(document, '.videoOsdPage,.videoPlayerContainer,.nowPlayingPage')) page = 'player';
        else if (q(document, '.loginPage,.selectServerPage')) page = 'login';

        body.dataset.velarisPage = page;
        body.classList.add('velaris-active');
        return page;
    }

    function enhanceHeader() {
        const header = q(document, '.skinHeader');
        if (!header) return;

        header.classList.add('velaris-header');

        if (!q(header, '.velaris-brand')) {
            const brand = document.createElement('div');
            brand.className = 'velaris-brand';
            brand.innerHTML = '<span class="velaris-brand__mark"></span><span>Velaris</span>';
            header.appendChild(brand);
        }

        q(header, '.headerTabs')?.classList.add('velaris-tabs');
    }

    function classify(section) {
        const title = text(q(section, '.sectionTitle'));
        section.classList.remove(
            'velaris-row--continue',
            'velaris-row--next',
            'velaris-row--latest',
            'velaris-row--favorites',
            'velaris-row--featured'
        );

        let kind = 'standard';
        if (rx.continue.test(title)) kind = 'continue';
        else if (rx.next.test(title)) kind = 'next';
        else if (rx.latest.test(title)) kind = 'latest';
        else if (rx.favorites.test(title)) kind = 'favorites';

        section.dataset.velarisKind = kind;
        if (kind !== 'standard') section.classList.add(`velaris-row--${kind}`);
    }

    function getScroller(section) {
        const candidates = qa(section, '.emby-scroller,.itemsContainer');
        return candidates.find(el => el.scrollWidth > el.clientWidth + 24) || candidates[0] || null;
    }

    function updateRailState(section, rail) {
        if (!rail) return;
        const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
        section.classList.toggle('velaris-can-scroll-left', rail.scrollLeft > 8);
        section.classList.toggle('velaris-can-scroll-right', rail.scrollLeft < max - 8);
    }

    function addRailControls(section) {
        const head = q(section, '.sectionTitleContainer');
        const rail = getScroller(section);
        if (!head || !rail) return;

        if (!q(section, '.velaris-rail-controls')) {
            const wrap = document.createElement('div');
            wrap.className = 'velaris-rail-controls';

            [-1, 1].forEach(dir => {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `velaris-rail-button velaris-rail-button--${dir < 0 ? 'prev' : 'next'} emby-button`;
                button.setAttribute('aria-label', dir < 0 ? 'Zurück' : 'Weiter');
                button.textContent = dir < 0 ? '‹' : '›';
                button.addEventListener('click', event => {
                    event.preventDefault();
                    event.stopPropagation();
                    rail.scrollBy({
                        left: Math.max(rail.clientWidth * 0.84, 320) * dir,
                        behavior: reduceMotion() ? 'auto' : 'smooth'
                    });
                });
                wrap.appendChild(button);
            });

            head.style.position = 'relative';
            head.appendChild(wrap);
        }

        if (!rail.dataset.velarisScrollBound) {
            rail.dataset.velarisScrollBound = '1';
            rail.addEventListener('scroll', () => updateRailState(section, rail), { passive: true });
        }

        updateRailState(section, rail);
    }

    function cardTitle(card) {
        return text(q(card, '.cardText:first-of-type')) ||
            card.getAttribute('aria-label') ||
            card.getAttribute('title') ||
            'Entdecken';
    }

    function cardSubtitle(card) {
        return text(q(card, '.cardText-secondary,.secondary,.secondaryText')) || '';
    }

    function cardImage(card) {
        const img = q(card, 'img');
        if (img?.currentSrc || img?.src) return img.currentSrc || img.src;

        const box = q(card, '.cardImageContainer,.cardImage');
        const bg = box ? getComputedStyle(box).backgroundImage : '';
        const match = bg && bg !== 'none' ? bg.match(/url\(["']?(.*?)["']?\)/) : null;
        return match?.[1] || '';
    }

    function collectHeroItems(sections) {
        const sourceSections = sections.filter(section => !['continue', 'next'].includes(section.dataset.velarisKind));
        const seen = new Set();
        const items = [];

        for (const section of sourceSections) {
            for (const card of qa(section, '.card')) {
                const image = cardImage(card);
                const title = cardTitle(card);
                if (!image || !title) continue;

                const key = `${title}|${image}`;
                if (seen.has(key)) continue;
                seen.add(key);

                items.push({ card, image, title, subtitle: cardSubtitle(card) });
                if (items.length >= 6) return items;
            }
        }

        return items;
    }

    function resolveCard(item) {
        if (!item) return null;
        if (item.card?.isConnected) return item.card;

        return qa(document, '.card').find(card => {
            const title = cardTitle(card);
            const image = cardImage(card);
            return title === item.title && (!item.image || !image || image === item.image);
        }) || qa(document, '.card').find(card => cardTitle(card) === item.title) || null;
    }

    function triggerItem(item, play = false) {
        const card = resolveCard(item);
        if (!card) return;

        if (play) {
            const playButton = q(card, '.cardOverlayFab-primary,[data-action="play"],.btnPlay');
            if (playButton) {
                playButton.click();
                return;
            }
        }

        (q(card, 'a[href],button[data-id],.cardImageContainer') || card).click();
    }

    function heroMarkup() {
        return `
            <div class="velaris-hero__art" aria-hidden="true"></div>
            <div class="velaris-hero__shade" aria-hidden="true"></div>
            <div class="velaris-hero__content">
                <div class="velaris-hero__eyebrow">Velaris Spotlight</div>
                <h1 class="velaris-hero__title"></h1>
                <div class="velaris-hero__meta"></div>
                <div class="velaris-hero__actions">
                    <button type="button" class="velaris-hero__button velaris-hero__button--primary emby-button" data-velaris-action="play">▶ Abspielen</button>
                    <button type="button" class="velaris-hero__button emby-button" data-velaris-action="details">ⓘ Details</button>
                </div>
            </div>
            <div class="velaris-hero__navigation" aria-label="Spotlight Navigation">
                <button type="button" class="velaris-hero__nav emby-button" data-velaris-hero="prev" aria-label="Vorheriger Titel">‹</button>
                <div class="velaris-hero__dots"></div>
                <button type="button" class="velaris-hero__nav emby-button" data-velaris-hero="next" aria-label="Nächster Titel">›</button>
            </div>`;
    }

    function preloadHero(index) {
        if (heroItems.length < 2) return;
        const next = heroItems[(index + 1) % heroItems.length];
        if (!next?.image) return;
        const image = new Image();
        image.decoding = 'async';
        image.src = next.image;
    }

    function renderHero(hero, index, animate = true) {
        if (!heroItems.length || !hero) return;

        heroIndex = (index + heroItems.length) % heroItems.length;
        const item = heroItems[heroIndex];
        if (!item) return;

        const art = q(hero, '.velaris-hero__art');
        const safeImage = item.image.replace(/"/g, '%22');

        if (animate && !reduceMotion()) {
            hero.classList.remove('velaris-hero--changing');
            void hero.offsetWidth;
            hero.classList.add('velaris-hero--changing');
        }

        art.style.backgroundImage = `url("${safeImage}")`;
        q(hero, '.velaris-hero__title').textContent = item.title;
        q(hero, '.velaris-hero__meta').textContent =
            item.subtitle || 'Aus deiner Mediathek — kuratiert für einen cineastischen Start.';

        hero.dataset.velarisIndex = String(heroIndex);

        qa(hero, '.velaris-hero__dot').forEach((dot, i) => {
            dot.classList.toggle('is-active', i === heroIndex);
            dot.setAttribute('aria-current', i === heroIndex ? 'true' : 'false');
        });

        preloadHero(heroIndex);
    }

    function restartHeroRotation(hero) {
        clearInterval(heroRotation);
        heroRotation = 0;

        if (heroItems.length < 2 || reduceMotion() || !heroVisible) return;

        heroRotation = window.setInterval(() => {
            if (!document.hidden && hero?.isConnected && !hero.matches(':hover') && !hero.matches(':focus-within')) {
                renderHero(hero, heroIndex + 1);
            }
        }, HERO_INTERVAL);
    }

    function bindHeroVisibility(hero) {
        if (hero.dataset.velarisVisibilityBound) return;
        hero.dataset.velarisVisibilityBound = '1';

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(entries => {
                const entry = entries[0];
                heroVisible = Boolean(entry?.isIntersecting);
                restartHeroRotation(hero);
            }, { threshold: 0.18 });
            io.observe(hero);
        }

        hero.addEventListener('mouseenter', () => clearInterval(heroRotation), { passive: true });
        hero.addEventListener('mouseleave', () => restartHeroRotation(hero), { passive: true });
        hero.addEventListener('focusin', () => clearInterval(heroRotation));
        hero.addEventListener('focusout', () => restartHeroRotation(hero));

        hero.addEventListener('keydown', event => {
            if (event.key === 'ArrowLeft') {
                renderHero(hero, heroIndex - 1);
                restartHeroRotation(hero);
            } else if (event.key === 'ArrowRight') {
                renderHero(hero, heroIndex + 1);
                restartHeroRotation(hero);
            }
        });
    }

    function buildHero(home, sections) {
        const items = collectHeroItems(sections);
        if (!items.length) return;

        const fingerprint = items.map(item => `${item.title}|${item.image}`).join('||');
        let hero = q(home, '.velaris-hero');

        if (!hero) {
            hero = document.createElement('section');
            hero.className = 'velaris-hero';
            hero.setAttribute('aria-label', 'Velaris Spotlight');
            hero.setAttribute('tabindex', '0');
            hero.innerHTML = heroMarkup();

            q(hero, '[data-velaris-action="play"]').addEventListener('click', () => triggerItem(heroItems[heroIndex], true));
            q(hero, '[data-velaris-action="details"]').addEventListener('click', () => triggerItem(heroItems[heroIndex], false));
            q(hero, '[data-velaris-hero="prev"]').addEventListener('click', () => {
                renderHero(hero, heroIndex - 1);
                restartHeroRotation(hero);
            });
            q(hero, '[data-velaris-hero="next"]').addEventListener('click', () => {
                renderHero(hero, heroIndex + 1);
                restartHeroRotation(hero);
            });

            const first = sections[0];
            first?.parentElement?.insertBefore(hero, first);
            bindHeroVisibility(hero);
        }

        heroItems = items;

        if (fingerprint !== heroFingerprint) {
            heroFingerprint = fingerprint;
            heroIndex = 0;

            const dots = q(hero, '.velaris-hero__dots');
            dots.replaceChildren();

            heroItems.forEach((item, i) => {
                const dot = document.createElement('button');
                dot.type = 'button';
                dot.className = 'velaris-hero__dot emby-button';
                dot.setAttribute('aria-label', `${item.title} anzeigen`);
                dot.addEventListener('click', () => {
                    renderHero(hero, i);
                    restartHeroRotation(hero);
                });
                dots.appendChild(dot);
            });

            renderHero(hero, 0, false);
            restartHeroRotation(hero);
        }
    }

    function reorderRows(sections) {
        const parent = sections[0]?.parentElement;
        if (!parent || sections.some(section => section.parentElement !== parent)) return;

        const continueRow = sections.find(section => section.dataset.velarisKind === 'continue');
        const nextRow = sections.find(section => section.dataset.velarisKind === 'next');
        const hero = q(parent, '.velaris-hero');
        const anchor = hero?.nextSibling || sections[0];

        [continueRow, nextRow].filter(Boolean).reverse().forEach(row => parent.insertBefore(row, anchor));
    }

    function enhanceHome() {
        const home = q(document, '.homePage');
        if (!home) return;

        const sections = qa(home, '.verticalSection');
        if (!sections.length) return;

        sections.forEach((section, index) => {
            classify(section);
            section.dataset.velarisRowIndex = String(index);
            addRailControls(section);
        });

        const featured = sections.find(section => !['continue', 'next'].includes(section.dataset.velarisKind));
        featured?.classList.add('velaris-row--featured');

        buildHero(home, sections);
        reorderRows(sections);
        home.dataset.velarisEnhanced = VERSION;
    }

    function enhanceDetails() {
        const primary = q(document, '.detailPagePrimaryContainer');
        const page = q(document, '.itemDetailPage') || primary?.closest?.('[data-role="page"]') || primary?.parentElement;
        if (!primary || !page) return;

        page.classList.add('velaris-detail-page');
        primary.classList.add('velaris-detail-primary');
        q(document, '.detailPageSecondaryContainer')?.classList.add('velaris-detail-secondary');

        const title = q(primary, '.itemName');
        title?.classList.add('velaris-detail-title');

        const misc = q(primary, '.itemMiscInfo');
        misc?.classList.add('velaris-detail-meta');

        const overview = q(primary, '.overview') || q(document, '.overview');
        overview?.classList.add('velaris-detail-overview');

        const play = q(primary, '.btnPlay,.btnResume') || q(document, '.btnPlay,.btnResume');
        const buttonParent = play?.parentElement;
        buttonParent?.classList.add('velaris-detail-actions');

        qa(primary, '.detailButton').forEach(button => button.classList.add('velaris-detail-action'));

        if (!q(primary, '.velaris-detail-kicker')) {
            const kicker = document.createElement('div');
            kicker.className = 'velaris-detail-kicker';
            kicker.textContent = 'Velaris Cinema';
            (title?.parentElement || primary).insertBefore(kicker, title || (title?.parentElement || primary).firstChild);
        }

        page.dataset.velarisDetailReady = VERSION;
    }

    function enhancePlayer() {
        const shell = q(document, '.videoOsdPage,.videoPlayerContainer,.nowPlayingPage');
        if (!shell) return;

        shell.classList.add('velaris-player-shell');

        const controls = q(document, '.videoOsdBottom,.osdControls,.videoOsdControls,.videoOsdBottomButtons');
        controls?.classList.add('velaris-player-controls');

        if (controls && !q(controls, '.velaris-player-badge')) {
            const badge = document.createElement('div');
            badge.className = 'velaris-player-badge';
            badge.textContent = 'VELARIS';
            controls.appendChild(badge);
        }

        qa(document, '.videoOsdBottom .paper-icon-button-light,.osdControls .paper-icon-button-light,.videoOsdControls .paper-icon-button-light')
            .forEach(button => button.classList.add('velaris-player-button'));
    }

    function enhance() {
        const page = detectPage();
        enhanceHeader();

        if (page === 'home') enhanceHome();
        if (page === 'details') enhanceDetails();
        if (page === 'player') enhancePlayer();

        document.documentElement.dataset.velarisVersion = VERSION;
    }

    function schedule(ms = 85) {
        clearTimeout(timer);
        timer = window.setTimeout(enhance, ms);
    }

    function boot() {
        enhance();

        observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) schedule();
        });

        observer.observe(document.documentElement, { childList: true, subtree: true });

        addEventListener('hashchange', () => schedule(35), { passive: true });
        addEventListener('popstate', () => schedule(35), { passive: true });
        addEventListener('resize', () => schedule(120), { passive: true });

        document.addEventListener('visibilitychange', () => {
            const hero = q(document, '.velaris-hero');
            if (!document.hidden && hero) restartHeroRotation(hero);
        });

        window.Velaris = Object.freeze({
            version: VERSION,
            refresh: enhance,
            nextSpotlight() {
                const hero = q(document, '.velaris-hero');
                if (hero) renderHero(hero, heroIndex + 1);
            },
            previousSpotlight() {
                const hero = q(document, '.velaris-hero');
                if (hero) renderHero(hero, heroIndex - 1);
            },
            stop() {
                observer?.disconnect();
                observer = null;
                clearInterval(heroRotation);
                heroRotation = 0;
            }
        });

        console.info(`[Velaris] v${VERSION} active`);
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', boot, { once: true })
        : boot();
})();
