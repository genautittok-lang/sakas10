import { eq, desc } from "drizzle-orm";
import { db } from "./db";
import {
  botUsers, payments, botConfig, managerMessages,
  type BotUser, type InsertBotUser,
  type Payment, type InsertPayment,
  type BotConfig, type InsertBotConfig,
  type ManagerMessage, type InsertManagerMessage,
} from "@shared/schema";

export interface IStorage {
  getBotUser(tgId: string): Promise<BotUser | undefined>;
  createBotUser(user: InsertBotUser): Promise<BotUser>;
  updateBotUser(tgId: string, data: Partial<InsertBotUser>): Promise<BotUser | undefined>;
  getAllBotUsers(): Promise<BotUser[]>;

  createPayment(payment: InsertPayment): Promise<Payment>;
  getPayment(id: string): Promise<Payment | undefined>;
  getPaymentByInvoice(invoiceId: string): Promise<Payment | undefined>;
  updatePaymentStatus(id: string, status: string): Promise<Payment | undefined>;
  getAllPayments(): Promise<Payment[]>;
  getPaymentsByTgId(tgId: string): Promise<Payment[]>;

  getConfig(key: string): Promise<string | undefined>;
  setConfig(key: string, value: string): Promise<void>;
  getAllConfig(): Promise<BotConfig[]>;

  createManagerMessage(msg: InsertManagerMessage): Promise<ManagerMessage>;
  getAllManagerMessages(): Promise<ManagerMessage[]>;
  resolveManagerMessage(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getBotUser(tgId: string): Promise<BotUser | undefined> {
    const [user] = await db.select().from(botUsers).where(eq(botUsers.tgId, tgId));
    return user;
  }

  async createBotUser(user: InsertBotUser): Promise<BotUser> {
    const [created] = await db.insert(botUsers).values(user).returning();
    return created;
  }

  async updateBotUser(tgId: string, data: Partial<InsertBotUser>): Promise<BotUser | undefined> {
    const [updated] = await db.update(botUsers).set(data).where(eq(botUsers.tgId, tgId)).returning();
    return updated;
  }

  async getAllBotUsers(): Promise<BotUser[]> {
    return db.select().from(botUsers).orderBy(desc(botUsers.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [created] = await db.insert(payments).values(payment).returning();
    return created;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentByInvoice(invoiceId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.invoiceId, invoiceId));
    return payment;
  }

  async updatePaymentStatus(id: string, status: string): Promise<Payment | undefined> {
    const [updated] = await db.update(payments).set({ status: status as any }).where(eq(payments.id, id)).returning();
    return updated;
  }

  async getAllPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async getPaymentsByTgId(tgId: string): Promise<Payment[]> {
    return db.select().from(payments).where(eq(payments.tgId, tgId)).orderBy(desc(payments.createdAt));
  }

  async getConfig(key: string): Promise<string | undefined> {
    const [config] = await db.select().from(botConfig).where(eq(botConfig.key, key));
    return config?.value;
  }

  async setConfig(key: string, value: string): Promise<void> {
    const existing = await this.getConfig(key);
    if (existing !== undefined) {
      await db.update(botConfig).set({ value }).where(eq(botConfig.key, key));
    } else {
      await db.insert(botConfig).values({ key, value });
    }
  }

  async getAllConfig(): Promise<BotConfig[]> {
    return db.select().from(botConfig);
  }

  async createManagerMessage(msg: InsertManagerMessage): Promise<ManagerMessage> {
    const [created] = await db.insert(managerMessages).values(msg).returning();
    return created;
  }

  async getAllManagerMessages(): Promise<ManagerMessage[]> {
    return db.select().from(managerMessages).orderBy(desc(managerMessages.createdAt));
  }

  async resolveManagerMessage(id: string): Promise<void> {
    await db.update(managerMessages).set({ resolved: true }).where(eq(managerMessages.id, id));
  }
}

export const storage = new DatabaseStorage();
