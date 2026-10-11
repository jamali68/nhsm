# 🚀 EASY BILL GENERATOR — CLIENT & DEPLOYMENT GUIDE

Aap ka software bilkul **Clean, Simple aur Portable (Asaan)** banaya gaya hai. Na koi mushkil configuration hai aur na hi koi extra complicated SaaS code jo aap ko samjh na aaye.

---

## 1. 📁 Architecture (Frontend + Firebase Backend)
- **Frontend**: Pure HTML, CSS, JavaScript (React wrapper for app shell).
- **Backend & Database**: Firebase Auth (User Authentication) + Firebase Cloud Firestore (Real-time Database).
- **Offline Ready**: PWA (Service Worker `sw.js` + Firestore Offline Persistence). Internet na hone par bhi stock aur bills access rehte hain.

---

## 2. 🛡️ Security & Anti-Hack (Tahafuz)
Aap ke database ko hack ya data leak se bachane ke liye `firestore.rules` file banayi gayi hai:
- Koi bhi ghair-mutaliqa shakhs kisi doosray user ya agency ka data na parh sakta hai aur na hi delete kar sakta hai.
- **Rule Principle**:
  - `users`: Sirf authenticated user apna profile dekh/update kar sakta hai.
  - `stock`, `bills`, `customers`: Har shop/agency ka data uski apni `agencyId` ya `userId` ke sath lock hota hai.
  - Direct URL access se koi doosra user kisi ka bill ya customer nahi dekh sakta.

---

## 3. 🌐 Kisi Bhi Naye Client ya PC / Hosting Par Upload Karne Ka Tariqa
Agar aap ko kisi client ke PC, local host, ya naye Netlify/Vercel par deploy karna ho:
1. Naye Firebase project se `firebase-config.js` mein sirf **6 keys** update karein:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "your-app.firebaseapp.com",
       projectId: "your-app",
       storageBucket: "your-app.firebasestorage.app",
       messagingSenderId: "...",
       appId: "..."
   };
   ```
2. Netlify par repo connect karein aur deploy kar dein — bina kisi build problem ke live chalega!
3. Firebase console mein ja kar `firestore.rules` paste kar dein ta k data safe rahay.

---

## 4. 📝 Naye Bill Designs & Checkboxes Ka Tariqa
- Har naye bill design ke sath shopkeeper/admin ko **Settings / Profile** mein dropdown aur checkboxes milenge.
- Admin apni marzi se check/uncheck karega (maslan: Logo dikhana hai ya nahi, Purana Udhaar print karna hai ya nahi, Salesman ka naam print karna hai ya nahi).
- Jo checkbox uncheck hoga, wo bill par print nahi hoga!

---

## 5. 🔒 Anti-Theft & GitHub Security (کوڈ چوری سے بچانے کے 5 حفاظتی پہرے)

### کیا GitHub اور ہمارا سسٹم فری ہے؟
- **جی ہاں!** GitHub پر اکاؤنٹ بنانا، ریپوزٹری بنانا اور ٹوکن جنریٹ کرنا **100% فری** ہے۔
- ہماری طرف سے بھی یہ پورا سسٹم اور رہنمائی بالکل مفت اور لائف ٹائم ہے۔

### کوڈ کو چوری سے محفوظ رکھنے کے لیے فعال کیے گئے 5 حفاظتی سیکیورٹی گارڈز:

1. **GitHub پر ریپوزٹری کو ہمیشہ "Private" رکھیں:**
   - جب آپ GitHub پر نیا پروجیکٹ بنائیں تو **Private Repository** منتخب کریں۔
   - اس سے دنیا میں کوئی بھی شخص آپ کا کوڈ، فائلیں یا سٹرکچر نہ دیکھ سکے گا اور نہ ڈاؤن لوڈ کر سکے گا۔

2. **🛡️ App Guard & Domain Lock (`app-guard.js` v2.0):**
   - اگر کوئی چور یا تیسرا بندہ فائلیں کاپی بھی کر لے اور اپنے کسی سرور، ڈومین یا غیر مجاز ہوسٹنگ پر چلانے کی کوشش کرے گا، تو سسٹم خود بخود **403 Unauthorized Lockout** لگا دے گا۔
   - اس کی سکرین پر ریڈ الرٹ لاک آ جائے گا اور ڈیٹا بیس کنکشن خود بخود منقطع ہو جائے گا۔
   - ڈومین انلاک صرف آفیشل ڈویلپر واٹس ایپ (+923346800959) سے لائسنس کی کے ذریعے ہو سکتا ہے۔

3. **🚫 Anti-Inspect & Anti-Save Shield:**
   - رائٹ کلک (Right-Click) بند کر دیا گیا ہے۔
   - `F12`، `Ctrl+Shift+I`، `Ctrl+Shift+J`، `Ctrl+Shift+C` (Inspect Element) بلاک ہیں۔
   - `Ctrl+U` (View Source) بلاک ہے۔
   - `Ctrl+S` (Save Webpage to Computer) بلاک ہے تاکہ کوئی پیج ڈاؤن لوڈ نہ کر سکے۔

4. **🔐 Firebase Cloud Firestore Security Rules (`firestore.rules`):**
   - غیر لاگ ان شدہ کوئی بھی شخص فائر بیس سے 1 فیصد ڈیٹا بھی نہیں چرا سکتا۔
   - پیکیجز اور قیمتوں میں ردوبدل صرف **Super Admin** کر سکتا ہے۔
   - ہر ایجنسی کا ڈیٹا مکمل طور پر محفوظ ہے۔

5. **📞 آفیشل سپورٹ و لائسنس انکوائری:**
   - ڈویلپر واٹس ایپ: **+923346800959**

