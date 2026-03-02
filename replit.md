# Telegram Bot Admin Panel

## Overview
Telegram bot with step-by-step user onboarding flow + admin dashboard for management.
Payment integration with Convert2pay. File upload support for videos.

## Architecture
- **Frontend**: React + Vite admin panel at port 5000 with sidebar navigation
- **Backend**: Express.js API + Telegram bot (node-telegram-bot-api with polling)
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Multi-admin with bcryptjs password hashing (max 3 admins)
- **Uploads**: Stored in `/uploads/` directory, served via Express static route

## Bot Flow
Users go through: HOME (welcome + social links + platform selection) -> STEP_2 (join club) -> STEP_3 (bonus) -> PAYMENT
- /start shows welcome text, social link buttons, then image with platform buttons + "Вступити в клуб" + "Правила"
- Each platform button sends installation video + download link
- "Я встановив додаток" button advances to STEP_2
- Each screen has "Manager 24/7" persistent keyboard button
- Steps are strictly sequential - user cannot skip steps
- Payment: choose amount -> enter Player ID -> get payment link -> check status
- Convert2pay integration for payment processing

## Key Files
- `shared/schema.ts` - Data models (botUsers, payments, botConfig, managerMessages, messageReplies, users)
- `server/bot.ts` - Telegram bot logic with Convert2pay integration + manager reply handling + broadcast
- `server/routes.ts` - API endpoints including file upload, payment webhooks, admin management, broadcast
- `server/storage.ts` - Database CRUD operations (including admin user management)
- `server/db.ts` - Database connection
- `client/src/pages/` - Admin panel pages (dashboard, users, payments, messages, config, steps, broadcast)
- `client/src/components/app-sidebar.tsx` - Navigation sidebar with notification badges

## Admin Pages
- `/` - Dashboard with statistics
- `/users` - Bot users management
- `/payments` - Payment management
- `/messages` - Manager messages
- `/config` - Bot configuration (links, payment settings, social media links)
- `/steps` - Step content management (text + video for each step)
- `/broadcast` - Broadcast messages to all users (text + photo + buttons)

## Environment Variables Required
- `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
- `DATABASE_URL` - PostgreSQL connection (auto-configured)
- `PUBLIC_BASE_URL` - Public URL for production deployment (for video file serving)

## Admin Authentication
- Username/password authentication with bcrypt hashing
- Default admin: username `admin`, password `admin123`
- Support up to 3 admin accounts
- Manage admins via Settings page -> Адміністратори section

## Bot Configuration (via Admin Panel)
### Settings page:
- Moderators section: up to 3 Telegram moderator chat IDs (stored comma-separated in `manager_chat_id`)
- All moderators receive notifications (messages, payments) and have access to Telegram admin commands
- `club_id` - Club ID shown in step 2
- `rules_text` - Rules text shown when user clicks "Правила"
- `rules_link` - URL for "Правила бота" button
- `club_join_link` - URL for "Вступити в клуб" button
- Social links: `telegram_channel_link`, `telegram_group_link`, `instagram_link`, `website_link`
- App download links: `android_link`, `ios_link`, `windows_link`
- Payment settings: `payment_amounts`, `convert2pay_api_url`, `convert2pay_merchant_id`, `convert2pay_secret_key`, `convert2pay_currency`

### Steps page:
- `welcome_text`, `welcome_image` - Welcome screen content
- `android_video`, `ios_video`, `windows_video` - Platform installation videos
- `step2_text`, `step2_video` - Club join step content
- `bonus_text` - Bonus step content

## API Endpoints
- GET /api/stats - Dashboard statistics
- POST /api/auth/login - Login (username + password)
- GET /api/auth/status - Auth status
- POST /api/auth/logout - Logout
- GET /api/users - All bot users
- GET /api/payments - All payments
- PATCH /api/payments/:id/status - Update payment status
- POST /api/payments/webhook - Convert2pay webhook
- GET /api/messages - Manager messages
- GET /api/messages/:id - Message detail with replies
- PATCH /api/messages/:id/resolve - Resolve message
- POST /api/messages/:id/reply - Reply to message
- GET /api/config - Bot configuration
- POST /api/config - Save config value
- POST /api/upload - File upload (videos/images, max 50MB)
- GET /api/admins - List admin users
- POST /api/admins - Create admin user (max 3)
- DELETE /api/admins/:id - Delete admin user
- PATCH /api/admins/:id/password - Change admin password
- POST /api/broadcast - Send broadcast (text + photo + buttons)

## Broadcast Features
- Web admin: text + photo upload + up to 3 inline buttons with URLs
- Telegram admin: text or photo with caption via /admin -> Розсилка

## Telegram Admin Panel (for Manager)
Manager (set via `manager_chat_id` in Settings) has admin commands in Telegram:
- `/admin` - Admin menu (stats, users, payments, broadcast)
- `/stats` - Quick statistics
- Confirm pending payments directly from Telegram
- Broadcast messages (text or photo) to all users
- Reply to user messages from Telegram notifications

## Production Build & Railway Deployment
- `npm run build` - Builds client (Vite) and server (esbuild) into `dist/`
- `npm run start` - Runs production server from `dist/index.cjs`
- `railway.toml` - Railway deployment config (nixpacks builder, healthcheck on /api/stats)
- Sessions stored in PostgreSQL via `connect-pg-simple` (table: `user_sessions`, auto-created)
- `trust proxy` enabled for correct cookie handling behind Railway's proxy

### Required Environment Variables for Railway
1. `DATABASE_URL` - PostgreSQL connection string (Railway Postgres addon)
2. `TELEGRAM_BOT_TOKEN` - Bot token from @BotFather
3. `PUBLIC_BASE_URL` - Your Railway deployment URL (e.g., https://your-app.up.railway.app)
4. `PORT` - Auto-set by Railway
5. `SESSION_SECRET` - Secret for signing session cookies (recommended for production)

## Recent Changes (2026-02-22)
- Added "Вступити в клуб" button with configurable link in bot welcome
- Added "Правила" button with separate rules message + "Правила бота" link button
- Added social media links (Telegram channel/group, Instagram, website) to welcome message
- Created Steps management page for editing step text + video content
- Replaced single password auth with multi-admin username/password system (bcryptjs)
- Added web admin broadcast page with text + photo + inline buttons support
- Enhanced Telegram admin broadcast to support photos
- Reorganized admin panel: separate pages for Steps, Broadcast, Config

## Previous Changes (2026-02-18)
- Merged HOME + STEP_1 into unified welcome screen with platform-specific videos
- /start now shows welcome text, then image with 3 platform buttons (Android/iOS/Windows)
- Each platform button sends installation video + download link
- Admin panel config updated: welcome_image, android_video, ios_video, windows_video fields

## Previous Changes (2026-02-17)
- Added Telegram admin panel for manager (/admin, /stats, payment confirmation, broadcast)
- Fixed Step 1 flow: video shown first, then download links as separate message
- Added messageReplies table for two-way messaging (web panel + Telegram)
- Fixed all bot strings to proper Ukrainian (removed English "Home" buttons)
- Added node-telegram-bot-api to production build allowlist
- UI redesign: improved dashboard with auto-refresh, search filters on users/payments, collapsible config sections
- Added railway.toml for Railway deployment
