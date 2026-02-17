import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { log } from "./index";
import { randomUUID } from "crypto";

let bot: TelegramBot | null = null;

const FIXED_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

function getServerBaseUrl(): string {
  const port = process.env.PORT || "5000";
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  if (process.env.REPL_SLUG) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `http://localhost:${port}`;
}

async function getConfigValue(key: string, fallback: string): Promise<string> {
  const val = await storage.getConfig(key);
  return val || fallback;
}

async function sendManagerNotification(tgId: string, username: string | null, step: string, reason: string) {
  if (!bot) return;
  const managerChatId = await getConfigValue("manager_chat_id", "");
  if (!managerChatId) {
    log("Manager chat ID not configured", "bot");
    return;
  }

  await storage.createManagerMessage({
    tgId,
    username: username || undefined,
    userStep: step,
    reason,
  });

  const text =
    `\u{1F4E9} Повідомлення від користувача\n\n` +
    `\u{1F464} ID: ${tgId}\n` +
    `\u{1F4DD} Username: @${username || "невідомо"}\n` +
    `\u{1F4CD} Крок: ${step}\n` +
    `\u{1F4AC} Причина: ${reason}`;

  try {
    await bot.sendMessage(managerChatId, text);
  } catch (err) {
    log(`Failed to send manager notification: ${err}`, "bot");
  }
}

async function ensureUser(tgId: string, username?: string): Promise<any> {
  let user = await storage.getBotUser(tgId);
  if (!user) {
    user = await storage.createBotUser({
      tgId,
      username: username || undefined,
      currentStep: "HOME",
    });
  } else if (username && user.username !== username) {
    user = await storage.updateBotUser(tgId, { username });
  }
  return user;
}

function resolveVideoUrl(videoUrl: string): string {
  if (videoUrl.startsWith("/")) {
    return `${getServerBaseUrl()}${videoUrl}`;
  }
  return videoUrl;
}

async function showHome(chatId: number, tgId: string) {
  const welcomeText = await getConfigValue("welcome_text",
    "\u{1F44B} \u0412\u0456\u0442\u0430\u0454\u043C\u043E! \u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0434\u0456\u044E:");

  await bot!.sendMessage(chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u25B6\uFE0F \u041F\u043E\u0447\u0430\u0442\u0438", callback_data: "go_step1" }],
        [{ text: "\u{1F4B3} \u041F\u043E\u043F\u043E\u0432\u043D\u0438\u0442\u0438", callback_data: "go_payment" }],
        [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
        [{ text: "\u{1F4CB} \u041F\u0440\u0430\u0432\u0438\u043B\u0430", callback_data: "rules" }],
      ],
    },
  });
}

async function showStep1(chatId: number) {
  const videoUrl = await getConfigValue("step1_video", "");
  const androidLink = await getConfigValue("android_link", "https://example.com/android");
  const iosLink = await getConfigValue("ios_link", "https://example.com/ios");
  const windowsLink = await getConfigValue("windows_link", "https://example.com/windows");
  const step1Text = await getConfigValue("step1_text",
    "\u{1F4F1} \u041A\u0440\u043E\u043A 1: \u0412\u0441\u0442\u0430\u043D\u043E\u0432\u0456\u0442\u044C \u0434\u043E\u0434\u0430\u0442\u043E\u043A\n\n\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0432\u0430\u0448\u0443 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443 \u0442\u0430 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0456\u0442\u044C \u0434\u043E\u0434\u0430\u0442\u043E\u043A:");

  if (videoUrl) {
    try {
      const resolvedUrl = resolveVideoUrl(videoUrl);
      await bot!.sendVideo(chatId, resolvedUrl, { caption: step1Text });
    } catch (e) {
      log(`Failed to send step1 video: ${e}`, "bot");
      await bot!.sendMessage(chatId, step1Text);
    }
  } else {
    await bot!.sendMessage(chatId, step1Text);
  }

  await bot!.sendMessage(chatId, "\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "\u{1F916} Android", url: androidLink },
          { text: "\u{1F34E} iOS", url: iosLink },
          { text: "\u{1F5A5} Windows", url: windowsLink },
        ],
        [{ text: "\u2705 \u042F \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0432 \u0434\u043E\u0434\u0430\u0442\u043E\u043A", callback_data: "installed_app" }],
        [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
      ],
    },
  });
}

async function showStep2(chatId: number) {
  const videoUrl = await getConfigValue("step2_video", "");
  const clubId = await getConfigValue("club_id", "\u041D\u0435 \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u043E");
  const step2Text = await getConfigValue("step2_text",
    `\u{1F3E0} \u041A\u0440\u043E\u043A 2: \u0412\u0441\u0442\u0443\u043F \u0434\u043E \u043A\u043B\u0443\u0431\u0443\n\n\u{1F194} Club ID: ${clubId}\n\n\u0417\u043D\u0430\u0439\u0434\u0456\u0442\u044C \u043A\u043B\u0443\u0431 \u0437\u0430 ID \u0442\u0430 \u043F\u0440\u0438\u0454\u0434\u043D\u0430\u0439\u0442\u0435\u0441\u044F.`);

  const text = step2Text.includes("Club ID") ? step2Text : `${step2Text}\n\n\u{1F194} Club ID: ${clubId}`;

  if (videoUrl) {
    try {
      const resolvedUrl = resolveVideoUrl(videoUrl);
      await bot!.sendVideo(chatId, resolvedUrl, { caption: text });
    } catch (e) {
      log(`Failed to send step2 video: ${e}`, "bot");
      await bot!.sendMessage(chatId, text);
    }
  } else {
    await bot!.sendMessage(chatId, text);
  }

  await bot!.sendMessage(chatId, "\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0434\u0456\u044E:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u2705 \u042F \u0432 \u043A\u043B\u0443\u0431\u0456", callback_data: "joined_club" }],
        [{ text: "\u274C \u041D\u0435 \u0437\u043D\u0430\u0439\u0448\u043E\u0432 \u043A\u043B\u0443\u0431", callback_data: "club_not_found" }],
        [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
      ],
    },
  });
}

async function showStep3(chatId: number) {
  const bonusText = await getConfigValue("bonus_text",
    "\u{1F381} \u041A\u0440\u043E\u043A 3: \u0411\u043E\u043D\u0443\u0441\n\n\u0412\u0456\u0442\u0430\u0454\u043C\u043E! \u0412\u0438 \u043C\u043E\u0436\u0435\u0442\u0435 \u043E\u0442\u0440\u0438\u043C\u0430\u0442\u0438 \u0431\u043E\u043D\u0443\u0441 \u0437\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044E \u0442\u0430 \u0432\u0441\u0442\u0443\u043F \u0434\u043E \u043A\u043B\u0443\u0431\u0443.\n\n\u041D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0438\u0436\u0447\u0435 \u0449\u043E\u0431 \u0437\u0430\u0431\u0440\u0430\u0442\u0438 \u0431\u043E\u043D\u0443\u0441.");

  await bot!.sendMessage(chatId, bonusText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u{1F381} \u0417\u0430\u0431\u0440\u0430\u0442\u0438 \u0431\u043E\u043D\u0443\u0441", callback_data: "claim_bonus" }],
        [{ text: "\u{1F4B3} \u041F\u043E\u043F\u043E\u0432\u043D\u0438\u0442\u0438", callback_data: "go_payment" }],
        [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
        [{ text: "\u{1F4CB} \u041F\u0440\u0430\u0432\u0438\u043B\u0430", callback_data: "rules" }, { text: "\u{1F3E0} Home", callback_data: "go_home" }],
      ],
    },
  });
}

async function showPaymentStep1(chatId: number) {
  await bot!.sendMessage(chatId, "\u{1F4B3} \u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0441\u0443\u043C\u0443 \u043F\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F:", {
    reply_markup: {
      inline_keyboard: [
        FIXED_AMOUNTS.slice(0, 3).map(a => ({ text: `${a} \u20B4`, callback_data: `amount_${a}` })),
        FIXED_AMOUNTS.slice(3).map(a => ({ text: `${a} \u20B4`, callback_data: `amount_${a}` })),
        [{ text: "\u270F\uFE0F \u0412\u0432\u0435\u0441\u0442\u0438 \u0432\u0440\u0443\u0447\u043D\u0443", callback_data: "custom_amount" }],
        [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
        [{ text: "\u{1F3E0} Home", callback_data: "go_home" }],
      ],
    },
  });
}

async function showPaymentStep2(chatId: number, amount: number) {
  await bot!.sendMessage(chatId,
    `\u{1F4B0} \u0421\u0443\u043C\u0430: ${amount} \u20B4\n\n\u{1F4DD} \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u0432\u0430\u0448 Player ID:`);
}

async function createConvert2payPayment(amount: number, playerId: string, paymentId: string): Promise<string | null> {
  const apiUrl = await getConfigValue("convert2pay_api_url", "");
  const merchantId = await getConfigValue("convert2pay_merchant_id", "");
  const secretKey = await getConfigValue("convert2pay_secret_key", "");
  const currency = await getConfigValue("convert2pay_currency", "UAH");

  if (!apiUrl || !merchantId || !secretKey) {
    return null;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount,
        currency,
        order_id: paymentId,
        description: `Payment ${playerId}`,
        player_id: playerId,
      }),
    });

    if (!response.ok) {
      log(`Convert2pay API error: ${response.status}`, "bot");
      return null;
    }

    const data = await response.json();
    return data.payment_url || data.url || data.redirect_url || null;
  } catch (err) {
    log(`Convert2pay request failed: ${err}`, "bot");
    return null;
  }
}

async function showPaymentStep3(chatId: number, amount: number, playerId: string, paymentId: string, tgId: string, username: string | null) {
  let payLink = await createConvert2payPayment(amount, playerId, paymentId);

  if (!payLink) {
    const paymentLink = await getConfigValue("payment_link_template", "");
    if (paymentLink) {
      payLink = paymentLink
        .replace("{amount}", String(amount))
        .replace("{player_id}", playerId)
        .replace("{payment_id}", paymentId);
    }
  }

  if (!payLink) {
    await bot!.sendMessage(chatId,
      `\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0430\n\n\u{1F4B0} \u0421\u0443\u043C\u0430: ${amount} \u20B4\n\u{1F3AE} Player ID: ${playerId}\n\n\u26A0\uFE0F \u0421\u0438\u0441\u0442\u0435\u043C\u0430 \u043E\u043F\u043B\u0430\u0442\u0438 \u0449\u0435 \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F.\n\u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0437\u0432'\u044F\u0436\u0435\u0442\u044C\u0441\u044F \u0437 \u0432\u0430\u043C\u0438 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u0438.`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u{1F504} \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u043E\u043F\u043B\u0430\u0442\u0443", callback_data: `check_payment_${paymentId}` }],
          [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
          [{ text: "\u{1F3E0} Home", callback_data: "go_home" }],
        ],
      },
    });
    await sendManagerNotification(tgId, username, "PAYMENT", `\u0417\u0430\u043F\u0438\u0442 \u043D\u0430 \u043E\u043F\u043B\u0430\u0442\u0443: ${amount} \u20B4, Player ID: ${playerId}`);
    return;
  }

  await bot!.sendMessage(chatId,
    `\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0430\n\n\u{1F4B0} \u0421\u0443\u043C\u0430: ${amount} \u20B4\n\u{1F3AE} Player ID: ${playerId}\n\n\u041D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0438\u0436\u0447\u0435 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u0438:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0438\u0442\u0438", url: payLink }],
        [{ text: "\u{1F504} \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u043E\u043F\u043B\u0430\u0442\u0443", callback_data: `check_payment_${paymentId}` }],
        [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
        [{ text: "\u{1F3E0} Home", callback_data: "go_home" }],
      ],
    },
  });
}

export function startBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    log("TELEGRAM_BOT_TOKEN not set, bot not started", "bot");
    return null;
  }

  bot = new TelegramBot(token, { polling: true });
  log("Telegram bot started", "bot");

  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const tgId = String(msg.from?.id);
    const username = msg.from?.username;

    await ensureUser(tgId, username);
    await storage.updateBotUser(tgId, { currentStep: "HOME", paymentSubStep: null, paymentAmount: null, paymentPlayerId: null });
    await showHome(chatId, tgId);
  });

  bot.on("callback_query", async (query) => {
    if (!query.message || !query.from) return;
    const chatId = query.message.chat.id;
    const tgId = String(query.from.id);
    const username = query.from.username || null;
    const data = query.data || "";

    await bot!.answerCallbackQuery(query.id);

    const user = await ensureUser(tgId, username || undefined);

    if (data === "manager") {
      await bot!.sendMessage(chatId, "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0441\u043A\u043E\u0440\u043E \u043D\u0430\u043F\u0438\u0448\u0435 \u0432\u0430\u043C. \u041E\u0447\u0456\u043A\u0443\u0439\u0442\u0435!");
      await sendManagerNotification(tgId, username, user.currentStep, "\u0417\u0430\u043F\u0438\u0442 \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u0430 24/7");
      return;
    }

    if (data === "rules") {
      const rulesText = await getConfigValue("rules_text",
        "\u{1F4CB} \u041F\u0440\u0430\u0432\u0438\u043B\u0430:\n\n1. \u0412\u0441\u0442\u0430\u043D\u043E\u0432\u0456\u0442\u044C \u0434\u043E\u0434\u0430\u0442\u043E\u043A\n2. \u0412\u0441\u0442\u0443\u043F\u0456\u0442\u044C \u0434\u043E \u043A\u043B\u0443\u0431\u0443\n3. \u041E\u0442\u0440\u0438\u043C\u0430\u0439\u0442\u0435 \u0431\u043E\u043D\u0443\u0441\n4. \u041F\u043E\u043F\u043E\u0432\u043D\u044E\u0439\u0442\u0435 \u0440\u0430\u0445\u0443\u043D\u043E\u043A");
      await bot!.sendMessage(chatId, rulesText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{1F3E0} Home", callback_data: "go_home" }],
          ],
        },
      });
      return;
    }

    if (data === "go_home") {
      await storage.updateBotUser(tgId, { currentStep: "HOME", paymentSubStep: null, paymentAmount: null, paymentPlayerId: null });
      await showHome(chatId, tgId);
      return;
    }

    if (data === "go_step1") {
      await storage.updateBotUser(tgId, { currentStep: "STEP_1" });
      await showStep1(chatId);
      return;
    }

    if (data === "installed_app") {
      if (user.currentStep === "STEP_1" || user.currentStep === "HOME") {
        await storage.updateBotUser(tgId, { currentStep: "STEP_2" });
        await showStep2(chatId);
      }
      return;
    }

    if (data === "joined_club") {
      if (user.currentStep === "STEP_2" || user.currentStep === "STEP_1") {
        await storage.updateBotUser(tgId, { currentStep: "STEP_3" });
        await showStep3(chatId);
      }
      return;
    }

    if (data === "club_not_found") {
      await bot!.sendMessage(chatId, "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0434\u043E\u043F\u043E\u043C\u043E\u0436\u0435 \u0432\u0430\u043C \u0437\u043D\u0430\u0439\u0442\u0438 \u043A\u043B\u0443\u0431. \u041E\u0447\u0456\u043A\u0443\u0439\u0442\u0435!");
      await sendManagerNotification(tgId, username, user.currentStep, "\u041D\u0435 \u0437\u043D\u0430\u0439\u0448\u043E\u0432 \u043A\u043B\u0443\u0431");
      return;
    }

    if (data === "claim_bonus") {
      await storage.updateBotUser(tgId, { claimedBonus: true });
      await bot!.sendMessage(chatId, "\u{1F381} \u0412\u0430\u0448 \u0437\u0430\u043F\u0438\u0442 \u043D\u0430 \u0431\u043E\u043D\u0443\u0441 \u043F\u0440\u0438\u0439\u043D\u044F\u0442\u043E! \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0437\u0432'\u044F\u0436\u0435\u0442\u044C\u0441\u044F \u0437 \u0432\u0430\u043C\u0438.");
      await sendManagerNotification(tgId, username, user.currentStep, "\u0417\u0430\u043F\u0438\u0442 \u043D\u0430 \u0431\u043E\u043D\u0443\u0441");
      return;
    }

    if (data === "go_payment") {
      await storage.updateBotUser(tgId, { currentStep: "PAYMENT", paymentSubStep: "amount" });
      await showPaymentStep1(chatId);
      return;
    }

    if (data.startsWith("amount_")) {
      const amount = parseInt(data.replace("amount_", ""));
      await storage.updateBotUser(tgId, { paymentAmount: amount, paymentSubStep: "player_id" });
      await showPaymentStep2(chatId, amount);
      return;
    }

    if (data === "custom_amount") {
      await storage.updateBotUser(tgId, { paymentSubStep: "custom_amount" });
      await bot!.sendMessage(chatId, "\u270F\uFE0F \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u0441\u0443\u043C\u0443 \u043F\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F (\u0447\u0438\u0441\u043B\u043E):");
      return;
    }

    if (data.startsWith("check_payment_")) {
      const paymentId = data.replace("check_payment_", "");
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        await bot!.sendMessage(chatId, "\u274C \u041F\u043B\u0430\u0442\u0456\u0436 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E");
        return;
      }
      if (payment.status === "paid") {
        await bot!.sendMessage(chatId, `\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u0430!\n\n\u{1F4B0} \u0421\u0443\u043C\u0430: ${payment.amount} \u20B4\n\u{1F3AE} Player ID: ${payment.playerId}`);
      } else if (payment.status === "cancelled") {
        await bot!.sendMessage(chatId, "\u274C \u041E\u043F\u043B\u0430\u0442\u0430 \u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u0430. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0437\u043D\u043E\u0432\u0443.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F4B3} \u041F\u043E\u043F\u043E\u0432\u043D\u0438\u0442\u0438", callback_data: "go_payment" }],
              [{ text: "\u{1F3E0} Home", callback_data: "go_home" }],
            ],
          },
        });
      } else {
        await bot!.sendMessage(chatId, "\u23F3 \u041E\u043F\u043B\u0430\u0442\u0430 \u0432 \u043E\u0431\u0440\u043E\u0431\u0446\u0456. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u043F\u0456\u0437\u043D\u0456\u0448\u0435.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F504} \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0449\u0435 \u0440\u0430\u0437", callback_data: `check_payment_${paymentId}` }],
              [{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7", callback_data: "manager" }],
            ],
          },
        });
      }
      return;
    }
  });

  bot.on("message", async (msg) => {
    if (msg.text?.startsWith("/")) return;
    if (!msg.from) return;

    const chatId = msg.chat.id;
    const tgId = String(msg.from.id);
    const user = await storage.getBotUser(tgId);
    if (!user) return;

    if (user.currentStep === "PAYMENT" && user.paymentSubStep === "custom_amount") {
      const amount = parseInt(msg.text || "");
      if (isNaN(amount) || amount <= 0) {
        await bot!.sendMessage(chatId, "\u274C \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0443 \u0441\u0443\u043C\u0443 (\u043F\u043E\u0437\u0438\u0442\u0438\u0432\u043D\u0435 \u0447\u0438\u0441\u043B\u043E):");
        return;
      }
      await storage.updateBotUser(tgId, { paymentAmount: amount, paymentSubStep: "player_id" });
      await showPaymentStep2(chatId, amount);
      return;
    }

    if (user.currentStep === "PAYMENT" && user.paymentSubStep === "player_id") {
      const playerId = msg.text?.trim() || "";
      if (!playerId) {
        await bot!.sendMessage(chatId, "\u274C \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u0439 Player ID:");
        return;
      }

      const amount = user.paymentAmount || 0;
      const payment = await storage.createPayment({
        tgId,
        playerId,
        amount,
        status: "pending",
        invoiceId: randomUUID(),
      });

      await storage.updateBotUser(tgId, {
        paymentPlayerId: playerId,
        paymentSubStep: "pay",
      });

      await showPaymentStep3(chatId, amount, playerId, payment.id, tgId, msg.from?.username || null);
      return;
    }
  });

  return bot;
}

export function getBot() {
  return bot;
}

export async function notifyManagerPayment(tgId: string, username: string | null, amount: number, playerId: string) {
  if (!bot) return;
  const managerChatId = await storage.getConfig("manager_chat_id");
  if (!managerChatId) return;

  const text =
    `\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u0430!\n\n` +
    `\u{1F464} ID: ${tgId}\n` +
    `\u{1F4DD} Username: @${username || "\u043D\u0435\u0432\u0456\u0434\u043E\u043C\u043E"}\n` +
    `\u{1F4B0} \u0421\u0443\u043C\u0430: ${amount} \u20B4\n` +
    `\u{1F3AE} Player ID: ${playerId}`;

  try {
    await bot.sendMessage(managerChatId, text);
  } catch (err) {
    log(`Failed to send payment notification: ${err}`, "bot");
  }
}

export async function sendMessageToUser(tgId: string, message: string) {
  if (!bot) return;
  try {
    await bot.sendMessage(parseInt(tgId), message);
  } catch (err) {
    log(`Failed to send message to user ${tgId}: ${err}`, "bot");
  }
}
