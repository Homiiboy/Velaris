/** Velaris v0.2.0 bundle */
(() => {
    'use strict';

    if (window.__VELARIS_BUNDLE_V020__) return;
    window.__VELARIS_BUNDLE_V020__ = true;

    const VERSION = '0.2.0';
    const BASE_URL = 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@v0.1.0/dist/velaris.js';
    const current = document.currentScript?.src || '';
    const PATCH_URL = current
        ? new URL('velaris-v020.js', current).href
        : 'https://cdn.jsdelivr.net/gh/Homiiboy/Velaris@main/dist/velaris-v020.js?v=0.2.0';

    const load = (src, id) => new Promise((resolve, reject) => {
        if (id && document.getElementById(id)) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        if (id) script.id = id;
        script.src = src;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        (document.head || document.documentElement).appendChild(script);
    });

    const baseReady = window.__VELARIS_BUNDLE_V010__
        ? Promise.resolve()
        : load(BASE_URL, 'velaris-base-v010');

    baseReady
        .then(() => window.__VELARIS_V020_PATCH__ ? undefined : load(PATCH_URL, 'velaris-patch-v020'))
        .then(() => {
            window.VelarisRelease = Object.freeze({
                version: VERSION,
                baseVersion: '0.1.0',
                searchVersion: window.VelarisSearch?.version || '0.0.7',
                settingsVersion: window.VelarisSettings?.version || '0.0.8',
                authVersion: window.VelarisAuth?.version || '0.0.9',
                shellVersion: window.VelarisShell?.version || '0.1.0',
                seriesVersion: window.VelarisSeries?.version || VERSION
            });
            console.info(`[Velaris] v${VERSION} bundle active`);
        })
        .catch(error => console.error('[Velaris] V0.2.0 bundle failed to load.', error));
})();
