# Aswaq — VPS Staging & Closed Beta Runbook

هذا الدليل التشغيلي مخصص لفترة التشغيل التجريبي (30 يوم) المعتمدة على **VPS Single-Node** باستخدام Docker Compose. الهدف هو إبقاء التعقيد التشغيلي في حده الأدنى وتقليل التكاليف دون التضحية بالمراقبة أو الاستقرار.

---

## 💻 1. المواصفات الموصى بها للخادم (VPS Specs)

- **Beta الحقيقي (مستحسن):** 4 vCPU, 8 GB RAM, 80-160 GB NVMe (مثل Hetzner CX31 أو CPX31).
- **ميزانية محدودة:** 2 vCPU, 4 GB RAM (قد تواجه ضغطاً بسبب وجود Redis, Postgres, Meilisearch معاً).
- **النظام:** Ubuntu 22.04 LTS أو 24.04 LTS.

---

## 🚀 2. خطوات النشر لأول مرة (Initial Deployment)

1. استأجر الـ VPS وقم بربط الـ Domain الخاص بك عبر A Record إلى IP الخادم.
2. اتصل بالخادم عبر `ssh root@YOUR_SERVER_IP`.
3. انسخ مشروع أسواق إلى الخادم (عبر git clone).
4. تأكد من أنك قمت بنسخ ملف `.env` الخاص بالإنتاج.
5. شغّل أمر الأتمتة:
   ```bash
   chmod +x ./scripts/deploy-vps.sh
   ./scripts/deploy-vps.sh
   ```
6. السكربت سيطلب الدومين والإيميل لضبط الـ SSL وإنشاء كلمة مرور للـ Grafana.

---

## 🔄 3. تحديث الكود في بيئة Staging

عند دمج كود جديد (New PR Merged)، لتحديث الخادم:
```bash
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build api worker
docker exec aswaq_api npx prisma migrate deploy
```

---

## 🛡️ 4. الأمان والنسخ الاحتياطي (Security & Backups)

- **قاعدة البيانات:** يتم نسخها احتياطياً يومياً والاحتفاظ بنسخ لـ 7 أيام عبر `scripts/vps-backup.sh`.
- **الشبكة الداخلية:** `postgres`, `redis`, و `meilisearch` لا تمتلك منافذ مفتوحة على الإنترنت. التخاطب يتم فقط داخل حاويات دوكر على شبكة `aswaq_internal`.
- **Grafana:** محمية عبر `Basic Auth` من خلال إعدادات Nginx.
- **SSL:** مفعل إجبارياً على جميع الطلبات بفضل Certbot عبر `nginx.conf`.

---

## 🚨 5. استكشاف الأخطاء وإصلاحها (Troubleshooting)

### مشكلة: الخادم توقف عن الاستجابة أو توقف فجأة (Crash)
**السبب الأكثر شيوعاً:** امتلاء مساحة القرص (Disk Full) أو استنفاد الذاكرة (OOM).

1. **فحص الذاكرة (OOM):**
   ```bash
   dmesg -T | grep -i 'killed process'
   ```
   *الحل:* أضف Swap Memory (مثلاً 2-4 جيجابايت) إذا كان الخادم يمتلك 4GB RAM فقط:
   ```bash
   fallocate -l 4G /swapfile
   chmod 600 /swapfile
   mkswap /swapfile
   swapon /swapfile
   ```

2. **فحص مساحة القرص:**
   ```bash
   df -h /
   ```
   *الحل:* إذا كان ممتلئاً بنسبة 100%، فالسبب غالباً هو تراكم صور Docker أو ملفات الـ Logs.
   ```bash
   # حذف الحاويات والصور غير المستخدمة (يوفر جيجابايتات)
   docker system prune -af --volumes
   # تفريغ سجلات Docker إذا كانت ضخمة
   truncate -s 0 /var/lib/docker/containers/*/*-json.log
   ```

### مشكلة: Nginx يرفض الإقلاع أو يظهر 502 Bad Gateway
1. افحص حالة Nginx: `docker logs aswaq_nginx`
2. إذا كانت المشكلة في شهادات الـ SSL، قد تحتاج لتشغيل Certbot يدوياً:
   ```bash
   certbot certonly --standalone -d beta.aswaq.com
   ```
3. إذا كان 502، فهذا يعني أن حاوية `api` لم تعمل بعد. افحص `docker logs aswaq_api`.

---

## 📈 6. متى ننتقل إلى AWS؟ (Scale-up Triggers)

لا تنتقل إلى بنية EKS و RDS السحابية إلا إذا تحققت الشروط التالية لتبرير الميزانية السحابية (FinOps):
1. اجتياز فترة الـ 30 يوماً بثبات.
2. كسر حاجز الـ 10,000 مستخدم نشط، بحيث يبدأ خادم الـ VPS (4 vCPU) في إظهار استخدام وحدة المعالجة المركزية (CPU) فوق 80% باستمرار.
3. متطلبات استمرارية التوافر المرتفع جداً (High Availability) حيث يتطلب العميل ألا تتوقف المنصة حتى لثوانٍ معدودة.
