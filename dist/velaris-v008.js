/** Velaris v0.0.8 — Settings & Branding */
(() => {
    'use strict';

    if (window.__VELARIS_V008_PATCH__) return;
    window.__VELARIS_V008_PATCH__ = true;

    const VERSION = '0.0.8';
    const STORAGE_KEY = 'velaris.settings.v008';
    const MODULE_SRC = document.currentScript?.src || '';
    const FALLBACK_ICON = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="16" fill="%23020305"/%3E%3Cpath d="M14 15h10l8 24 8-24h10L36 51h-8z" fill="%2300eaff"/%3E%3Ccircle cx="47" cy="17" r="5" fill="%23ff2bd6"/%3E%3C/svg%3E';
    const ICON_URL = MODULE_SRC ? new URL('../assets/velaris-mark.svg', MODULE_SRC).href : FALLBACK_ICON;
    const THEME_COLOR = '#020305';

    const DEFAULTS = Object.freeze({
        spotlight: true,
        motion: 'full',
        density: 'comfortable',
        cards: 'medium',
        accent: 'balanced',
        browserTitle: true,
        favicon: true,
        themeColor: true
    });

    const ENUMS = Object.freeze({
        motion: ['full', 'reduced', 'off'],
        density: ['compact', 'comfortable', 'spacious'],
        cards: ['small', 'medium', 'large'],
        accent: ['subtle', 'balanced', 'vivid']
    });

    let settings = loadSettings();
    let refreshTimer = 0;
    let observer = null;
    let titleObserver = null;
    let nativeTitle = document.title || 'Jellyfin';
    let originalIcons = null;
    let originalThemeColor = null;

    const q = (root, selector) => root?.querySelector?.(selector) || null;
    const qa = (root, selector) => root?.querySelectorAll ? Array.from(root.querySelectorAll(selector)) : [];

    function normalize(input = {}) {
        const result = { ...DEFAULTS };
        for (const key of ['spotlight', 'browserTitle', 'favicon', 'themeColor']) {
            if (typeof input[key] === 'boolean') result[key] = input[key];
        }
        for (const [key, allowed] of Object.entries(ENUMS)) {
            if (allowed.includes(input[key])) result[key] = input[key];
        }
        return result;
    }

    function loadSettings() {
        try {
            return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
        } catch {
            return { ...DEFAULTS };
        }
    }

    function saveSettings() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.warn('[Velaris Settings] Could not persist settings.', error);
        }
    }

    function captureOriginalIcons() {
        if (originalIcons) return;
        originalIcons = qa(document.head, 'link[rel~="icon"], link[rel="shortcut icon"]')
            .filter(link => !link.dataset.velarisBranding)
            .map(link => ({
                rel: link.rel,
                href: link.href,
                type: link.type || '',
                sizes: link.sizes?.value || ''
            }));
    }

    function applyFavicon() {
        captureOriginalIcons();
        qa(document.head, 'link[data-velaris-branding="favicon"]').forEach(link => link.remove());

        if (!settings.favicon) {
            if (!q(document.head, 'link[rel~="icon"]') && originalIcons?.length) {
                for (const icon of originalIcons) {
                    const link = document.createElement('link');
                    link.rel = icon.rel || 'icon';
                    link.href = icon.href;
                    if (icon.type) link.type = icon.type;
                    if (icon.sizes) link.sizes = icon.sizes;
                    document.head.appendChild(link);
                }
            }
            return;
        }

        qa(document.head, 'link[rel~="icon"], link[rel="shortcut icon"]')
            .filter(link => !link.dataset.velarisBranding)
            .forEach(link => link.remove());

        const icon = document.createElement('link');
        icon.rel = 'icon';
        icon.type = 'image/svg+xml';
        icon.href = ICON_URL;
        icon.dataset.velarisBranding = 'favicon';
        document.head.appendChild(icon);
    }

    function cleanedNativeTitle(value) {
        return String(value || '')
            .replace(/^Velaris(?:\s*[—–-]\s*)?/i, '')
            .replace(/\s*[—–-]\s*Jellyfin\s*$/i, '')
            .trim();
    }

    function brandedTitle() {
        const context = cleanedNativeTitle(nativeTitle);
        if (!context || /^jellyfin$/i.test(context)) return 'Velaris';
        return `Velaris — ${context}`;
    }

    function applyTitle() {
        if (!settings.browserTitle) {
            if (/^Velaris(?:\s*[—–-]|$)/i.test(document.title) && nativeTitle) document.title = nativeTitle;
            return;
        }
        const target = brandedTitle();
        if (document.title !== target) document.title = target;
    }

    function observeTitle() {
        const title = q(document.head, 'title');
        if (!title || titleObserver) return;
        titleObserver = new MutationObserver(() => {
            const current = document.title || '';
            if (!/^Velaris(?:\s*[—–-]|$)/i.test(current)) nativeTitle = current || nativeTitle;
            queueMicrotask(applyTitle);
        });
        titleObserver.observe(title, { childList: true, characterData: true, subtree: true });
    }

    function applyThemeColor() {
        let meta = q(document.head, 'meta[name="theme-color"]');
        if (originalThemeColor === null) originalThemeColor = meta?.content ?? '';

        if (!settings.themeColor) {
            if (meta?.dataset.velarisBranding === 'theme-color') {
                if (originalThemeColor) {
                    meta.content = originalThemeColor;
                    delete meta.dataset.velarisBranding;
                } else {
                    meta.remove();
                }
            }
            return;
        }

        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'theme-color';
            document.head.appendChild(meta);
        }
        meta.content = THEME_COLOR;
        meta.dataset.velarisBranding = 'theme-color';
    }

    function applyDataSettings() {
        const root = document.documentElement;
        root.dataset.velarisSpotlight = settings.spotlight ? 'on' : 'off';
        root.dataset.velarisMotion = settings.motion;
        root.dataset.velarisDensity = settings.density;
        root.dataset.velarisCardSize = settings.cards;
        root.dataset.velarisAccent = settings.accent;
        root.dataset.velarisSettings = VERSION;
    }

    function applyBranding() {
        applyFavicon();
        applyTitle();
        applyThemeColor();
        observeTitle();
    }

    function applyAll() {
        applyDataSettings();
        applyBranding();
        syncSettingsUI();
    }

    function setSetting(key, value) {
        const candidate = normalize({ ...settings, [key]: value });
        settings = candidate;
        saveSettings();
        applyAll();
        window.dispatchEvent(new CustomEvent('velaris:settings-changed', { detail: { ...settings } }));
    }

    function resetSettings() {
        settings = { ...DEFAULTS };
        saveSettings();
        applyAll();
        window.dispatchEvent(new CustomEvent('velaris:settings-changed', { detail: { ...settings } }));
    }

    function settingRow({ title, copy, control }) {
        return `<div class="velaris-settings__row"><div class="velaris-settings__row-copy"><strong>${title}</strong><span>${copy}</span></div>${control}</div>`;
    }

    function selectControl(key, label, options) {
        const html = options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('');
        return `<label class="velaris-settings__select-wrap"><span class="sr-only">${label}</span><select class="velaris-settings__select" data-setting="${key}">${html}</select></label>`;
    }

    function toggleControl(key, label) {
        return `<button type="button" class="velaris-settings__toggle" data-setting="${key}" role="switch" aria-label="${label}" aria-checked="false"><span></span></button>`;
    }

    function ensurePanel() {
        if (q(document, '.velaris-settings')) return;

        const root = document.createElement('div');
        root.className = 'velaris-settings';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <button type="button" class="velaris-settings__backdrop" aria-label="Einstellungen schließen"></button>
            <aside class="velaris-settings__panel" role="dialog" aria-modal="true" aria-label="Velaris Einstellungen">
                <header class="velaris-settings__header">
                    <div><span class="velaris-settings__eyebrow">Velaris ${VERSION}</span><h2>Settings</h2><p>Deine Oberfläche, dein Tempo, dein Branding.</p></div>
                    <button type="button" class="velaris-settings__close emby-button" aria-label="Einstellungen schließen">×</button>
                </header>
                <div class="velaris-settings__content">
                    <section class="velaris-settings__section">
                        <div class="velaris-settings__section-head"><span>01</span><div><h3>Experience</h3><p>Spotlight und Bewegung steuern.</p></div></div>
                        ${settingRow({ title: 'Velaris Spotlight', copy: 'Den großen rotierenden Home-Hero anzeigen.', control: toggleControl('spotlight', 'Velaris Spotlight') })}
                        ${settingRow({ title: 'Animationen', copy: 'Bewegung und Übergänge an deine Präferenz anpassen.', control: selectControl('motion', 'Animationen', [['full', 'Voll'], ['reduced', 'Reduziert'], ['off', 'Aus']]) })}
                    </section>
                    <section class="velaris-settings__section">
                        <div class="velaris-settings__section-head"><span>02</span><div><h3>Layout</h3><p>Informationsdichte und Kartenwirkung verändern.</p></div></div>
                        ${settingRow({ title: 'UI-Dichte', copy: 'Abstände zwischen Bereichen und Inhalten.', control: selectControl('density', 'UI-Dichte', [['compact', 'Kompakt'], ['comfortable', 'Standard'], ['spacious', 'Großzügig']]) })}
                        ${settingRow({ title: 'Kartengröße', copy: 'Poster und Backdrop-Cards auf Home und in Libraries skalieren.', control: selectControl('cards', 'Kartengröße', [['small', 'Klein'], ['medium', 'Mittel'], ['large', 'Groß']]) })}
                        ${settingRow({ title: 'Akzentintensität', copy: 'Cyan, Violett und Magenta dezenter oder kräftiger darstellen.', control: selectControl('accent', 'Akzentintensität', [['subtle', 'Dezent'], ['balanced', 'Balanced'], ['vivid', 'Vivid']]) })}
                    </section>
                    <section class="velaris-settings__section">
                        <div class="velaris-settings__section-head"><span>03</span><div><h3>Browser Branding</h3><p>Velaris auch außerhalb der eigentlichen Jellyfin-Oberfläche sichtbar machen.</p></div></div>
                        ${settingRow({ title: 'Velaris Tab-Titel', copy: 'Browser-Tabs als „Velaris — …“ benennen.', control: toggleControl('browserTitle', 'Velaris Tab-Titel') })}
                        ${settingRow({ title: 'Velaris Favicon', copy: 'Das Jellyfin-Favicon durch das Velaris-Symbol ersetzen.', control: toggleControl('favicon', 'Velaris Favicon') })}
                        ${settingRow({ title: 'Browser Theme Color', copy: 'Browser-Chrome und PWA-Flächen in Velaris-Schwarz einfärben.', control: toggleControl('themeColor', 'Browser Theme Color') })}
                    </section>
                </div>
                <footer class="velaris-settings__footer">
                    <button type="button" class="velaris-settings__reset emby-button">Auf Standard zurücksetzen</button>
                    <span>Änderungen werden lokal in diesem Browser gespeichert.</span>
                </footer>
            </aside>`;

        q(root, '.velaris-settings__backdrop').addEventListener('click', closePanel);
        q(root, '.velaris-settings__close').addEventListener('click', closePanel);
        q(root, '.velaris-settings__reset').addEventListener('click', resetSettings);

        root.addEventListener('click', event => {
            const toggle = event.target.closest('.velaris-settings__toggle');
            if (!toggle) return;
            const key = toggle.dataset.setting;
            setSetting(key, !settings[key]);
        });

        root.addEventListener('change', event => {
            const select = event.target.closest('.velaris-settings__select');
            if (!select) return;
            setSetting(select.dataset.setting, select.value);
        });

        document.body.appendChild(root);
        syncSettingsUI();
    }

    function syncSettingsUI() {
        const root = q(document, '.velaris-settings');
        if (!root) return;
        qa(root, '.velaris-settings__toggle').forEach(toggle => {
            const enabled = Boolean(settings[toggle.dataset.setting]);
            toggle.classList.toggle('is-on', enabled);
            toggle.setAttribute('aria-checked', enabled ? 'true' : 'false');
        });
        qa(root, '.velaris-settings__select').forEach(select => {
            const value = settings[select.dataset.setting];
            if (value && select.value !== value) select.value = value;
        });
    }

    function openPanel() {
        ensurePanel();
        const root = q(document, '.velaris-settings');
        root?.classList.add('is-open');
        root?.setAttribute('aria-hidden', 'false');
        document.body?.classList.add('velaris-settings-open');
        window.setTimeout(() => q(root, '.velaris-settings__close')?.focus(), 30);
    }

    function closePanel() {
        const root = q(document, '.velaris-settings');
        root?.classList.remove('is-open');
        root?.setAttribute('aria-hidden', 'true');
        document.body?.classList.remove('velaris-settings-open');
    }

    function ensureSettingsButton() {
        const bar = q(document, '.velaris-commandbar');
        if (!bar || q(bar, '[data-action="settings"]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'velaris-commandbar__button velaris-commandbar__button--settings emby-button';
        button.dataset.action = 'settings';
        button.setAttribute('aria-label', 'Velaris Einstellungen');
        button.innerHTML = '<span class="velaris-commandbar__glyph">⚙</span><span class="velaris-commandbar__label">Settings</span>';
        button.addEventListener('click', openPanel);
        bar.appendChild(button);
    }

    function globalKeys(event) {
        if (event.key === 'Escape' && q(document, '.velaris-settings.is-open')) {
            event.preventDefault();
            closePanel();
            return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key === ',') {
            event.preventDefault();
            openPanel();
        }
    }

    function refresh() {
        ensureSettingsButton();
        applyAll();
    }

    function scheduleRefresh() {
        window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(refresh, 120);
    }

    function boot() {
        ensurePanel();
        refresh();

        observer = new MutationObserver(mutations => {
            if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) scheduleRefresh();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });

        addEventListener('hashchange', scheduleRefresh, { passive: true });
        addEventListener('popstate', scheduleRefresh, { passive: true });
        document.addEventListener('keydown', globalKeys);

        window.VelarisSettings = Object.freeze({
            version: VERSION,
            get: () => ({ ...settings }),
            set: setSetting,
            reset: resetSettings,
            open: openPanel,
            close: closePanel,
            refresh,
            stop() {
                observer?.disconnect();
                titleObserver?.disconnect();
                observer = null;
                titleObserver = null;
                document.removeEventListener('keydown', globalKeys);
            }
        });

        console.info(`[Velaris Settings] v${VERSION} active`);
    }

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', boot, { once: true })
        : boot();
})();
