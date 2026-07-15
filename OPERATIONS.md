# Aswaq — Operations Handbook
**الإصدار:** 1.0 | **آخر تحديث:** 2026-06-27

---

## 1. تعريفات SLO / SLA

### 1.1 Service Level Objectives (SLO)

| المؤشر | الهدف | طريقة القياس | نافذة القياس |
|--------|-------|-------------|-------------|
| **Availability** | ≥ 99.9% | `1 - (error_5xx / total_requests)` | شهري |
| **Latency p95** | < 500ms | `histogram_quantile(0.95, ...)` | 5 دقائق |
| **Latency p99** | < 1000ms | `histogram_quantile(0.99, ...)` | 5 دقائق |
| **Error Rate** | < 0.1% | `5xx / total × 100` | 5 دقائق |
| **MTTR** | < 30 دقيقة | وقت الاكتشاف → وقت الحل | per incident |
| **MTTD** | < 5 دقائق | وقت الحدث → وقت التنبيه | per incident |
| **Backup Success** | 100% | نجاح الـ backup اليومي | يومي |
| **RTO** | < 2 ساعة | وقت استعادة الخدمة بعد كارثة | per DR event |
| **RPO** | < 24 ساعة | أقصى فقدان للبيانات | per DR event |

---

### 1.2 Error Budget

```
Error Budget الشهري = 100% - 99.9% = 0.1%
                    = 0.001 × 30 يوم × 24 ساعة × 60 دقيقة
                    = 43.2 دقيقة / شهر

Burn Rate × 1  → يستنزف الـ budget خلال 30 يوم (طبيعي)
Burn Rate × 6  → يستنزف الـ budget خلال 5 أيام (تحذير)
Burn Rate × 14 → يستنزف الـ budget خلال 2 يوم (حرج)
```

**قاعدة Error Budget:**
- Budget > 50%: يمكن نشر features جديدة
- Budget 20-50%: نشر محافظ فقط (canary إلزامي)
- Budget < 20%: تجميد النشر — التركيز على الاستقرار فقط

---

### 1.3 Service Level Agreement (SLA) — للعملاء

| مستوى الخدمة | Uptime | تعويض |
|-------------|--------|-------|
| Standard | 99.5% | — |
| Business | 99.9% | 10% من الفاتورة الشهرية |
| Enterprise | 99.99% | 25% من الفاتورة الشهرية |

---

## 2. تصنيف الحوادث

### SEV1 — انقطاع كامل (Full Outage)
**التعريف:** التطبيق غير متاح لجميع المستخدمين.

**أمثلة:**
- قاعدة البيانات متوقفة
- API Server متوقف تماماً
- انقطاع في الشبكة

**الإجراء:**
```
1. [فوري]   تشغيل incident-response.sh SEV1 database
2. [< 1 دق] إشعار Slack #incidents + PagerDuty
3. [< 5 دق] تشغيل diagnostics
4. [< 15 دق] تنفيذ recovery procedure
5. [< 30 دق] التحقق من الاستعادة
6. [48 ساعة] توثيق RCA
```

**مسؤولية:** On-call engineer يستجيب خلال **5 دقائق**

---

### SEV2 — تدهور جزئي (Partial Degradation)
**التعريف:** بعض الميزات متأثرة لكن التطبيق يعمل.

**أمثلة:**
- Redis متوقف (التخزين المؤقت معطل)
- Meilisearch متوقف (البحث يعمل من DB)
- بطء ملحوظ في أداء API

**الإجراء:**
```
1. [< 5 دق]  إشعار Slack #alerts
2. [< 30 دق] التحقيق
3. [< 2 ساعة] الحل أو الإعلان عن مخطط عمل
```

---

### SEV3 — تدهور في الأداء
**التعريف:** أداء أقل من المعتاد لكن لا يؤثر على الاستخدام الأساسي.

**أمثلة:**
- p95 > 500ms لكن < 1000ms
- معدل خطأ بين 1-5%
- مشاكل في خدمة ثانوية

**الإجراء:**
```
1. [< 30 دق] فتح ticket ومتابعة
2. [< 24 ساعة] الحل أو التخطيط
```

---

## 3. Incident Response Playbook

### 3.1 SEV1 — Database Down

```bash
# الخطوة 1: تشخيص
./scripts/incident-response.sh SEV1 database

# الخطوة 2: فحص RDS
aws rds describe-db-instances \
  --db-instance-identifier aswaq-production-postgres \
  --query 'DBInstances[0].DBInstanceStatus'

# الخطوة 3: Failover (إن كانت Multi-AZ)
aws rds failover-db-cluster \
  --db-cluster-identifier aswaq-production-postgres

# الخطوة 4: إذا فشل Failover → Disaster Recovery
./scripts/backup-restore.sh disaster-recovery \
  --env production \
  --backup-key <latest-s3-key>

# الخطوة 5: Status Page
# تحديث public/status/index.html أو Statuspage.io
```

**نقطة تفتيش:** بعد استعادة الخدمة، تشغيل Prisma migrate status

---

### 3.2 SEV1 — Full Pod Crash / OOMKill

```bash
# فحص سبب الـ crash
kubectl describe pod <pod-name> -n aswaq | tail -30
kubectl logs <pod-name> -n aswaq --previous

# Rollback فوري (< 5 دقائق)
./scripts/canary-deploy.sh rollback --env production

# إذا فشل Rollback
helm rollback aswaq 0 --namespace aswaq

# رفع حد الذاكرة مؤقتاً إن كانت OOMKill
kubectl patch deployment aswaq -n aswaq \
  --patch '{"spec":{"template":{"spec":{"containers":[{"name":"aswaq","resources":{"limits":{"memory":"2Gi"}}}]}}}}'
```

---

### 3.3 SEV2 — Redis Down

```bash
# التطبيق يعمل بدون Redis (fallback mode) — لكن:
# - الجلسات لن تُخزَّن
# - BullMQ queues معطلة
# - التخزين المؤقت معطل

# فحص Redis
kubectl exec -n aswaq redis-0 -- redis-cli ping

# إعادة تشغيل Redis pod
kubectl rollout restart statefulset/redis -n aswaq

# إذا لم يُفِد → إعادة تشغيل كاملة عبر Helm
helm upgrade aswaq helm/ --namespace aswaq --reuse-values --atomic
```

---

## 4. الإشعارات والتنبيهات

### 4.1 قنوات Slack

| القناة | الغرض |
|--------|--------|
| `#incidents` | SEV1 فقط — حوادث بالغة |
| `#alerts` | SEV2 + SEV3 تلقائياً |
| `#slo-alerts` | تنبيهات Burn Rate |
| `#ops-backup` | نتائج Backup اليومي |
| `#deployments` | كل عملية نشر |

### 4.2 Prometheus Alert Rules

| التنبيه | الحد | الفترة | الخطورة |
|---------|------|--------|---------|
| SLO_AvailabilityBurnRate_Critical | 14.4× burn | 2 دقائق | critical |
| SLO_AvailabilityBurnRate_Warning | 6× burn | 5 دقائق | warning |
| SLO_LatencyP95_Critical | > 1000ms | 3 دقائق | critical |
| SLO_LatencyP95_Warning | > 500ms | 5 دقائق | warning |
| DatabaseDown | up == 0 | 1 دقيقة | critical |
| PodOOMKilled | reason=OOMKilled | فوري | critical |
| BackupMissing | > 36 ساعة | فوري | critical |

---

## 5. Release Strategy

### 5.1 Canary Release (الافتراضي)

```
الخطوة 1: نشر 10% من الطلبات إلى الإصدار الجديد
           ./scripts/canary-deploy.sh canary --image-tag v1.1.0 --weight 10

الخطوة 2: مراقبة 30 دقيقة (error rate, p95, memory)

الخطوة 3: ترقية إلى 50%
           ./scripts/canary-deploy.sh canary --image-tag v1.1.0 --weight 50

الخطوة 4: مراقبة 15 دقيقة

الخطوة 5: ترقية إلى 100%
           ./scripts/canary-deploy.sh promote --image-tag v1.1.0
```

**الفشل التلقائي:** إذا تجاوز error rate 5% خلال أي مرحلة → rollback تلقائي

---

### 5.2 Blue/Green (للتحديثات الكبرى)

```bash
# نشر الإصدار الجديد (green slot) بدون تأثير على المستخدمين
./scripts/canary-deploy.sh blue-green \
  --image-tag v1.1.0 \
  --env production

# الإصدار الجديد يُختبر أولاً، ثم يُحوَّل الـ ingress تلقائياً
# الإصدار القديم (blue) يبقى جاهزاً لـ rollback فوري
```

---

### 5.3 Emergency Rollback (< 5 دقائق)

```bash
# الأمر الوحيد المطلوب
./scripts/canary-deploy.sh rollback --env production

# يقوم بـ:
# 1. helm rollback aswaq 0
# 2. إزالة canary إن وُجد
# 3. انتظار kubectl rollout status
# 4. health gate
# 5. إشعار Slack
```

---

## 6. Status Page

**الموقع:** `https://status.aswaq.sa`  
**الملف:** [`public/status/index.html`](public/status/index.html)

**الخدمات المُراقَبة:**
- 🌐 API Server
- 🗄️ قاعدة البيانات (PostgreSQL)
- ⚡ Redis
- 🔍 محرك البحث (Meilisearch)
- 🔔 الإشعارات (Outbox Worker)

**التحديث:** كل 30 ثانية تلقائياً من `/health` endpoint

**لتشغيل Status Page محلياً:**
```bash
npx serve public/status -p 3001
# أو
python -m http.server 3001 --directory public/status
```

---

## 7. Disaster Recovery Checklist

```
[ ] تشخيص الكارثة (< 5 دقائق)
    ./scripts/incident-response.sh SEV1 <component>

[ ] إخطار stakeholders (< 10 دقائق)
    - Slack #incidents
    - Email إلى الإدارة
    - تحديث Status Page

[ ] تقييم نطاق الكارثة (< 15 دقائق)
    - هل قاعدة البيانات مفقودة؟
    - هل يمكن Failover؟
    - هل نحتاج Restore كامل؟

[ ] تنفيذ الاستعادة (< 2 ساعة)
    ./scripts/backup-restore.sh disaster-recovery \
      --env production \
      --backup-key <s3-key>

[ ] التحقق من صحة البيانات
    npx prisma migrate status
    curl -s https://api.aswaq.sa/health

[ ] إعلان إعادة الخدمة
    - تحديث Status Page إلى "Operational"
    - إشعار Slack #incidents

[ ] Post-Incident
    - RCA خلال 48 ساعة
    - Action items للوقاية
```

---

## 8. Monitoring Stack

| الأداة | الوصول | الغرض |
|--------|--------|--------|
| Prometheus | `http://prometheus:9090` | جمع المقاييس |
| Grafana | `http://grafana:3000` | لوحة المراقبة |
| AlertManager | `http://alertmanager:9093` | إدارة التنبيهات |
| Status Page | `https://status.aswaq.sa` | الحالة العامة للجمهور |

**Alert Rules:** [`server/data/prometheus-alerts.yml`](server/data/prometheus-alerts.yml)  
**AlertManager:** [`server/data/alertmanager.yml`](server/data/alertmanager.yml)

---

## 9. Contacts

| الدور | المسؤولية |
|-------|-----------|
| On-call Engineer | SEV1/2 response |
| Tech Lead | قرار Rollback للإنتاج |
| DevOps | Terraform + Kubernetes |
| Security | ثغرات أمنية |
