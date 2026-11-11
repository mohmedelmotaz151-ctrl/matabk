# المطبات — Motabat

نسخة V2 جاهزة للرفع على GitHub وVercel.

## المزايا الحالية

- Manifest صحيح وأيقونة PWA وService Worker.
- خريطة Leaflet + OpenStreetMap وتحديد موقع المركبة.
- إضافة مطب أو حفرة مع درجة الخطورة والملاحظات.
- تسجيل الدخول وإنشاء حساب عبر Supabase.
- تخزين البلاغات في Supabase مع RLS.
- تنبيه عند الاقتراب من خطر مسجل.
- حساس حركة محافظ مع تأكيد المستخدم قبل إرسال البلاغ.
- فتح موقع الخطر في خرائط Google.
- إعداد Vercel SPA.

## قاعدة البيانات السحابية

ملفات قاعدة البيانات في جذر المستودع:

- `schema.sql`: المخطط الأساسي للجداول والحسابات وسياسات RLS.
- `postgis_migration.sql`: ترقية إضافية آمنة تضيف الإحداثيات الجغرافية PostGIS وسجل تأكيد/رفض البلاغات لكل مستخدم.

### لمشروع Supabase جديد

1. افتح Supabase → SQL Editor.
2. الصق محتوى `schema.sql` بالكامل ثم Run.
3. الصق محتوى `postgis_migration.sql` بالكامل ثم Run.
4. من Table Editor تأكد من وجود `hazards` و`profiles` و`hazard_reports`.

### لمشروع Supabase قائم بالفعل

لا تُعد تشغيل المخطط الأساسي لمجرد التحديث. شغّل `postgis_migration.sql` فقط بعد التأكد أن جدول `public.hazards` موجود بالأعمدة التي يعرّفها `schema.sql`.

الترقية لا تحذف المطبات الحالية ولا تعيد إنشاءها؛ تضيف عمود الموقع الجغرافي وتملؤه من خط العرض والطول الموجودين، مع إبقاء حقول الإحداثيات القديمة كما هي.

## إعداد متغيرات الاتصال

انسخ `.env.example` إلى `.env.local` ثم أدخل بيانات مشروعك:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

احصل على القيم من Supabase → Project Settings → API. لا ترفع ملف `.env.local` أو أي مفتاح سري إلى GitHub.

## التشغيل محلياً

```bash
npm install
npm run dev
```

## النشر على Vercel

- Framework: Vite
- Build Command: `npm run build`
- Output Directory: `dist`
- أضف `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` في Environment Variables ثم أعد النشر.

## اختبار PWA

- افتح الموقع عبر HTTPS.
- تحقق من `/manifest.webmanifest` و`/icons/icon.svg`.
- بعدها أعد الفحص في PWABuilder.

## ملاحظة السلامة

التطبيق مساعد للسائق فقط ولا يغني عن الانتباه للطريق أو الالتزام بالأنظمة المرورية. قد يخطئ GPS وقد تكون بيانات المخاطر غير مكتملة.

## الخطوات التالية

1. ربط واجهة التأكيد والرفض بجدول `hazard_reports`.
2. استخدام PostGIS للبحث عن الأخطار القريبة بكفاءة.
3. تجميع البلاغات المتقاربة ومنع التكرار.
4. تنبيهات صوتية قبل 500/300/150 متر.
5. لوحة إدارة ونظام نقاط وثقة للمستخدمين.
