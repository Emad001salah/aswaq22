#!/bin/bash
# scripts/deploy-vps.sh
# Staging / Production Deployment Script for Aswaq on a single VPS (Ubuntu 22.04 / 24.04)

set -e

# Define Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Aswaq VPS Staging Deployment Pipeline${NC}"

# 1. Prompt for Domain and Email
read -p "Enter the domain name (e.g. beta.aswaq.com): " DOMAIN
read -p "Enter your email for Let's Encrypt SSL: " EMAIL
read -p "Enter a password for Grafana Admin Basic Auth: " GRAFANA_PASS

if [ -z "$DOMAIN" ] || [ -z "$EMAIL" ] || [ -z "$GRAFANA_PASS" ]; then
    echo -e "${RED}❌ Domain, Email, and Password are required! Exiting.${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Updating system and installing dependencies (Docker, Certbot, UFW, apache2-utils)...${NC}"
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release certbot apache2-utils ufw

# 2. Install Docker if not installed
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}🐳 Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo -e "${GREEN}✅ Docker is already installed.${NC}"
fi

# 3. Configure UFW Firewall
echo -e "${YELLOW}🛡️ Configuring Firewall (UFW)...${NC}"
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
echo "y" | sudo ufw enable
echo -e "${GREEN}✅ UFW configured and enabled.${NC}"

# 3.5. Prepare and secure .env configuration
echo -e "${YELLOW}🔑 Checking and securing .env configuration...${NC}"
if [ ! -f .env ]; then
    echo -e "${YELLOW}📝 Creating .env from .env.example...${NC}"
    cp .env.example .env
fi

generate_key_if_missing() {
    local KEY_NAME=$1
    # Check if key line exists
    if ! grep -q "^${KEY_NAME}=" .env; then
        local NEW_VAL=$(openssl rand -hex 32)
        echo "${KEY_NAME}=\"${NEW_VAL}\"" >> .env
        echo -e "${GREEN}✅ Generated new secure ${KEY_NAME}.${NC}"
        return
    fi
    
    local CURRENT_VAL=$(grep -E "^${KEY_NAME}=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
    if [ -z "$CURRENT_VAL" ] || [[ "$CURRENT_VAL" == *"your_meilisearch_master_key"* ]] || [[ "$CURRENT_VAL" == *"minimum-32-character"* ]] || [[ "$CURRENT_VAL" == *"your-secret-key"* ]] || [[ "$CURRENT_VAL" == *"another-random-string"* ]]; then
        local NEW_VAL=$(openssl rand -hex 32)
        sed -i "/^${KEY_NAME}=/d" .env
        echo "${KEY_NAME}=\"${NEW_VAL}\"" >> .env
        echo -e "${GREEN}✅ Replaced placeholder with secure ${KEY_NAME}.${NC}"
    else
        echo -e "${GREEN}✅ Using existing secure ${KEY_NAME}.${NC}"
    fi
}

generate_key_if_missing "JWT_SECRET"
generate_key_if_missing "PEPPER_SECRET"
generate_key_if_missing "MEILI_MASTER_KEY"

# Match MEILI_API_KEY to MEILI_MASTER_KEY
MEILI_MASTER_VAL=$(grep -E "^MEILI_MASTER_KEY=" .env | cut -d'=' -f2- | tr -d '"' | tr -d "'")
sed -i "/^MEILI_API_KEY=/d" .env
echo "MEILI_API_KEY=\"${MEILI_MASTER_VAL}\"" >> .env


# 4. Configure Basic Auth for Grafana
echo -e "${YELLOW}🔐 Setting up Basic Auth for Grafana...${NC}"
mkdir -p ./config/nginx
htpasswd -bc ./config/nginx/.htpasswd admin "$GRAFANA_PASS"

# 5. Replace domain in Nginx Config
echo -e "${YELLOW}⚙️ Configuring Nginx...${NC}"
sed -i "s/YOUR_DOMAIN/$DOMAIN/g" ./config/nginx/nginx.conf
sed -i "s/server_name _;/server_name $DOMAIN;/g" ./config/nginx/nginx.conf

# 6. Request SSL Certificate (Let's Encrypt)
echo -e "${YELLOW}🔒 Requesting SSL Certificate for $DOMAIN...${NC}"
# We use certbot in standalone mode. Note: ports 80/443 must be free.
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    # Stop anything on port 80 temporarily
    docker compose -f docker-compose.yml -f docker-compose.prod.yml down || true
    sudo certbot certonly --standalone -d $DOMAIN -d www.$DOMAIN -d api.$DOMAIN -d admin.$DOMAIN --email $EMAIL --agree-tos --non-interactive
else
    echo -e "${GREEN}✅ SSL Certificate already exists.${NC}"
fi

# Set domain env var for docker-compose substitution
export DOMAIN=$DOMAIN
export GRAFANA_PASSWORD=$GRAFANA_PASS

# 7. Start the Docker Services
echo -e "${YELLOW}🚀 Starting Aswaq services...${NC}"
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 8. Run Prisma Migrations & Seeds
echo -e "${YELLOW}🗄️ Running Database Migrations...${NC}"
docker exec aswaq_api npx prisma migrate deploy
docker exec aswaq_api npm run seed || true

echo -e "${GREEN}✅ Aswaq deployment completed successfully!${NC}"
echo -e "🌐 Website: https://$DOMAIN"
echo -e "📊 Grafana: https://$DOMAIN/grafana (User: admin / Pass: [YOUR_GRAFANA_PASS])"
echo -e "\nRun 'docker ps' to check running containers."
