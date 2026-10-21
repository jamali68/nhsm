// ==========================================================================
// 📦 NHPos / EasyBill IndexedDB Caching Engine (v1.0)
// High-capacity offline persistence for Pending Bills, Stock, & Customers
// ==========================================================================

const BillsDB = (function() {
    'use strict';

    const DB_NAME = 'NHPosBillingDB';
    const DB_VERSION = 1;

    const STORES = {
        PENDING_BILLS: 'pending_bills',
        CACHED_STOCK: 'cached_stock',
        CACHED_CUSTOMERS: 'cached_customers'
    };

    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;

        dbPromise = new Promise((resolve) => {
            if (!window.indexedDB) {
                console.warn('IndexedDB not supported in this browser. Falling back to localStorage.');
                resolve(null);
                return;
            }

            try {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = function(e) {
                    const db = e.target.result;

                    // 1. Pending bills store
                    if (!db.objectStoreNames.contains(STORES.PENDING_BILLS)) {
                        const billStore = db.createObjectStore(STORES.PENDING_BILLS, { keyPath: 'localId' });
                        billStore.createIndex('agencyId', 'agencyId', { unique: false });
                        billStore.createIndex('createdAt', 'createdAt', { unique: false });
                        billStore.createIndex('type', 'type', { unique: false });
                        billStore.createIndex('syncStatus', 'syncStatus', { unique: false });
                    }

                    // 2. Cached stock catalogue store
                    if (!db.objectStoreNames.contains(STORES.CACHED_STOCK)) {
                        const stockStore = db.createObjectStore(STORES.CACHED_STOCK, { keyPath: 'id' });
                        stockStore.createIndex('agencyId', 'agencyId', { unique: false });
                        stockStore.createIndex('barcode', 'barcode', { unique: false });
                        stockStore.createIndex('name', 'name', { unique: false });
                    }

                    // 3. Cached customers store
                    if (!db.objectStoreNames.contains(STORES.CACHED_CUSTOMERS)) {
                        const custStore = db.createObjectStore(STORES.CACHED_CUSTOMERS, { keyPath: 'id' });
                        custStore.createIndex('agencyId', 'agencyId', { unique: false });
                        custStore.createIndex('name', 'name', { unique: false });
                        custStore.createIndex('mobile', 'mobile', { unique: false });
                    }
                };

                request.onsuccess = function(e) {
                    resolve(e.target.result);
                };

                request.onerror = function(e) {
                    console.error('IndexedDB open error:', e.target.error);
                    resolve(null);
                };

                request.onblocked = function() {
                    console.warn('IndexedDB blocked by another tab.');
                };
            } catch (err) {
                console.error('IndexedDB initialization failed:', err);
                resolve(null);
            }
        });

        return dbPromise;
    }

    // --- 💾 PENDING BILLS CRUD (OFFLINE STORAGE) ---

    async function savePendingBill(billData) {
        const db = await openDB();
        const agencyId = billData.agencyId || localStorage.getItem('eb_active_agencyId') || 'default';
        const localId = billData.localId || billData.id || ('off_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));

        const record = {
            ...billData,
            localId: localId,
            agencyId: agencyId,
            isOffline: true,
            syncStatus: 'pending',
            savedAt: new Date().toISOString()
        };

        if (db) {
            try {
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([STORES.PENDING_BILLS], 'readwrite');
                    const store = tx.objectStore(STORES.PENDING_BILLS);
                    const req = store.put(record);
                    req.onsuccess = () => resolve(record);
                    req.onerror = () => reject(req.error);
                });
            } catch(e) {
                console.warn('IndexedDB put pending bill error:', e);
            }
        }

        // Secondary fallback to localStorage
        try {
            const key = `eb_offline_orders_${agencyId}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const idx = existing.findIndex(x => (x.localId && x.localId === localId) || (x.billNo && x.billNo === record.billNo));
            if (idx >= 0) {
                existing[idx] = record;
            } else {
                existing.push(record);
            }
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {
            console.warn('localStorage backup save error:', e);
        }

        return record;
    }

    async function getPendingBills(agencyId) {
        const db = await openDB();
        let list = [];

        if (db) {
            try {
                list = await new Promise((resolve, reject) => {
                    const tx = db.transaction([STORES.PENDING_BILLS], 'readonly');
                    const store = tx.objectStore(STORES.PENDING_BILLS);
                    const req = store.getAll();
                    req.onsuccess = () => resolve(req.result || []);
                    req.onerror = () => reject(req.error);
                });
            } catch(e) {
                console.warn('IndexedDB getPendingBills error:', e);
            }
        }

        // Merge with localStorage backup in case any items exist there
        try {
            const targetAgency = agencyId || localStorage.getItem('eb_active_agencyId') || 'default';
            const key = `eb_offline_orders_${targetAgency}`;
            const localList = JSON.parse(localStorage.getItem(key) || '[]');
            
            // Combine ensuring no duplicates by localId or billNo
            localList.forEach(locItem => {
                const found = list.some(x => (x.localId && x.localId === locItem.localId) || (x.billNo && x.billNo === locItem.billNo));
                if (!found) {
                    list.push(locItem);
                    // Backfill into IndexedDB
                    if (db) {
                        try {
                            const tx = db.transaction([STORES.PENDING_BILLS], 'readwrite');
                            tx.objectStore(STORES.PENDING_BILLS).put(locItem);
                        } catch(bErr) {}
                    }
                }
            });
        } catch(e) {}

        if (agencyId) {
            return list.filter(b => !b.agencyId || b.agencyId === agencyId);
        }
        return list;
    }

    async function removePendingBill(localId, agencyId) {
        const db = await openDB();
        if (db && localId) {
            try {
                await new Promise((resolve, reject) => {
                    const tx = db.transaction([STORES.PENDING_BILLS], 'readwrite');
                    const store = tx.objectStore(STORES.PENDING_BILLS);
                    const req = store.delete(localId);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => reject(req.error);
                });
            } catch(e) {
                console.warn('IndexedDB delete pending bill error:', e);
            }
        }

        // Also clean up localStorage backup
        try {
            const targetAgency = agencyId || localStorage.getItem('eb_active_agencyId') || 'default';
            const key = `eb_offline_orders_${targetAgency}`;
            const existing = JSON.parse(localStorage.getItem(key) || '[]');
            const filtered = existing.filter(x => x.localId !== localId && x.billNo !== localId);
            localStorage.setItem(key, JSON.stringify(filtered));
        } catch(e) {}

        return true;
    }

    async function clearAllPendingBills(agencyId) {
        const db = await openDB();
        if (db) {
            try {
                const tx = db.transaction([STORES.PENDING_BILLS], 'readwrite');
                const store = tx.objectStore(STORES.PENDING_BILLS);
                if (!agencyId) {
                    store.clear();
                } else {
                    const list = await getPendingBills(agencyId);
                    list.forEach(item => {
                        if (item.agencyId === agencyId) {
                            store.delete(item.localId);
                        }
                    });
                }
            } catch(e) {}
        }

        try {
            const targetAgency = agencyId || localStorage.getItem('eb_active_agencyId') || 'default';
            localStorage.removeItem(`eb_offline_orders_${targetAgency}`);
        } catch(e) {}
    }

    // --- 📦 STOCK & CUSTOMER CACHING IN INDEXEDDB ---

    async function cacheStock(agencyId, stockList) {
        if (!Array.isArray(stockList) || stockList.length === 0) return;
        const db = await openDB();
        if (!db) return;
        try {
            const tx = db.transaction([STORES.CACHED_STOCK], 'readwrite');
            const store = tx.objectStore(STORES.CACHED_STOCK);
            stockList.forEach(item => {
                store.put({
                    ...item,
                    agencyId: agencyId,
                    id: String(item.id || item.stockId || ('stk_' + Math.random().toString(36).substr(2, 5)))
                });
            });
        } catch(e) {
            console.warn('IndexedDB cacheStock error:', e);
        }
    }

    async function getCachedStock(agencyId) {
        const db = await openDB();
        if (!db) return [];
        try {
            return await new Promise((resolve) => {
                const tx = db.transaction([STORES.CACHED_STOCK], 'readonly');
                const store = tx.objectStore(STORES.CACHED_STOCK);
                const req = store.getAll();
                req.onsuccess = () => {
                    const list = req.result || [];
                    if (agencyId) {
                        resolve(list.filter(x => !x.agencyId || x.agencyId === agencyId));
                    } else {
                        resolve(list);
                    }
                };
                req.onerror = () => resolve([]);
            });
        } catch(e) {
            return [];
        }
    }

    async function cacheCustomers(agencyId, custList) {
        if (!Array.isArray(custList) || custList.length === 0) return;
        const db = await openDB();
        if (!db) return;
        try {
            const tx = db.transaction([STORES.CACHED_CUSTOMERS], 'readwrite');
            const store = tx.objectStore(STORES.CACHED_CUSTOMERS);
            custList.forEach(c => {
                store.put({
                    ...c,
                    agencyId: agencyId,
                    id: String(c.id)
                });
            });
        } catch(e) {
            console.warn('IndexedDB cacheCustomers error:', e);
        }
    }

    async function getCachedCustomers(agencyId) {
        const db = await openDB();
        if (!db) return [];
        try {
            return await new Promise((resolve) => {
                const tx = db.transaction([STORES.CACHED_CUSTOMERS], 'readonly');
                const store = tx.objectStore(STORES.CACHED_CUSTOMERS);
                const req = store.getAll();
                req.onsuccess = () => {
                    const list = req.result || [];
                    if (agencyId) {
                        resolve(list.filter(x => !x.agencyId || x.agencyId === agencyId));
                    } else {
                        resolve(list);
                    }
                };
                req.onerror = () => resolve([]);
            });
        } catch(e) {
            return [];
        }
    }

    // Auto-initialize connection
    openDB();

    return {
        openDB,
        savePendingBill,
        getPendingBills,
        removePendingBill,
        clearAllPendingBills,
        cacheStock,
        getCachedStock,
        cacheCustomers,
        getCachedCustomers
    };
})();

window.BillsDB = BillsDB;
