// ============================================
// 🎨 EASY BILL GENERATOR — BILL TEMPLATES (v1)
// ✅ 5 Professional Templates:
//    T1: 🇵🇰 Urdu Classic (Nastaliq!)
//    T2: 📋 Traders English (Big Header)
//    T3: 🇵🇰 Urdu + English Mix
//    T4: ⚡ Modern Minimal (Default)
//    T5: 💎 Premium Full (Sab kuch!)
// ✅ Har template: Print/PDF/JPG/Share ke sath!
// ============================================

// ============================================
// 🎨 URDU FONT (Nastaliq!)
// ============================================
function getUrduFontCSS() {
    return `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
    .urdu-text { 
        font-family: 'Noto Nastaliq Urdu', serif; 
        direction: rtl; 
        line-height: 2.2;
    }
    `;
}

// ============================================
// 🎯 SHARED DATA HELPERS
// ============================================
function getTemplateAgency(agency, bill) {
    const ag = agency || {};
    const b = bill || {};
    return {
        name: ag.name || b.agencyName || 'NH POS',
        tagline: ag.tagline || ag.slogan || b.agencyTagline || '',
        ownerName: ag.ownerName || ag.proprietor || b.agencyOwner || '',
        mobile: ag.mobile || ag.ownerMobile || b.agencyMobile || '',
        mobile2: ag.mobile2 || ag.phone || b.agencyPhone || '',
        phone: ag.phone || b.agencyPhone || '',
        address: ag.address || b.agencyAddress || '',
        city: ag.city || b.agencyCity || '',
        ntn: ag.ntn || b.agencyNtn || '',
        licenceNo: ag.licenceNo || ag.licenseNo || ag.regNo || b.agencyLicence || '',
        strn: ag.strn || b.agencyStrn || '',
        logo: ag.logoBase64 || ag.logo || b.agencyLogo || null,
        invoiceFooter: ag.invoiceFooter || b.invoiceFooter || '',
        terminalId: ag.terminalId || 'DESKTOP-POS-01'
    };
}

function getTemplateCustomer(bill) {
    const b = bill || {};
    const ntnVal = b.customerNtn || b.custNTN || b.customerNTN || (b.customer && (b.customer.ntn || b.customer.customerNtn)) || '';
    const fbrStatusVal = b.customerFbrStatus || (b.customer && b.customer.fbrStatus) || (ntnVal ? 'filer' : 'non-filer');
    return {
        id: b.customerId || '',
        code: b.customerId ? b.customerId.slice(-4) : (b.customerCode || '101'),
        name: b.customerName || (b.customer && b.customer.name) || 'Counter Sale',
        shopName: b.customerShopName || (b.customer && b.customer.shopName) || '',
        mobile: b.customerMobile || (b.customer && b.customer.mobile) || '',
        address: b.customerAddress || (b.customer && b.customer.address) || '',
        route: b.customerRoute || (b.customer && b.customer.route) || '',
        city: b.customerCity || (b.customer && b.customer.city) || '',
        area: b.customerArea || b.customerRoute || (b.customer && (b.customer.area || b.customer.route)) || '',
        terms: b.customerTerms || (b.customer && b.customer.paymentTerms) || '',
        ntn: ntnVal,
        fbrStatus: fbrStatusVal,
        isFiler: fbrStatusVal === 'filer',
        cnic: b.customerCnic || (b.customer && b.customer.cnic) || ''
    };
}

function getTemplateItems(bill) {
    return (bill.items || []).map((it, i) => ({
        sno: i + 1,
        name: it.name,
        qty: it.qty,
        rate: it.rate,
        total: (it.total || 0).toFixed(2)
    }));
}

function getTemplateTotals(bill) {
    return {
        subTotal: (bill.subTotal || 0).toFixed(2),
        discount: (bill.discount || 0).toFixed(2),
        grandTotal: (bill.grandTotal || 0).toFixed(2),
        prevBalance: (bill.previousBalance || 0).toFixed(2),
        received: (bill.received || 0).toFixed(2),
        balance: (bill.balance || 0).toFixed(2)
    };
}

// ============================================
// 🎨 TEMPLATE 1: 🇵🇰 URDU CLASSIC (Nastaliq!)
// DigiKhata-style — Urdu header, seedhi layout
// ============================================
function template1Urdu(bill, agency, customer, settings) {
    const s = settings || (window.ebPrintEngine ? window.ebPrintEngine.getEffectivePrintSettings(agency) : {});
    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const bookerName = bill.bookerName || bill.salesmanName || '';
    const bookerMobile = bill.bookerMobile || '';
    const custDisplayName = customer.shopName ? `${customer.shopName} (${customer.name})` : (customer.name || 'Counter Sale');

    return `
    <html>
    <head>
        <title>${bill.billNo}</title>
        <style>
            ${getUrduFontCSS()}
            body { 
                font-family: 'Segoe UI', Arial, sans-serif; 
                padding: 20px; max-width: 650px; margin: auto; color: #333;
            }
            .urdu-main {
                background: #fff;
                padding: 20px;
                border: 2px solid #333;
                border-radius: 8px;
            }
            .urdu-header {
                text-align: center;
                border-bottom: 3px double #333;
                padding-bottom: 15px;
                margin-bottom: 15px;
            }
            .urdu-title {
                font-family: 'Noto Nastaliq Urdu', serif;
                font-size: 28px;
                font-weight: 700;
                color: #1a1a1a;
                margin: 0;
                line-height: 1.8;
            }
            .urdu-subtitle {
                font-family: 'Noto Nastaliq Urdu', serif;
                font-size: 14px;
                color: #555;
                margin: 5px 0;
            }
            .cash-tag {
                font-size: 22px;
                font-weight: bold;
                color: #2c3e50;
                letter-spacing: 3px;
                text-align: right;
                margin-top: -40px;
            }
            .urdu-info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px 20px;
                font-family: 'Noto Nastaliq Urdu', serif;
                font-size: 14px;
                border: 1px solid #555;
                padding: 12px;
                border-radius: 6px;
                margin-bottom: 15px;
            }
            .urdu-info-item {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                border-bottom: 1px dotted #999;
                padding: 3px 0;
            }
            .urdu-info-label { color: #555; }
            .urdu-info-value { color: #1a1a1a; font-weight: bold; }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 15px 0;
                font-family: 'Noto Nastaliq Urdu', serif;
            }
            th, td {
                border: 1px solid #444;
                padding: 6px 8px;
                text-align: center;
                font-size: 13px;
            }
            th { background: #f0f0f0; font-weight: bold; }
            td.name { text-align: right; }
            .urdu-totals {
                font-family: 'Noto Nastaliq Urdu', serif;
                margin-top: 15px;
            }
            .urdu-total-row {
                display: flex;
                justify-content: space-between;
                padding: 5px 15px;
                font-size: 15px;
            }
            .urdu-total-row.grand {
                border-top: 2px solid #333;
                font-weight: bold;
                font-size: 17px;
                background: #f9f9f9;
            }
            .urdu-total-row.bal { color: #c0392b; font-weight: bold; }
            .urdu-footer {
                text-align: center;
                font-family: 'Noto Nastaliq Urdu', serif;
                font-size: 12px;
                color: #666;
                margin-top: 20px;
                border-top: 1px solid #ccc;
                padding-top: 10px;
                line-height: 2;
            }
            .sig-area {
                margin-top: 40px;
                display: flex;
                justify-content: space-between;
                font-family: 'Noto Nastaliq Urdu', serif;
            }
            .sig-box {
                border-top: 1px solid #333;
                width: 140px;
                text-align: center;
                padding-top: 5px;
                font-size: 13px;
            }
        </style>
    </head>
    <body>
        <div class="urdu-main">
            <div class="urdu-header">
                ${(s.showLogo !== false && agency.logo) ? `<div style="text-align:center; margin-bottom:8px;"><img src="${agency.logo}" style="max-height:55px; max-width:140px; object-fit:contain;"></div>` : ''}
                ${s.showAgencyName ? `<h1 class="urdu-title">${agency.name}</h1>` : ''}
                ${s.showAddress && agency.address ? `<p class="urdu-subtitle">${agency.address} ${agency.city ? ', ' + agency.city : ''}</p>` : ''}
                <div class="urdu-subtitle" style="font-size:12px; font-weight:bold;">
                    ${s.showMobiles && agency.mobile ? `<span>📱 ${agency.mobile}</span>` : ''}
                    ${s.showNTN && agency.ntn ? `&nbsp;|&nbsp; <span>NTN: ${agency.ntn}</span>` : ''}
                    ${s.showLicence && agency.licenceNo ? `&nbsp;|&nbsp; <span>Licence: ${agency.licenceNo}</span>` : ''}
                </div>
                ${s.showOwnerName && agency.ownerName ? `<p class="urdu-subtitle" style="font-size:12px;">👤 ${agency.ownerName}</p>` : ''}
                ${s.showPayType ? `<div class="cash-tag">${bill.payType || 'CASH'}</div>` : ''}
            </div>

            <div class="urdu-info-grid">
                ${s.showBillNo ? `<div class="urdu-info-item"><span class="urdu-info-label">بل نمبر:</span><span class="urdu-info-value">${bill.billNo}</span></div>` : ''}
                ${s.showDate ? `<div class="urdu-info-item"><span class="urdu-info-label">تاریخ:</span><span class="urdu-info-value">${dateStr} ${s.showTime ? timeStr : ''}</span></div>` : ''}
                ${s.showCustomerName ? `<div class="urdu-info-item"><span class="urdu-info-label">گاہک کا نام:</span><span class="urdu-info-value">${custDisplayName}</span></div>` : ''}
                ${s.showCustomerPhone ? `<div class="urdu-info-item"><span class="urdu-info-label">موبائل:</span><span class="urdu-info-value">${customer.mobile || '—'}</span></div>` : ''}
                ${s.showCustomerAddress ? `<div class="urdu-info-item"><span class="urdu-info-label">پتہ:</span><span class="urdu-info-value">${customer.address || '—'}</span></div>` : ''}
                ${s.showCustomerRoute ? `<div class="urdu-info-item"><span class="urdu-info-label">روٹ:</span><span class="urdu-info-value">${customer.route || bill.customerRoute || '—'}</span></div>` : ''}
                ${s.showCustomerNTN ? `<div class="urdu-info-item"><span class="urdu-info-label">گاہک NTN:</span><span class="urdu-info-value">${customer.ntn || '—'} <small style="font-weight:bold; margin-right:4px;">(${customer.isFiler ? '🟢 فائلر' : '🔴 نان فائلر'})</small></span></div>` : ''}
                ${s.showBookerName && bookerName ? `<div class="urdu-info-item"><span class="urdu-info-label">سیلزمین / بکر:</span><span class="urdu-info-value">${bookerName} ${bookerMobile}</span></div>` : ''}
            </div>

            <table>
                <tr>
                    <th>نمبر</th>
                    <th>تفصیل</th>
                    <th>تعداد</th>
                    <th>ریٹ</th>
                    <th>کل قیمت</th>
                </tr>
                ${items.map(it => `
                <tr>
                    <td>${it.sno}</td>
                    <td class="name">${it.name}</td>
                    <td>${it.qty}</td>
                    <td>Rs ${it.rate}</td>
                    <td>Rs ${it.total}</td>
                </tr>`).join('')}
            </table>

            <div class="urdu-totals">
                <div class="urdu-total-row">
                    <span>ٹوٹل رقم:</span>
                    <span>Rs ${tot.subTotal}</span>
                </div>
                ${parseFloat(tot.discount) > 0 ? `
                <div class="urdu-total-row">
                    <span>ڈسکاؤنٹ:</span>
                    <span>Rs ${tot.discount}</span>
                </div>` : ''}
                ${(s.showTax && (bill.taxAmount > 0 || (bill.taxRate && bill.taxRate > 0))) ? `
                <div class="urdu-total-row">
                    <span>FBR ایڈوانس ٹیکس (${customer.isFiler ? 'فائلر' : 'نان فائلر'} ${bill.taxRate ? bill.taxRate + '%' : ''}):</span>
                    <span>+ Rs ${parseFloat(bill.taxAmount || 0).toFixed(2)}</span>
                </div>` : ''}
                <div class="urdu-total-row grand">
                    <span>کل واجب الادا:</span>
                    <span>Rs ${tot.grandTotal}</span>
                </div>
                ${s.showPreviousBalance !== false && parseFloat(tot.prevBalance) > 0 ? `
                <div class="urdu-total-row">
                    <span>سابقہ بقایا:</span>
                    <span>Rs ${tot.prevBalance}</span>
                </div>` : ''}
                ${s.showReceivedAmount !== false && parseFloat(tot.received) > 0 ? `
                <div class="urdu-total-row">
                    <span>وصول شدہ:</span>
                    <span>Rs ${tot.received}</span>
                </div>` : ''}
                ${s.showBalance !== false ? `
                <div class="urdu-total-row bal">
                    <span>کل بقایا رقم:</span>
                    <span>Rs ${tot.balance}</span>
                </div>` : ''}
            </div>

            <div class="sig-area">
                <div class="sig-box">دستخط آرڈر بکر / سیلزمین</div>
                <div class="sig-box">دستخط گاہک / دکاندار</div>
                <div class="sig-box">دستخط برائے ادارہ</div>
            </div>

            <div class="urdu-footer">
                ${s.showTermsAndConditions !== false ? `
                مال موقع پر چیک کریں۔ بعد میں کمپنی ذمہ دار نہ ہوگی۔<br>
                ${agency.invoiceFooter ? agency.invoiceFooter + '<br>' : ''}` : ''}
                بل نمبر: ${bill.billNo} — NH POS
            </div>
        </div>
    </body>
    </html>
    `;
}

// ============================================
// 🎨 TEMPLATE 2: 📋 TRADERS ENGLISH (Big Header!)
// Usama Traders style — Bold company header
// ============================================
function template2Traders(bill, agency, customer, settings) {
    const s = settings || (window.ebPrintEngine ? window.ebPrintEngine.getEffectivePrintSettings(agency) : {});
    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const bookerName = bill.bookerName || bill.salesmanName || '';
    const bookerMobile = bill.bookerMobile || '';
    const custDisplayName = customer.shopName ? `${customer.shopName} (${customer.name})` : (customer.name || 'Counter Sale');

    return `
    <html>
    <head>
        <title>${bill.billNo}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 650px; margin: auto; color: #222; }
            .main-header {
                text-align: center;
                border-bottom: 4px solid #222;
                padding-bottom: 12px;
                margin-bottom: 8px;
            }
            .company-name {
                font-size: 34px;
                font-weight: 900;
                letter-spacing: 2px;
                color: #1a1a1a;
                margin: 0;
                text-transform: uppercase;
            }
            .company-sub {
                font-size: 13px;
                color: #555;
                margin: 4px 0 0;
            }
            .cash-tag {
                font-size: 22px;
                font-weight: 900;
                color: #1a1a1a;
                letter-spacing: 4px;
                text-align: right;
                margin: -35px 0 10px;
            }
            .top-info {
                display: flex;
                justify-content: space-between;
                font-size: 12.5px;
                margin-bottom: 14px;
                background: #f8fafc;
                padding: 10px 14px;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
            }
            .top-info div { line-height: 1.6; }
            .top-info b { color: #000; }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin: 10px 0;
                font-size: 13px;
            }
            .items-table th, .items-table td {
                border: 1px solid #333;
                padding: 6px 8px;
                text-align: left;
            }
            .items-table th { background: #f0f0f0; font-weight: bold; text-align: center; }
            .items-table td.num { text-align: right; }
            .summary-table {
                width: 340px;
                margin-left: auto;
                margin-top: 15px;
                font-size: 13px;
            }
            .summary-table div {
                display: flex;
                justify-content: space-between;
                padding: 4px 10px;
            }
            .summary-table .label { font-weight: bold; }
            .summary-table .grand {
                border-top: 2px solid #333;
                font-weight: bold;
                font-size: 15px;
                background: #f9f9f9;
            }
            .summary-table .net {
                font-weight: bold;
                border: 2px solid #333;
                font-size: 14px;
                background: #f0f0f0;
            }
            .sign-area {
                margin-top: 45px;
                display: flex;
                justify-content: space-between;
                font-size: 12.5px;
                font-weight: bold;
            }
            .sign-box {
                border-top: 2px solid #333;
                width: 150px;
                text-align: center;
                padding-top: 5px;
            }
            .footer {
                text-align: center;
                font-size: 10px;
                color: #666;
                margin-top: 25px;
                border-top: 1px solid #999;
                padding-top: 8px;
            }
        </style>
    </head>
    <body>
        <div class="main-header">
            ${(s.showLogo !== false && agency.logo) ? `<div style="margin-bottom:6px;"><img src="${agency.logo}" style="max-height:55px; max-width:140px; object-fit:contain;"></div>` : ''}
            ${s.showAgencyName ? `<h1 class="company-name">${agency.name}</h1>` : ''}
            ${s.showAddress && agency.address ? `<p class="company-sub">📍 ${agency.address} ${agency.city ? ', ' + agency.city : ''}</p>` : ''}
            <div class="company-sub" style="font-weight:bold;">
                ${s.showMobiles && agency.mobile ? `<span>📱 ${agency.mobile}</span>` : ''}
                ${s.showNTN && agency.ntn ? `&nbsp;|&nbsp; <span>NTN: ${agency.ntn}</span>` : ''}
                ${s.showLicence && agency.licenceNo ? `&nbsp;|&nbsp; <span>Licence: ${agency.licenceNo}</span>` : ''}
            </div>
            ${s.showOwnerName && agency.ownerName ? `<p class="company-sub">👤 Owner: ${agency.ownerName}</p>` : ''}
        </div>
        ${s.showPayType ? `<div class="cash-tag">${bill.payType || 'CASH'}</div>` : ''}

        <div class="top-info">
            <div>
                ${s.showCustomerName ? `<b>Customer:</b> ${custDisplayName}<br>` : ''}
                ${s.showCustomerAddress && customer.address ? `<b>Address:</b> ${customer.address}<br>` : ''}
                ${s.showCustomerPhone && customer.mobile ? `<b>Contacts:</b> ${customer.mobile}<br>` : ''}
                ${s.showCustomerRoute && customer.route ? `<b>Route:</b> ${customer.route}<br>` : ''}
                ${s.showCustomerNTN && (customer.ntn || customer.cnic) ? `<b>Customer NTN:</b> ${customer.ntn || customer.cnic} <small>(${customer.isFiler ? '🟢 FILER' : '🔴 NON-FILER'})</small>` : (customer.fbrStatus ? `<small>(${customer.isFiler ? '🟢 FILER' : '🔴 NON-FILER'})</small>` : '')}
            </div>
            <div style="text-align: right;">
                ${s.showBillNo ? `<b>Invoice No:</b> ${bill.billNo}<br>` : ''}
                ${s.showDate ? `<b>Inv. Date:</b> ${dateStr}<br>` : ''}
                ${s.showTime ? `<b>Time:</b> ${timeStr}<br>` : ''}
                ${s.showBookerName && bookerName ? `<b>Booker:</b> ${bookerName} ${bookerMobile ? '(' + bookerMobile + ')' : ''}<br>` : ''}
                ${bill.supplierName ? `<b>Supplier:</b> ${bill.supplierName}` : ''}
            </div>
        </div>

        <table class="items-table">
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Discount</th>
                <th>Net Total</th>
            </tr>
            ${items.map(it => `
            <tr>
                <td><b>${it.name}</b></td>
                <td style="text-align:center;">${it.qty}</td>
                <td class="num">Rs ${it.rate}</td>
                <td style="text-align:center;">-</td>
                <td class="num">Rs ${it.total}</td>
            </tr>`).join('')}
            <tr>
                <td colspan="4" style="text-align:right; font-weight:bold;">Gross Total:</td>
                <td class="num" style="font-weight:bold;">Rs ${tot.subTotal}</td>
            </tr>
        </table>

        <div class="summary-table">
            <div><span class="label">Gross Amount:</span><span>Rs ${tot.subTotal}</span></div>
            ${parseFloat(tot.discount) > 0 ? `<div><span class="label">Discount:</span><span>- Rs ${tot.discount}</span></div>` : ''}
            ${(s.showTax && (bill.taxAmount > 0 || (bill.taxRate && bill.taxRate > 0))) ? `<div><span class="label">FBR Advance Tax (${customer.isFiler ? 'Filer' : 'Non-Filer'} ${bill.taxRate ? bill.taxRate + '%' : ''}):</span><span>+ Rs ${parseFloat(bill.taxAmount || 0).toFixed(2)}</span></div>` : ''}
            <div class="net"><span class="label">Net Bill Amount:</span><span>Rs ${tot.grandTotal}</span></div>
            ${s.showPreviousBalance !== false && parseFloat(tot.prevBalance) > 0 ? `<div><span class="label">Previous Balance:</span><span>Rs ${tot.prevBalance}</span></div>` : ''}
            ${s.showReceivedAmount !== false && parseFloat(tot.received) > 0 ? `<div><span class="label">Received:</span><span>- Rs ${tot.received}</span></div>` : ''}
            <div class="net"><span class="label">Total Due / Balance:</span><span>Rs ${tot.balance}</span></div>
        </div>

        <div class="sign-area">
            <div class="sign-box">Prepared By (Booker)</div>
            <div class="sign-box">Authorized Signature</div>
            <div class="sign-box">Customer Signature</div>
        </div>

        <div class="footer">
            ${s.showTermsAndConditions !== false && agency.invoiceFooter ? agency.invoiceFooter + '<br>' : ''}
            (Sales &amp; Distribution App) Developed by NH POS
        </div>
    </body>
    </html>
    `;
}

// ============================================
// 🎨 TEMPLATE 3: 🇵🇰 URDU + ENGLISH MIX
// Taj Traders style — Urdu header + English data
// ============================================
function template3Mix(bill, agency, customer, settings) {
    const s = settings || (window.ebPrintEngine ? window.ebPrintEngine.getEffectivePrintSettings(agency) : {});
    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const bookerName = bill.bookerName || bill.salesmanName || '';
    const bookerMobile = bill.bookerMobile || '';
    const custDisplayName = customer.shopName ? `${customer.shopName} (${customer.name})` : (customer.name || 'Counter Sale');

    return `
    <html>
    <head>
        <title>${bill.billNo}</title>
        <style>
            ${getUrduFontCSS()}
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 650px; margin: auto; color: #222; }
            .main-header {
                text-align: center;
                border-bottom: 3px solid #222;
                padding-bottom: 10px;
                margin-bottom: 12px;
            }
            .urdu-company {
                font-family: 'Noto Nastaliq Urdu', serif;
                font-size: 28px;
                font-weight: 700;
                margin: 0;
                line-height: 1.8;
            }
            .eng-sub {
                font-size: 12.5px;
                color: #555;
                font-family: 'Segoe UI', Arial;
                margin: 3px 0;
            }
            .cash-tag {
                font-size: 22px;
                font-weight: 900;
                color: #1a1a1a;
                letter-spacing: 4px;
                text-align: right;
                margin: -40px 0 10px;
            }
            .info-row {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                margin-bottom: 10px;
                background: #f8fafc;
                padding: 10px 12px;
                border: 1px solid #e2e8f0;
                border-radius: 8px;
            }
            .info-row .urdu-label {
                font-family: 'Noto Nastaliq Urdu', serif;
                font-weight: bold;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin: 12px 0;
                font-size: 13px;
            }
            .items-table th, .items-table td {
                border: 1px solid #333;
                padding: 6px 8px;
            }
            .items-table th { background: #f0f0f0; text-align: center; }
            .items-table td.name {
                font-family: 'Noto Nastaliq Urdu', serif;
                text-align: right;
            }
            .urdu-totals {
                margin-top: 10px;
                max-width: 350px;
                margin-left: auto;
            }
            .urdu-total-row {
                display: flex;
                justify-content: space-between;
                padding: 4px 10px;
                font-size: 13.5px;
            }
            .urdu-total-row .urdu-label {
                font-family: 'Noto Nastaliq Urdu', serif;
                font-weight: bold;
            }
            .urdu-total-row.grand {
                border-top: 2px solid #333;
                font-weight: bold;
                background: #f9f9f9;
            }
            .urdu-total-row.bal { color: #c0392b; font-weight: bold; }
            .urdu-terms {
                font-family: 'Noto Nastaliq Urdu', serif;
                font-size: 12px;
                margin-top: 20px;
                border: 1px solid #999;
                padding: 10px;
                border-radius: 6px;
                line-height: 2;
            }
            .sign-area {
                margin-top: 35px;
                display: flex;
                justify-content: space-between;
                font-family: 'Noto Nastaliq Urdu', serif;
            }
            .sign-box {
                border-top: 1px solid #333;
                width: 130px;
                text-align: center;
                padding-top: 5px;
            }
        </style>
    </head>
    <body>
        <div class="main-header">
            ${(s.showLogo !== false && agency.logo) ? `<div style="margin-bottom:6px;"><img src="${agency.logo}" style="max-height:55px; max-width:140px; object-fit:contain;"></div>` : ''}
            ${s.showAgencyName ? `<h1 class="urdu-company">${agency.name}</h1>` : ''}
            ${s.showAddress && agency.address ? `<p class="eng-sub">📍 ${agency.address} ${agency.city ? ', ' + agency.city : ''}</p>` : ''}
            <div class="eng-sub" style="font-weight:bold;">
                ${s.showMobiles && agency.mobile ? `<span>📱 ${agency.mobile}</span>` : ''}
                ${s.showNTN && agency.ntn ? `&nbsp;|&nbsp; <span>NTN: ${agency.ntn}</span>` : ''}
                ${s.showLicence && agency.licenceNo ? `&nbsp;|&nbsp; <span>Licence: ${agency.licenceNo}</span>` : ''}
            </div>
            ${s.showOwnerName && agency.ownerName ? `<p class="eng-sub">👤 Owner: ${agency.ownerName}</p>` : ''}
        </div>
        ${s.showPayType ? `<div class="cash-tag">${bill.payType || 'CASH'}</div>` : ''}

        <div class="info-row">
            <div>
                ${s.showCustomerName ? `<span class="urdu-label">گاہک کا نام:</span> <b>${custDisplayName}</b><br>` : ''}
                ${s.showCustomerPhone && customer.mobile ? `<span class="urdu-label">موبائل:</span> ${customer.mobile}<br>` : ''}
                ${s.showCustomerAddress && customer.address ? `<span class="urdu-label">پتہ:</span> ${customer.address}<br>` : ''}
                ${s.showCustomerRoute && customer.route ? `<span class="urdu-label">روٹ:</span> ${customer.route}<br>` : ''}
                ${s.showCustomerNTN && (customer.ntn || customer.cnic) ? `<span class="urdu-label">گاہک NTN:</span> ${customer.ntn || customer.cnic} <small>(${customer.isFiler ? '🟢 فائلر' : '🔴 نان فائلر'})</small>` : (customer.fbrStatus ? `<small>(${customer.isFiler ? '🟢 فائلر' : '🔴 نان فائلر'})</small>` : '')}
            </div>
            <div style="text-align: right;">
                ${s.showBillNo ? `<b>Bill No:</b> ${bill.billNo}<br>` : ''}
                ${s.showDate ? `<b>Date:</b> ${dateStr} ${s.showTime ? timeStr : ''}<br>` : ''}
                ${s.showBookerName && bookerName ? `<b>Booker:</b> ${bookerName} ${bookerMobile ? '(' + bookerMobile + ')' : ''}<br>` : ''}
                ${bill.supplierName ? `<b>Supplier:</b> ${bill.supplierName}` : ''}
            </div>
        </div>

        <table class="items-table">
            <tr>
                <th>تفصیل</th>
                <th>تعداد</th>
                <th>ریٹ</th>
                <th>کل قیمت</th>
            </tr>
            ${items.map(it => `
            <tr>
                <td class="name">${it.name}</td>
                <td style="text-align:center;">${it.qty}</td>
                <td style="text-align:center;">Rs ${it.rate}</td>
                <td style="text-align:center;">Rs ${it.total}</td>
            </tr>`).join('')}
            <tr>
                <td colspan="3" style="text-align:left; font-weight:bold;">
                    <span class="urdu-label" style="font-family:'Noto Nastaliq Urdu',serif;">ٹوٹل رقم:</span>
                </td>
                <td style="text-align:center; font-weight:bold;">Rs ${tot.subTotal}</td>
            </tr>
        </table>

        <div class="urdu-totals">
            ${parseFloat(tot.discount) > 0 ? `
            <div class="urdu-total-row">
                <span class="urdu-label">ڈسکاؤنٹ:</span>
                <span>- Rs ${tot.discount}</span>
            </div>` : ''}
            ${(s.showTax && (bill.taxAmount > 0 || (bill.taxRate && bill.taxRate > 0))) ? `
            <div class="urdu-total-row">
                <span class="urdu-label">FBR ٹیکس (${customer.isFiler ? 'فائلر' : 'نان فائلر'} ${bill.taxRate ? bill.taxRate + '%' : ''}):</span>
                <span>+ Rs ${parseFloat(bill.taxAmount || 0).toFixed(2)}</span>
            </div>` : ''}
            <div class="urdu-total-row grand">
                <span class="urdu-label">کل واجب الادا:</span>
                <span>Rs ${tot.grandTotal}</span>
            </div>
            ${s.showPreviousBalance !== false && parseFloat(tot.prevBalance) > 0 ? `
            <div class="urdu-total-row">
                <span class="urdu-label">سابقہ بقایا:</span>
                <span>Rs ${tot.prevBalance}</span>
            </div>` : ''}
            ${s.showReceivedAmount !== false && parseFloat(tot.received) > 0 ? `
            <div class="urdu-total-row">
                <span class="urdu-label">وصول شدہ:</span>
                <span>Rs ${tot.received}</span>
            </div>` : ''}
            ${s.showBalance !== false ? `
            <div class="urdu-total-row bal">
                <span class="urdu-label">کل بقایا:</span>
                <span>Rs ${tot.balance}</span>
            </div>` : ''}
        </div>

        <div class="urdu-terms">
            ${s.showTermsAndConditions !== false && agency.invoiceFooter ? agency.invoiceFooter : 'مال موقع پر چیک کریں۔ بعد میں کمپنی ذمہ دار نہ ہوگی۔'}
        </div>

        <div class="sign-area">
            <div class="sign-box">دستخط آرڈر بکر</div>
            <div class="sign-box">دستخط گاہک</div>
            <div class="sign-box">دستخط ادارہ</div>
        </div>
    </body>
    </html>
    `;
}

// ============================================
// 🎨 TEMPLATE 4: ⚡ MODERN MINIMAL (Default!)
// v4 — Title BIG + 👤 OWNER NAME (Title nechay!) + Line: Mobiles→NTN→Licence
// ============================================
function template4Modern(bill, agency, customer, settings) {
    const s = settings || (window.ebPrintEngine ? window.ebPrintEngine.getEffectivePrintSettings(agency) : {
        showLogo: true, showAgencyName: true, showOwnerName: true, showAddress: true, showMobiles: true,
        showNTN: true, showPayType: true, showBillNo: true, showDate: true, showTime: true,
        showCustomerName: true, showCustomerPhone: true, showCustomerAddress: true, showCustomerNTN: true,
        showItemSno: true, showItemName: true, showItemQty: true, showItemRate: true, showItemTotal: true,
        showSubTotal: true, showDiscount: true, showTax: true, showGrandTotal: true,
        showPreviousBalance: true, showReceivedAmount: true, showBalance: true,
        showThankYouNote: true, showSignatureAuthorized: true
    });

    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const payType = bill.payType || (agency.payType || 'CASH');

    // 🏢 AGENCY DETAILS (Always preserved as requested!)
    const ownerNm = String(agency.ownerName || '').trim();
    const ownerMob = String(agency.ownerMobile || '').trim();
    const ownerBits = [];
    if (ownerNm) ownerBits.push(`👤 ${ownerNm}`);
    if (ownerMob) ownerBits.push(`📱 ${ownerMob}`);
    const ownerHTML = ownerBits.join('&nbsp;&nbsp;&nbsp;');
    
    // 📱 Mobiles
    const mobilesArr = [agency.mobile, agency.mobile2]
        .filter(m => m && String(m).trim())
        .map(m => `📱 ${String(m).trim()}`);

    // Contact line
    const contactBits = [];
    if (s.showMobiles && mobilesArr.length > 0) contactBits.push(mobilesArr.join('&nbsp;&nbsp;'));
    if (s.showNTN && agency.ntn && String(agency.ntn).trim()) contactBits.push(`🔢 NTN: ${agency.ntn}`);
    if (s.showNTN && agency.licenceNo && String(agency.licenceNo).trim()) contactBits.push(`📋 Licence: ${agency.licenceNo}`);
    const contactHTML = contactBits.join(' &nbsp;|&nbsp; ');

    // Address
    const addrParts = [agency.address, agency.city].filter(a => a && String(a).trim());
    const addrHTML = (s.showAddress && addrParts.length) ? `📍 ${addrParts.join(', ')}` : '';

    // 💰 Tax row
    const taxRow = (s.showTax && bill.taxAmount && bill.taxAmount > 0)
        ? `<div><span>FBR Advance Tax (${customer.isFiler ? 'Filer' : 'Non-Filer'} ${bill.taxRate ? bill.taxRate + '%' : ''}):</span><span>+ Rs ${parseFloat(bill.taxAmount).toFixed(2)}</span></div>`
        : '';

    return `
    <html>
    <head>
        <title>Bill ${bill.billNo}</title>
        <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 650px; margin: auto; color: #333; }

            /* 🏢 AGENCY HEADER */
            .ag-header {
                display: flex;
                align-items: flex-start;
                border-bottom: 3px double #333;
                padding-bottom: 8px;
                margin-bottom: 12px;
            }
            .ag-logo { flex: 0 0 auto; display: flex; align-items: center; }
            .ag-logo img { width: 55px; height: 50px; object-fit: contain; }
            .ag-details { flex: 1; text-align: left; padding: 0 10px; min-width: 0; }

            /* 🏢 TITLE — BARA (24px) + auto-shrink! */
            .ag-name-row { white-space: nowrap; overflow: hidden; }
            .ag-name {
                font-size: 24px;
                font-weight: 900;
                color: #1a1a1a;
                letter-spacing: 0.3px;
                display: inline-block;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* 🆕 OWNER NAME line (Title nechay — bold!) */
            .ag-owner-line { font-size: 12.5px; color: #1a1a1a; font-weight: 800; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

            /* 📍 Choti line (Address+City) */
            .ag-sub-line { font-size: 10.5px; color: #555; font-weight: 600; margin-top: 2px; word-wrap: break-word; }

            /* 📱🔢 Contact LINE: Mobiles + NTN + Licence */
            .ag-contact-line {
                font-size: 11px;
                color: #333;
                font-weight: bold;
                margin-top: 3px;
                word-wrap: break-word;
            }

            /* 💳 PAY TYPE (right top — bold!) */
            .pay-type {
                flex: 0 0 auto;
                align-self: center;
                font-size: 22px;
                font-weight: 900;
                color: #1a1a1a;
                letter-spacing: 3px;
            }

            /* 🧾 BILL META (grey rounded — right side!) */
            .bill-meta-inner {
                background: #f8f9fa;
                border: 1px solid #e0e6e8;
                border-radius: 8px;
                padding: 8px 12px;
                font-size: 12px;
                line-height: 1.9;
                min-width: 160px;
            }
            .bill-meta-inner b { color: #2c3e50; }

            /* 👤 CUSTOMER BOX */
            .cust-box {
                background: #f8f9fa;
                border: 1px solid #e0e6e8;
                border-radius: 8px;
                padding: 10px 14px;
                margin-bottom: 12px;
                font-size: 13px;
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
                align-items: flex-start;
            }
            .cust-left { flex: 1; min-width: 200px; line-height: 1.8; }
            .cust-right {
                flex: 0 0 auto;
                text-align: left;
                border-left: 1px dashed #bbb;
                padding-left: 15px;
            }
            .cust-name-big { font-size: 15px; font-weight: bold; color: #1a1a1a; }
            .cust-addr { color: #444; word-wrap: break-word; max-width: 320px; display: inline; }
            .cust-label { font-size: 11px; color: #7f8c8d; font-weight: bold; }
            .dim-value { color: #222; font-weight: 600; }

            /* 📋 ITEMS TABLE */
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #444; padding: 7px 8px; text-align: left; font-size: 13px; }
            th { background: #f0f0f0; text-align: center; }
            td.qty, td.rate, td.total { text-align: right; }

            /* 💰 TOTALS */
            .totals {
                margin-top: 12px;
                max-width: 340px;
                margin-left: auto;
                background: #fafbfc;
                border: 1px solid #e0e6e8;
                border-radius: 8px;
                padding: 8px 15px;
            }
            .totals div { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 14px; }
            .totals .grand { border-top: 2px solid #333; font-weight: bold; font-size: 15px; }
            .totals .bal { color: #c0392b; font-weight: bold; }

            .thanks { text-align: center; font-weight: bold; margin-top: 15px; color: #2c3e50; }
            .sig-area { margin-top: 40px; text-align: right; }
            .sig-line { border-top: 1px solid #333; width: 160px; display: inline-block; padding-top: 5px; font-weight: bold; }
            .footer-note { text-align: center; font-size: 10px; color: #888; margin-top: 25px; font-style: italic; }
        </style>
    </head>
    <body>
        <!-- 🏢 AGENCY HEADER (Title → OWNER → Address → Mobiles+NTN+Licence) -->
        <div class="ag-header">
            ${s.showLogo && agency.logo ? `<div class="ag-logo"><img src="${agency.logo}"></div>` : ''}
            <div class="ag-details">
                ${s.showAgencyName ? `<div class="ag-name-row"><span class="ag-name" id="agName">${agency.name}</span></div>` : ''}
                ${s.showOwnerName && ownerHTML ? `<div class="ag-owner-line">${ownerHTML}</div>` : ''}
                ${addrHTML ? `<div class="ag-sub-line">${addrHTML}</div>` : ''}
                ${contactHTML ? `<div class="ag-contact-line">${contactHTML}</div>` : ''}
            </div>
            ${s.showPayType ? `<div class="pay-type">${payType}</div>` : ''}
        </div>

        <!-- 👤 CUSTOMER BOX -->
        <div class="cust-box">
            <div class="cust-left">
                ${s.showCustomerName ? `<span class="cust-label">👤 Customer:</span><span class="cust-name-big"> ${customer.shopName ? customer.shopName + ' (' + customer.name + ')' : customer.name}</span>` : ''}
                ${s.showCustomerPhone && customer.mobile ? `<span> &nbsp; 📱 ${customer.mobile}</span>` : ''}
                ${s.showCustomerAddress && customer.address ? `<br><span class="cust-label">📍 Address:</span> <span class="cust-addr"> ${customer.address}</span>` : ''}
                ${s.showCustomerRoute && customer.route ? `<br><span class="cust-label">🛣️ Route:</span> <span class="dim-value"> ${customer.route}</span>` : ''}
                ${s.showCustomerNTN && (customer.ntn || customer.cnic) ? `
                <br><span class="cust-label">🔢 Customer NTN:</span> <span class="dim-value"> ${customer.ntn || customer.cnic}</span>
                <span style="font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px; margin-left:4px; ${customer.isFiler ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;'}">(${customer.isFiler ? '🟢 FILER' : '🔴 NON-FILER'})</span>` : (customer.fbrStatus ? `<span style="font-size:10px; font-weight:800; padding:1px 6px; border-radius:4px; margin-left:4px; ${customer.isFiler ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;'}">(${customer.isFiler ? '🟢 FILER' : '🔴 NON-FILER'})</span>` : '')}
            </div>
            <div class="cust-right">
                <div class="bill-meta-inner">
                    ${s.showBillNo ? `<b>🧾 Bill No:</b> ${bill.billNo}<br>` : ''}
                    ${s.showDate ? `<b>📅 Date:</b> ${dateStr}<br>` : ''}
                    ${s.showTime ? `<b>🕐 Time:</b> ${timeStr}<br>` : ''}
                    ${s.showBookerName && (bill.bookerName || bill.salesmanName) ? `<b>🚴 Booker:</b> ${bill.bookerName || bill.salesmanName} ${bill.bookerMobile ? '(' + bill.bookerMobile + ')' : ''}<br>` : ''}
                    ${bill.supplierName ? `<b>🏢 Supplier:</b> ${bill.supplierName}` : ''}
                </div>
            </div>
        </div>

        <table>
            <tr>
                ${s.showItemSno ? '<th>#</th>' : ''}
                <th>Item</th>
                ${s.showItemQty ? '<th>Qty</th>' : ''}
                ${s.showItemRate ? '<th>Rate</th>' : ''}
                ${s.showItemTotal ? '<th>Total</th>' : ''}
            </tr>
            ${items.map(it => `
                <tr>
                    ${s.showItemSno ? `<td>${it.sno}</td>` : ''}
                    <td>${it.name}</td>
                    ${s.showItemQty ? `<td class="qty">${it.qty}</td>` : ''}
                    ${s.showItemRate ? `<td class="rate">Rs ${it.rate}</td>` : ''}
                    ${s.showItemTotal ? `<td class="total">Rs ${it.total}</td>` : ''}
                </tr>`).join('')}
        </table>

        <div class="totals">
            ${s.showSubTotal ? `<div><span>Sub Total:</span><span>Rs ${tot.subTotal}</span></div>` : ''}
            ${s.showDiscount && parseFloat(tot.discount) > 0 ? `<div><span>Discount:</span><span>- Rs ${tot.discount}</span></div>` : ''}
            ${taxRow}
            ${s.showGrandTotal ? `<div class="grand"><span>Grand Total:</span><span>Rs ${tot.grandTotal}</span></div>` : ''}
            ${s.showPreviousBalance && parseFloat(tot.prevBalance) > 0 ? `<div><span>Previous Balance:</span><span>Rs ${tot.prevBalance}</span></div>` : ''}
            ${s.showReceivedAmount ? `<div><span>Received:</span><span>- Rs ${tot.received}</span></div>` : ''}
            ${s.showBalance ? `<div class="bal"><span>TOTAL BALANCE:</span><span>Rs ${tot.balance}</span></div>` : ''}
        </div>

        ${s.showThankYouNote ? '<div class="thanks">🙏 Shukriya! Dobara tashreef layen!</div>' : ''}

        ${s.showSignatureAuthorized ? `
        <div class="sig-area">
            <div class="sig-line">Authorized Signature</div>
        </div>` : ''}

        <div class="footer-note">Bill ${bill.billNo} — NH POS se generate hua hai.</div>

        <!-- 🌟 AUTO-SHRINK (24px se shuru — naam lamba to chota!) -->
        <script>
            (function() {
                function fitName() {
                    try {
                        var nameEl = document.getElementById('agName');
                        if (!nameEl) return;
                        var size = 24;
                        nameEl.style.fontSize = size + 'px';
                        var guard = 0;
                        while (nameEl.scrollWidth > nameEl.clientWidth && size > 10 && guard < 50) {
                            size -= 0.5;
                            nameEl.style.fontSize = size + 'px';
                            guard++;
                        }
                    } catch (e) {}
                }
                window.addEventListener('load', fitName);
                setTimeout(fitName, 100);
            })();
        <\/script>
    </body>
    </html>
    `;
}

// ============================================
// 🎨 TEMPLATE 5: 💎 PREMIUM FULL (Sab Kuch!)
// Logo + Urdu + English + Salesman + Bonus + Pack detail
// ============================================
function template5Premium(bill, agency, customer) {
    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const logoHtml = agency.logo 
        ? `<img src="${agency.logo}" style="max-width:100px; max-height:100px; margin-bottom:8px;">`
        : '<div style="font-size:50px;">⚡</div>';

    return `
    <html>
    <head>
        <title>${bill.billNo}</title>
        <style>
            ${getUrduFontCSS()}
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; max-width: 700px; margin: auto; color: #222; }
            .premium-header {
                background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                color: #fff;
                padding: 20px;
                border-radius: 12px 12px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .premium-header .biz-info { text-align: left; }
            .premium-header h1 { margin: 0 0 5px 0; font-size: 24px; }
            .premium-header p { margin: 2px 0; font-size: 12px; opacity: 0.9; }
            .premium-header .logo { text-align: right; }
            .bill-type-badge {
                background: var(--warning, #f39c12);
                color: #fff;
                padding: 5px 20px;
                border-radius: 0 0 12px 12px;
                display: inline-block;
                font-weight: bold;
                font-size: 14px;
                letter-spacing: 2px;
            }
            .meta-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                background: #f8f9fa;
                padding: 12px;
                border-radius: 8px;
                margin: 12px 0;
                font-size: 12px;
            }
            .meta-grid div { line-height: 1.6; }
            .meta-grid b { color: #2c3e50; }
            .cust-section {
                display: flex;
                gap: 15px;
                background: #eef2f7;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 12px;
                font-size: 13px;
            }
            .cust-section div { flex: 1; line-height: 1.6; }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin: 12px 0;
                font-size: 12px;
            }
            .items-table th, .items-table td {
                border: 1px solid #444;
                padding: 6px 8px;
                text-align: left;
            }
            .items-table th { background: #2c3e50; color: #fff; text-align: center; font-size: 11px; }
            .items-table td.num { text-align: right; }
            .items-table td.center { text-align: center; }
            .pack-detail { font-size: 10px; color: #666; font-style: italic; }
            .totals-premium {
                background: #f8f9fa;
                border-radius: 10px;
                padding: 12px 18px;
                max-width: 380px;
                margin-left: auto;
                margin-top: 15px;
            }
            .totals-premium div {
                display: flex;
                justify-content: space-between;
                padding: 5px 0;
                font-size: 13px;
            }
            .totals-premium .grand {
                border-top: 2px solid #2c3e50;
                font-weight: bold;
                font-size: 16px;
                color: #2c3e50;
            }
            .totals-premium .bal { color: #c0392b; font-weight: bold; }
            .urdu-note {
                font-family: 'Noto Nastaliq Urdu', serif;
                font-size: 12px;
                text-align: center;
                margin-top: 20px;
                line-height: 2.2;
                color: #555;
                border-top: 1px solid #ccc;
                padding-top: 10px;
            }
            .sig-premium {
                margin-top: 35px;
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                font-weight: bold;
            }
            .sig-premium .box {
                border-top: 2px solid #2c3e50;
                width: 150px;
                text-align: center;
                padding-top: 5px;
            }
        </style>
    </head>
    <body>
        <div class="premium-header">
            <div class="biz-info">
                <h1>${agency.name}</h1>
                ${agency.address ? `<p>📍 ${agency.address}</p>` : ''}
                ${agency.mobile ? `<p>📱 ${agency.mobile}</p>` : ''}
                ${agency.ntn ? `<p>🔢 NTN: ${agency.ntn}</p>` : ''}
            </div>
            <div class="logo">${logoHtml}</div>
        </div>
        <div style="text-align:center;"><span class="bill-type-badge">CASH / CREDIT</span></div>

        <div class="meta-grid">
            <div><b>🧾 Bill No:</b> ${bill.billNo}</div>
            <div><b>📅 Date:</b> ${dateStr}</div>
            <div><b>🕐 Time:</b> ${timeStr}</div>
            ${bill.salesMan ? `<div><b>👤 Sales Man:</b> ${bill.salesMan}</div>` : ''}
            ${bill.route ? `<div><b>🛣️ Route:</b> ${bill.route}</div>` : ''}
            <div><b>📦 Items:</b> ${(bill.items || []).length}</div>
        </div>

        <div class="cust-section">
            <div>
                <b>👤 Customer:</b> ${customer.name}<br>
                ${customer.address ? `📍 ${customer.address}` : ''}
            </div>
            <div>
                ${customer.mobile ? `<b>📱</b> ${customer.mobile}` : ''}
            </div>
        </div>

        <table class="items-table">
            <tr>
                <th>Item</th>
                <th>Pack</th>
                <th>Ctn-Box-Units</th>
                <th>Bonus</th>
                <th>Rate</th>
                <th>Disc%</th>
                <th>Extended</th>
            </tr>
            ${items.map(it => `
            <tr>
                <td>${it.name}</td>
                <td class="center">${it.packSize || '—'}</td>
                <td class="center">1 - 0 - ${it.qty}</td>
                <td class="center">${it.bonus || 0}</td>
                <td class="num">Rs ${it.rate}</td>
                <td class="center">0.00%</td>
                <td class="num">Rs ${it.total}</td>
            </tr>`).join('')}
            <tr>
                <td colspan="6" style="text-align:right; font-weight:bold;">Totals:</td>
                <td class="num" style="font-weight:bold;">Rs ${tot.subTotal}</td>
            </tr>
        </table>

        <div class="totals-premium">
            <div><span>Sub Total:</span><span>Rs ${tot.subTotal}</span></div>
            <div><span>Discount:</span><span>- Rs ${tot.discount}</span></div>
            <div class="grand"><span>Grand Total:</span><span>Rs ${tot.grandTotal}</span></div>
            <div><span>Previous Balance:</span><span>Rs ${tot.prevBalance}</span></div>
            <div><span>Received:</span><span>- Rs ${tot.received}</span></div>
            <div class="bal"><span>TOTAL BALANCE:</span><span>Rs ${tot.balance}</span></div>
        </div>

        <div class="urdu-note">
            سیل میں کی گئی ترین کا ادارہ ذمہ دار نہیں ہوگا۔ براہ کرم بل کی رقم مقررہ تاریخ تک ادا کر دیں۔ شکریہ!
        </div>

        <div class="sig-premium">
            <div class="box">Prepared By</div>
            <div class="box">Authorized Signature</div>
        </div>
    </body>
    </html>
    `;
}

// ============================================
// 🎨 TEMPLATE 6: 🧾 THERMAL POS RECEIPT (58mm / 80mm)
// Ultra-fast compact thermal slip format
// ============================================
function template6Thermal(bill, agency, customer, settings) {
    const s = settings || (window.ebPrintEngine ? window.ebPrintEngine.getEffectivePrintSettings(agency) : {});
    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const payType = bill.payType || (agency.payType || 'CASH');

    return `
    <html>
    <head>
        <title>Receipt ${bill.billNo}</title>
        <style>
            @media print {
                @page { margin: 0; size: 80mm auto; }
                body { margin: 0; padding: 6px; }
            }
            body {
                font-family: 'Courier New', Courier, monospace, sans-serif;
                width: 76mm;
                margin: auto;
                padding: 8px 4px;
                color: #000;
                font-size: 12px;
                line-height: 1.3;
            }
            .t-center { text-align: center; }
            .t-bold { font-weight: bold; }
            .t-header { border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
            .t-title { font-size: 16px; font-weight: 900; margin: 0; text-transform: uppercase; }
            .t-sub { font-size: 11px; margin: 2px 0; }
            .t-meta { font-size: 11px; margin-bottom: 6px; border-bottom: 1px dashed #000; padding-bottom: 4px; }
            .t-row { display: flex; justify-content: space-between; }
            .t-table { width: 100%; border-collapse: collapse; margin: 6px 0; font-size: 11px; }
            .t-table th { border-bottom: 1px solid #000; text-align: left; padding: 2px 0; }
            .t-table td { padding: 3px 0; }
            .t-right { text-align: right; }
            .t-totals { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-top: 4px; }
            .t-totals .t-row { margin: 2px 0; }
            .t-grand { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 2px; }
            .t-footer { margin-top: 8px; text-align: center; font-size: 10px; }
        </style>
    </head>
    <body>
        <div class="t-center t-header">
            ${s.showLogo && agency.logo ? `<div style="margin-bottom:4px;"><img src="${agency.logo}" style="max-height:40px; max-width:120px;"></div>` : ''}
            ${s.showAgencyName ? `<div class="t-title">${agency.name}</div>` : ''}
            ${s.showOwnerName && agency.ownerName ? `<div class="t-sub">👤 ${agency.ownerName}</div>` : ''}
            ${s.showAddress && agency.address ? `<div class="t-sub">${agency.address}</div>` : ''}
            ${s.showMobiles && agency.mobile ? `<div class="t-sub">Cell: ${agency.mobile}</div>` : ''}
            ${s.showNTN && agency.ntn ? `<div class="t-sub">NTN: ${agency.ntn}</div>` : ''}
            ${s.showPayType ? `<div style="font-weight:bold; margin-top:3px;">*** ${payType} ***</div>` : ''}
        </div>

        <div class="t-meta">
            ${s.showBillNo ? `<div class="t-row"><span>Bill No:</span><span class="t-bold">${bill.billNo}</span></div>` : ''}
            ${s.showDate ? `<div class="t-row"><span>Date:</span><span>${dateStr} ${s.showTime ? timeStr : ''}</span></div>` : ''}
            ${s.showCustomerName ? `<div class="t-row"><span>Customer:</span><span class="t-bold">${customer.name}</span></div>` : ''}
            ${s.showCustomerPhone && customer.mobile ? `<div class="t-row"><span>Phone:</span><span>${customer.mobile}</span></div>` : ''}
        </div>

        <table class="t-table">
            <thead>
                <tr>
                    ${s.showItemSno ? '<th style="width:20px;">#</th>' : ''}
                    <th>Item</th>
                    ${s.showItemQty ? '<th class="t-right">Qty</th>' : ''}
                    ${s.showItemRate ? '<th class="t-right">Rate</th>' : ''}
                    ${s.showItemTotal ? '<th class="t-right">Total</th>' : ''}
                </tr>
            </thead>
            <tbody>
                ${items.map(it => `
                    <tr>
                        ${s.showItemSno ? `<td>${it.sno}</td>` : ''}
                        <td>${it.name}</td>
                        ${s.showItemQty ? `<td class="t-right">${it.qty}</td>` : ''}
                        ${s.showItemRate ? `<td class="t-right">${it.rate}</td>` : ''}
                        ${s.showItemTotal ? `<td class="t-right">${it.total}</td>` : ''}
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="t-totals">
            ${s.showSubTotal ? `<div class="t-row"><span>Sub Total:</span><span>Rs ${tot.subTotal}</span></div>` : ''}
            ${s.showDiscount && parseFloat(tot.discount) > 0 ? `<div class="t-row"><span>Discount:</span><span>- Rs ${tot.discount}</span></div>` : ''}
            ${s.showGrandTotal ? `<div class="t-row t-grand"><span>Grand Total:</span><span>Rs ${tot.grandTotal}</span></div>` : ''}
            ${s.showPreviousBalance && parseFloat(tot.prevBalance) > 0 ? `<div class="t-row"><span>Prev Bal:</span><span>Rs ${tot.prevBalance}</span></div>` : ''}
            ${s.showReceivedAmount ? `<div class="t-row"><span>Paid:</span><span>- Rs ${tot.received}</span></div>` : ''}
            ${s.showBalance ? `<div class="t-row t-bold" style="color:#000;"><span>Balance:</span><span>Rs ${tot.balance}</span></div>` : ''}
        </div>

        <div class="t-footer">
            ${s.showThankYouNote ? '<div>Thank You! Visit Again.</div>' : ''}
            ${s.showSignatureAuthorized ? '<div style="margin-top:20px; border-top:1px dashed #000; padding-top:4px;">Signature</div>' : ''}
            ${s.showAppWatermark ? '<div style="font-size:8px; color:#666; margin-top:4px;">NH POS</div>' : ''}
        </div>
    </body>
    </html>
    `;
}

// ============================================
// 🎨 TEMPLATE 7: 📦 FMCG CORPORATE DISTRIBUTION INVOICE
// Recreated from Hassan Distributor & Al Raheem Agencies (Images 1 & 3)
// Features: Top distributor metadata, Route, Booker, Load Form #, CTN/Size,
// Trade Offer/Bonus, Tax, SDR, Store Credit Balance, Signatures
// ============================================
function template7FMCGDistribution(bill, agency, customer, settings) {
    const s = settings || (window.ebPrintEngine ? window.ebPrintEngine.getEffectivePrintSettings(agency) : {});
    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const bookerName = bill.bookerName || bill.salesmanName || agency.ownerName || 'Direct Booker';
    const routeName = bill.routeName || customer.route || 'General Market Route';
    const billNo = bill.billNo || 'INV-0000';
    const payType = bill.payType || (agency.payType || 'CASH');

    return `
    <html>
    <head>
        <title>Invoice - ${billNo}</title>
        <style>
            @media print {
                @page { size: A4 portrait; margin: 8mm; }
                body { margin: 0; padding: 0; }
                .no-print { display: none !important; }
            }
            body {
                font-family: Arial, sans-serif;
                color: #111;
                font-size: 11px;
                line-height: 1.25;
                margin: 0 auto;
                max-width: 820px;
                padding: 10px;
            }
            .header-tbl { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
            .header-tbl td { vertical-align: top; }
            .dist-title { font-size: 18px; font-weight: 900; text-transform: uppercase; margin: 0 0 2px 0; letter-spacing: 0.5px; }
            .dist-sub { font-size: 11px; color: #222; margin: 1px 0; }
            .inv-badge { font-size: 22px; font-weight: bold; text-align: center; text-transform: uppercase; border: 2px solid #222; padding: 2px 14px; display: inline-block; }
            
            .meta-box { border: 1px solid #333; margin-bottom: 8px; border-collapse: collapse; width: 100%; font-size: 10.5px; }
            .meta-box td { border: 1px solid #777; padding: 3px 6px; }
            .meta-lbl { font-weight: bold; color: #000; width: 14%; background: #f5f5f5; }
            .meta-val { width: 36%; }

            .item-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; }
            .item-table th { border: 1px solid #222; background: #e8e8e8; padding: 4px 3px; font-weight: bold; text-align: center; }
            .item-table td { border: 1px solid #555; padding: 4px 3px; }
            .t-left { text-align: left; }
            .t-center { text-align: center; }
            .t-right { text-align: right; }
            .item-total-row td { font-weight: bold; background: #f5f5f5; border-top: 2px solid #000; }

            .bottom-grid { width: 100%; border-collapse: collapse; margin-top: 6px; }
            .bottom-grid td { vertical-align: top; }
            .summary-table { width: 100%; border-collapse: collapse; font-size: 10.5px; border: 1px solid #333; }
            .summary-table td { border: 1px solid #666; padding: 3px 6px; }
            .summary-lbl { font-weight: bold; background: #f7f7f7; }

            .sig-table { width: 100%; margin-top: 30px; border-collapse: collapse; text-align: center; font-size: 11px; }
            .sig-table td { width: 33.33%; padding-top: 25px; border-top: 1px solid #444; }
            .notice-box { border: 1px solid #333; padding: 6px; font-size: 10px; margin-top: 8px; background: #fafafa; }
        </style>
    </head>
    <body>
        <!-- 🏢 HEADER -->
        <table class="header-tbl">
            <tr>
                <td style="width: 70%;">
                    ${(s.showLogo !== false && agency.logo) ? `<img src="${agency.logo}" style="max-height:48px; max-width:140px; object-fit:contain; margin-bottom:4px; display:block;" alt="Logo">` : ''}
                    ${s.showAgencyName ? `<h1 class="dist-title">${agency.name}</h1>` : ''}
                    ${s.showAddress && agency.address ? `<div class="dist-sub">📍 ${agency.address} ${agency.city ? ', ' + agency.city : ''}</div>` : ''}
                    <div class="dist-sub">
                        ${s.showMobiles && agency.mobile ? `<span>📞 ${agency.mobile}</span>` : ''}
                        ${s.showNTN && agency.ntn ? `&nbsp;|&nbsp; <span>NTN: ${agency.ntn}</span>` : ''}
                        ${s.showLicence && agency.licenceNo ? `&nbsp;|&nbsp; <span>Licence: ${agency.licenceNo}</span>` : ''}
                    </div>
                    ${s.showOwnerName && agency.ownerName ? `<div class="dist-sub">👤 Owner / Rep: ${agency.ownerName}</div>` : ''}
                </td>
                <td style="width: 30%; text-align: right;">
                    <div class="inv-badge">INVOICE</div>
                    <div style="margin-top: 6px; font-size: 11px; font-weight: bold;">
                        ${s.showPayType ? `Type: [ ${payType} ]` : ''}
                    </div>
                </td>
            </tr>
        </table>

        <!-- 📋 INVOICE & CUSTOMER INFO BOX -->
        <table class="meta-box">
            <tr>
                <td class="meta-lbl">Customer:</td>
                <td class="meta-val"><b>${customer.shopName ? customer.shopName + ' (' + customer.name + ')' : customer.name}</b> ${customer.mobile ? '(' + customer.mobile + ')' : ''}</td>
                <td class="meta-lbl">Invoice No:</td>
                <td class="meta-val"><b>${billNo}</b></td>
            </tr>
            <tr>
                <td class="meta-lbl">Address:</td>
                <td class="meta-val">${customer.address || ''}</td>
                <td class="meta-lbl">Inv Date:</td>
                <td class="meta-val">${dateStr} ${s.showTime ? timeStr : ''}</td>
            </tr>
            <tr>
                <td class="meta-lbl">Booker / Rep:</td>
                <td class="meta-val">${bookerName} ${bill.bookerMobile ? '(' + bill.bookerMobile + ')' : ''}</td>
                <td class="meta-lbl">Route / Area:</td>
                <td class="meta-val">${customer.route || routeName || ''}</td>
            </tr>
            <tr>
                <td class="meta-lbl">Customer NTN:</td>
                <td class="meta-val">
                    ${s.showCustomerNTN && (customer.ntn || customer.cnic) ? `<b>${customer.ntn || customer.cnic}</b>` : '—'}
                    <span style="font-weight:bold; margin-left:6px; padding:1px 6px; border-radius:4px; font-size:10px; ${customer.isFiler ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;'}">(${customer.isFiler ? '🟢 FILER' : '🔴 NON-FILER'})</span>
                </td>
                <td class="meta-lbl">Supplier / Dist:</td>
                <td class="meta-val">${bill.supplierName || agency.name || ''}</td>
            </tr>
        </table>

        <!-- 📦 ITEMS TABLE -->
        <table class="item-table">
            <thead>
                <tr>
                    <th style="width: 25px;">#</th>
                    <th>Product Code / Description</th>
                    <th style="width: 45px;">Sale Qty</th>
                    <th style="width: 55px;">Trade Price</th>
                    <th style="width: 60px;">Gross Amount</th>
                    <th style="width: 45px;">Trade Offer / Disc</th>
                    <th style="width: 50px;">Tax / GST</th>
                    <th style="width: 70px;">Net Amount</th>
                </tr>
            </thead>
            <tbody>
                ${items.map((it, idx) => {
                    const gross = (parseFloat(it.qty) * parseFloat(it.rate)).toFixed(2);
                    const disc = (it.disc || 0);
                    return `
                    <tr>
                        <td class="t-center">${idx + 1}</td>
                        <td class="t-left"><b>${it.name}</b></td>
                        <td class="t-center">${it.qty}</td>
                        <td class="t-right">${it.rate}</td>
                        <td class="t-right">${gross}</td>
                        <td class="t-center">${disc > 0 ? disc : '-'}</td>
                        <td class="t-center">${bill.taxRate ? bill.taxRate + '%' : '-'}</td>
                        <td class="t-right"><b>${it.total}</b></td>
                    </tr>
                    `;
                }).join('')}
                <tr class="item-total-row">
                    <td class="t-center" colspan="2">TOTAL ITEMS: ${items.length}</td>
                    <td class="t-center">${items.reduce((acc, it) => acc + (parseFloat(it.qty) || 0), 0)}</td>
                    <td class="t-right">-</td>
                    <td class="t-right">Rs ${tot.subTotal}</td>
                    <td class="t-center">Rs ${tot.discount}</td>
                    <td class="t-center">${bill.taxAmount ? 'Rs ' + bill.taxAmount.toFixed(2) : '-'}</td>
                    <td class="t-right">Rs ${tot.grandTotal}</td>
                </tr>
            </tbody>
        </table>

        <!-- 📊 TOTALS & SETTLEMENT GRID -->
        <table class="bottom-grid">
            <tr>
                <td style="width: 55%; padding-right: 10px;">
                    <div class="notice-box">
                        <b>Terms &amp; Claims Notice:</b><br>
                        1. Please verify goods upon receipt. Company is not responsible for damages later.<br>
                        2. Expiry claims must be notified 1 month prior to expiry date.<br>
                        3. Payment via Cheque/Cash within agreed credit cycle only.
                    </div>
                </td>
                <td style="width: 45%;">
                    <table class="summary-table">
                        <tr>
                            <td class="summary-lbl">Gross Amount:</td>
                            <td class="t-right">Rs ${tot.subTotal}</td>
                        </tr>
                        ${parseFloat(tot.discount) > 0 ? `
                        <tr>
                            <td class="summary-lbl">Total Discount:</td>
                            <td class="t-right">- Rs ${tot.discount}</td>
                        </tr>` : ''}
                        ${(s.showTax && (bill.taxAmount > 0 || (bill.taxRate && bill.taxRate > 0))) ? `
                        <tr>
                            <td class="summary-lbl">FBR Advance Tax (${customer.isFiler ? 'Filer' : 'Non-Filer'} ${bill.taxRate ? bill.taxRate + '%' : ''}):</td>
                            <td class="t-right">+ Rs ${parseFloat(bill.taxAmount || 0).toFixed(2)}</td>
                        </tr>` : ''}
                        <tr style="background: #eef2f5; font-size: 11px;">
                            <td class="summary-lbl"><b>Net Invoice Amount:</b></td>
                            <td class="t-right"><b>Rs ${tot.grandTotal}</b></td>
                        </tr>
                        ${parseFloat(tot.prevBalance) > 0 ? `
                        <tr>
                            <td class="summary-lbl">Previous Credit Balance:</td>
                            <td class="t-right">Rs ${tot.prevBalance}</td>
                        </tr>` : ''}
                        <tr>
                            <td class="summary-lbl">Amount Received:</td>
                            <td class="t-right">- Rs ${tot.received}</td>
                        </tr>
                        <tr style="background: #e2e8f0; font-size: 12px; font-weight: bold;">
                            <td class="summary-lbl">Net Store Payable / Balance:</td>
                            <td class="t-right">Rs ${tot.balance}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- ✍️ SIGNATURES (Checked By Order Booker, Delivered By, Shopkeeper) -->
        <table class="sig-table">
            <tr>
                <td><b>${bookerName}</b><br>Checked by Order Booker</td>
                <td><b>Delivery Rep</b><br>Delivered by</td>
                <td><b>${customer.name}</b><br>Shop Keeper Signature / Stamp</td>
            </tr>
        </table>
    </body>
    </html>
    `;
}

// ============================================
// ============================================
// 🎨 TEMPLATE 8: 🇵🇰 CLASSIC WHOLESALE URDU GRID INVOICE
// Recreated with 100% fidelity from Ali Raza Traders Distribution Invoice (User Reference Photo)
// Features: Exact 4-Row Meta Header Grid, 7-Column Items Table (تفصیل، تعداد، ریٹ، گراس رقم، ڈسکاؤنٹ، سکیم، میزان),
// Summary row (0-5-0), Legal conditions box, Freight/Other/Tax/PrevBal/Total calculations,
// Sized for Half-Legal / A5 Portrait (8.5in x 7in) fitting 10-15 items per page cleanly!
// ============================================
function template8WholesaleUrduGrid(bill, agency, customer, settings) {
    const s = settings || (window.ebPrintEngine ? window.ebPrintEngine.getEffectivePrintSettings(agency) : {});
    const items = getTemplateItems(bill);
    const tot = getTemplateTotals(bill);
    const dateStr = bill.date || '-';
    const timeStr = bill.time || '-';
    const bookerName = bill.bookerName || bill.salesmanName || agency.ownerName || '';
    const bookerMobile = bill.bookerMobile || '';
    const billNo = bill.billNo || 'INV-001';
    const payType = bill.payType || (agency.payType || 'CASH');

    // Calculate totals breakdown for the 7 columns
    let totalQty = 0;
    let totalGross = 0;
    let totalDisc = 0;
    let totalScheme = 0;
    let totalNet = 0;

    const formattedRows = (bill.items || []).map((it, idx) => {
        const qtyNum = parseFloat(it.qty) || 0;
        const rateNum = parseFloat(it.rate) || 0;
        const gross = qtyNum * rateNum;
        const discountVal = parseFloat(it.discount) || 0;
        const schemeVal = parseFloat(it.schemeDiscount || it.schemeVal) || 0;
        const netTotal = it.total !== undefined ? parseFloat(it.total) : (gross - discountVal - schemeVal);

        totalQty += qtyNum;
        totalGross += gross;
        totalDisc += discountVal;
        totalScheme += schemeVal;
        totalNet += netTotal;

        const unitStr = it.unit ? it.unit : (qtyNum > 1 ? 'بکس' : 'عدد');
        const packingStr = it.packing ? ` (${it.packing})` : '';

        return `
        <tr>
            <td class="t-name urdu">${it.name}${packingStr}</td>
            <td class="t-center urdu">${qtyNum} ${unitStr}</td>
            <td class="t-num">${rateNum.toFixed(2)}</td>
            <td class="t-num">${gross.toFixed(2)}</td>
            <td class="t-num">${discountVal > 0 ? discountVal.toFixed(2) + '%' : '0.00%'}</td>
            <td class="t-num">${schemeVal > 0 ? schemeVal.toFixed(2) : '0.00'}</td>
            <td class="t-num"><b>${netTotal.toFixed(2)}</b></td>
        </tr>`;
    }).join('');

    // Summary unit format e.g. "0 - 5 - 0"
    const totalQtySummary = `0 - ${totalQty} - 0`;

    // Customer display string
    const custCode = customer.code || (customer.id ? customer.id.slice(-4) : '');
    const custDisplayName = customer.shopName ? `${customer.shopName} (${customer.name})` : (customer.name || 'Counter Sale');

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ur">
    <head>
        <meta charset="utf-8">
        <title>Invoice ${billNo} — ${agency.name || 'Ali Raza Traders'}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
            @media print {
                @page { 
                    size: 8.5in 7in; 
                    margin: 4mm 6mm; 
                }
                body { margin: 0; padding: 0; }
                .no-print { display: none !important; }
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                color: #000;
                font-size: 11.5px;
                line-height: 1.25;
                margin: 0 auto;
                max-width: 820px;
                padding: 6px 12px;
                direction: rtl;
                background: #fff;
            }
            .urdu { font-family: 'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', Arial, serif; }

            /* 🏢 HEADER SECTION */
            .header-sec {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 6px;
                padding-bottom: 4px;
            }
            .header-left {
                width: 28%;
                text-align: left;
                direction: ltr;
                font-size: 11.5px;
                font-weight: bold;
                line-height: 1.4;
            }
            .header-center {
                width: 44%;
                text-align: center;
                line-height: 1.3;
            }
            .agency-title {
                font-size: 27px;
                font-weight: 900;
                margin: 0;
                line-height: 1.4;
                color: #000;
            }
            .agency-sub {
                font-size: 12.5px;
                font-weight: bold;
                margin: 1px 0;
            }
            .agency-proprietor {
                font-size: 11.5px;
                font-weight: bold;
                margin-top: 1px;
            }
            .header-right {
                width: 28%;
                text-align: right;
                line-height: 1.4;
            }
            .badge-paytype {
                font-size: 22px;
                font-weight: 900;
                letter-spacing: 1.5px;
                font-family: 'Segoe UI', Arial, sans-serif;
                margin-bottom: 2px;
            }
            .bill-timestamp {
                font-size: 11px;
                font-weight: bold;
                direction: ltr;
                display: inline-block;
            }

            /* 📋 4-ROW META GRID (Bordered Table matching receipt photo) */
            .meta-grid {
                width: 100%;
                border-collapse: collapse;
                border: 1.5px solid #000;
                margin-bottom: 6px;
                font-size: 11.5px;
            }
            .meta-grid td {
                border: 1px solid #000;
                padding: 4px 6px;
                vertical-align: middle;
            }
            .meta-grid .t-ltr {
                text-align: left;
                direction: ltr;
                font-weight: bold;
            }
            .meta-grid .t-rtl {
                text-align: right;
                direction: rtl;
            }

            /* 📦 ITEMS TABLE (7 Exact Columns matching photo) */
            .grid-table {
                width: 100%;
                border-collapse: collapse;
                border: 1.5px solid #000;
                margin-bottom: 6px;
                font-size: 11px;
            }
            .grid-table th {
                border: 1px solid #000;
                background: #f1f5f9;
                padding: 4px 4px;
                font-weight: 800;
                text-align: center;
                color: #000;
            }
            .grid-table td {
                border: 1px solid #333;
                padding: 3.5px 5px;
                vertical-align: middle;
            }
            .t-name {
                text-align: right;
                font-weight: 700;
                padding-right: 6px !important;
            }
            .t-center {
                text-align: center;
                font-weight: 600;
            }
            .t-num {
                text-align: right;
                direction: ltr;
                font-weight: 600;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            }
            .summary-row td {
                font-weight: 800;
                background: #f8fafc;
                border-top: 1.5px solid #000;
            }

            /* 📊 LOWER SECTION (Terms Box Right + Calculations Box Left) */
            .footer-table {
                width: 100%;
                border-collapse: collapse;
                border: 1.5px solid #000;
                margin-top: 2px;
            }
            .footer-table td {
                vertical-align: top;
                padding: 6px 10px;
            }
            .terms-box {
                font-size: 10.5px;
                line-height: 1.8;
                font-weight: 700;
                text-align: right;
            }
            .calc-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11.5px;
            }
            .calc-table td {
                padding: 2.5px 4px;
            }
            .calc-table .c-lbl {
                text-align: right;
                font-weight: 700;
            }
            .calc-table .c-val {
                text-align: left;
                direction: ltr;
                font-weight: 800;
                font-family: 'Segoe UI', Tahoma, sans-serif;
            }
            .calc-table .grand-row td {
                font-size: 13px;
                font-weight: 900;
                border-top: 1px solid #000;
                border-bottom: 1px solid #000;
                padding: 3px 4px;
            }

            /* 🖨️ STATUS FOOTER */
            .bottom-status-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 10px;
                font-weight: 700;
                margin-top: 6px;
                border-top: 1px solid #cbd5e1;
                padding-top: 3px;
                direction: ltr;
            }
        </style>
    </head>
    <body>
        <!-- 🏢 HEADER -->
        <div class="header-sec">
            <!-- Left: Agency Mobile, NTN, Licence & Logo -->
            <div class="header-left">
                ${(s.showLogo !== false && agency.logo) ? `<img src="${agency.logo}" style="max-height:48px; max-width:130px; object-fit:contain; margin-bottom:4px; display:block;" alt="Logo">` : ''}
                ${s.showMobiles ? `<div>${agency.mobile || ''} <span class="urdu">${agency.ownerName || ''}</span></div>` : '<div>&nbsp;</div>'}
                ${s.showNTN ? `<div>NTN: ${agency.ntn || ''}</div>` : ''}
                ${s.showLicence ? `<div>Licence: ${agency.licenceNo || ''}</div>` : ''}
            </div>

            <!-- Center: Agency Title, Subtitle, Proprietor -->
            <div class="header-center">
                ${s.showAgencyName ? `<h1 class="agency-title urdu">${agency.name || ''}</h1>` : ''}
                ${s.showAddress ? `<div class="agency-sub urdu">${agency.address || ''} ${agency.city ? agency.city : ''}</div>` : ''}
                ${s.showOwnerName ? `<div class="agency-proprietor urdu">${agency.ownerName || ''}</div>` : ''}
            </div>

            <!-- Right: Payment Type Badge & Timestamp -->
            <div class="header-right">
                <div class="badge-paytype">${s.showPayType ? payType : ''}</div>
                <div class="bill-timestamp">${s.showTime ? timeStr : ''} &nbsp;&nbsp; ${s.showDate ? dateStr : ''}</div>
            </div>
        </div>

        <!-- 📋 4-ROW META GRID (Bordered Table matching receipt photo) -->
        <table class="meta-grid">
            <!-- Row 1: Mobile Left, Customer Name Right -->
            <tr>
                <td style="width: 24%;" class="t-ltr">
                    ${s.showCustomerPhone ? (customer.mobile || '') : ''}
                </td>
                <td colspan="3" style="width: 76%;" class="t-rtl urdu">
                    ${s.showCustomerName ? `بل بنام: &nbsp;${custCode ? `( <b style="font-family:'Segoe UI',sans-serif;">${custCode}</b> ) &nbsp;&nbsp;` : ''}<b>${custDisplayName}</b>` : ''}
                </td>
            </tr>

            <!-- Row 2: Bill No Left, Salesman / Booker Right -->
            <tr>
                <td style="width: 24%;" class="t-rtl urdu">
                    ${s.showBillNo ? `بل نمبر: &nbsp;&nbsp;<b style="font-family:'Segoe UI',sans-serif; font-size:13px;">${billNo}</b>` : ''}
                </td>
                <td colspan="3" style="width: 76%;" class="t-rtl urdu">
                    ${s.showBookerName ? `سیلزمین / آرڈر بکر: &nbsp;&nbsp;<b>${bookerName || ''}</b> &nbsp;&nbsp;<span class="t-ltr" style="font-family:'Segoe UI',sans-serif;">${bookerMobile || ''}</span>` : ''}
                </td>
            </tr>

            <!-- Row 3: Bill Date Left, Area Middle, Route Right -->
            <tr>
                <td style="width: 24%;" class="t-rtl urdu">
                    ${s.showDate ? `بل تاریخ: &nbsp;&nbsp;<span style="font-family:'Segoe UI',sans-serif;">${dateStr}</span>` : ''}
                </td>
                <td style="width: 38%;" class="t-rtl urdu">
                    ${s.showCustomerAddress ? (customer.address || customer.area || '') : ''}
                </td>
                <td colspan="2" style="width: 38%;" class="t-rtl urdu">
                    ${s.showCustomerRoute ? `روٹ: &nbsp;&nbsp;<b>${customer.route || bill.customerRoute || ''}</b>` : ''}
                </td>
            </tr>

            <!-- Row 4: Summary No Left, Delivery Man Middle, CNIC/NTN Right -->
            <tr>
                <td style="width: 24%;" class="t-rtl urdu">
                    ${bill.summaryNo ? `سمری نمبر: &nbsp;&nbsp;<b style="font-family:'Segoe UI',sans-serif;">${bill.summaryNo}</b>` : ''}
                </td>
                <td style="width: 38%;" class="t-rtl urdu">
                    ${s.showSupplierName ? `ڈیلیوری مین / سپلائر: &nbsp;&nbsp;<b>${bill.supplierName || bill.deliveryMan || ''}</b>` : ''}
                </td>
                <td colspan="2" style="width: 38%;" class="t-rtl urdu">
                    ${s.showCustomerNTN ? `
                    آئی ڈی کارڈ / NTN: &nbsp;&nbsp;<span style="font-family:'Segoe UI',sans-serif; font-weight:bold;">${customer.ntn || customer.cnic || ''}</span>
                    ${customer.fbrStatus ? `<span style="font-weight:bold; margin-right:4px; padding:1px 6px; border-radius:4px; font-size:10px; ${customer.isFiler ? 'background:#dcfce7; color:#15803d; border:1px solid #86efac;' : 'background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;'}">(${customer.isFiler ? '🟢 فائلر' : '🔴 نان فائلر'})</span>` : ''}
                    ` : ''}
                </td>
            </tr>
        </table>

        <!-- 📦 7-COLUMN ITEMS TABLE (تفصیل، تعداد، ریٹ، گراس رقم، ڈسکاؤنٹ، سکیم، میزان) -->
        <table class="grid-table">
            <thead>
                <tr>
                    <th style="width: 44%; text-align:right; padding-right:8px;" class="urdu">تفصیل</th>
                    <th style="width: 12%;" class="urdu">تعداد</th>
                    <th style="width: 9%;" class="urdu">ریٹ</th>
                    <th style="width: 11%;" class="urdu">گراس رقم</th>
                    <th style="width: 8%;" class="urdu">ڈسکاؤنٹ</th>
                    <th style="width: 8%;" class="urdu">سکیم</th>
                    <th style="width: 12%;" class="urdu">میزان</th>
                </tr>
            </thead>
            <tbody>
                ${formattedRows}
                <!-- 📊 Summary Row -->
                <tr class="summary-row">
                    <td class="urdu" style="text-align:center; font-weight:800;">میزان</td>
                    <td class="urdu" style="text-align:center; font-weight:800;">${totalQtySummary}</td>
                    <td></td>
                    <td class="t-num"><b>${totalGross.toFixed(2)}</b></td>
                    <td class="t-num">${totalDisc.toFixed(2)}</td>
                    <td class="t-num">${totalScheme.toFixed(2)}</td>
                    <td class="t-num"><b>${totalNet.toFixed(2)}</b></td>
                </tr>
            </tbody>
        </table>

        <!-- 📊 LOWER SECTION (Terms Box Right + Calculations Box Left) -->
        <table class="footer-table">
            <tr>
                <!-- Legal Terms & Conditions (Photo Match) -->
                <td style="width: 58%; border-left: 1.5px solid #000;">
                    ${s.showTermsAndConditions !== false ? `
                    <div class="terms-box urdu">
                        سٹاک موقع پر چیک کریں بعد از ادارہ ذمہ دار نہ ہوگا<br>
                        آرڈر بکر یا سپلائر کے ذاتی لین دین کا ادارہ ذمہ دار نہ ہوگا<br>
                        چوہے کے کاٹے یا ڈیمیج کا کوئی کلیم نہ ہوگا<br>
                        ${agency.invoiceFooter ? agency.invoiceFooter : ''}
                    </div>` : ''}
                </td>

                <!-- Financial Calculations (Freight, Other, Tax, Grand Total, Previous, Total Due) -->
                <td style="width: 42%;">
                    <table class="calc-table">
                        <tr>
                            <td class="c-lbl urdu">کرایہ (-) :</td>
                            <td class="c-val">${parseFloat(bill.freight || 0).toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td class="c-lbl urdu">دیگر (+) :</td>
                            <td class="c-val">${parseFloat(bill.otherCharges || 0).toFixed(2)}</td>
                        </tr>
                        ${(s.showTax && (parseFloat(bill.taxAmount || 0) > 0 || (bill.taxRate && parseFloat(bill.taxRate) > 0))) ? `
                        <tr>
                            <td class="c-lbl urdu">FBR ایڈوانس ٹیکس (${customer.isFiler ? 'فائلر' : 'نان فائلر'} ${bill.taxRate ? bill.taxRate + '%' : ''}) :</td>
                            <td class="c-val">+ ${parseFloat(bill.taxAmount || 0).toFixed(2)}</td>
                        </tr>` : ''}
                        <tr class="grand-row">
                            <td class="c-lbl urdu">واجب الادا :</td>
                            <td class="c-val">${tot.grandTotal}</td>
                        </tr>
                        ${s.showPreviousBalance !== false ? `
                        <tr>
                            <td class="c-lbl urdu">سابقہ بیلنس :</td>
                            <td class="c-val">(${tot.prevBalance})</td>
                        </tr>` : ''}
                        ${s.showReceivedAmount !== false && parseFloat(tot.received) > 0 ? `
                        <tr>
                            <td class="c-lbl urdu">وصول شدہ :</td>
                            <td class="c-val">- ${tot.received}</td>
                        </tr>` : ''}
                        ${s.showBalance !== false ? `
                        <tr style="font-weight:900; font-size:13px;">
                            <td class="c-lbl urdu">ٹوٹل بقایا :</td>
                            <td class="c-val"><b>${tot.balance}</b></td>
                        </tr>` : ''}
                    </table>
                </td>
            </tr>
        </table>

        <!-- ✍️ SIGNATURES ROW -->
        <table style="width:100%; margin-top:8px; border-top:1px dashed #94a3b8; padding-top:4px; font-size:10.5px; text-align:center;">
            <tr>
                <td style="width:33.3%;">
                    ${s.showSignatureCustomer !== false ? `<div style="border-top:1px solid #000; width:130px; margin:16px auto 2px; padding-top:2px;" class="urdu">دستخط وصول کنندہ / گاہک</div>` : ''}
                </td>
                <td style="width:33.3%;">
                    ${s.showSignatureBooker !== false ? `<div style="border-top:1px solid #000; width:130px; margin:16px auto 2px; padding-top:2px;" class="urdu">دستخط آرڈر بکر / سیلزمین</div>` : ''}
                </td>
                <td style="width:33.3%;">
                    ${s.showSignatureAuthorized !== false ? `<div style="border-top:1px solid #000; width:130px; margin:16px auto 2px; padding-top:2px;" class="urdu">دستخط برائے ادارہ / مہر</div>` : ''}
                </td>
            </tr>
        </table>

        <!-- 🖨️ STATUS FOOTER (PC / User / Phone / Page) -->
        <div class="bottom-status-row">
            <span>PC: &nbsp;${agency.terminalId || 'DESKTOP-POS-01'}</span>
            <span>User: &nbsp;${(typeof myUser !== 'undefined' && myUser && myUser.name) ? myUser.name : 'Admin'}</span>
            <span>${agency.mobile ? 'Phone: ' + agency.mobile : ''}</span>
            <span>Page 1 of 1</span>
        </div>
    </body>
    </html>
    `;
}

// ============================================
// 🎯 TEMPLATE REGISTRY (Naam → Function!)
// ============================================
const BILL_TEMPLATES = {
    'template8': { name: '🇵🇰 Classic Wholesale Urdu Grid (Legal Half-Cut)', fn: template8WholesaleUrduGrid },
    'template7': { name: '📦 FMCG Corporate Distribution Invoice', fn: template7FMCGDistribution },
    'template4': { name: '⚡ Modern Minimal / Table Invoice', fn: template4Modern },
    'template1': { name: '🇵🇰 Urdu Classic (Nastaliq)', fn: template1Urdu },
    'template2': { name: '📋 Traders English (Header)', fn: template2Traders },
    'template3': { name: '🇵🇰 Urdu + English Mix', fn: template3Mix },
    'template5': { name: '💎 Premium Full (All Boxes)', fn: template5Premium },
    'template6': { name: '🧾 Thermal Slip (58/80mm POS)', fn: template6Thermal }
};

const DEFAULT_TEMPLATE = 'template8';

// ============================================
// 🎯 MAIN RENDERER & EXPORT TO WINDOW
// ============================================
function buildBillHTML(bill, templateId, customSettings) {
    if (!bill) return '';
    const agRaw = (typeof myAgency !== 'undefined' && myAgency) ? myAgency : (bill.agency || {});
    const agency = getTemplateAgency(agRaw, bill);
    const customer = getTemplateCustomer(bill);
    const tId = templateId || agency.defaultTemplate || agency.template || DEFAULT_TEMPLATE;
    const template = BILL_TEMPLATES[tId] || BILL_TEMPLATES[DEFAULT_TEMPLATE] || BILL_TEMPLATES['template4'];
    
    // Read checkbox controls if print engine loaded
    const settings = customSettings || ((window.ebPrintEngine && window.ebPrintEngine.getEffectivePrintSettings)
        ? window.ebPrintEngine.getEffectivePrintSettings(agRaw)
        : (typeof DEFAULT_PRINT_SETTINGS !== 'undefined' ? DEFAULT_PRINT_SETTINGS : {}));

    return template.fn(bill, agency, customer, settings);
}

// Attach globally
window.buildBillHTML = buildBillHTML;
window.renderBillTemplate = buildBillHTML;
window.BILL_TEMPLATES = BILL_TEMPLATES;