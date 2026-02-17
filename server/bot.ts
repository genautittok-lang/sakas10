import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { log } from "./index";
import { randomUUID } from "crypto";

let bot: TelegramBot | null = null;

const FIXED_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

function getServerBaseUrl(): string {
  const port = process.env.PORT || "5000";
  
  // Check PUBLIC_BASE_URL first (highest priority for deployment)
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL;
  }
  
  // Fall back to Replit environment variables
  if (process.env.REPL_SLUG) {
    return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  }
  
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  
  // Final fallback to localhost
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

  const text = `Povidomlennya vid korystuvacha\n\n` +
    `ID: ${tgId}\n` +
    `Username: @${username || "nevidomo"}\n` +
    `Krok: ${step}\n` +
    `Prychyna: ${reason}`;

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
    "Vitayemo! Oberit diyu:");

  await bot!.sendMessage(chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Pochaty", callback_data: "go_step1" }],
        [{ text: "Popovnyty", callback_data: "go_payment" }],
        [{ text: "Manager 24/7", callback_data: "manager" }],
        [{ text: "Pravyla", callback_data: "rules" }],
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
    "Krok 1: Vstanovit dodatok\n\nOberit vashu platformu ta vstanovit dodatok:");

  if (videoUrl) {
    try {
      const resolvedUrl = resolveVideoUrl(videoUrl);
      await bot!.sendVideo(chatId, resolvedUrl, { caption: step1Text });
    } catch {
      await bot!.sendMessage(chatId, step1Text);
    }
  } else {
    await bot!.sendMessage(chatId, step1Text);
  }

  await bot!.sendMessage(chatId, "Oberit platformu:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Android", url: androidLink },
          { text: "iOS", url: iosLink },
          { text: "Windows", url: windowsLink },
        ],
        [{ text: "Ya vstanovyv dodatok", callback_data: "installed_app" }],
        [{ text: "Manager 24/7", callback_data: "manager" }],
      ],
    },
  });
}

async function showStep2(chatId: number) {
  const videoUrl = await getConfigValue("step2_video", "");
  const clubId = await getConfigValue("club_id", "Ne nalashtovano");
  const step2Text = await getConfigValue("step2_text",
    `Krok 2: Vstup do klubu\n\nClub ID: ${clubId}\n\nZnaydit klub za ID ta pryyednaitesya.`);

  const text = step2Text.includes("Club ID") ? step2Text : `${step2Text}\n\nClub ID: ${clubId}`;

  if (videoUrl) {
    try {
      const resolvedUrl = resolveVideoUrl(videoUrl);
      await bot!.sendVideo(chatId, resolvedUrl, { caption: text });
    } catch {
      await bot!.sendMessage(chatId, text);
    }
  } else {
    await bot!.sendMessage(chatId, text);
  }

  await bot!.sendMessage(chatId, "Oberit diyu:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Ya v klubi", callback_data: "joined_club" }],
        [{ text: "Ne znayshov klub", callback_data: "club_not_found" }],
        [{ text: "Manager 24/7", callback_data: "manager" }],
      ],
    },
  });
}

async function showStep3(chatId: number) {
  const bonusText = await getConfigValue("bonus_text",
    "Krok 3: Bonus\n\nVitayemo! Vy mozhete otrymaty bonus za reyestraciyu ta vstup do klubu.\n\nNatysnit knopku nyzhche shchob zabraty bonus.");

  await bot!.sendMessage(chatId, bonusText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Zabraty bonus", callback_data: "claim_bonus" }],
        [{ text: "Popovnyty", callback_data: "go_payment" }],
        [{ text: "Manager 24/7", callback_data: "manager" }],
        [{ text: "Pravyla", callback_data: "rules" }, { text: "Home", callback_data: "go_home" }],
      ],
    },
  });
}

async function showPaymentStep1(chatId: number) {
  await bot!.sendMessage(chatId, "Oberit sumu popovnennya:", {
    reply_markup: {
      inline_keyboard: [
        FIXED_AMOUNTS.slice(0, 3).map(a => ({ text: `${a} UAH`, callback_data: `amount_${a}` })),
        FIXED_AMOUNTS.slice(3).map(a => ({ text: `${a} UAH`, callback_data: `amount_${a}` })),
        [{ text: "Vvesty vruchnu", callback_data: "custom_amount" }],
        [{ text: "Manager 24/7", callback_data: "manager" }],
        [{ text: "Home", callback_data: "go_home" }],
      ],
    },
  });
}

async function showPaymentStep2(chatId: number, amount: number) {
  await bot!.sendMessage(chatId,
    `Suma: ${amount} UAH\n\nVvedit vash Player ID:`);
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

async function showPaymentStep3(chatId: number, amount: number, playerId: string, paymentId: string) {
  let payLink = await createConvert2payPayment(amount, playerId, paymentId);

  if (!payLink) {
    const paymentLink = await getConfigValue("payment_link_template", "");
    payLink = paymentLink
      .replace("{amount}", String(amount))
      .replace("{player_id}", playerId)
      .replace("{payment_id}", paymentId);

    if (!payLink) {
      payLink = `https://example.com/pay?amount=${amount}&id=${paymentId}`;
    }
  }

  const buttons: any[][] = [
    [{ text: "Oplatyty", url: payLink }],
    [{ text: "Pereviryty oplatu", callback_data: `check_payment_${paymentId}` }],
    [{ text: "Manager 24/7", callback_data: "manager" }],
    [{ text: "Home", callback_data: "go_home" }],
  ];

  await bot!.sendMessage(chatId,
    `Oplata\n\nSuma: ${amount} UAH\nPlayer ID: ${playerId}\n\nNatysnit knopku nyzhche dlya oplaty:`, {
    reply_markup: { inline_keyboard: buttons },
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

    const user = await ensureUser(tgId, username);
    await storage.updateBotUser(tgId, { currentStep: "HOME" });
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
      await bot!.sendMessage(chatId, "Manager skoro napyshe vam. Ochikuite!");
      await sendManagerNotification(tgId, username, user.currentStep, "Zapyt managera 24/7");
      return;
    }

    if (data === "rules") {
      const rulesText = await getConfigValue("rules_text",
        "Pravyla:\n\n1. Vstanovit dodatok\n2. Vstupity do klubu\n3. Otrymayty bonus\n4. Popovnyuity rakhunok");
      await bot!.sendMessage(chatId, rulesText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Home", callback_data: "go_home" }],
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
      await bot!.sendMessage(chatId, "Manager dopomozhe vam znayty klub. Ochikuite!");
      await sendManagerNotification(tgId, username, user.currentStep, "Ne znayshov klub");
      return;
    }

    if (data === "claim_bonus") {
      await storage.updateBotUser(tgId, { claimedBonus: true });
      await bot!.sendMessage(chatId, "Vash zapyt na bonus pryynyato! Manager zv'yazhetsya z vamy.");
      await sendManagerNotification(tgId, username, user.currentStep, "Zapyt na bonus");
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
      await bot!.sendMessage(chatId, "Vvedit sumu popovnennya (chyslo):");
      return;
    }

    if (data.startsWith("check_payment_")) {
      const paymentId = data.replace("check_payment_", "");
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        await bot!.sendMessage(chatId, "Platizh ne znaydeno");
        return;
      }
      if (payment.status === "paid") {
        await bot!.sendMessage(chatId, `Oplata pidtverdzhena!\n\nSuma: ${payment.amount} UAH\nPlayer ID: ${payment.playerId}`);
      } else if (payment.status === "cancelled") {
        await bot!.sendMessage(chatId, "Oplata skasovana. Sprobuyte znovu.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Popovnyty", callback_data: "go_payment" }],
              [{ text: "Home", callback_data: "go_home" }],
            ],
          },
        });
      } else {
        await bot!.sendMessage(chatId, "Oplata v obrobci. Sprobuyte pereviryty piznishe.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Pereviryty shche raz", callback_data: `check_payment_${paymentId}` }],
              [{ text: "Manager 24/7", callback_data: "manager" }],
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
        await bot!.sendMessage(chatId, "Vvedit korektnu sumu (pozytyvne chyslo):");
        return;
      }
      await storage.updateBotUser(tgId, { paymentAmount: amount, paymentSubStep: "player_id" });
      await showPaymentStep2(chatId, amount);
      return;
    }

    if (user.currentStep === "PAYMENT" && user.paymentSubStep === "player_id") {
      const playerId = msg.text?.trim() || "";
      if (!playerId) {
        await bot!.sendMessage(chatId, "Vvedit korektnyy Player ID:");
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

      await showPaymentStep3(chatId, amount, playerId, payment.id);
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

  const text = `Oplata pidtverdzhena!\n\n` +
    `ID: ${tgId}\n` +
    `Username: @${username || "nevidomo"}\n` +
    `Suma: ${amount} UAH\n` +
    `Player ID: ${playerId}`;

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
