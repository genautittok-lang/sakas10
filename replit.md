# Telegram Bot Admin Panel

## Overview
Telegram bot with step-by-step user onboarding flow + admin dashboard for management.

## Architecture
- **Frontend**: React + Vite admin panel at port 5000 with sidebar navigation
- **Backend**: Express.js API + Telegram bot (node-telegram-bot-api with polling)
- **Database**: PostgreSQL via Drizzle ORM

## Bot Flow
Users go through: HOME → STEP_1 (install app) → STEP_2 (join club) → STEP_3 (bonus) → PAYMENT
- Each screen has "Manager 24/7" button
- Payment: choose amount → enter Player ID → get payment link → check status

## Key Files
- `shared/schema.ts` - Data models (botUsers, payments, botConfig, managerMessages)
- `server/bot.ts` - Telegram bot logic
- `server/routes.ts` - API endpoints
- `server/storage.ts` - Database CRUD operations
- `server/db.ts` - Database connection
- `client/src/pages/` - Admin panel pages (dashboard, users, payments, messages, config)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar

## Environment Variables Required
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `DATABASE_URL` - PostgreSQL connection (auto-configured)

## Bot Configuration (via Admin Panel → Settings)
- `manager_chat_id` - Telegram chat ID of manager
- `club_id` - Club ID shown in step 2
- `step1_video`, `step2_video` - Video URLs for steps
- `android_link`, `ios_link`, `windows_link` - App download links
- `payment_link_template` - Payment URL template with {amount}, {player_id}, {payment_id}
- Various text fields for bot messages

## API Endpoints
- GET /api/stats - Dashboard statistics
- GET /api/users - All bot users
- GET /api/payments - All payments
- PATCH /api/payments/:id/status - Update payment status
- GET /api/messages - Manager messages
- PATCH /api/messages/:id/resolve - Resolve message
- GET /api/config - Bot configuration
- POST /api/config - Save config value
