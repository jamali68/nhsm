// ==========================================================================
// ⚡ EASY BILL GENERATOR — CLOUD SYNC & SHIFT QUOTA ENGINE (v2.0)
// 🇵🇰 Pakistan Standard Time (PKT, UTC+5) 2-Shift System
// 🛡️ Shift 1: 12:00 AM - 12:00 PM PKT | Shift 2: 12:00 PM - 12:00 AM PKT
// 🔒 Strict Rules: 1 Manual Refresh Per Shift | Offline Guard | 100% English
// ==========================================================================

(function (window) {
    'use strict';

    const CloudSync = {
        version: '2.0.0',

        // ⚙️ 0. Quota & Sync Settings Reader / Writer
        getSettings(agencyId) {
            agencyId = agencyId || localStorage.getItem('eb_active_agencyId') || 'agency_default';
            try {
                const raw = localStorage.getItem(`eb_sync_settings_${agencyId}`);
                if (raw) return JSON.parse(raw);
            } catch (e) {}
            return {
                syncMode: 'shift_schedule',
                protectBookerOrders: true,
                offlineCache: true
            };
        },

        saveSettings(agencyId, settings) {
            agencyId = agencyId || localStorage.getItem('eb_active_agencyId') || 'agency_default';
            try {
                localStorage.setItem(`eb_sync_settings_${agencyId}`, JSON.stringify(settings));
                return true;
            } catch (e) {
                return false;
            }
        },

        // 🇵🇰 1. Calculate Pakistan Standard Time (PKT, UTC+5) and Active Shift
        getPktInfo() {
            const now = new Date();
            // Convert local time to UTC, then add 5 hours for PKT
            const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
            const pktTime = new Date(utcTime + (3600000 * 5));

            const pktHours = pktTime.getHours();
            const pktMinutes = pktTime.getMinutes();
            const pktSeconds = pktTime.getSeconds();

            // Format YYYY-MM-DD in PKT
            const y = pktTime.getFullYear();
            const m = String(pktTime.getMonth() + 1).padStart(2, '0');
            const d = String(pktTime.getDate()).padStart(2, '0');
            const pktDateStr = `${y}-${m}-${d}`;

            // Slot 1: Morning (12:00:00 AM to 11:59:59 AM PKT) -> hours 0..11
            // Slot 2: Evening (12:00:00 PM to 11:59:59 PM PKT) -> hours 12..23
            const isMorning = pktHours < 12;
            const shiftId = isMorning ? 'morning' : 'evening';
            const shiftTitle = isMorning
                ? 'Shift 1: Morning (12:00 AM - 12:00 PM PKT)'
                : 'Shift 2: Evening (12:00 PM - 12:00 AM PKT)';
            const shiftShort = isMorning ? 'Morning Shift' : 'Evening Shift';
            const shiftHours = isMorning ? '12:00 AM - 12:00 PM' : '12:00 PM - 12:00 AM';

            const slotKey = `${pktDateStr}_${shiftId}`;

            // Calculate countdown to next shift change
            const nextShiftTarget = new Date(pktTime);
            if (isMorning) {
                nextShiftTarget.setHours(12, 0, 0, 0);
            } else {
                nextShiftTarget.setDate(nextShiftTarget.getDate() + 1);
                nextShiftTarget.setHours(0, 0, 0, 0);
            }
            const msToNext = Math.max(0, nextShiftTarget.getTime() - pktTime.getTime());
            const hoursToNext = Math.floor(msToNext / (1000 * 60 * 60));
            const minsToNext = Math.floor((msToNext % (1000 * 60 * 60)) / (1000 * 60));

            // Formatted 12-hour clock
            const ampm = pktHours >= 12 ? 'PM' : 'AM';
            const h12 = pktHours % 12 || 12;
            const formattedTime = `${String(h12).padStart(2, '0')}:${String(pktMinutes).padStart(2, '0')}:${String(pktSeconds).padStart(2, '0')} ${ampm} PKT`;

            return {
                pktTime,
                pktHours,
                pktMinutes,
                pktDateStr,
                isMorning,
                shiftId,
                shiftTitle,
                shiftShort,
                shiftHours,
                slotKey,
                formattedTime,
                nextShiftIn: `${hoursToNext}h ${minsToNext}m`
            };
        },

        // ⚙️ 2. Read Shift Status for Agency
        getSyncStatus(agencyId) {
            agencyId = agencyId || localStorage.getItem('eb_active_agencyId') || 'agency_default';
            const pkt = this.getPktInfo();
            const lastSlot = localStorage.getItem(`eb_last_sync_slot_${agencyId}`);
            const lastTime = localStorage.getItem(`eb_last_sync_time_${agencyId}`);

            const isShiftSynced = (lastSlot === pkt.slotKey);

            // Format last sync time in English
            let lastFormatted = 'Never';
            if (lastTime) {
                try {
                    const dt = new Date(parseInt(lastTime, 10));
                    const shiftLabel = (lastSlot && lastSlot.includes('morning')) ? 'Morning Shift' : 'Evening Shift';
                    lastFormatted = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) +
                        ` (${shiftLabel})`;
                } catch (e) {}
            }

            // Reads saved stats
            let readsSaved = 0;
            try {
                readsSaved = parseInt(localStorage.getItem(`eb_reads_saved_${agencyId}`) || '0', 10);
            } catch (e) {}

            return {
                pkt,
                isShiftSynced,
                lastSlot,
                lastTime,
                lastFormatted,
                readsSaved,
                isOnline: navigator.onLine
            };
        },

        // 📈 3. Record reads saved in local storage
        recordReadsSaved(agencyId, count) {
            agencyId = agencyId || localStorage.getItem('eb_active_agencyId');
            if (!agencyId || !count || count <= 0) return;
            try {
                const cur = parseInt(localStorage.getItem(`eb_reads_saved_${agencyId}`) || '0', 10);
                localStorage.setItem(`eb_reads_saved_${agencyId}`, String(cur + count));
            } catch (e) {}
        },

        // 🚀 4. Manual Shift Refresh (With Offline Check & Strict 1-per-shift Limit)
        async syncShiftData(agencyId, options = {}) {
            agencyId = agencyId || localStorage.getItem('eb_active_agencyId');
            if (!agencyId) return { success: false, error: 'no_agency', message: 'Agency ID not found' };

            const pkt = this.getPktInfo();
            const showToast = options.silent !== true;

            // 🛑 A. Check Online Status
            if (!navigator.onLine) {
                const msg = 'You are currently offline. Please connect to the internet first to refresh cloud data.';
                if (showToast && typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'warning',
                        title: 'You Are Offline',
                        text: msg,
                        confirmButtonColor: '#0284c7'
                    });
                }
                return { success: false, error: 'offline', message: msg };
            }

            // 🛑 B. Check 1 Refresh Per Shift Limit (unless force override requested by system)
            const lastSlot = localStorage.getItem(`eb_last_sync_slot_${agencyId}`);
            if (options.force !== true && lastSlot === pkt.slotKey) {
                const msg = `Shift Refresh Limit Reached: You have already refreshed data for this shift (${pkt.shiftShort}: ${pkt.shiftHours} PKT). Your next data refresh will unlock in ${pkt.nextShiftIn}.`;
                if (showToast && typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'info',
                        title: 'Shift Limit Reached',
                        html: `
                            <div style="font-size:13px; color:#334155; line-height:1.6; text-align:left;">
                                <p style="margin:0 0 10px 0;">
                                    <b>You have already refreshed data for this shift:</b><br>
                                    <span style="color:#0284c7; font-weight:700;">${pkt.shiftTitle}</span>
                                </p>
                                <div style="background:#f1f5f9; border-left:4px solid #0284c7; padding:10px 12px; border-radius:4px; margin-bottom:12px;">
                                    To protect cloud quota, only <b>1 refresh</b> is permitted per shift.<br>
                                    Next refresh unlocks in: <b style="color:#0f172a;">${pkt.nextShiftIn}</b>
                                </div>
                                <span style="font-size:12px; color:#64748b;">
                                    All your stock and customer records are safely loaded from local cache with zero delays.
                                </span>
                            </div>
                        `,
                        confirmButtonText: 'Understood',
                        confirmButtonColor: '#0284c7'
                    });
                }
                return { success: false, error: 'limit_exceeded', message: msg };
            }

            // 🌐 C. Fetch Fresh Data from Firestore (1 Batch Read, NOT continuous onSnapshot)
            const db = options.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
            if (!db) {
                return { success: false, error: 'no_db', message: 'Database service is not ready.' };
            }

            try {
                const [stockSnap, custSnap] = await Promise.all([
                    db.collection('stock').where('agencyId', '==', agencyId).get(),
                    db.collection('customers').where('agencyId', '==', agencyId).get()
                ]);

                // 1. Process and cache Stock
                const stockItems = [];
                stockSnap.forEach(doc => {
                    const data = doc.data();
                    data.id = doc.id;
                    if (data.retailRate === undefined) data.retailRate = data.rate || 0;
                    if (data.wholesaleRate === undefined) data.wholesaleRate = data.rate || 0;
                    stockItems.push(data);
                });
                stockItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                localStorage.setItem(`eb_stock_cache_${agencyId}`, JSON.stringify({
                    items: stockItems,
                    syncedAt: Date.now(),
                    slotKey: pkt.slotKey
                }));

                // 2. Process and cache Customers
                const customerItems = [];
                custSnap.forEach(doc => {
                    customerItems.push({ id: doc.id, ...doc.data() });
                });
                customerItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                localStorage.setItem(`eb_cust_cache_${agencyId}`, JSON.stringify(customerItems));

                // 3. Mark Shift as Synced
                const nowTime = Date.now();
                localStorage.setItem(`eb_last_sync_slot_${agencyId}`, pkt.slotKey);
                localStorage.setItem(`eb_last_sync_time_${agencyId}`, String(nowTime));

                // 4. Dispatch event so open pages update their data immediately
                window.dispatchEvent(new CustomEvent('eb-data-synced', {
                    detail: {
                        agencyId,
                        stock: stockItems,
                        customers: customerItems,
                        slotKey: pkt.slotKey,
                        time: nowTime
                    }
                }));

                // Update indicators
                this.updateTopBarIndicator(agencyId);

                if (showToast && typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Cloud Data Refreshed!',
                        html: `
                            <div style="font-size:13px; line-height:1.6; text-align:left; color:#1e293b;">
                                <b>Active Shift:</b> ${pkt.shiftTitle}<br>
                                📦 <b>Stock Items:</b> ${stockItems.length}<br>
                                👥 <b>Customer Accounts:</b> ${customerItems.length}<br>
                                <hr style="margin:8px 0; border:0; border-top:1px dashed #cbd5e1;">
                                <span style="color:#16a34a; font-weight:bold;">
                                    ✅ Data updated in local cache. Your 1 refresh for this shift is now used.
                                </span>
                            </div>
                        `,
                        timer: 4000,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }

                return {
                    success: true,
                    stockCount: stockItems.length,
                    custCount: customerItems.length,
                    slotKey: pkt.slotKey
                };

            } catch (err) {
                console.error('CloudSync error:', err);
                if (showToast && typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Sync Failed',
                        text: err.message || 'Could not fetch data from cloud. Please check your internet connection.'
                    });
                }
                return { success: false, error: err };
            }
        },

        // 🛡️ 5. Auto-check on page load: Zero auto-fetch! (Uses local cache only)
        checkAndAutoSync(agencyId) {
            if (!agencyId) return;
            const status = this.getSyncStatus(agencyId);

            // Record estimated reads saved for opening page from cache
            let stockCount = 0;
            try {
                const st = JSON.parse(localStorage.getItem(`eb_stock_cache_${agencyId}`) || '{}');
                if (Array.isArray(st.items)) stockCount = st.items.length;
            } catch (e) {}
            this.recordReadsSaved(agencyId, stockCount + 30);
            this.updateTopBarIndicator(agencyId);
        },

        // 🔝 6. Topbar Visual Indicator
        updateTopBarIndicator(agencyId) {
            agencyId = agencyId || localStorage.getItem('eb_active_agencyId');
            if (!agencyId) return;
            const dot = document.getElementById('ebTopSyncDot');
            const btn = document.getElementById('ebTopSyncBtn');
            const status = this.getSyncStatus(agencyId);

            if (dot) {
                if (status.isShiftSynced) {
                    dot.style.background = '#10b981'; // Green: Shift refresh completed
                    dot.title = `Shift Synced: ${status.pkt.shiftShort}`;
                } else {
                    dot.style.background = '#0284c7'; // Blue: 1 refresh available
                    dot.title = `1 Refresh Available for ${status.pkt.shiftShort}`;
                }
            }

            if (btn) {
                btn.title = `Cloud Sync: ${status.isShiftSynced ? 'Shift Refresh Used (Cached)' : '1 Refresh Available'} (${status.pkt.formattedTime})`;
            }
        },

        // 📱 7. Interactive Cloud Sync Modal (100% Clean English)
        openSyncModal(agencyId, db) {
            agencyId = agencyId || localStorage.getItem('eb_active_agencyId');
            if (!agencyId) {
                window.location.href = 'settings.html?tab=secSyncSchedule';
                return;
            }

            const status = this.getSyncStatus(agencyId);
            const pkt = status.pkt;
            const isSynced = status.isShiftSynced;
            const isOnline = navigator.onLine;

            const modalHtml = `
                <div style="text-align:left; font-size:13px; color:#1e293b; line-height:1.6;">
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:12px; border-radius:10px; margin-bottom:14px; text-align:center;">
                        <div style="font-size:11px; font-weight:700; color:#15803d; text-transform:uppercase; letter-spacing:0.5px;">
                            🇵🇰 Pakistan Standard Time (PKT, UTC+5)
                        </div>
                        <div style="font-size:22px; font-weight:900; color:#166534; margin:4px 0;" id="modalPktClock">
                            ${pkt.formattedTime}
                        </div>
                        <div style="font-size:12px; font-weight:700; color:#15803d;">
                            ${pkt.shiftTitle}
                        </div>
                    </div>

                    <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:12px; margin-bottom:14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:600; color:#475569;">Network Connection:</span>
                            <span style="font-weight:800; font-size:11px; padding:2px 8px; border-radius:12px; background:${isOnline ? '#dcfce7; color:#15803d;' : '#fee2e2; color:#b91c1c;'}">
                                ${isOnline ? '🟢 Online' : '🔴 Offline'}
                            </span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:600; color:#475569;">Shift Refresh Status:</span>
                            <span style="font-weight:800; font-size:11px; padding:2px 8px; border-radius:12px; background:${isSynced ? '#dcfce7; color:#15803d;' : '#e0f2fe; color:#0369a1;'}">
                                ${isSynced ? '✅ 1 of 1 Refresh Used' : '⚡ 1 Refresh Available'}
                            </span>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:600; color:#475569;">Last Synced:</span>
                            <b style="color:#0f172a;">${status.lastFormatted}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <span style="font-weight:600; color:#475569;">Next Shift Unlocks In:</span>
                            <b style="color:#0284c7;">${pkt.nextShiftIn}</b>
                        </div>
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:600; color:#475569;">Cloud Reads Saved:</span>
                            <b style="color:#16a34a; font-size:14px;">⚡ ${status.readsSaved.toLocaleString()} reads</b>
                        </div>
                    </div>

                    <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:10px; font-size:12px; color:#1e40af;">
                        ℹ️ <b>Shift Timetable Rule:</b> 1 manual refresh is allowed per shift (Morning: 12 AM - 12 PM | Evening: 12 PM - 12 AM PKT). All billing and stock operations continue offline instantly.
                    </div>
                </div>
            `;

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Cloud Sync & Shift Schedule',
                    html: modalHtml,
                    showCancelButton: true,
                    confirmButtonText: '<i class="fas fa-rotate"></i> Refresh Cloud Data Now',
                    cancelButtonText: 'Close',
                    confirmButtonColor: '#10b981',
                    cancelButtonColor: '#64748b',
                    didOpen: () => {
                        const clockEl = document.getElementById('modalPktClock');
                        if (clockEl) {
                            const timer = setInterval(() => {
                                if (!document.getElementById('modalPktClock')) {
                                    clearInterval(timer);
                                    return;
                                }
                                clockEl.innerText = CloudSync.getPktInfo().formattedTime;
                            }, 1000);
                        }
                    }
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        Swal.fire({
                            title: 'Syncing Data...',
                            text: 'Fetching fresh stock and customer records from cloud...',
                            allowOutsideClick: false,
                            didOpen: () => Swal.showLoading()
                        });
                        await CloudSync.syncShiftData(agencyId, { db, silent: false });
                    }
                });
            }
        }
    };

    window.CloudSync = CloudSync;

})(window);
