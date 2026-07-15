-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPER_ADMIN', 'ADMIN', 'AGENT', 'MERCHANT', 'MODERATOR');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('none', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('PENDING', 'ACTIVE', 'SOLD', 'EXPIRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('seeking', 'hiring');

-- CreateEnum
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "BetaInviteStatus" AS ENUM ('PENDING', 'ACTIVATED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CarrierMethod" AS ENUM ('SELF', 'P2P_AGENT', 'CARRIER', 'STORE_PICKUP', 'BRANCH_PICKUP');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'WAITING_PICKUP', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURN_REQUESTED', 'RETURNED', 'CANCELLED', 'LOST', 'DAMAGED');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('OFFLINE', 'ONLINE', 'AVAILABLE', 'BUSY', 'ON_BREAK', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "VerifyMethod" AS ENUM ('OTP', 'SIGNATURE', 'PHOTO', 'QR');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('COD_COLLECT', 'PAYOUT_MERCHANT', 'COMMISSION_PLAT', 'AGENT_DELIVERY_FEE', 'SETTLEMENT');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "bio" TEXT,
    "coverPhoto" TEXT,
    "is_verified" "VerificationStatus" DEFAULT 'none',
    "countryId" TEXT DEFAULT 'ye',
    "city" TEXT,
    "managedCountry" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'YER',
    "category_id" UUID NOT NULL,
    "sub_category_id" UUID,
    "jobType" "JobType",
    "city" TEXT NOT NULL,
    "district" TEXT,
    "status" "AdStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" UUID NOT NULL,
    "showOnMap" BOOLEAN NOT NULL DEFAULT true,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "views" INTEGER NOT NULL DEFAULT 0,
    "videoUrl" TEXT,
    "contactNumber" TEXT,

    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_images" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ad_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "width" INTEGER,
    "height" INTEGER,
    "blur_hash" TEXT,

    CONSTRAINT "ad_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "device_info" JSONB,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "text" TEXT NOT NULL,
    "ad_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ad_id" UUID NOT NULL,
    "participant_one" UUID NOT NULL,
    "participant_two" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "text" TEXT NOT NULL,
    "sender_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "icon" TEXT NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sub_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category_id" UUID NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "sub_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ad_id" UUID NOT NULL,
    "reporter_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "admin_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ip_address" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "security_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "ip_address" TEXT NOT NULL,
    "details" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tags" TEXT NOT NULL,
    "comment" TEXT,
    "rater_id" UUID NOT NULL,
    "rated_id" UUID NOT NULL,
    "ad_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "video_url" TEXT NOT NULL,
    "title" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_likes" (
    "ad_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_likes_pkey" PRIMARY KEY ("ad_id","user_id")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "aggregate" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "session_id" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rollout_pct" INTEGER NOT NULL DEFAULT 0,
    "allowed_users" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beta_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT,
    "phone" TEXT,
    "code" TEXT NOT NULL,
    "status" "BetaInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invited_by" TEXT,
    "activated_by" TEXT,
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beta_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyer_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "ad_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "total_price" DOUBLE PRECISION NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "carrier_method" "CarrierMethod" NOT NULL,
    "carrier_name" TEXT,
    "tracking_number" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "agent_id" UUID,
    "base_price" DOUBLE PRECISION NOT NULL,
    "distance_fee" DOUBLE PRECISION NOT NULL,
    "weight_fee" DOUBLE PRECISION NOT NULL,
    "volume_fee" DOUBLE PRECISION NOT NULL,
    "insurance_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cod_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remote_area_fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "cod_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "width" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "height" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "depth" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "pickup_lat" DOUBLE PRECISION,
    "pickup_lng" DOUBLE PRECISION,
    "delivery_lat" DOUBLE PRECISION,
    "delivery_lng" DOUBLE PRECISION,
    "estimated_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "vehicle_type" TEXT,
    "license_plate" TEXT,
    "status" "AgentStatus" NOT NULL DEFAULT 'OFFLINE',
    "current_lat" DOUBLE PRECISION,
    "current_lng" DOUBLE PRECISION,
    "wallet_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cod_balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "total_deliveries" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "description" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carrier_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "carrier_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "api_url" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "account_no" TEXT NOT NULL,
    "api_key" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carrier_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "method" "VerifyMethod" NOT NULL,
    "code" TEXT,
    "signature_url" TEXT,
    "photo_url" TEXT,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_ledger" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "agent_id" UUID,
    "seller_id" UUID NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "LedgerType" NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_zones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "country" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "district" TEXT,
    "base_price" DOUBLE PRECISION NOT NULL,
    "km_rate" DOUBLE PRECISION NOT NULL,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "votes" INTEGER[],
    "country_code" TEXT NOT NULL DEFAULT 'ALL',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "ads_user_id_idx" ON "ads"("user_id");

-- CreateIndex
CREATE INDEX "ads_status_created_at_idx" ON "ads"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ads_category_id_status_idx" ON "ads"("category_id", "status");

-- CreateIndex
CREATE INDEX "ads_city_status_idx" ON "ads"("city", "status");

-- CreateIndex
CREATE INDEX "ads_latitude_longitude_idx" ON "ads"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "ad_images_ad_id_sort_order_idx" ON "ad_images"("ad_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "comments_ad_id_idx" ON "comments"("ad_id");

-- CreateIndex
CREATE INDEX "conversations_participant_one_idx" ON "conversations"("participant_one");

-- CreateIndex
CREATE INDEX "conversations_participant_two_idx" ON "conversations"("participant_two");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_ad_id_participant_one_participant_two_key" ON "conversations"("ad_id", "participant_one", "participant_two");

-- CreateIndex
CREATE INDEX "messages_sender_id_receiver_id_idx" ON "messages"("sender_id", "receiver_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");

-- CreateIndex
CREATE INDEX "messages_timestamp_idx" ON "messages"("timestamp" ASC);

-- CreateIndex
CREATE INDEX "notifications_user_id_read_idx" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "ad_likes_user_id_idx" ON "ad_likes"("user_id");

-- CreateIndex
CREATE INDEX "ad_likes_ad_id_idx" ON "ad_likes"("ad_id");

-- CreateIndex
CREATE INDEX "outbox_events_status_created_at_idx" ON "outbox_events"("status", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_event_created_at_idx" ON "analytics_events"("event", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_userId_created_at_idx" ON "analytics_events"("userId", "created_at");

-- CreateIndex
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_key_key" ON "feature_flags"("key");

-- CreateIndex
CREATE UNIQUE INDEX "beta_invitations_code_key" ON "beta_invitations"("code");

-- CreateIndex
CREATE INDEX "beta_invitations_code_idx" ON "beta_invitations"("code");

-- CreateIndex
CREATE INDEX "beta_invitations_status_idx" ON "beta_invitations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_number_key" ON "shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_agents_user_id_key" ON "delivery_agents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "carrier_configurations_carrier_key_key" ON "carrier_configurations"("carrier_key");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_zones_country_city_district_key" ON "shipping_zones"("country", "city", "district");

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_sub_category_id_fkey" FOREIGN KEY ("sub_category_id") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ads" ADD CONSTRAINT "ads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_images" ADD CONSTRAINT "ad_images_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sub_categories" ADD CONSTRAINT "sub_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reels" ADD CONSTRAINT "reels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_likes" ADD CONSTRAINT "ad_likes_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_likes" ADD CONSTRAINT "ad_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_ad_id_fkey" FOREIGN KEY ("ad_id") REFERENCES "ads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "delivery_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_agents" ADD CONSTRAINT "delivery_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_verifications" ADD CONSTRAINT "delivery_verifications_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_ledger" ADD CONSTRAINT "shipping_ledger_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

