import { db } from "./db";
import { sql } from "drizzle-orm";

export async function initDatabase() {
  console.log("Initializing database tables...");

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE user_step AS ENUM ('HOME', 'STEP_1', 'STEP_2', 'STEP_3', 'PAYMENT');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'cancelled', 'processing');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bot_users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tg_id TEXT NOT NULL UNIQUE,
      username TEXT,
      current_step user_step NOT NULL DEFAULT 'HOME',
      claimed_bonus BOOLEAN NOT NULL DEFAULT false,
      payment_amount INTEGER,
      payment_player_id TEXT,
      payment_sub_step TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tg_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      amount INTEGER NOT NULL,
      status payment_status NOT NULL DEFAULT 'pending',
      invoice_id TEXT,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS bot_config (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS manager_messages (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      tg_id TEXT NOT NULL,
      username TEXT,
      user_step TEXT,
      reason TEXT,
      message_text TEXT,
      resolved BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS message_replies (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id VARCHAR NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'web',
      created_at TIMESTAMP DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    );
  `);

  console.log("Database tables initialized successfully.");
}
