import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { startBot, notifyManagerPayment, sendMessageToUser, sendBroadcastMessage } from "./bot";
import { initDatabase } from "./db-init";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import fs from "fs";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";

declare module "express-session" {
  interface SessionData {
    authenticated?: boolean;
    userId?: string;
    username?: string;
  }
}


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

async function seedDefaults() {
  const configs = await storage.getAllConfig();
  const existingKeys = new Set(configs.map((c: any) => c.key));

  const defaults: Record<string, string> = {
    club_id: "CLUB777",
    welcome_text: "\u{1F44B} \u0412\u0456\u0442\u0430\u0454\u043C\u043E \u0432 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u043C\u0443 \u043A\u043B\u0443\u0431\u0456 W Dealz !\n\n\u{1F525} \u0427\u043E\u043C\u0443 \u0443\u043A\u0440\u0430\u0457\u043D\u0446\u0456 \u043E\u0431\u0440\u0430\u043B\u0438 \u0441\u0430\u043C\u0435 \u043D\u0430\u0441:\n\u2705 \u0428\u0432\u0438\u0434\u043A\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044F \u0431\u0435\u0437 \u0432\u0435\u0440\u0438\u0444\u0456\u043A\u0430\u0446\u0456\u0457\n\u2705 \u0420\u0435\u0439\u043A\u0431\u0435\u043A \u0432\u0441\u0456\u043C \u0433\u0440\u0430\u0432\u0446\u044F\u043C\n\u2705 \u0414\u0436\u0435\u043A\u043F\u043E\u0442 \n\n\u{1F3C6} \u041B\u0406\u0414\u0415\u0420\u0411\u041E\u0420\u0414\u0418 \n\n\u{1F4B0} \u20B4 50 000 \u0422\u0423\u0420\u041D\u0406\u0420\u041D\u0418\u0419 \u0424\u041E\u041D\u0414 \u0429\u041E\u041C\u0406\u0421\u042F\u0426\u042F\n2-5+ \u0442\u0443\u0440\u043D\u0456\u0440\u0456\u0432 \u043D\u0430 \u0434\u0435\u043D\u044C\n\n\u{1F48E} \u041F\u041E\u0414\u0412\u041E\u042E\u0419 \u041F\u0415\u0420\u0428\u0418\u0419 \u0414\u0415\u041F\u041E\u0417\u0418\u0422!\n\u041C\u0438\u0442\u0442\u0454\u0432\u0435 \u043F\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F \u0432\u0456\u0434 \u20B4 500, \u0432\u0438\u0432\u0456\u0434 \u0434\u0432\u0430 \u0440\u0430\u0437\u0438 \u043D\u0430 \u0434\u043E\u0431\u0443",
    step2_text: "Крок 2: Вступ до клубу\n\nЗнайдіть клуб за ID та приєднайтесь.",
    bonus_text: "Крок 3: Бонус\n\nВітаємо! Ви можете отримати бонус за реєстрацію.",
    payment_amounts: "100, 200, 500, 1000, 2000, 5000",
    club_join_link: "https://example.com/club",
    rules_link: "",
    social_links: "[]",
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (!existingKeys.has(key)) {
      await storage.setConfig(key, value);
    }
  }

  if (!existingKeys.has("social_links") || configs.find((c: any) => c.key === "social_links")?.value === "[]") {
    const oldKeys = [
      { configKey: "telegram_group_link", name: "Telegram група" },
      { configKey: "telegram_channel_link", name: "Telegram канал" },
      { configKey: "instagram_link", name: "Instagram" },
      { configKey: "website_link", name: "Сайт" },
    ];
    const migrated: { name: string; url: string }[] = [];
    for (const { configKey, name } of oldKeys) {
      const entry = configs.find((c: any) => c.key === configKey);
      if (entry?.value) migrated.push({ name, url: entry.value });
    }
    if (migrated.length > 0) {
      await storage.setConfig("social_links", JSON.stringify(migrated));
    }
  }

  const adminUser = await storage.getUserByUsername("admin");
  if (!adminUser) {
    const hashedPassword = bcrypt.hashSync("admin123", 10);
    await storage.createUser({ username: "admin", password: hashedPassword });
    console.log("Default admin user created (admin / admin123)");
  }
  console.log(`Total admin user(s): ${await storage.countUsers()}`);
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const publicPaths = [
    "/api/auth/login",
    "/api/auth/status",
    "/api/payments/webhook",
    "/api/stats",
  ];
  if (publicPaths.some(p => req.path === p)) {
    return next();
  }
  if (req.path.startsWith("/api/") && !req.session?.authenticated) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.set("trust proxy", 1);

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "fallback-secret-change-me",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1000,
      },
    })
  );

  app.use(requireAuth);

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.webm': 'video/webm',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
      };
      if (mimeTypes[ext]) {
        res.setHeader('Content-Type', mimeTypes[ext]);
      }
    },
  }));

  await initDatabase();
  startBot();
  try {
    await seedDefaults();
  } catch (e) {
    console.error("Seed defaults error:", e);
  }

  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.authenticated = true;
    req.session.userId = user.id;
    req.session.username = user.username;
    return res.json({ success: true, username: user.username });
  });

  app.get("/api/auth/status", (req, res) => {
    res.json({ authenticated: !!req.session?.authenticated });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/admins", async (_req, res) => {
    const allUsers = await storage.getAllUsers();
    const safe = allUsers.map(u => ({ id: u.id, username: u.username }));
    res.json(safe);
  });

  app.post("/api/admins", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    const currentCount = await storage.countUsers();
    if (currentCount >= 3) {
      return res.status(400).json({ message: "Maximum 3 admins allowed" });
    }
    const existing = await storage.getUserByUsername(username);
    if (existing) {
      return res.status(400).json({ message: "Username already exists" });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = await storage.createUser({ username, password: hashedPassword });
    res.json({ id: user.id, username: user.username });
  });

  app.delete("/api/admins/:id", async (req, res) => {
    const { id } = req.params;
    const currentCount = await storage.countUsers();
    if (currentCount <= 1) {
      return res.status(400).json({ message: "Cannot delete last admin" });
    }
    await storage.deleteUser(id);
    res.json({ success: true });
  });

  app.patch("/api/admins/:id/password", async (req, res) => {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ message: "Password required" });
    }
    const hashedPassword = bcrypt.hashSync(password, 10);
    await storage.updateUserPassword(req.params.id, hashedPassword);
    res.json({ success: true });
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    
    const mimetype = req.file.mimetype;
    const ext = path.extname(req.file.filename).toLowerCase();
    const needsConversion = mimetype === "video/quicktime" || ext === ".mov";
    
    if (needsConversion) {
      const inputPath = path.join(uploadsDir, req.file.filename);
      const mp4Filename = req.file.filename.replace(/\.[^.]+$/, ".mp4");
      const outputPath = path.join(uploadsDir, mp4Filename);
      
      try {
        const { exec } = require("child_process");
        await new Promise<void>((resolve, reject) => {
          const proc = exec(
            `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart "${outputPath}"`,
            { timeout: 120000 },
            (error: any) => {
              if (error) reject(error);
              else resolve();
            }
          );
        });
        fs.unlinkSync(inputPath);
        const url = `/uploads/${mp4Filename}`;
        return res.json({ url });
      } catch (err) {
        console.error("FFmpeg conversion failed:", err);
        const url = `/uploads/${req.file.filename}`;
        return res.json({ url });
      }
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

    const now = new Date();
    const dateStr = now.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    if (status === "paid") {
      const user = await storage.getBotUser(payment.tgId);
      await sendMessageToUser(payment.tgId,
        `✅ Оплата підтверджена!\n\n💰 Сума: ${payment.amount} ₴\n🎮 Player ID: ${payment.playerId}\n📅 Дата: ${dateStr}`);
      await notifyManagerPayment(payment.tgId, user?.username || null, payment.amount, payment.playerId, dateStr);
    } else if (status === "cancelled") {
      await sendMessageToUser(payment.tgId,
        `❌ Оплата не пройшла / скасована.\n\nЯкщо це помилка — спробуйте ще раз або зверніться до підтримки.`);
    } else if (status === "processing") {
      await sendMessageToUser(payment.tgId,
        `⏳ Ваш платіж знаходиться в обробці.\n\nБудь ласка, зачекайте кілька хвилин і перевірте статус ще раз.`);
    }

    res.json(payment);
  });

  app.post("/api/payments/webhook", async (req, res) => {
    try {
      console.log("[webhook] Incoming request body:", JSON.stringify(req.body));
      console.log("[webhook] Headers:", JSON.stringify({ secret: req.get("X-Webhook-Secret"), query: req.query.secret }));

      const secretFromHeader = req.get("X-Webhook-Secret");
      const secretFromQuery = req.query.secret as string | undefined;
      const providedSecret = secretFromHeader || secretFromQuery;

      if (!providedSecret) {
        console.log("[webhook] Rejected: no secret provided");
        return res.status(403).json({ message: "Webhook secret required" });
      }

      const configuredSecret = await storage.getConfig("convert2pay_secret_key");
      if (!configuredSecret || providedSecret !== configuredSecret) {
        console.log("[webhook] Rejected: invalid secret");
        return res.status(403).json({ message: "Invalid webhook secret" });
      }

      const { payment_id, invoice_id, status: webhookStatus } = req.body;
      console.log(`[webhook] payment_id=${payment_id} invoice_id=${invoice_id} status=${webhookStatus}`);

      let payment = null;
      if (payment_id) {
        payment = await storage.getPayment(payment_id);
      }
      if (!payment && invoice_id) {
        payment = await storage.getPaymentByInvoice(invoice_id);
      }

      if (!payment) {
        console.log(`[webhook] Payment not found for payment_id=${payment_id} invoice_id=${invoice_id}`);
        return res.status(404).json({ message: "Payment not found" });
      }
      console.log(`[webhook] Found payment id=${payment.id} current_status=${payment.status}`);

      let newStatus = "pending";
      if (webhookStatus === "success" || webhookStatus === "paid" || webhookStatus === "completed") {
        newStatus = "paid";
      } else if (webhookStatus === "failed" || webhookStatus === "cancelled" || webhookStatus === "rejected") {
        newStatus = "cancelled";
      } else if (webhookStatus === "processing" || webhookStatus === "pending") {
        newStatus = "processing";
      }

      console.log(`[webhook] Updating payment ${payment.id} to status: ${newStatus}`);
      const updated = await storage.updatePaymentStatus(payment.id, newStatus);
      console.log(`[webhook] Update result: ${updated ? "success" : "failed"}`);

      const webhookNow = new Date();
      const webhookDateStr = webhookNow.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      if (newStatus === "paid" && updated) {
        const user = await storage.getBotUser(updated.tgId);
        await sendMessageToUser(updated.tgId,
          `✅ Оплата підтверджена!\n\n💰 Сума: ${updated.amount} ₴\n🎮 Player ID: ${updated.playerId}\n📅 Дата: ${webhookDateStr}`);
        await notifyManagerPayment(updated.tgId, user?.username || null, updated.amount, updated.playerId, webhookDateStr);
        console.log(`[webhook] Notifications sent for paid payment ${updated.id} tgId=${updated.tgId}`);
      } else if (newStatus === "cancelled" && updated) {
        await sendMessageToUser(updated.tgId,
          `❌ Оплата не пройшла / скасована.\n\nЯкщо це помилка — спробуйте ще раз або зверніться до підтримки.`);
        console.log(`[webhook] Cancellation notification sent for payment ${updated.id} tgId=${updated.tgId}`);
      } else if (newStatus === "processing" && updated) {
        await sendMessageToUser(updated.tgId,
          `⏳ Ваш платіж знаходиться в обробці.\n\nБудь ласка, зачекайте кілька хвилин і перевірте статус ще раз.`);
        console.log(`[webhook] Processing notification sent for payment ${updated.id} tgId=${updated.tgId}`);
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

  app.get("/api/messages/:id", async (req, res) => {
    const { id } = req.params;
    const message = await storage.getManagerMessage(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    const replies = await storage.getMessageReplies(id);
    res.json({ ...message, replies });
  });

  app.patch("/api/messages/:id/resolve", async (req, res) => {
    const { id } = req.params;
    await storage.resolveManagerMessage(id);
    res.json({ success: true });
  });

  app.post("/api/messages/:id/reply", async (req, res) => {
    const { id } = req.params;
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text is required" });
    }
    const message = await storage.getManagerMessage(id);
    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }
    const reply = await storage.createMessageReply({
      messageId: id,
      text: text.trim(),
      source: "web",
    });
    await sendMessageToUser(message.tgId, `\u{1F4AC} \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u0430:\n\n${text.trim()}`);
    res.json(reply);
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

  app.get("/pay/:paymentId", async (req, res) => {
    const { paymentId } = req.params;
    const payment = await storage.getPayment(paymentId);
    if (!payment) {
      return res.status(404).send("<h3>Payment not found</h3>");
    }

    const convert2payUrl = await storage.getConfig("convert2pay_api_url");
    if (!convert2payUrl) {
      return res.status(500).send("<h3>Payment system not configured</h3>");
    }

    try {
      const getResp = await fetch(convert2payUrl);
      const html = await getResp.text();

      const cookies = getResp.headers.getSetCookie?.() || [];
      const cookieHeader = cookies.map((c: string) => c.split(';')[0]).join('; ');

      const viewStateMatch = html.match(/name="__VIEWSTATE"[^>]*value="([^"]*)"/);
      const viewStateGenMatch = html.match(/name="__VIEWSTATEGENERATOR"[^>]*value="([^"]*)"/);
      const eventValidationMatch = html.match(/name="__EVENTVALIDATION"[^>]*value="([^"]*)"/);

      if (!viewStateMatch || !eventValidationMatch) {
        console.log("[pay] Could not extract ASP.NET tokens from Convert2pay page");
        return res.redirect(convert2payUrl);
      }

      const formData = new URLSearchParams();
      formData.append("__VIEWSTATE", viewStateMatch[1]);
      if (viewStateGenMatch) formData.append("__VIEWSTATEGENERATOR", viewStateGenMatch[1]);
      formData.append("__EVENTVALIDATION", eventValidationMatch[1]);
      formData.append("Order_ID", paymentId);
      formData.append("Client_Id", payment.playerId || '');
      formData.append("Amount", String(payment.amount));
      formData.append("Click", "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C");

      const postHeaders: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
      };
      if (cookieHeader) {
        postHeaders["Cookie"] = cookieHeader;
      }

      const postResp = await fetch(convert2payUrl, {
        method: "POST",
        headers: postHeaders,
        body: formData.toString(),
        redirect: "manual",
      });
      const resultHtml = await postResp.text();

      const invoiceMatch = resultHtml.match(/id="InvoiceHref"[^>]*>(https?:\/\/[^<]+)</);
      if (invoiceMatch) {
        console.log(`[pay] Payment ${paymentId} -> ${invoiceMatch[1]}`);
        return res.redirect(invoiceMatch[1]);
      }

      const linkMatch = resultHtml.match(/href="(https?:\/\/[^"]*(?:pay|invoice|checkout)[^"]*)"/i);
      if (linkMatch) {
        console.log(`[pay] Payment ${paymentId} -> ${linkMatch[1]}`);
        return res.redirect(linkMatch[1]);
      }

      console.log("[pay] Could not find payment link in Convert2pay response, falling back to landing");
      return res.redirect(convert2payUrl);
    } catch (err) {
      console.log(`[pay] Error processing Convert2pay: ${err}`);
      return res.redirect(convert2payUrl);
    }
  });

  app.post("/api/broadcast", async (req, res) => {
    const { text, photoUrl, buttons } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Text is required" });
    }

    const allUsers = await storage.getAllBotUsers();
    let sent = 0;
    let failed = 0;

    for (const u of allUsers) {
      try {
        const chatId = parseInt(u.tgId);
        if (photoUrl) {
          await sendBroadcastMessage(chatId, text.trim(), photoUrl, buttons);
        } else {
          await sendBroadcastMessage(chatId, text.trim(), null, buttons);
        }
        sent++;
      } catch (err) {
        failed++;
      }
    }

    res.json({ sent, failed, total: allUsers.length });
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
