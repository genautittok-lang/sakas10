import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { startBot, notifyManagerPayment, sendMessageToUser } from "./bot";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  startBot();

  app.get("/api/users", async (_req, res) => {
    const users = await storage.getAllBotUsers();
    res.json(users);
  });

  app.get("/api/payments", async (_req, res) => {
    const payments = await storage.getAllPayments();
    res.json(payments);
  });

  app.patch("/api/payments/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!["pending", "paid", "cancelled", "processing"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const payment = await storage.updatePaymentStatus(id, status);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    if (status === "paid") {
      const user = await storage.getBotUser(payment.tgId);
      await sendMessageToUser(payment.tgId,
        `✅ Оплата підтверджена!\n\n💰 Сума: ${payment.amount} ₴\n🎮 Player ID: ${payment.playerId}`);
      await notifyManagerPayment(payment.tgId, user?.username || null, payment.amount, payment.playerId);
    } else if (status === "cancelled") {
      await sendMessageToUser(payment.tgId,
        `❌ Оплата скасована.\n\nВикористайте /start щоб повернутись на головну.`);
    }

    res.json(payment);
  });

  app.get("/api/messages", async (_req, res) => {
    const messages = await storage.getAllManagerMessages();
    res.json(messages);
  });

  app.patch("/api/messages/:id/resolve", async (req, res) => {
    const { id } = req.params;
    await storage.resolveManagerMessage(id);
    res.json({ success: true });
  });

  app.get("/api/config", async (_req, res) => {
    const config = await storage.getAllConfig();
    res.json(config);
  });

  app.post("/api/config", async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ message: "Key and value required" });
    }
    await storage.setConfig(key, value);
    res.json({ success: true });
  });

  app.get("/api/stats", async (_req, res) => {
    const users = await storage.getAllBotUsers();
    const payments = await storage.getAllPayments();
    const messages = await storage.getAllManagerMessages();

    const totalUsers = users.length;
    const stepCounts = {
      HOME: users.filter(u => u.currentStep === "HOME").length,
      STEP_1: users.filter(u => u.currentStep === "STEP_1").length,
      STEP_2: users.filter(u => u.currentStep === "STEP_2").length,
      STEP_3: users.filter(u => u.currentStep === "STEP_3").length,
      PAYMENT: users.filter(u => u.currentStep === "PAYMENT").length,
    };
    const bonusClaimed = users.filter(u => u.claimedBonus).length;
    const totalPayments = payments.length;
    const paidPayments = payments.filter(p => p.status === "paid");
    const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const pendingMessages = messages.filter(m => !m.resolved).length;

    res.json({
      totalUsers,
      stepCounts,
      bonusClaimed,
      totalPayments,
      paidCount: paidPayments.length,
      totalRevenue,
      pendingMessages,
    });
  });

  return httpServer;
}
