/** Velaris v0.0.9 — Login & Profiles */
(() => {
    'use strict';

    if (window.__VELARIS_V009_PATCH__) return;
    window.__VELARIS_V009_PATCH__ = true;

    const VERSION = '0.0.9';
    const LAST_PROFILE_KEY = 'velaris.profile.last';
    const REFRESH_DELAY = 90;

    let observer = null;
    let refreshTimer = 0;

    const q = (root, selector) => root?.querySelector?.(selector) || null;
    const qa = (root, selector) => root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];
    const text = node => (node?.textContent || '').replace(/\s+/g, ' ').trim();

    function visible(node) {
        if (!node || !node.isConnected) return false;
        const style = window.getComputedStyle(node);
        return style.display !== 'none' && style.visibility !== 'hidden' && !node.classList.contains('hide');
    }

    function activePage() {
        const candidates = qa(document, '[data-role="page"], .page');
        return candidates.find(page => visible(page) && !page.classList.contains('backgroundContainer')) || null;
    }

    function modeFor(page) {
        if (!page) return 'none';
        const signature = `${page.id || ''} ${page.className || ''}`.toLowerCase();

        if (/selectserver|serverselection|connectserver|serverpage/.test(signature) ||
            q(page, '.serverList, .serverSelection, .selectServerForm, [data-serverid]')) {
            return 'server';
        }

        const loginLike = /login|signin|connect/.test(signature) || q(page, '.manualLoginForm, .visualLoginForm, .loginForm');
        if (!loginLike) return 'none';

        if (q(page, '.visualLoginForm, .userList, .usersList, .userGrid') &&
            qa(page, '.userList .card, .userCard, .userItem, .visualLoginForm .card').length) {
            return 'profiles';
        }

        if (q(page, '.manualLoginForm, .loginForm, input[type="password"], input[name*="password" i]')) {
            return 'login';
        }

        if (q(page, '.userList, .usersList, .visualLoginForm')) return 'profiles';
        return 'login';
    }

    function pageTitle(mode) {
        if (mode === 'profiles') return ['Profile', 'Wer schaut heute?'];
        if (mode === 'server') return ['Connection', 'Dein Velaris Zuhause'];
        return ['Access', 'Willkommen bei Velaris'];
    }

    function pageCopy(mode) {
        if (mode === 'profiles') return 'Wähle dein Profil und tauche direkt in deine persönliche Mediathek ein.';
        if (mode === 'server') return 'Verbinde dich mit dem Jellyfin-Server, auf dem deine Velaris-Mediathek zuhause ist.';
        return 'Melde dich an und öffne deine persönliche Streaming-Oberfläche.';
    }

    function ensureBrand(page, mode) {
        let brand = q(page, ':scope > .velaris-auth-brand');
        if (!brand) {
            brand = document.createElement('section');
            brand.className = 'velaris-auth-brand';
            brand.innerHTML = `
                <div class="velaris-auth-brand__mark" aria-hidden="true"><span></span></div>
                <div class="velaris-auth-brand__copy">
                    <span class="velaris-auth-brand__eyebrow"></span>
                    <h1></h1>
                    <p></p>
                </div>
                <div class="velaris-auth-brand__meta"><span>VELARIS</span><span>JELLYFIN EXPERIENCE</span></div>`;
            page.prepend(brand);
        }

        const [eyebrow, title] = pageTitle(mode);
        q(brand, '.velaris-auth-brand__eyebrow').textContent = eyebrow;
        q(brand, 'h1').textContent = title;
        q(brand, 'p').textContent = pageCopy(mode);
    }

    function profileName(card) {
        return text(q(card, '.cardText, .cardText-first, .userName, .name, .itemName')) ||
            card.getAttribute('aria-label') || card.getAttribute('title') || '';
    }

    function profileCards(page) {
        const selectors = [
            '.userList .card', '.usersList .card', '.visualLoginForm .card',
            '.userCard', '.userItem', '.userGrid .card'
        ];
        return Array.from(new Set(selectors.flatMap(selector => qa(page, selector))));
    }

    function enhanceProfiles(page) {
        const cards = profileCards(page);
        if (!cards.length) return;

        const list = cards[0].parentElement;
        if (list) list.classList.add('velaris-profile-grid');

        const stored = (() => {
            try { return localStorage.getItem(LAST_PROFILE_KEY) || ''; } catch { return ''; }
        })();

        cards.forEach(card => {
            card.classList.add('velaris-profile-card');
            const name = profileName(card);
            if (name) card.dataset.velarisProfile = name;
            card.classList.toggle('velaris-profile-card--last', Boolean(stored && name === stored));

            if (!card.dataset.velarisProfileBound) {
                card.dataset.velarisProfileBound = 'true';
                card.addEventListener('click', () => {
                    const selected = profileName(card);
                    if (!selected) return;
                    try { localStorage.setItem(LAST_PROFILE_KEY, selected); } catch {}
                }, { passive: true });
            }
        });

        const host = list?.parentElement || page;
        if (!q(host, '.velaris-profile-heading')) {
            const heading = document.createElement('div');
            heading.className = 'velaris-profile-heading';
            heading.innerHTML = '<span>Profiles</span><strong>Wer schaut heute?</strong><small>Deine Wiedergabe und Empfehlungen bleiben pro Jellyfin-Profil getrennt.</small>';
            list?.before(heading);
        }
    }

    function enhanceLogin(page) {
        const form = q(page, '.manualLoginForm, .loginForm, form');
        if (!form) return;
        form.classList.add('velaris-login-form');

        qa(form, '.inputContainer, .inputContainer-withDescription, label').forEach(node => node.classList.add('velaris-login-field'));
        qa(form, 'input').forEach(input => input.classList.add('velaris-login-input'));
        qa(form, 'button').forEach(button => button.classList.add('velaris-login-action'));

        if (!q(form, '.velaris-login-kicker')) {
            const kicker = document.createElement('div');
            kicker.className = 'velaris-login-kicker';
            kicker.innerHTML = '<span></span><strong>Private Session</strong><small>Velaris speichert keine Zugangsdaten.</small>';
            form.prepend(kicker);
        }
    }

    function enhanceServer(page) {
        const cards = qa(page, '.serverList .card, .serverSelection .card, [data-serverid], .serverItem');
        cards.forEach(card => card.classList.add('velaris-server-card'));
        const form = q(page, '.selectServerForm, form');
        if (form) form.classList.add('velaris-server-form');
    }

    function enhanceSecondaryActions(page) {
        qa(page, 'button, .emby-button, a').forEach(node => {
            const label = `${text(node)} ${node.getAttribute('aria-label') || ''}`.toLowerCase();
            if (/manual|manuell|forgot|passwort|server|connect|zurück|back/.test(label)) {
                node.classList.add('velaris-auth-secondary');
            }
        });
    }

    function cleanup() {
        document.body?.classList.remove('velaris-auth-active', 'velaris-auth-login', 'velaris-auth-profiles', 'velaris-auth-server');
        delete document.documentElement.dataset.velarisAuth;
        qa(document, '.velaris-auth-brand, .velaris-profile-heading').forEach(node => node.remove());
    }

    function refresh() {
        const page = activePage();
        const mode = modeFor(page);
        if (mode === 'none') {
            cleanup();
            return;
        }

        document.body?.classList.add('velaris-auth-active');
        document.body?.classList.toggle('velaris-auth-login', mode === 'login');
        document.body?.classList.toggle('velaris-auth-profiles', mode === 'profiles');
        document.body?.classList.toggle('velaris-auth-server', mode === 'server');
        document.documentElement.dataset.velarisAuth = mode;
        page.classList.add('velaris-auth-page');
        page.dataset.velarisAuthMode = mode;

        ensureBrand(page, mode);
        enhanceSecondaryActions(page);
        if (mode === 'profiles') enhanceProfiles(page);
        if (mode === 'login') enhanceLogin(page);
        if (mode === 'server') enhanceServer(page);
    }

    function scheduleRefresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(refresh, REFRESH_DELAY);
    }

    function startObserver() {
        if (observer || !document.documentElement) return;
        observer = new MutationObserver(scheduleRefresh);
        observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] });
    }

    function stop() {
        observer?.disconnect();
        observer = null;
        window.clearTimeout(refreshTimer);
    }

    function boot() {
        refresh();
        startObserver();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
    else boot();

    window.addEventListener('hashchange', scheduleRefresh);
    window.addEventListener('popstate', scheduleRefresh);
    window.addEventListener('velaris:settings-changed', scheduleRefresh);

    window.VelarisAuth = Object.freeze({ version: VERSION, refresh, stop });
    console.info(`[Velaris Auth] v${VERSION} active`);
})();
