/** Velaris v0.1.0 — Unified App Shell */
(() => {
    'use strict';

    if (window.__VELARIS_V010_PATCH__) return;
    window.__VELARIS_V010_PATCH__ = true;

    const VERSION = '0.1.0';
    const ROUTE_SETTLE_MS = 260;
    const ENHANCE_DELAY_MS = 90;

    let observer = null;
    let enhanceTimer = 0;
    let routeTimer = 0;
    let lastRoute = location.href;

    const q = (root, selector) => root?.querySelector?.(selector) || null;
    const qa = (root, selector) => root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
    const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();

    function pageKind() {
        const declared = document.body?.dataset?.velarisPage || '';
        if (declared) return declared;
        const hash = `${location.hash} ${location.pathname}`.toLowerCase();
        if (/login|selectserver|serverselection|startup|wizard/.test(hash)) return 'auth';
        if (/video|player|playback/.test(hash) || q(document, '.videoOsdBottom,.videoOsdTop,.htmlvideoplayer')) return 'player';
        if (/details/.test(hash)) return 'details';
        if (/home/.test(hash) || q(document, '.homePage')) return 'home';
        if (/movies|tvshows|library|items|favorites|collections|genres/.test(hash)) return 'library';
        return 'browse';
    }

    function pageLabel(kind = pageKind()) {
        const context = text(q(document, '.velaris-commandbar__context'));
        if (context && context !== 'Jellyfin') return context;
        const heading = text(q(document, '.pageTitle,.sectionTitle,.headerTabs .emby-tab-button-active'));
        if (heading) return heading;
        const labels = {
            home: 'Home', library: 'Bibliothek', details: 'Details', player: 'Player', auth: 'Willkommen', browse: 'Entdecken'
        };
        return labels[kind] || 'Velaris';
    }

    function shellRoot() {
        let root = q(document, '.velaris-shell-root');
        if (root) return root;
        root = document.createElement('div');
        root.className = 'velaris-shell-root';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = '<span class="velaris-shell-root__orb velaris-shell-root__orb--a"></span><span class="velaris-shell-root__orb velaris-shell-root__orb--b"></span><span class="velaris-shell-root__grain"></span>';
        document.body?.prepend(root);
        return root;
    }

    function nativeTarget(pattern) {
        const header = q(document, '.skinHeader');
        const roots = [header, q(document, '.mainDrawer'), document].filter(Boolean);
        for (const root of roots) {
            const nodes = qa(root, 'a,button,.navMenuOption,.emby-tab-button');
            const hit = nodes.find(node => {
                if (node.closest?.('.velaris-commandbar,.velaris-shell-dock')) return false;
                const haystack = `${text(node)} ${node.getAttribute?.('aria-label') || ''} ${node.getAttribute?.('title') || ''}`;
                return pattern.test(haystack);
            });
            if (hit) return hit;
        }
        return null;
    }

    function activateNative(pattern, fallbackHash = '') {
        const target = nativeTarget(pattern);
        if (target) {
            target.click();
            return true;
        }
        if (fallbackHash) {
            location.hash = fallbackHash;
            return true;
        }
        return false;
    }

    function ensureShellDock() {
        const header = q(document, '.skinHeader');
        const command = q(header, '.velaris-commandbar');
        if (!header || !command) return;

        let dock = q(command, '.velaris-shell-dock');
        if (!dock) {
            dock = document.createElement('div');
            dock.className = 'velaris-shell-dock';
            dock.innerHTML = `
                <span class="velaris-shell-dock__divider" aria-hidden="true"></span>
                <button type="button" class="velaris-shell-dock__item emby-button" data-shell-action="movies" aria-label="Filme öffnen"><span class="velaris-shell-dock__dot"></span><span>Filme</span></button>
                <button type="button" class="velaris-shell-dock__item emby-button" data-shell-action="series" aria-label="Serien öffnen"><span class="velaris-shell-dock__dot"></span><span>Serien</span></button>
                <button type="button" class="velaris-shell-dock__item velaris-shell-dock__item--discover emby-button" data-shell-action="discover" aria-label="Entdecken"><span class="velaris-shell-dock__dot"></span><span>Entdecken</span></button>`;

            q(dock, '[data-shell-action="movies"]')?.addEventListener('click', () => activateNative(/^(filme|movies)$/i, '#!/movies.html'));
            q(dock, '[data-shell-action="series"]')?.addEventListener('click', () => activateNative(/^(serien|tv shows|shows)$/i, '#!/tv.html'));
            q(dock, '[data-shell-action="discover"]')?.addEventListener('click', () => {
                if (!activateNative(/entdecken|discover|genres|sammlungen|collections/i)) {
                    window.VelarisSearch?.open?.('');
                }
            });

            const searchButton = q(command, '[data-action="search"]');
            if (searchButton) command.insertBefore(dock, searchButton);
            else command.appendChild(dock);
        }

        let badge = q(command, '.velaris-shell-status');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'velaris-shell-status';
            badge.innerHTML = '<span class="velaris-shell-status__pulse"></span><span class="velaris-shell-status__label">Velaris</span>';
            command.appendChild(badge);
        }
    }

    function updateShellDock() {
        const kind = pageKind();
        const route = `${location.hash} ${location.pathname}`.toLowerCase();
        qa(document, '.velaris-shell-dock__item').forEach(item => item.classList.remove('is-active'));
        if (/movie/.test(route)) q(document, '[data-shell-action="movies"]')?.classList.add('is-active');
        if (/tv|series|show/.test(route)) q(document, '[data-shell-action="series"]')?.classList.add('is-active');
        if (/genre|collection|discover|favorite/.test(route)) q(document, '[data-shell-action="discover"]')?.classList.add('is-active');

        const label = q(document, '.velaris-shell-status__label');
        if (label) label.textContent = pageLabel(kind);
        document.documentElement.dataset.velarisShellPage = kind;
        document.documentElement.dataset.velarisShellVersion = VERSION;
    }

    function classifySurfaces() {
        const dialogSelectors = [
            '.dialog', '.formDialog', '.promptDialog', '.dialogContainer .focuscontainer-x', '.confirmDialog'
        ];
        const menuSelectors = [
            '.actionSheet', '.popupMenu', '.selectMenu', '.paperList', '.listItem-border'
        ];
        const toastSelectors = [
            '.toast', '.toastContainer', '.notification', '.snackbar'
        ];

        for (const selector of dialogSelectors) {
            qa(document, selector).forEach(node => node.classList.add('velaris-surface', 'velaris-surface--dialog'));
        }
        for (const selector of menuSelectors) {
            qa(document, selector).forEach(node => node.classList.add('velaris-surface', 'velaris-surface--menu'));
        }
        for (const selector of toastSelectors) {
            qa(document, selector).forEach(node => node.classList.add('velaris-surface', 'velaris-surface--toast'));
        }

        const modalVisible = qa(document, '.dialog,.formDialog,.promptDialog,.actionSheet,.popupMenu')
            .some(node => node.offsetParent !== null && getComputedStyle(node).visibility !== 'hidden');
        document.body?.classList.toggle('velaris-modal-open', modalVisible);
    }

    function enhancePageContainer() {
        const kind = pageKind();
        const pages = qa(document, '[data-role="page"],.page,main');
        for (const page of pages) {
            if (page.closest?.('.velaris-search,.velaris-settings')) continue;
            const visible = page.classList.contains('is-active') || page.classList.contains('page-active') || page.offsetParent !== null;
            if (!visible) continue;
            page.classList.add('velaris-shell-page');
            page.dataset.velarisShellPage = kind;
        }
    }

    function routeStart(source = 'navigation') {
        if (!document.body) return;
        const reduce = document.documentElement.dataset.velarisMotion;
        document.body.classList.add('velaris-route-changing');
        document.body.dataset.velarisRouteSource = source;
        window.clearTimeout(routeTimer);
        routeTimer = window.setTimeout(routeEnd, reduce === 'off' ? 0 : ROUTE_SETTLE_MS);
    }

    function routeEnd() {
        document.body?.classList.remove('velaris-route-changing');
        enhance();
        window.dispatchEvent(new CustomEvent('velaris:route-settled', {
            detail: { version: VERSION, page: pageKind(), href: location.href }
        }));
    }

    function detectRouteChange() {
        if (location.href === lastRoute) return;
        lastRoute = location.href;
        routeStart('spa');
    }

    function ensureToastHost() {
        let host = q(document, '.velaris-toast-host');
        if (host) return host;
        host = document.createElement('div');
        host.className = 'velaris-toast-host';
        host.setAttribute('aria-live', 'polite');
        host.setAttribute('aria-atomic', 'true');
        document.body?.appendChild(host);
        return host;
    }

    function toast(message, options = {}) {
        const value = String(message || '').trim();
        if (!value) return null;
        const host = ensureToastHost();
        if (!host) return null;

        const item = document.createElement('div');
        item.className = `velaris-toast velaris-toast--${options.type || 'info'}`;
        item.innerHTML = '<span class="velaris-toast__mark"></span><span class="velaris-toast__copy"></span>';
        q(item, '.velaris-toast__copy').textContent = value;
        host.appendChild(item);
        requestAnimationFrame(() => item.classList.add('is-visible'));
        const timeout = Number.isFinite(options.duration) ? options.duration : 3200;
        window.setTimeout(() => {
            item.classList.remove('is-visible');
            window.setTimeout(() => item.remove(), 260);
        }, timeout);
        return item;
    }

    function syncGlobalState() {
        const searchOpen = q(document, '.velaris-search.is-open');
        const settingsOpen = q(document, '.velaris-settings.is-open');
        document.body?.classList.toggle('velaris-overlay-open', Boolean(searchOpen || settingsOpen));
    }

    function enhance() {
        if (!document.body) return;
        shellRoot();
        ensureShellDock();
        updateShellDock();
        classifySurfaces();
        enhancePageContainer();
        syncGlobalState();
    }

    function scheduleEnhance() {
        window.clearTimeout(enhanceTimer);
        enhanceTimer = window.setTimeout(() => {
            detectRouteChange();
            enhance();
        }, ENHANCE_DELAY_MS);
    }

    function onGlobalKeydown(event) {
        if (event.defaultPrevented) return;
        if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === '1') {
            event.preventDefault();
            activateNative(/^(home|startseite)$/i, '#!/home.html');
        } else if (event.key === '2') {
            event.preventDefault();
            activateNative(/^(filme|movies)$/i, '#!/movies.html');
        } else if (event.key === '3') {
            event.preventDefault();
            activateNative(/^(serien|tv shows|shows)$/i, '#!/tv.html');
        }
    }

    function boot() {
        enhance();
        ensureToastHost();

        observer = new MutationObserver(mutations => {
            if (mutations.some(m => m.addedNodes.length || m.removedNodes.length || m.type === 'attributes')) scheduleEnhance();
        });
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style', 'aria-hidden']
        });

        addEventListener('hashchange', () => routeStart('hash'), { passive: true });
        addEventListener('popstate', () => routeStart('history'), { passive: true });
        addEventListener('velaris:settings-changed', () => window.setTimeout(enhance, 0));
        document.addEventListener('keydown', onGlobalKeydown, true);

        window.VelarisShell = Object.freeze({
            version: VERSION,
            refresh: enhance,
            toast,
            route: routeStart,
            page: pageKind,
            stop() {
                observer?.disconnect();
                observer = null;
                window.clearTimeout(enhanceTimer);
                window.clearTimeout(routeTimer);
                document.removeEventListener('keydown', onGlobalKeydown, true);
            }
        });

        console.info(`[Velaris Shell] v${VERSION} active`);
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', boot, { once: true })
        : boot();
})();
