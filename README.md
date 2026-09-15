# المطبات — Motabat

نسخة V2 جاهزة للرفع على GitHub وVercel.

## ما تم إصلاحه

- Manifest صحيح باسم التطبيق ووصفه و`start_url` و`scope`.
- أيقونة PWA حقيقية بدل Placeholder.
- Service Worker للتثبيت والعمل الأساسي دون اتصال.
- خريطة Leaflet + OpenStreetMap.
- تحديد موقع المركبة ومتابعته.
- إضافة مطب أو حفرة مع درجة الخطورة والملاحظات.
- تسجيل الدخول وإنشاء حساب عبر Supabase.
- تخزين البلاغات في Supabase مع RLS.
- تنبيه عند الاقتراب من خطر مسجل.
- حساس حركة محافظ لتقليل التنبيهات الكاذبة.
- تأكيد المستخدم قبل إرسال البلاغ التلقائي من الحساس.
- رابط فتح موقع الخطر في خرائط Google.
- إعداد Vercel SPA حتى لا تظهر صفحة NOT_FOUND عند فتح المسارات.

## 1) إنشاء قاعدة البيانات

في Supabase:
1. افتح SQL Editor.
2. افتح الملف `supabase/schema.sql`.
3. الصق محتواه بالكامل.
4. اضغط Run.
5. تأكد أن جدول `hazards` ظهر في Table Editor.

## 2) إعداد المتغيرات

انسخ `.env.example` إلى `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

احصل على القيم من Supabase:
Project Settings → API.

## 3) التشغيل محلياً

```bash
npm install
npm run dev
```

ثم افتح رابط Vite الظاهر في الطرفية.

## 4) الرفع إلى GitHub

أنشئ Repository جديداً ثم ارفع محتويات هذا المجلد، وليس ملف ZIP نفسه.

```bash
git init
git add .
git commit -m "Motabat V2 - PWA map sensor Supabase"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY
git push -u origin main
```

## 5) النشر على Vercel

في Vercel:
1. Add New → Project.
2. اختر Repository.
3. Framework: Vite.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. أضف:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy.

بعد إضافة المتغيرات اضغط Redeploy.

## 6) اختبار PWABuilder

بعد أن يصبح موقع Vercel متاحاً:
- افتح الموقع على HTTPS.
- تأكد أن `/manifest.webmanifest` يفتح.
- تأكد أن `/icons/icon.svg` يفتح.
- بعدها أعد الفحص في PWABuilder.

## ملاحظة حساسة الحركة

على iPhone/Safari يحتاج حساس الحركة إلى إذن من المستخدم، لذلك يوجد زر "تشغيل الحساس".
على Android/Chrome يجب تشغيل الموقع عبر HTTPS (Vercel مناسب).

الحساس لا يضيف بلاغاً تلقائياً مباشرة: يعرض سؤال تأكيد أولاً. هذا يقلل البلاغات الخاطئة الناتجة عن المطبات الصغيرة أو اهتزاز الهاتف.

## هيكل المشروع

- `src/App.tsx` — التطبيق والخريطة والحساس والحسابات.
- `src/lib/supabase.ts` — اتصال Supabase.
- `src/types.ts` — الأنواع.
- `src/utils.ts` — حساب المسافات.
- `src/styles.css` — التصميم المتجاوب.
- `public/manifest.webmanifest` — PWA Manifest.
- `public/sw.js` — Service Worker.
- `public/icons/icon.svg` — أيقونة التطبيق.
- `supabase/schema.sql` — الجداول والصلاحيات.
- `vercel.json` — إصلاح مسارات SPA في Vercel.

## الخطوة التالية المقترحة

بعد تشغيل هذه النسخة يمكن إضافة:
1. نظام تأكيد/رفض البلاغات.
2. تجميع البلاغات المتقاربة في نقطة واحدة.
3. صوت تحذير قبل 500/300/150 متر.
4. لوحة إدارة للمشرف.
5. نظام نقاط وثقة للمستخدمين.
6. تحسين خوارزمية الحساس باستخدام accelerometer + gyroscope مع معايرة حسب نوع السيارة.
