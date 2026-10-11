import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  FileText,
  Users,
  LayoutDashboard,
  ShieldCheck,
  UserCheck,
  ExternalLink,
  Smartphone,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
  Boxes,
  Receipt,
  UserCircle,
  Database,
  Moon,
  Sun,
  Wifi,
  WifiOff,
  AlertTriangle,
  Loader2,
  CheckCircle
} from 'lucide-react';

interface ModuleCard {
  id: string;
  name: string;
  url: string;
  icon: any;
  category: string;
  desc: string;
  role: string;
}

const MODULES: ModuleCard[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    url: '/dashboard.html',
    icon: LayoutDashboard,
    category: 'Core',
    desc: 'Live business stats, recent orders, fast action buttons, and sales overview',
    role: 'All Users'
  },
  {
    id: 'stock',
    name: 'Stock Manager',
    url: '/stock.html',
    icon: Boxes,
    category: 'Inventory',
    desc: 'Products, stock levels, low-stock alerts, out-of-stock tracking & history',
    role: 'Owner & Admin'
  },
  {
    id: 'bills',
    name: 'Create New Bill',
    url: '/bills.html?mode=stock',
    icon: Receipt,
    category: 'Billing',
    desc: 'Create professional bills with customizable designs, print presets, PDF export & WhatsApp share',
    role: 'Owner, Admin & Booker'
  },
  {
    id: 'customers',
    name: 'Customer Khata / Ledger',
    url: '/customers.html',
    icon: Users,
    category: 'Customers',
    desc: 'Customer balance, payment records, phone directory, and debt tracking',
    role: 'Owner & Admin'
  },
  {
    id: 'auth',
    name: 'Auth / Login Portal',
    url: '/auth.html',
    icon: ShieldCheck,
    category: 'Security',
    desc: 'Email/Password & Google Sign-in with bilingual (English/Urdu) toggle',
    role: 'Public'
  },
  {
    id: 'owner',
    name: 'Order Bookers Management',
    url: '/owner.html',
    icon: UserCheck,
    category: 'Staff',
    desc: 'Manage sales bookers, pin codes, targets, and commission logs',
    role: 'Owner Only'
  },
  {
    id: 'admin',
    name: 'Agencies / Super Admin',
    url: '/admin.html',
    icon: Database,
    category: 'Admin',
    desc: 'Multi-agency control, plans/subscription packages, and system audit',
    role: 'Super Admin'
  },
  {
    id: 'profile',
    name: 'Business Profile & Print Settings',
    url: '/profile.html',
    icon: UserCircle,
    category: 'Settings',
    desc: 'Store name, logo, phone, address, and invoice headers',
    role: 'Owner & Admin'
  }
];

const THEME_STORAGE_KEY = 'eb_theme_mode';

type ConnectionStatus = 'connecting' | 'connected' | 'error' | 'offline';

export default function App() {
  const [activeFrame, setActiveFrame] = useState<string>('/dashboard.html');
  const [viewMode, setViewMode] = useState<'app' | 'catalog'>('app');
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [pwaInstalled, setPwaInstalled] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [lastConnectedTime, setLastConnectedTime] = useState<string | null>(null);
  const [statusTooltip, setStatusTooltip] = useState<string>('Connecting to module...');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem(THEME_STORAGE_KEY) as 'light' | 'dark') || 'dark';
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // Apply theme change
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.add('dark-theme');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.remove('dark-theme');
    }
    localStorage.setItem(THEME_STORAGE_KEY, theme);

    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'THEME_CHANGED', theme }, '*');
      } catch (e) {
        console.warn('Post message to iframe:', e);
      }
    }
  }, [theme]);

  // When activeFrame or iframeKey changes, start connection watcher
  useEffect(() => {
    if (!navigator.onLine) {
      setConnectionStatus('offline');
      setStatusTooltip('Network is offline');
      return;
    }

    setConnectionStatus('connecting');
    setStatusTooltip(`Loading ${activeFrame.replace('/', '')}...`);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // If iframe fails to load within 7 seconds, mark as error
    timeoutRef.current = setTimeout(() => {
      setConnectionStatus((prev) => {
        if (prev === 'connecting') {
          setStatusTooltip('Module connection timed out or network error');
          return 'error';
        }
        return prev;
      });
    }, 7000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [activeFrame, iframeKey]);

  // PWA, Message listeners, & Network status
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        console.log('Easy Bill Service Worker active:', reg.scope);
      }).catch((err) => {
        console.warn('SW registration info:', err);
      });
    }

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setPwaInstalled(true);
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'THEME_CHANGED') {
        setTheme(event.data.theme);
      } else if (event.data && event.data.type === 'MODULE_STATUS') {
        if (event.data.status === 'connected') {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          setConnectionStatus('connected');
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setLastConnectedTime(timeStr);
          setStatusTooltip(`Connected to ${event.data.module || 'module'} (${timeStr})`);
        }
      } else if (event.data && event.data.type === 'MODULE_NETWORK') {
        if (!event.data.online) {
          setConnectionStatus('offline');
          setStatusTooltip('Offline: Check network connection');
        } else {
          setConnectionStatus('connected');
          setStatusTooltip('Network reconnected');
        }
      }
    };

    const handleOnline = () => {
      setConnectionStatus('connected');
      setStatusTooltip('Online');
    };

    const handleOffline = () => {
      setConnectionStatus('offline');
      setStatusTooltip('You are currently offline');
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleIframeLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setConnectionStatus('connected');
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLastConnectedTime(timeStr);
    setStatusTooltip(`Module loaded successfully (${timeStr})`);

    // Ping iframe to apply theme
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage({ type: 'THEME_CHANGED', theme }, '*');
      } catch (e) {
        console.warn('Send theme on iframe load:', e);
      }
    }
  };

  const handleIframeError = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setConnectionStatus('error');
    setStatusTooltip('Failed to load module. Network error.');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLaunch = (url: string) => {
    setActiveFrame(url);
    setViewMode('app');
    setIframeKey((prev) => prev + 1);
  };

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-800'
    }`}>
      {/* Top Application Bar */}
      <header className={`px-4 py-2.5 flex items-center justify-between sticky top-0 z-50 shadow-md transition-colors duration-200 ${
        isDark 
          ? 'bg-slate-900 border-b border-slate-800 text-white' 
          : 'bg-white border-b border-slate-200 text-slate-900'
      }`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base tracking-tight">Easy Bill Generator</span>
              <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                isDark 
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
              }`}>
                PWA Ready
              </span>

              {/* 🟢 REAL-TIME CONNECTION STATUS BADGE */}
              <div 
                title={statusTooltip}
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all select-none cursor-pointer ${
                  connectionStatus === 'connected'
                    ? isDark
                      ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-700'
                    : connectionStatus === 'connecting'
                    ? isDark
                      ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                      : 'bg-amber-50 border-amber-300 text-amber-800'
                    : connectionStatus === 'offline'
                    ? isDark
                      ? 'bg-zinc-800/80 border-zinc-600 text-zinc-300'
                      : 'bg-zinc-100 border-zinc-300 text-zinc-700'
                    : isDark
                    ? 'bg-rose-950/60 border-rose-500/40 text-rose-400'
                    : 'bg-rose-50 border-rose-300 text-rose-700'
                }`}
                onClick={handleReload}
              >
                {connectionStatus === 'connected' && (
                  <>
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="hidden sm:inline font-mono">Connected</span>
                  </>
                )}

                {connectionStatus === 'connecting' && (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                    <span className="hidden sm:inline font-mono">Connecting...</span>
                  </>
                )}

                {connectionStatus === 'offline' && (
                  <>
                    <WifiOff className="w-3 h-3 text-zinc-400" />
                    <span className="hidden sm:inline font-mono">Offline</span>
                  </>
                )}

                {connectionStatus === 'error' && (
                  <>
                    <AlertTriangle className="w-3 h-3 text-rose-500" />
                    <span className="hidden sm:inline font-mono">Load Error</span>
                  </>
                )}
              </div>
            </div>
            <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Inventory & POS Billing System
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Quick Nav Dropdown / Switcher */}
          <div className={`hidden md:flex items-center rounded-lg p-1 border transition-colors ${
            isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-300'
          }`}>
            <button
              onClick={() => handleLaunch('/dashboard.html')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeFrame === '/dashboard.html' && viewMode === 'app'
                  ? 'bg-emerald-600 text-white'
                  : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleLaunch('/stock.html')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeFrame === '/stock.html' && viewMode === 'app'
                  ? 'bg-emerald-600 text-white'
                  : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Stock
            </button>
            <button
              onClick={() => handleLaunch('/bills.html?mode=stock')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeFrame.startsWith('/bills.html') && viewMode === 'app'
                  ? 'bg-emerald-600 text-white'
                  : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create Bill
            </button>
            <button
              onClick={() => handleLaunch('/customers.html')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeFrame === '/customers.html' && viewMode === 'app'
                  ? 'bg-emerald-600 text-white'
                  : isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Customers
            </button>
          </div>

          {/* ☀️ / 🌙 THEME TOGGLE BUTTON */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme Mode"
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
            }`}
            title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
          >
            {isDark ? (
              <>
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-semibold text-slate-200">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-3.5 h-3.5 text-indigo-600" />
                <span className="font-semibold text-slate-700">Dark</span>
              </>
            )}
          </button>

          <button
            onClick={() => setViewMode(viewMode === 'app' ? 'catalog' : 'app')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 ${
              isDark
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
            }`}
            title="Toggle All Modules List"
          >
            <FolderOpen className={`w-3.5 h-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">{viewMode === 'app' ? 'All Modules' : 'Back to App'}</span>
          </button>

          {viewMode === 'app' && (
            <button
              onClick={handleReload}
              className={`p-2 text-xs font-medium rounded-lg border transition-colors ${
                isDark
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-300'
              }`}
              title="Refresh Module"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
            </button>
          )}

          <a
            href={activeFrame}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>Open Tab</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Connection Notice Banner if error or offline */}
      {connectionStatus === 'error' && (
        <div className="bg-rose-950 border-b border-rose-800 text-rose-200 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Connection timeout or network failure while loading module <strong>{activeFrame}</strong>.</span>
          </div>
          <button
            onClick={handleReload}
            className="px-2.5 py-1 bg-rose-800 hover:bg-rose-700 text-white rounded font-medium transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {connectionStatus === 'offline' && (
        <div className="bg-amber-950 border-b border-amber-800 text-amber-200 px-4 py-2 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
            <span>You appear to be offline. Local cached assets are being served by Service Worker.</span>
          </div>
          <button
            onClick={handleReload}
            className="px-2.5 py-1 bg-amber-800 hover:bg-amber-700 text-white rounded font-medium transition-colors"
          >
            Check Status
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <div className={`flex-1 flex flex-col relative overflow-hidden transition-colors ${
        isDark ? 'bg-slate-950' : 'bg-slate-50'
      }`}>
        {viewMode === 'app' ? (
          <div className="flex-1 w-full h-[calc(100vh-57px)] flex flex-col relative">
            {/* Loading progress bar on connecting */}
            {connectionStatus === 'connecting' && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden z-20">
                <div className="h-full bg-emerald-500 animate-pulse w-full"></div>
              </div>
            )}

            <iframe
              ref={iframeRef}
              id="mainIframe"
              key={iframeKey}
              src={activeFrame}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title="Easy Bill Generator App"
              className="w-full flex-1 border-0"
              allow="camera; clipboard-read; clipboard-write; geolocation"
            />
          </div>
        ) : (
          /* Catalog view */
          <div className="flex-1 max-w-7xl mx-auto w-full p-6 sm:p-8 overflow-y-auto">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Easy Bill Generator — System Architecture
                </h2>
                <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                  All modules from your repository are connected and live. Click any card to launch it directly.
                </p>
              </div>

              {/* Status pill in catalog view */}
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-3 py-1 rounded-lg border flex items-center gap-1.5 ${
                  isDark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-emerald-500' : connectionStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-rose-500'
                  }`} />
                  <span>Module Status: <strong>{connectionStatus}</strong></span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MODULES.map((item) => {
                const Icon = item.icon;
                const isActive = activeFrame === item.url;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleLaunch(item.url)}
                    className={`cursor-pointer rounded-xl border p-5 transition-all flex flex-col justify-between ${
                      isActive
                        ? isDark
                          ? 'border-emerald-500 bg-slate-900/90 ring-1 ring-emerald-500 shadow-md'
                          : 'border-emerald-500 bg-white ring-1 ring-emerald-500 shadow-md'
                        : isDark
                          ? 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs mb-3">
                        <span className="font-mono text-emerald-500">{item.category}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] ${
                          isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {item.role}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mb-2">
                        <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${
                          isDark 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-200'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <h3 className={`font-semibold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          {item.name}
                        </h3>
                      </div>
                      <p className={`text-xs leading-relaxed mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                        {item.desc}
                      </p>
                    </div>

                    <div className={`pt-3 border-t flex items-center justify-between text-xs ${
                      isDark ? 'border-slate-800/80' : 'border-slate-100'
                    }`}>
                      <span className={`font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{item.url}</span>
                      <span className="text-emerald-500 font-medium flex items-center gap-1">
                        Launch &rarr;
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PWA & Repository Info Card */}
            <div className={`mt-8 p-6 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              isDark 
                ? 'border-slate-800 bg-slate-900/40' 
                : 'border-slate-200 bg-white shadow-xs'
            }`}>
              <div>
                <div className="text-xs font-mono text-emerald-500 mb-1">
                  REPOSITORY SYNCHRONIZED
                </div>
                <div className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  helpgoodforyouofficial-eng/easy-bill-generator
                </div>
                <div className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  Real-time iframe heartbeat &amp; load detection · Online/Offline network sync
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleLaunch('/stock.html')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                >
                  Manage Stock
                </button>
                <button
                  onClick={() => handleLaunch('/bills.html')}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors border ${
                    isDark 
                      ? 'text-slate-200 bg-slate-800 hover:bg-slate-700 border-slate-700' 
                      : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-200'
                  }`}
                >
                  Create Bill
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
