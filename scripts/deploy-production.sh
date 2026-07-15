#!/bin/bash
# =====================================================================
# deploy-production.sh — Aswaq نشر الإنتاج الكامل
# يُشغَّل على السيرفر (Ubuntu 22.04+) بأمر واحد:
#   bash deploy-production.sh
# =====================================================================
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

DOMAIN="aswaq22.com"
EMAIL="emad001salah@gmail.com"

echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   🚀 أسواق الأردن — نشر الإنتاج          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"

# ── 1. تثبيت المتطلبات ────────────────────────────────────────────
echo -e "\n${YELLOW}[1/8] تثبيت المتطلبات...${NC}"
sudo apt-get update -y -q
sudo apt-get install -y -q ca-certificates curl gnupg certbot apache2-utils ufw git

# ── 2. تثبيت Docker ───────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}    تثبيت Docker...${NC}"
    curl -fsSL https://get.docker.com | sudo sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}    ✅ Docker مثبّت${NC}"
else
    echo -e "${GREEN}    ✅ Docker موجود: $(docker --version)${NC}"
fi

# ── 3. إعداد الجدار الناري ────────────────────────────────────────
echo -e "\n${YELLOW}[2/8] إعداد الجدار الناري (UFW)...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
echo "y" | sudo ufw enable 2>/dev/null || true
echo -e "${GREEN}    ✅ UFW مُفعَّل: SSH + HTTP + HTTPS${NC}"

# ── 4. إنشاء ملف .env إذا لم يوجد ──────────────────────────────
echo -e "\n${YELLOW}[3/8] التحقق من ملف .env...${NC}"
if [ ! -f .env ]; then
    echo -e "${RED}    ❌ ملف .env غير موجود!${NC}"
    echo -e "${YELLOW}    📋 انسخ ملف .env من جهازك إلى السيرفر أولاً${NC}"
    exit 1
fi

# توليد المفاتيح العشوائية إذا فارغة
for KEY in JWT_SECRET PEPPER_SECRET MEILI_MASTER_KEY; do
    if grep -q "^${KEY}=$" .env 2>/dev/null || ! grep -q "^${KEY}=" .env 2>/dev/null; then
        NEW_VAL=$(openssl rand -hex 32)
        sed -i "/^${KEY}=/d" .env 2>/dev/null || true
        echo "${KEY}=\"${NEW_VAL}\"" >> .env
        echo -e "${GREEN}    ✅ تم توليد ${KEY}${NC}"
    fi
done
echo -e "${GREEN}    ✅ ملف .env جاهز${NC}"

# ── 5. إعداد Basic Auth للـ Grafana ─────────────────────────────
echo -e "\n${YELLOW}[4/8] إعداد حماية لوحة المراقبة...${NC}"
mkdir -p ./config/nginx
GRAFANA_PASS=$(openssl rand -base64 12)
htpasswd -bc ./config/nginx/.htpasswd admin "$GRAFANA_PASS"
echo "GRAFANA_PASSWORD=\"$GRAFANA_PASS\"" >> .env
echo -e "${GREEN}    ✅ Grafana Admin Password: ${GRAFANA_PASS}${NC}"

# ── 6. شهادة SSL (Let's Encrypt) ─────────────────────────────────
echo -e "\n${YELLOW}[5/8] طلب شهادة SSL من Let's Encrypt...${NC}"
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    # إيقاف أي شيء على port 80 مؤقتاً
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    sudo certbot certonly --standalone \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        -d "admin.$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive
    echo -e "${GREEN}    ✅ شهادة SSL جاهزة${NC}"
else
    echo -e "${GREEN}    ✅ شهادة SSL موجودة مسبقاً${NC}"
fi

# إعداد تجديد تلقائي للشهادة
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'docker compose -f /opt/aswaq/docker-compose.prod.yml restart nginx'") | crontab -

# ── 7. بناء ورفع Docker ──────────────────────────────────────────
echo -e "\n${YELLOW}[6/8] بناء وتشغيل Docker...${NC}"
export $(grep -v '^#' .env | xargs) 2>/dev/null || true
export DOMAIN="$DOMAIN"

docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
echo -e "${GREEN}    ✅ جميع الـ containers تعمل${NC}"

# ── 8. Migrations قاعدة البيانات ────────────────────────────────
echo -e "\n${YELLOW}[7/8] تحديث قاعدة البيانات...${NC}"
sleep 10  # انتظار تشغيل postgres
docker exec aswaq_api npx prisma migrate deploy
echo -e "${GREEN}    ✅ قاعدة البيانات محدّثة${NC}"

# ── 9. التحقق النهائي ─────────────────────────────────────────────
echo -e "\n${YELLOW}[8/8] التحقق من الخدمات...${NC}"
sleep 5
docker ps --format "table {{.Names}}\t{{.Status}}"

echo -e "\n${BLUE}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ✅ النشر اكتمل بنجاح!                                 ║${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║  🌐 الموقع:    https://$DOMAIN             ║${NC}"
echo -e "${BLUE}║  👑 لوحة إدارة: https://admin.$DOMAIN      ║${NC}"
echo -e "${BLUE}║  📊 المراقبة:   https://$DOMAIN/grafana    ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}  كلمة مرور Grafana: ${GRAFANA_PASS}${NC}"
echo -e "${YELLOW}  احفظها في مكان آمن! ↑${NC}"
