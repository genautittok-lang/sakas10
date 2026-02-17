# Telegram Bot Admin Panel

## Overview
Telegram bot with step-by-step user onboarding flow + admin dashboard for management.
Payment integration with Convert2pay. File upload support for videos.

## Architecture
- **Frontend**: React + Vite admin panel at port 5000 with sidebar navigation
- **Backend**: Express.js API + Telegram bot (node-telegram-bot-api with polling)
- **Database**: PostgreSQL via Drizzle ORM
- **Uploads**: Stored in `/uploads/` directory, served via Express static route

## Bot Flow
Users go through: HOME -> STEP_1 (install app) -> STEP_2 (join club) -> STEP_3 (bonus) -> PAYMENT
- Each screen has "Manager 24/7" button (including payment sub-steps)
- Steps are strictly sequential - user cannot skip steps
- Payment: choose amount -> enter Player ID -> get payment link -> check status
- Convert2pay integration for payment processing

## Key Files
- `shared/schema.ts` - Data models (botUsers, payments, botConfig, managerMessages)
- `server/bot.ts` - Telegram bot logic with Convert2pay integration
- `server/routes.ts` - API endpoints including file upload and payment webhooks
- `server/storage.ts` - Database CRUD operations
- `server/db.ts` - Database connection
- `client/src/pages/` - Admin panel pages (dashboard, users, payments, messages, config)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with notification badges

## Environment Variables Required
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `DATABASE_URL` - PostgreSQL connection (auto-configured)
- `PUBLIC_BASE_URL` - Public URL for production deployment (for video file serving)

## Bot Configuration (via Admin Panel -> Settings)
- `manager_chat_id` - Telegram chat ID of manager
- `club_id` - Club ID shown in step 2
- `step1_video`, `step2_video` - Video URLs or uploaded files for steps
- `android_link`, `ios_link`, `windows_link` - App download links
- `payment_amounts` - Comma-separated fixed amounts for payment buttons (default: 100, 200, 500, 1000, 2000, 5000)
- `convert2pay_api_url` - Convert2pay API endpoint
- `convert2pay_merchant_id` - Merchant ID
- `convert2pay_secret_key` - Secret key (also used for webhook verification)
- `convert2pay_currency` - Currency code (default UAH)
- Various text fields for bot messages (welcome_text, step1_text, step2_text, bonus_text, rules_text)

## API Endpoints
- GET /api/stats - Dashboard statistics
- GET /api/users - All bot users
- GET /api/payments - All payments
- PATCH /api/payments/:id/status - Update payment status
- POST /api/payments/webhook - Convert2pay webhook (requires X-Webhook-Secret header)
- GET /api/messages - Manager messages
- PATCH /api/messages/:id/resolve - Resolve message
- GET /api/config - Bot configuration
- POST /api/config - Save config value
- POST /api/upload - File upload (videos/images, max 50MB)

## Seed Data
On first run, creates demo users, payments, messages, and default config values for testing.
