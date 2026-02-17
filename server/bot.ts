import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { log } from "./index";
import { randomUUID } from "crypto";

let bot: TelegramBot | null = null;

const FIXED_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

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

  const text = `📩 Повідомлення від користувача\n\n` +
    `👤 ID: ${tgId}\n` +
    `📝 Username: @${username || "невідомо"}\n` +
    `📍 Крок: ${step}\n` +
    `💬 Причина: ${reason}`;

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

async function showHome(chatId: number, tgId: string) {
  const welcomeText = await getConfigValue("welcome_text",
    "Вітаємо! Оберіть дію:");

  await bot!.sendMessage(chatId, welcomeText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "▶️ Почати", callback_data: "go_step1" }],
        [{ text: "💳 Поповнити", callback_data: "go_payment" }],
        [{ text: "📞 Менеджер 24/7", callback_data: "manager" }],
        [{ text: "📋 Правила", callback_data: "rules" }],
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
    "📱 Крок 1: Встановіть додаток\n\nОберіть вашу платформу та встановіть додаток:");

  if (videoUrl) {
    try {
      await bot!.sendVideo(chatId, videoUrl, { caption: step1Text });
    } catch {
      await bot!.sendMessage(chatId, step1Text);
    }
  } else {
    await bot!.sendMessage(chatId, step1Text);
  }

  await bot!.sendMessage(chatId, "Оберіть платформу:", {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🤖 Android", url: androidLink },
          { text: "🍎 iOS", url: iosLink },
          { text: "🖥 Windows", url: windowsLink },
        ],
        [{ text: "✅ Я встановив додаток", callback_data: "installed_app" }],
        [{ text: "📞 Менеджер 24/7", callback_data: "manager" }],
      ],
    },
  });
}

async function showStep2(chatId: number) {
  const videoUrl = await getConfigValue("step2_video", "");
  const clubId = await getConfigValue("club_id", "Не налаштовано");
  const step2Text = await getConfigValue("step2_text",
    `🏠 Крок 2: Вступ до клубу\n\n🆔 Club ID: ${clubId}\n\nЗнайдіть клуб за ID та приєднайтесь.`);

  const text = step2Text.includes("Club ID") ? step2Text : `${step2Text}\n\n🆔 Club ID: ${clubId}`;

  if (videoUrl) {
    try {
      await bot!.sendVideo(chatId, videoUrl, { caption: text });
    } catch {
      await bot!.sendMessage(chatId, text);
    }
  } else {
    await bot!.sendMessage(chatId, text);
  }

  await bot!.sendMessage(chatId, "Оберіть дію:", {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Я в клубі", callback_data: "joined_club" }],
        [{ text: "❌ Не знайшов клуб", callback_data: "club_not_found" }],
        [{ text: "📞 Менеджер 24/7", callback_data: "manager" }],
      ],
    },
  });
}

async function showStep3(chatId: number) {
  const bonusText = await getConfigValue("bonus_text",
    "🎁 Крок 3: Бонус\n\nВітаємо! Ви можете отримати бонус за реєстрацію та вступ до клубу.\n\nНатисніть кнопку нижче щоб забрати бонус.");

  await bot!.sendMessage(chatId, bonusText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎁 Забрати бонус", callback_data: "claim_bonus" }],
        [{ text: "💳 Поповнити", callback_data: "go_payment" }],
        [{ text: "📞 Менеджер 24/7", callback_data: "manager" }],
        [{ text: "📋 Правила", callback_data: "rules" }, { text: "🏠 Home", callback_data: "go_home" }],
      ],
    },
  });
}

async function showPaymentStep1(chatId: number) {
  await bot!.sendMessage(chatId, "💳 Оберіть суму поповнення:", {
    reply_markup: {
      inline_keyboard: [
        FIXED_AMOUNTS.slice(0, 3).map(a => ({ text: `${a} ₴`, callback_data: `amount_${a}` })),
        FIXED_AMOUNTS.slice(3).map(a => ({ text: `${a} ₴`, callback_data: `amount_${a}` })),
        [{ text: "✏️ Ввести вручну", callback_data: "custom_amount" }],
        [{ text: "📞 Менеджер 24/7", callback_data: "manager" }],
        [{ text: "🏠 Home", callback_data: "go_home" }],
      ],
    },
  });
}

async function showPaymentStep2(chatId: number, amount: number) {
  await bot!.sendMessage(chatId,
    `💰 Сума: ${amount} ₴\n\n📝 Введіть ваш Player ID:`);
}

async function showPaymentStep3(chatId: number, amount: number, playerId: string, paymentId: string) {
  const paymentLink = await getConfigValue("payment_link_template", "");
  let payLink = paymentLink
    .replace("{amount}", String(amount))
    .replace("{player_id}", playerId)
    .replace("{payment_id}", paymentId);

  if (!payLink) {
    payLink = `https://example.com/pay?amount=${amount}&id=${paymentId}`;
  }

  const buttons: any[][] = [
    [{ text: "💳 Оплатити", url: payLink }],
    [{ text: "🔄 Перевірити оплату", callback_data: `check_payment_${paymentId}` }],
    [{ text: "📞 Менеджер 24/7", callback_data: "manager" }],
    [{ text: "🏠 Home", callback_data: "go_home" }],
  ];

  await bot!.sendMessage(chatId,
    `💳 Оплата\n\n💰 Сума: ${amount} ₴\n🎮 Player ID: ${playerId}\n\nНатисніть кнопку нижче для оплати:`, {
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
      await bot!.sendMessage(chatId, "📞 Менеджер скоро напише вам. Очікуйте!");
      await sendManagerNotification(tgId, username, user.currentStep, "Запит менеджера 24/7");
      return;
    }

    if (data === "rules") {
      const rulesText = await getConfigValue("rules_text",
        "📋 Правила:\n\n1. Встановіть додаток\n2. Вступіть до клубу\n3. Отримайте бонус\n4. Поповнюйте рахунок");
      await bot!.sendMessage(chatId, rulesText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "🏠 Home", callback_data: "go_home" }],
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
      await bot!.sendMessage(chatId, "📞 Менеджер допоможе вам знайти клуб. Очікуйте!");
      await sendManagerNotification(tgId, username, user.currentStep, "Не знайшов клуб");
      return;
    }

    if (data === "claim_bonus") {
      await storage.updateBotUser(tgId, { claimedBonus: true });
      await bot!.sendMessage(chatId, "🎁 Ваш запит на бонус прийнято! Менеджер зв'яжеться з вами.");
      await sendManagerNotification(tgId, username, user.currentStep, "Запит на бонус");
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
      await bot!.sendMessage(chatId, "✏️ Введіть суму поповнення (число):");
      return;
    }

    if (data.startsWith("check_payment_")) {
      const paymentId = data.replace("check_payment_", "");
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        await bot!.sendMessage(chatId, "❌ Платіж не знайдено");
        return;
      }
      if (payment.status === "paid") {
        await bot!.sendMessage(chatId, `✅ Оплата підтверджена!\n\n💰 Сума: ${payment.amount} ₴\n🎮 Player ID: ${payment.playerId}`);
      } else if (payment.status === "cancelled") {
        await bot!.sendMessage(chatId, "❌ Оплата скасована. Спробуйте знову.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "💳 Поповнити", callback_data: "go_payment" }],
              [{ text: "🏠 Home", callback_data: "go_home" }],
            ],
          },
        });
      } else {
        await bot!.sendMessage(chatId, "⏳ Оплата в обробці. Спробуйте перевірити пізніше.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "🔄 Перевірити ще раз", callback_data: `check_payment_${paymentId}` }],
              [{ text: "📞 Менеджер 24/7", callback_data: "manager" }],
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
        await bot!.sendMessage(chatId, "❌ Введіть коректну суму (позитивне число):");
        return;
      }
      await storage.updateBotUser(tgId, { paymentAmount: amount, paymentSubStep: "player_id" });
      await showPaymentStep2(chatId, amount);
      return;
    }

    if (user.currentStep === "PAYMENT" && user.paymentSubStep === "player_id") {
      const playerId = msg.text?.trim() || "";
      if (!playerId) {
        await bot!.sendMessage(chatId, "❌ Введіть коректний Player ID:");
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

  const text = `✅ Оплата підтверджена!\n\n` +
    `👤 ID: ${tgId}\n` +
    `📝 Username: @${username || "невідомо"}\n` +
    `💰 Сума: ${amount} ₴\n` +
    `🎮 Player ID: ${playerId}`;

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
