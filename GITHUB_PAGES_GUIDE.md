# 🚀 Easy Bill Generator & Customer Ledger — GitHub Pages Deployment Guide
(گٹ ہب پیجز پر اپلوڈ کرنے کا آسان اور مکمل طریقہ)

یہ پروجیکٹ 100% خالص **HTML5**, **CSS3**, **Vanilla JavaScript** اور **Firebase** پر مشتمل ہے۔ اس میں کوئی بھی مشکل فریم ورک (React/Angular/Vue/TypeScript) استعمال نہیں کیا گیا، جس کی وجہ سے آپ اسے بغیر کسی build step کے براہ راست **GitHub Pages** پر چلا سکتے ہیں۔

---

## 📁 فائلوں کی ساخت (File Structure):
تمام فائلیں خالص ویب فارمیٹ میں ہیں:
- `auth.html` & `auth.js` & `auth.css`: لاگ ان، سائن اپ، ملٹی رول اور گوگل لاگ ان
- `dashboard.html`: مین ڈیش بورڈ، فوری سیلز سمری، ریونیو ویوز
- `bills.html` & `bills.js` & `bills.css`: بلنگ، انوائس، کسٹمر سلیکشن اور بل پرنٹنگ
- `customers.html` & `customers.js` & `customers.css`: کسٹمر لیجر، رننگ بیلنس اور وصولیاں
- `stock.html` & `stock.js` & `stock.css`: آئٹمز انوینٹری، ریٹس اور بارکوڈز
- `admin.html` & `owner.html`: بزنس ایڈمن اور اونر پینل
- `firebase-config.js`: فائر بیس ڈیٹا بیس سیٹنگز
- `index.html`: ابتدائی لوڈر جو سیدھا `auth.html` پر ری ڈائریکٹ کرتا ہے

---

## 🌐 GitHub Pages پر لائیو کرنے کے 2 طریقے:

### طریقہ 1: ریپوزٹری کے روٹ (Root) پر فائلیں رکھ کر (سب سے آسان)
1. اپنے گٹ ہب ریپوزٹری میں تمام فائلیں (`public/` کے اندر موجود تمام `.html`, `.css`, `.js` فائلیں) سیدھی مین فولڈر (Root) میں اپلوڈ کریں۔
2. گٹ ہب پر اپنی ریپوزٹری کھولیں۔
3. اوپر **Settings** پر کلک کریں۔
4. بائیں مینو میں **Pages** پر کلک کریں۔
5. **Branch** میں `main` سلیکٹ کریں اور فولڈر میں `/ (root)` منتخب کر کے **Save** دبا دیں۔
6. 1 منٹ بعد آپ کی ایپ کا لائیو لنک (جیسے `https://username.github.io/repo-name/`) بن جائے گا۔

### طریقہ 2: موجودہ فولڈر کے ساتھ (GitHub Actions یا /docs)
اگر آپ فائلیں فولڈر میں رکھنا چاہتے ہیں تو گٹ ہب سیٹنگز میں Pages کے اندر برانچ منتخب کر کے فولڈر منتخب کریں۔

---

## 🔐 فائر بیس ڈومین اجازت (Firebase Authorized Domains):
جب آپ GitHub Pages پر ایپ لائیو کریں گے تو گوگل سائن ان اور فائر بیس کو اجازت دینے کے لیے:
1. [Firebase Console](https://console.firebase.google.com/) پر جائیں۔
2. اپنے پروجیکٹ کے **Authentication** -> **Settings** -> **Authorized domains** میں جائیں۔
3. **Add domain** پر کلک کریں اور اپنا گٹ ہب ڈومین شامل کریں:
   `username.github.io`
4. اب آپ کا گوگل لاگ ان اور فائر بیس گٹ ہب پیجز پر بغیر کسی رکاوٹ کے 100% چلے گا۔

---
✅ **ہماری مستقل ضمانت:** آئندہ تمام فکسز اور فیچرز صرف خالص HTML, CSS, JavaScript اور Firebase میں ہی رہیں گے تاکہ آپ آسانی سے کوڈ سمجھ سکیں اور بغیر کسی پریشانی کے گٹ ہب پر چلا سکیں۔
