// Global Theme & Module Communication Handler for Easy Bill Generator
(function initGlobalTheme() {
    // 🛡️ Ensure App Guard & Domain Lock is loaded across all pages
    if (!document.getElementById('eb-app-guard-script') && typeof window.EB_GUARD === 'undefined') {
        const guardScript = document.createElement('script');
        guardScript.id = 'eb-app-guard-script';
        guardScript.async = false;
        guardScript.src = 'app-guard.js';
        (document.head || document.documentElement).appendChild(guardScript);
    }

    const STORAGE_KEY = 'eb_theme_mode';
    
    // Read saved theme preference (default to dark as established by app shell, or light if specified)
    function getSavedTheme() {
        return localStorage.getItem(STORAGE_KEY) || 'dark';
    }

    function applyLanguage(lang) {
        const activeLang = lang || localStorage.getItem('eb_app_language') || 'en';
        document.documentElement.setAttribute('data-lang', activeLang);
    }

    function applyTheme(theme) {
        const validThemes = ['dark', 'night', 'light', 'theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-yellow', 'theme-orange'];
        const activeTheme = theme || 'dark';
        
        // Remove all previous theme classes
        document.documentElement.classList.remove('dark-theme', 'theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-yellow', 'theme-orange');
        if (document.body) {
            document.body.classList.remove('dark-theme', 'theme-green', 'theme-red', 'theme-blue', 'theme-purple', 'theme-yellow', 'theme-orange');
        }

        if (activeTheme === 'dark' || activeTheme === 'night') {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.setAttribute('data-theme', 'dark');
            if (document.body) {
                document.body.classList.add('dark-theme');
                document.body.setAttribute('data-theme', 'dark');
            }
        } else if (activeTheme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
            if (document.body) {
                document.body.setAttribute('data-theme', 'light');
            }
        } else {
            // Preset for future themes
            document.documentElement.classList.add(activeTheme);
            document.documentElement.setAttribute('data-theme', activeTheme);
            if (document.body) {
                document.body.classList.add(activeTheme);
                document.body.setAttribute('data-theme', activeTheme);
            }
        }
    }

    // Apply immediately to prevent flash
    const currentTheme = getSavedTheme();
    applyTheme(currentTheme);
    applyLanguage();

    // Notify parent window when module is loaded and ready
    function notifyParentModuleReady() {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'MODULE_STATUS',
                status: 'connected',
                module: window.location.pathname.split('/').pop() || 'dashboard.html',
                timestamp: Date.now()
            }, '*');
        }
    }

    // Apply when DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            applyTheme(getSavedTheme());
            applyLanguage();
            notifyParentModuleReady();
        });
    } else {
        applyTheme(currentTheme);
        applyLanguage();
        notifyParentModuleReady();
    }

    // Also notify on window load event
    window.addEventListener('load', notifyParentModuleReady);

    // Listen for theme change message from parent window / iframe
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'THEME_CHANGED') {
            applyTheme(event.data.theme);
        } else if (event.data && event.data.type === 'PING_MODULE') {
            notifyParentModuleReady();
        }
    });

    // Listen for online / offline events
    window.addEventListener('online', () => {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'MODULE_NETWORK',
                online: true,
                module: window.location.pathname.split('/').pop() || 'dashboard.html'
            }, '*');
        }
    });

    window.addEventListener('offline', () => {
        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'MODULE_NETWORK',
                online: false,
                module: window.location.pathname.split('/').pop() || 'dashboard.html'
            }, '*');
        }
    });

    // Also listen to storage events across tabs
    window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
            applyTheme(event.newValue);
        }
    });

    // Expose helpers globally
    window.ebTheme = {
        getTheme: getSavedTheme,
        setTheme: (newTheme) => {
            localStorage.setItem(STORAGE_KEY, newTheme);
            applyTheme(newTheme);
        },
        toggleTheme: () => {
            const next = getSavedTheme() === 'dark' ? 'light' : 'dark';
            localStorage.setItem(STORAGE_KEY, next);
            applyTheme(next);
            return next;
        }
    };

    window.ebLang = {
        getLang: () => localStorage.getItem('eb_app_language') || 'en',
        setLang: (newLang) => {
            localStorage.setItem('eb_app_language', newLang);
            applyLanguage(newLang);
            window.dispatchEvent(new CustomEvent('eb-lang-changed', { detail: { lang: newLang } }));
        },
        toggleLang: () => {
            const current = localStorage.getItem('eb_app_language') || 'en';
            const next = current === 'en-ur' ? 'en' : 'en-ur';
            localStorage.setItem('eb_app_language', next);
            applyLanguage(next);
            window.dispatchEvent(new CustomEvent('eb-lang-changed', { detail: { lang: next } }));
            return next;
        }
    };

    // 📱 PWA Service Worker Registration & Offline App Cache
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then((registration) => {
                    // Check for SW updates
                    registration.onupdatefound = () => {
                        const installingWorker = registration.installing;
                        if (installingWorker) {
                            installingWorker.onstatechange = () => {
                                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    console.log('[PWA] New offline version available.');
                                }
                            };
                        }
                    };
                })
                .catch((err) => {
                    console.warn('[PWA] ServiceWorker registration failed:', err.message);
                });
        });
    }
})();


