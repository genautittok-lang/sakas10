import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { startBot, notifyManagerPayment, sendMessageToUser } from "./bot";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import express from "express";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `${Date.now()}_${randomUUID().slice(0, 8)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage: multerStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = [
      "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mpeg",
      "image/jpeg", "image/png", "image/gif", "image/webp",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type"));
    }
  },
});

async function seedData() {
  const userCount = await storage.countBotUsers();
  if (userCount > 0) return;

  await storage.createBotUser({ tgId: "100001", username: "demo_user1", currentStep: "HOME" });
  await storage.createBotUser({ tgId: "100002", username: "demo_user2", currentStep: "STEP_1" });
  await storage.createBotUser({ tgId: "100003", username: "demo_user3", currentStep: "STEP_2", claimedBonus: false });
  await storage.createBotUser({ tgId: "100004", username: "demo_user4", currentStep: "PAYMENT", claimedBonus: true });

  await storage.createPayment({ tgId: "100002", playerId: "PLAYER001", amount: 500, status: "pending", invoiceId: "inv_demo_1" });
  await storage.createPayment({ tgId: "100003", playerId: "PLAYER002", amount: 1000, status: "paid", invoiceId: "inv_demo_2" });
  await storage.createPayment({ tgId: "100004", playerId: "PLAYER003", amount: 200, status: "cancelled", invoiceId: "inv_demo_3" });

  await storage.createManagerMessage({ tgId: "100002", username: "demo_user2", userStep: "STEP_1", reason: "Потрібна допомога з встановленням" });
  await storage.createManagerMessage({ tgId: "100003", username: "demo_user3", userStep: "STEP_2", reason: "Не знайшов клуб" });

  await storage.setConfig("club_id", "CLUB777");
  await storage.setConfig("welcome_text", "Ласкаво просимо до нашого клубу! Оберіть дію:");
  await storage.setConfig("step1_text", "Крок 1: Встановіть додаток\n\nОберіть вашу платформу та встановіть додаток:");
  await storage.setConfig("step2_text", "Крок 2: Вступ до клубу\n\nЗнайдіть клуб за ID та приєднайтесь.");
  await storage.setConfig("bonus_text", "Крок 3: Бонус\n\nВітаємо! Ви можете отримати бонус за реєстрацію.");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  startBot();
  await seedData();

  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });

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
        `\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u0430!\n\n\u{1F4B0} \u0421\u0443\u043C\u0430: ${payment.amount} \u20B4\n\u{1F3AE} Player ID: ${payment.playerId}`);
      await notifyManagerPayment(payment.tgId, user?.username || null, payment.amount, payment.playerId);
    } else if (status === "cancelled") {
      await sendMessageToUser(payment.tgId,
        `\u274C \u041E\u043F\u043B\u0430\u0442\u0430 \u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u0430.\n\n\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u0439\u0442\u0435 /start \u0449\u043E\u0431 \u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438\u0441\u044C \u043D\u0430 \u0433\u043E\u043B\u043E\u0432\u043D\u0443.`);
    }

    res.json(payment);
  });

  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const secretFromHeader = req.get("X-Webhook-Secret");
      const secretFromQuery = req.query.secret as string | undefined;
      const providedSecret = secretFromHeader || secretFromQuery;

      if (!providedSecret) {
        return res.status(403).json({ message: "Webhook secret required" });
      }

      const configuredSecret = await storage.getConfig("convert2pay_secret_key");
      if (!configuredSecret || providedSecret !== configuredSecret) {
        return res.status(403).json({ message: "Invalid webhook secret" });
      }

      const { payment_id, invoice_id, status: webhookStatus } = req.body;

      let payment = null;
      if (payment_id) {
        payment = await storage.getPayment(payment_id);
      } else if (invoice_id) {
        payment = await storage.getPaymentByInvoice(invoice_id);
      }

      if (!payment) {
        return res.status(404).json({ message: "Payment not found" });
      }

      let newStatus = "pending";
      if (webhookStatus === "success" || webhookStatus === "paid" || webhookStatus === "completed") {
        newStatus = "paid";
      } else if (webhookStatus === "failed" || webhookStatus === "cancelled" || webhookStatus === "rejected") {
        newStatus = "cancelled";
      } else if (webhookStatus === "processing" || webhookStatus === "pending") {
        newStatus = "processing";
      }

      const updated = await storage.updatePaymentStatus(payment.id, newStatus);

      if (newStatus === "paid" && updated) {
        const user = await storage.getBotUser(updated.tgId);
        await sendMessageToUser(updated.tgId,
          `\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u0430!\n\n\u{1F4B0} \u0421\u0443\u043C\u0430: ${updated.amount} \u20B4\n\u{1F3AE} Player ID: ${updated.playerId}`);
        await notifyManagerPayment(updated.tgId, user?.username || null, updated.amount, updated.playerId);
      } else if (newStatus === "cancelled" && updated) {
        await sendMessageToUser(updated.tgId,
          `\u274C \u041E\u043F\u043B\u0430\u0442\u0430 \u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u0430.\n\n\u0412\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u0439\u0442\u0435 /start \u0449\u043E\u0431 \u043F\u043E\u0432\u0435\u0440\u043D\u0443\u0442\u0438\u0441\u044C \u043D\u0430 \u0433\u043E\u043B\u043E\u0432\u043D\u0443.`);
      }

      res.json({ success: true });
    } catch (err) {
      console.error("Webhook error:", err);
      res.status(500).json({ message: "Webhook processing error" });
    }
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
    const pendingMessages = await storage.countPendingMessages();
    const pendingPayments = await storage.countPendingPayments();

    res.json({
      totalUsers,
      stepCounts,
      bonusClaimed,
      totalPayments,
      paidCount: paidPayments.length,
      totalRevenue,
      pendingMessages,
      pendingPayments,
    });
  });

  return httpServer;
}
