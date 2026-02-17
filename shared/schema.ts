import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userStepEnum = pgEnum("user_step", ["HOME", "STEP_1", "STEP_2", "STEP_3", "PAYMENT"]);
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "cancelled", "processing"]);

export const botUsers = pgTable("bot_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tgId: text("tg_id").notNull().unique(),
  username: text("username"),
  currentStep: userStepEnum("current_step").notNull().default("HOME"),
  claimedBonus: boolean("claimed_bonus").notNull().default(false),
  paymentAmount: integer("payment_amount"),
  paymentPlayerId: text("payment_player_id"),
  paymentSubStep: text("payment_sub_step"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tgId: text("tg_id").notNull(),
  playerId: text("player_id").notNull(),
  amount: integer("amount").notNull(),
  status: paymentStatusEnum("status").notNull().default("pending"),
  invoiceId: text("invoice_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const botConfig = pgTable("bot_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
});

export const managerMessages = pgTable("manager_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tgId: text("tg_id").notNull(),
  username: text("username"),
  userStep: text("user_step"),
  reason: text("reason"),
  resolved: boolean("resolved").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertBotUserSchema = createInsertSchema(botUsers).omit({ id: true, createdAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true });
export const insertBotConfigSchema = createInsertSchema(botConfig).omit({ id: true });
export const insertManagerMessageSchema = createInsertSchema(managerMessages).omit({ id: true, createdAt: true });

export type InsertBotUser = z.infer<typeof insertBotUserSchema>;
export type BotUser = typeof botUsers.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof payments.$inferSelect;
export type BotConfig = typeof botConfig.$inferSelect;
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;
export type ManagerMessage = typeof managerMessages.$inferSelect;
export type InsertManagerMessage = z.infer<typeof insertManagerMessageSchema>;

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
