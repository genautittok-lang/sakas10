import TelegramBot from "node-telegram-bot-api";
import { storage } from "./storage";
import { log } from "./index";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

let bot: TelegramBot | null = null;

const DEFAULT_AMOUNTS = [100, 200, 500, 1000, 2000, 5000];

async function getPaymentAmounts(): Promise<number[]> {
  const raw = await storage.getConfig("payment_amounts");
  if (!raw) return DEFAULT_AMOUNTS;
  const parsed = raw.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n > 0);
  return parsed.length > 0 ? parsed : DEFAULT_AMOUNTS;
}

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

const managerReplyState: Map<string, string> = new Map();
const broadcastState: Map<string, boolean> = new Map();
const userManagerState: Map<string, boolean> = new Map();

function translateStep(step: string): string {
  const translations: Record<string, string> = {
    HOME: "Головна",
    STEP_1: "Крок 1",
    STEP_2: "Крок 2",
    STEP_3: "Крок 3",
    PAYMENT: "Оплата",
  };
  return translations[step] || step;
}

function translatePaymentStatus(status: string): string {
  const translations: Record<string, string> = {
    paid: "Оплачено",
    pending: "Очікує",
    cancelled: "Скасовано",
    processing: "В обробці",
  };
  return translations[status] || status;
}

async function sendManagerNotification(tgId: string, username: string | null, step: string, reason: string) {
  const msg = await storage.createManagerMessage({
    tgId,
    username: username || undefined,
    userStep: step,
    reason,
  });

  if (!bot) return;
  const managerChatId = await getConfigValue("manager_chat_id", "");
  if (!managerChatId) {
    log("Manager chat ID not configured, message saved to web panel only", "bot");
    return;
  }

  const text =
    `\u{1F4E9} Повідомлення від користувача\n\n` +
    `\u{1F464} ID: ${tgId}\n` +
    `\u{1F4DD} Username: @${username || "невідомо"}\n` +
    `\u{1F4CD} Крок: ${step}\n` +
    `\u{1F4AC} Причина: ${reason}`;

  try {
    await bot.sendMessage(managerChatId, text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u270F\uFE0F \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0441\u0442\u0438", callback_data: `reply_to_${msg.id}_${tgId}` }],
        ],
      },
    });
  } catch (err) {
    const errMsg = String(err);
    if (errMsg.includes("chat not found")) {
      log(`Manager chat ID "${managerChatId}" not found. Make sure to use a numeric Chat ID (not username). You can get it by messaging @userinfobot on Telegram.`, "bot");
    } else {
      log(`Failed to send manager notification: ${err}`, "bot");
    }
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

function resolveMediaSource(mediaPath: string): string | fs.ReadStream {
  if (mediaPath.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), mediaPath);
    if (fs.existsSync(filePath)) {
      log(`Sending media from disk: ${filePath}`, "bot");
      return fs.createReadStream(filePath);
    }
    log(`File not found on disk: ${filePath}, falling back to URL`, "bot");
    return `${getServerBaseUrl()}${mediaPath}`;
  }
  if (mediaPath.startsWith("/")) {
    return `${getServerBaseUrl()}${mediaPath}`;
  }
  return mediaPath;
}

function getFileOptions(mediaPath: string): Record<string, any> {
  const ext = path.extname(mediaPath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".mp4": "video/mp4",
    ".mov": "video/mp4",
    ".avi": "video/x-msvideo",
    ".webm": "video/webm",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };
  if (mediaPath.startsWith("/uploads/") || mediaPath.startsWith("/")) {
    const filePath = path.join(process.cwd(), mediaPath);
    const filename = path.basename(mediaPath);
    const contentType = mimeTypes[ext] || "application/octet-stream";
    return { contentType, filename };
  }
  return {};
}

const PERSISTENT_MANAGER_KEYBOARD = {
  reply_markup: {
    keyboard: [[{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7" }]],
    resize_keyboard: true,
    is_persistent: true,
  },
};

async function showHome(chatId: number, tgId: string) {
  const welcomeText = await getConfigValue("welcome_text",
    "\u{1F44B} \u0412\u0456\u0442\u0430\u0454\u043C\u043E \u0432 \u043F\u0440\u0438\u0432\u0430\u0442\u043D\u043E\u043C\u0443 \u043A\u043B\u0443\u0431\u0456 W Dealz !\n\n\u{1F525} \u0427\u043E\u043C\u0443 \u0443\u043A\u0440\u0430\u0457\u043D\u0446\u0456 \u043E\u0431\u0440\u0430\u043B\u0438 \u0441\u0430\u043C\u0435 \u043D\u0430\u0441:\n\u2705 \u0428\u0432\u0438\u0434\u043A\u0430 \u0440\u0435\u0454\u0441\u0442\u0440\u0430\u0446\u0456\u044F \u0431\u0435\u0437 \u0432\u0435\u0440\u0438\u0444\u0456\u043A\u0430\u0446\u0456\u0457\n\u2705 \u0420\u0435\u0439\u043A\u0431\u0435\u043A \u0432\u0441\u0456\u043C \u0433\u0440\u0430\u0432\u0446\u044F\u043C\n\u2705 \u0414\u0436\u0435\u043A\u043F\u043E\u0442 \n\n\u{1F3C6} \u041B\u0406\u0414\u0415\u0420\u0411\u041E\u0420\u0414\u0418 \n\n\u{1F4B0} \u20B4 50 000 \u0422\u0423\u0420\u041D\u0406\u0420\u041D\u0418\u0419 \u0424\u041E\u041D\u0414 \u0429\u041E\u041C\u0406\u0421\u042F\u0426\u042F\n2-5+ \u0442\u0443\u0440\u043D\u0456\u0440\u0456\u0432 \u043D\u0430 \u0434\u0435\u043D\u044C\n\n\u{1F48E} \u041F\u041E\u0414\u0412\u041E\u042E\u0419 \u041F\u0415\u0420\u0428\u0418\u0419 \u0414\u0415\u041F\u041E\u0417\u0418\u0422!\n\u041C\u0438\u0442\u0442\u0454\u0432\u0435 \u043F\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F \u0432\u0456\u0434 \u20B4 500, \u0432\u0438\u0432\u0456\u0434 \u0434\u0432\u0430 \u0440\u0430\u0437\u0438 \u043D\u0430 \u0434\u043E\u0431\u0443");

  await bot!.sendMessage(chatId, welcomeText, {
    reply_markup: {
      keyboard: [[{ text: "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7" }]],
      resize_keyboard: true,
      is_persistent: true,
    },
  });

  const welcomeImage = await getConfigValue("welcome_image", "");
  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "\u{1F916} Android", callback_data: "show_android" },
          { text: "\u{1F34E} iOS", callback_data: "show_ios" },
          { text: "\u{1F5A5} Windows", callback_data: "show_windows" },
        ],
      ],
    },
  };

  if (welcomeImage) {
    try {
      const source = resolveMediaSource(welcomeImage);
      const fileOpts = getFileOptions(welcomeImage);
      await bot!.sendPhoto(chatId, source, {
        caption: "\u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0442\u0435 \u0434\u043E\u0434\u0430\u0442\u043E\u043A \u0434\u043B\u044F \u0432\u0430\u0448\u043E\u0457 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0438:",
        ...buttons,
      }, { ...fileOpts });
    } catch (e) {
      log(`Failed to send welcome image: ${e}`, "bot");
      await bot!.sendMessage(chatId, "\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0432\u0430\u0448\u0443 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443:", buttons);
    }
  } else {
    await bot!.sendMessage(chatId, "\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0432\u0430\u0448\u0443 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0443:", buttons);
  }
}

async function showPlatformVideo(chatId: number, platform: "android" | "ios" | "windows") {
  const videoKey = `${platform}_video`;
  const linkKey = `${platform}_link`;
  const videoUrl = await getConfigValue(videoKey, "");
  const downloadLink = await getConfigValue(linkKey, `https://example.com/${platform}`);

  const platformNames: Record<string, string> = {
    android: "Android",
    ios: "iOS",
    windows: "Windows",
  };

  const buttons = {
    reply_markup: {
      inline_keyboard: [
        [{ text: `\u{1F4E5} \u0417\u0430\u0432\u0430\u043D\u0442\u0430\u0436\u0438\u0442\u0438 ${platformNames[platform]}`, url: downloadLink }],
        [{ text: "\u2705 \u042F \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0432 \u0434\u043E\u0434\u0430\u0442\u043E\u043A", callback_data: "installed_app" }],
        [{ text: "\u{1F519} \u041D\u0430\u0437\u0430\u0434", callback_data: "go_home" }],
      ],
    },
  };

  if (videoUrl) {
    try {
      const source = resolveMediaSource(videoUrl);
      const fileOpts = getFileOptions(videoUrl);
      await bot!.sendVideo(chatId, source, {
        caption: "\u{1F4F1} \u0406\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044F \u0437 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F",
        ...buttons,
      }, { ...fileOpts });
    } catch (e) {
      log(`Failed to send ${platform} video: ${e}`, "bot");
      await bot!.sendMessage(chatId, "\u{1F4F1} \u0406\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044F \u0437 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F", buttons);
    }
  } else {
    await bot!.sendMessage(chatId, "\u{1F4F1} \u0406\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0456\u044F \u0437 \u0432\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u043D\u044F", buttons);
  }
}

async function showStep2(chatId: number) {
  const videoUrl = await getConfigValue("step2_video", "");
  const clubId = await getConfigValue("club_id", "\u041D\u0435 \u043D\u0430\u043B\u0430\u0448\u0442\u043E\u0432\u0430\u043D\u043E");
  const step2Text = await getConfigValue("step2_text",
    `\u{1F3E0} \u041A\u0440\u043E\u043A 2: \u0412\u0441\u0442\u0443\u043F \u0434\u043E \u043A\u043B\u0443\u0431\u0443\n\n\u{1F194} Club ID: ${clubId}\n\n\u0417\u043D\u0430\u0439\u0434\u0456\u0442\u044C \u043A\u043B\u0443\u0431 \u0437\u0430 ID \u0442\u0430 \u043F\u0440\u0438\u0454\u0434\u043D\u0430\u0439\u0442\u0435\u0441\u044F.`);

  const text = step2Text.includes("Club ID") ? step2Text : `${step2Text}\n\n\u{1F194} Club ID: ${clubId}`;

  if (videoUrl) {
    try {
      const source = resolveMediaSource(videoUrl);
      const fileOpts = getFileOptions(videoUrl);
      await bot!.sendVideo(chatId, source, { caption: text }, { ...fileOpts });
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
      ],
    },
  });
}

async function showStep3(chatId: number) {
  const bonusText = await getConfigValue("bonus_text",
    "\u{1F381} \u0411\u043E\u043D\u0443\u0441\n\n\u{1F48E} \u041F\u041E\u0414\u0412\u041E\u042E\u0419 \u041F\u0415\u0420\u0428\u0418\u0419 \u0414\u0415\u041F\u041E\u0417\u0418\u0422!\n\n\u041F\u043E\u043F\u043E\u0432\u043D\u0456\u0442\u044C \u0440\u0430\u0445\u0443\u043D\u043E\u043A \u0442\u0430 \u043E\u0442\u0440\u0438\u043C\u0430\u0439\u0442\u0435 \u0431\u043E\u043D\u0443\u0441 \u043D\u0430 \u043F\u0435\u0440\u0448\u0438\u0439 \u0434\u0435\u043F\u043E\u0437\u0438\u0442.\n\u041C\u0456\u043D\u0456\u043C\u0430\u043B\u044C\u043D\u0435 \u043F\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F \u0432\u0456\u0434 \u20B4 500.");

  await bot!.sendMessage(chatId, bonusText, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u{1F4B0} \u041F\u043E\u043F\u043E\u0432\u043D\u0438\u0442\u0438 \u0442\u0430 \u043E\u0442\u0440\u0438\u043C\u0430\u0442\u0438 \u0431\u043E\u043D\u0443\u0441", callback_data: "go_payment" }],
        [{ text: "\u{1F4CB} \u041F\u0440\u0430\u0432\u0438\u043B\u0430", callback_data: "rules" }, { text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
      ],
    },
  });
}

async function showPaymentStep1(chatId: number) {
  const amounts = await getPaymentAmounts();
  const rows: any[][] = [];
  for (let i = 0; i < amounts.length; i += 3) {
    rows.push(amounts.slice(i, i + 3).map(a => ({ text: `${a} \u20B4`, callback_data: `amount_${a}` })));
  }
  rows.push([{ text: "\u270F\uFE0F \u0412\u0432\u0435\u0441\u0442\u0438 \u0432\u0440\u0443\u0447\u043D\u0443", callback_data: "custom_amount" }]);
  rows.push([{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }]);

  await bot!.sendMessage(chatId, "\u{1F4B3} \u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0441\u0443\u043C\u0443 \u043F\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F:", {
    reply_markup: { inline_keyboard: rows },
  });
}

async function showPaymentStep2(chatId: number, amount: number) {
  await bot!.sendMessage(chatId,
    `\u{1F4B0} \u0421\u0443\u043C\u0430: ${amount} \u20B4\n\n\u{1F4DD} \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u0432\u0430\u0448 Player ID:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
      ],
    },
  });
}

async function createConvert2payPayment(amount: number, playerId: string, paymentId: string): Promise<string | null> {
  const apiUrl = await getConfigValue("convert2pay_api_url", "");
  const merchantId = await getConfigValue("convert2pay_merchant_id", "");
  const secretKey = await getConfigValue("convert2pay_secret_key", "");
  const currency = await getConfigValue("convert2pay_currency", "UAH");

  if (!apiUrl) {
    return null;
  }

  if (merchantId && secretKey) {
    try {
      log(`Convert2pay API request to: ${apiUrl}`, "bot");
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

      const responseText = await response.text();
      log(`Convert2pay response (${response.status}): ${responseText.substring(0, 500)}`, "bot");

      try {
        const data = JSON.parse(responseText);
        if (response.ok) {
          const link = data.payment_url || data.url || data.redirect_url || data.link || null;
          if (link) return link;
        }
        log(`Convert2pay API error or no link in response`, "bot");
      } catch {
        log(`Convert2pay returned HTML - not a REST API, using URL as direct payment link`, "bot");
      }
    } catch (err) {
      log(`Convert2pay API request failed: ${err}`, "bot");
    }
  }

  log(`Using Convert2pay URL directly as payment link: ${apiUrl}`, "bot");
  return apiUrl;
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
          [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
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
        [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
      ],
    },
  });
}

async function showAdminStats(chatId: number) {
  const users = await storage.getAllBotUsers();
  const payments = await storage.getAllPayments();

  const totalUsers = users.length;
  const stepCounts: Record<string, number> = {};
  for (const u of users) {
    stepCounts[u.currentStep] = (stepCounts[u.currentStep] || 0) + 1;
  }

  const totalPayments = payments.length;
  const paidPayments = payments.filter(p => p.status === "paid");
  const pendingPayments = payments.filter(p => p.status === "pending");
  const paidAmount = paidPayments.reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

  const stepLines = Object.entries(stepCounts).map(([step, cnt]) => `  ${translateStep(step)}: ${cnt}`).join("\n");

  const text =
    `\u{1F4CA} \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430 \u0431\u043E\u0442\u0430\n\n` +
    `\u{1F465} \u0412\u0441\u044C\u043E\u0433\u043E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0456\u0432: ${totalUsers}\n\n` +
    `\u{1F4CD} \u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0456 \u043F\u043E \u043A\u0440\u043E\u043A\u0430\u0445:\n${stepLines}\n\n` +
    `\u{1F4B3} \u0412\u0441\u044C\u043E\u0433\u043E \u043F\u043B\u0430\u0442\u0435\u0436\u0456\u0432: ${totalPayments}\n` +
    `\u2705 \u041E\u043F\u043B\u0430\u0447\u0435\u043D\u043E: ${paidPayments.length} (${paidAmount} \u20B4)\n` +
    `\u23F3 \u041E\u0447\u0456\u043A\u0443\u044E\u0442\u044C: ${pendingPayments.length} (${pendingAmount} \u20B4)`;

  await bot!.sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u{1F519} \u041D\u0430\u0437\u0430\u0434", callback_data: "admin_menu" }],
      ],
    },
  });
}

async function showAdminUsers(chatId: number) {
  const users = await storage.getAllBotUsers();
  const last10 = users.slice(0, 10);

  if (last10.length === 0) {
    await bot!.sendMessage(chatId, "\u{1F465} \u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0456\u0432 \u043D\u0435\u043C\u0430\u0454.");
    return;
  }

  const lines = last10.map((u, i) =>
    `${i + 1}. \u{1F464} ${u.tgId}\n` +
    `   \u{1F4DD} @${u.username || "\u043D\u0435\u0432\u0456\u0434\u043E\u043C\u043E"}\n` +
    `   \u{1F4CD} \u041A\u0440\u043E\u043A: ${translateStep(u.currentStep)}\n` +
    `   \u{1F381} \u0411\u043E\u043D\u0443\u0441: ${u.claimedBonus ? "\u2705" : "\u274C"}`
  ).join("\n\n");

  await bot!.sendMessage(chatId, `\u{1F465} \u041E\u0441\u0442\u0430\u043D\u043D\u0456 10 \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0456\u0432:\n\n${lines}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "\u{1F519} \u041D\u0430\u0437\u0430\u0434", callback_data: "admin_menu" }],
      ],
    },
  });
}

async function showAdminPayments(chatId: number) {
  const allPayments = await storage.getAllPayments();
  const last10 = allPayments.slice(0, 10);

  if (last10.length === 0) {
    await bot!.sendMessage(chatId, "\u{1F4B3} \u041F\u043B\u0430\u0442\u0435\u0436\u0456\u0432 \u043D\u0435\u043C\u0430\u0454.");
    return;
  }

  const statusIcon = (s: string) => s === "paid" ? "\u2705" : s === "pending" ? "\u23F3" : s === "cancelled" ? "\u274C" : "\u{1F504}";

  const lines = last10.map((p, i) =>
    `${i + 1}. ${statusIcon(p.status)} ${translatePaymentStatus(p.status)}\n` +
    `   \u{1F464} TG: ${p.tgId}\n` +
    `   \u{1F4B0} ${p.amount} \u20B4\n` +
    `   \u{1F3AE} Player: ${p.playerId}\n` +
    `   \u{1F4C5} ${p.createdAt ? new Date(p.createdAt).toLocaleDateString("uk-UA") : "\u2014"}`
  ).join("\n\n");

  const pendingButtons = last10
    .filter(p => p.status === "pending")
    .map(p => [{ text: `\u2705 \u041F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u0438 #${p.id.slice(0, 6)}`, callback_data: `admin_confirm_${p.id}` }]);

  const keyboard = [...pendingButtons, [{ text: "\u{1F519} \u041D\u0430\u0437\u0430\u0434", callback_data: "admin_menu" }]];

  await bot!.sendMessage(chatId, `\u{1F4B3} \u041E\u0441\u0442\u0430\u043D\u043D\u0456 10 \u043F\u043B\u0430\u0442\u0435\u0436\u0456\u0432:\n\n${lines}`, {
    reply_markup: { inline_keyboard: keyboard },
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
    userManagerState.delete(tgId);
    await storage.updateBotUser(tgId, { currentStep: "HOME", paymentSubStep: null, paymentAmount: null, paymentPlayerId: null });
    await showHome(chatId, tgId);
  });

  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const managerChatId = await getConfigValue("manager_chat_id", "");
    if (!managerChatId || String(chatId) !== managerChatId) return;

    await bot!.sendMessage(chatId, "\u{1F6E0}\uFE0F \u0410\u0434\u043C\u0456\u043D-\u043F\u0430\u043D\u0435\u043B\u044C\n\n\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0434\u0456\u044E:", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "\u{1F4CA} \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430", callback_data: "admin_stats" }],
          [{ text: "\u{1F465} \u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0456", callback_data: "admin_users" }],
          [{ text: "\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0438", callback_data: "admin_payments" }],
          [{ text: "\u{1F4E2} \u0420\u043E\u0437\u0441\u0438\u043B\u043A\u0430", callback_data: "admin_broadcast" }],
        ],
      },
    });
  });

  bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const managerChatId = await getConfigValue("manager_chat_id", "");
    if (!managerChatId || String(chatId) !== managerChatId) return;

    await showAdminStats(chatId);
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
      userManagerState.set(tgId, true);
      await bot!.sendMessage(chatId, "\u{1F4AC} \u041E\u043F\u0438\u0448\u0456\u0442\u044C \u0432\u0430\u0448\u0443 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0443, \u0456 \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0441\u0442\u044C \u0432\u0430\u043C \u043D\u0430\u0439\u0431\u043B\u0438\u0436\u0447\u0438\u043C \u0447\u0430\u0441\u043E\u043C.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u274C \u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438", callback_data: "cancel_manager_msg" }],
          ],
        },
      });
      return;
    }

    if (data === "cancel_manager_msg") {
      userManagerState.delete(tgId);
      await bot!.sendMessage(chatId, "\u274C \u0417\u0432\u0435\u0440\u043D\u0435\u043D\u043D\u044F \u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u043E.");
      return;
    }

    if (data.startsWith("reply_to_")) {
      const parts = data.replace("reply_to_", "").split("_");
      const targetTgId = parts.pop()!;
      const messageId = parts.join("_");
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) === managerChatId) {
        managerReplyState.set(managerChatId, `${messageId}:${targetTgId}`);
        await bot!.sendMessage(chatId, `\u270F\uFE0F \u041D\u0430\u043F\u0438\u0448\u0456\u0442\u044C \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0443 (ID: ${targetTgId}):\n\n\u0412\u0456\u0434\u043F\u0440\u0430\u0432\u0442\u0435 \u0442\u0435\u043A\u0441\u0442\u043E\u0432\u0435 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0456 \u044F \u043F\u0435\u0440\u0435\u0448\u043B\u044E \u0439\u043E\u0433\u043E.`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u274C \u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438", callback_data: "cancel_reply" }],
            ],
          },
        });
      }
      return;
    }

    if (data === "cancel_reply") {
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) === managerChatId) {
        managerReplyState.delete(managerChatId);
        broadcastState.delete(managerChatId);
        await bot!.sendMessage(chatId, "\u274C \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u043E.");
      }
      return;
    }

    if (data === "admin_menu") {
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) === managerChatId) {
        await bot!.sendMessage(chatId, "\u{1F6E0}\uFE0F \u0410\u0434\u043C\u0456\u043D-\u043F\u0430\u043D\u0435\u043B\u044C\n\n\u041E\u0431\u0435\u0440\u0456\u0442\u044C \u0434\u0456\u044E:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F4CA} \u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0430", callback_data: "admin_stats" }],
              [{ text: "\u{1F465} \u041A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0456", callback_data: "admin_users" }],
              [{ text: "\u{1F4B3} \u041E\u043F\u043B\u0430\u0442\u0438", callback_data: "admin_payments" }],
              [{ text: "\u{1F4E2} \u0420\u043E\u0437\u0441\u0438\u043B\u043A\u0430", callback_data: "admin_broadcast" }],
            ],
          },
        });
      }
      return;
    }

    if (data === "admin_stats") {
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) === managerChatId) {
        await showAdminStats(chatId);
      }
      return;
    }

    if (data === "admin_users") {
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) === managerChatId) {
        await showAdminUsers(chatId);
      }
      return;
    }

    if (data === "admin_payments") {
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) === managerChatId) {
        await showAdminPayments(chatId);
      }
      return;
    }

    if (data === "admin_broadcast") {
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) === managerChatId) {
        broadcastState.set(managerChatId, true);
        await bot!.sendMessage(chatId, "\u{1F4E2} \u0420\u043E\u0437\u0441\u0438\u043B\u043A\u0430\n\n\u041D\u0430\u043F\u0438\u0448\u0456\u0442\u044C \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F, \u044F\u043A\u0435 \u0431\u0443\u0434\u0435 \u043D\u0430\u0434\u0456\u0441\u043B\u0430\u043D\u043E \u0432\u0441\u0456\u043C \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0430\u043C:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u274C \u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438", callback_data: "cancel_reply" }],
            ],
          },
        });
      }
      return;
    }

    if (data.startsWith("admin_confirm_")) {
      const managerChatId = await getConfigValue("manager_chat_id", "");
      if (String(chatId) !== managerChatId) return;

      const paymentId = data.replace("admin_confirm_", "");
      const payment = await storage.getPayment(paymentId);
      if (!payment) {
        await bot!.sendMessage(chatId, "\u274C \u041F\u043B\u0430\u0442\u0456\u0436 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E.");
        return;
      }

      await storage.updatePaymentStatus(paymentId, "paid");

      await sendMessageToUser(payment.tgId,
        `\u2705 \u0412\u0430\u0448\u0443 \u043E\u043F\u043B\u0430\u0442\u0443 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043E!\n\n\u{1F4B0} \u0421\u0443\u043C\u0430: ${payment.amount} \u20B4\n\u{1F3AE} Player ID: ${payment.playerId}`
      );

      await bot!.sendMessage(chatId,
        `\u2705 \u041F\u043B\u0430\u0442\u0456\u0436 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u043E!\n\n\u{1F464} TG: ${payment.tgId}\n\u{1F4B0} ${payment.amount} \u20B4\n\u{1F3AE} Player: ${payment.playerId}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{1F519} \u041D\u0430\u0437\u0430\u0434 \u0434\u043E \u043E\u043F\u043B\u0430\u0442", callback_data: "admin_payments" }],
          ],
        },
      });
      return;
    }

    if (data === "rules") {
      const rulesText = await getConfigValue("rules_text",
        "\u{1F4CB} \u041F\u0440\u0430\u0432\u0438\u043B\u0430:\n\n1. \u0412\u0441\u0442\u0430\u043D\u043E\u0432\u0456\u0442\u044C \u0434\u043E\u0434\u0430\u0442\u043E\u043A\n2. \u0412\u0441\u0442\u0443\u043F\u0456\u0442\u044C \u0434\u043E \u043A\u043B\u0443\u0431\u0443\n3. \u041E\u0442\u0440\u0438\u043C\u0430\u0439\u0442\u0435 \u0431\u043E\u043D\u0443\u0441\n4. \u041F\u043E\u043F\u043E\u0432\u043D\u044E\u0439\u0442\u0435 \u0440\u0430\u0445\u0443\u043D\u043E\u043A");
      await bot!.sendMessage(chatId, rulesText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
          ],
        },
      });
      return;
    }

    if (data === "go_home") {
      userManagerState.delete(tgId);
      await storage.updateBotUser(tgId, { currentStep: "HOME", paymentSubStep: null, paymentAmount: null, paymentPlayerId: null });
      await showHome(chatId, tgId);
      return;
    }

    if (data === "show_android" || data === "show_ios" || data === "show_windows") {
      const platform = data.replace("show_", "") as "android" | "ios" | "windows";
      await showPlatformVideo(chatId, platform);
      return;
    }

    if (data === "installed_app") {
      if (user.currentStep === "HOME" || user.currentStep === "STEP_1") {
        await storage.updateBotUser(tgId, { currentStep: "STEP_2" });
        await showStep2(chatId);
      }
      return;
    }

    if (data === "joined_club") {
      if (user.currentStep === "STEP_2") {
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
      await bot!.sendMessage(chatId, "\u270F\uFE0F \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u0441\u0443\u043C\u0443 \u043F\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F (\u0447\u0438\u0441\u043B\u043E):", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
          ],
        },
      });
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
        await bot!.sendMessage(chatId, `\u2705 \u041E\u043F\u043B\u0430\u0442\u0430 \u043F\u0456\u0434\u0442\u0432\u0435\u0440\u0434\u0436\u0435\u043D\u0430!\n\n\u{1F4B0} \u0421\u0443\u043C\u0430: ${payment.amount} \u20B4\n\u{1F3AE} Player ID: ${payment.playerId}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F4B3} \u041F\u043E\u043F\u043E\u0432\u043D\u0438\u0442\u0438 \u0449\u0435", callback_data: "go_payment" }],
              [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
            ],
          },
        });
      } else if (payment.status === "cancelled") {
        await bot!.sendMessage(chatId, "\u274C \u041E\u043F\u043B\u0430\u0442\u0430 \u0441\u043A\u0430\u0441\u043E\u0432\u0430\u043D\u0430. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0437\u043D\u043E\u0432\u0443.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F4B3} \u041F\u043E\u043F\u043E\u0432\u043D\u0438\u0442\u0438", callback_data: "go_payment" }],
              [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
            ],
          },
        });
      } else {
        await bot!.sendMessage(chatId, "\u23F3 \u041E\u043F\u043B\u0430\u0442\u0430 \u0432 \u043E\u0431\u0440\u043E\u0431\u0446\u0456. \u0421\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u043F\u0456\u0437\u043D\u0456\u0448\u0435.", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F504} \u041F\u0435\u0440\u0435\u0432\u0456\u0440\u0438\u0442\u0438 \u0449\u0435 \u0440\u0430\u0437", callback_data: `check_payment_${paymentId}` }],
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

    const managerChatId = await getConfigValue("manager_chat_id", "");
    if (managerChatId && String(chatId) === managerChatId) {
      const replyInfo = managerReplyState.get(managerChatId);
      if (replyInfo && msg.text) {
        const [messageId, targetTgId] = replyInfo.split(":");
        managerReplyState.delete(managerChatId);

        await sendMessageToUser(targetTgId, `\u{1F4AC} \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u0430:\n\n${msg.text}`);

        if (messageId) {
          await storage.createMessageReply({
            messageId,
            text: msg.text,
            source: "telegram",
          });
        }

        await bot!.sendMessage(chatId, `\u2705 \u0412\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C \u0432\u0456\u0434\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0443 ${targetTgId}!`);
        return;
      }

      if (broadcastState.get(managerChatId) && msg.text) {
        broadcastState.delete(managerChatId);
        const allUsers = await storage.getAllBotUsers();
        let sent = 0;
        let failed = 0;

        await bot!.sendMessage(chatId, `\u{1F4E2} \u0420\u043E\u0437\u0441\u0438\u043B\u043A\u0430 \u0440\u043E\u0437\u043F\u043E\u0447\u0430\u0442\u0430... (\u{1F465} ${allUsers.length} \u043A\u043E\u0440\u0438\u0441\u0442\u0443\u0432\u0430\u0447\u0456\u0432)`);

        for (const u of allUsers) {
          try {
            await bot!.sendMessage(parseInt(u.tgId), msg.text);
            sent++;
          } catch (err) {
            failed++;
            log(`Broadcast failed for ${u.tgId}: ${err}`, "bot");
          }
        }

        await bot!.sendMessage(chatId,
          `\u2705 \u0420\u043E\u0437\u0441\u0438\u043B\u043A\u0443 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u043E!\n\n` +
          `\u{1F4E8} \u041D\u0430\u0434\u0456\u0441\u043B\u0430\u043D\u043E: ${sent}\n` +
          `\u274C \u041F\u043E\u043C\u0438\u043B\u043A\u0438: ${failed}`, {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F519} \u041D\u0430\u0437\u0430\u0434", callback_data: "admin_menu" }],
            ],
          },
        });
        return;
      }

      return;
    }

    if (msg.text === "\u{1F4DE} \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 24/7") {
      await ensureUser(tgId, msg.from?.username);
      userManagerState.set(tgId, true);
      await bot!.sendMessage(chatId, "\u{1F4AC} \u041E\u043F\u0438\u0448\u0456\u0442\u044C \u0432\u0430\u0448\u0443 \u043F\u0440\u043E\u0431\u043B\u0435\u043C\u0443, \u0456 \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0441\u0442\u044C \u0432\u0430\u043C \u043D\u0430\u0439\u0431\u043B\u0438\u0436\u0447\u0438\u043C \u0447\u0430\u0441\u043E\u043C.", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u274C \u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438", callback_data: "cancel_manager_msg" }],
          ],
        },
      });
      return;
    }

    if (userManagerState.get(tgId) && msg.text) {
      userManagerState.delete(tgId);
      const user = await storage.getBotUser(tgId);
      const step = user?.currentStep || "HOME";
      await sendManagerNotification(tgId, msg.from?.username || null, step, msg.text);
      await bot!.sendMessage(chatId, "\u2705 \u0412\u0430\u0448\u0435 \u043F\u043E\u0432\u0456\u0434\u043E\u043C\u043B\u0435\u043D\u043D\u044F \u0432\u0456\u0434\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440\u0443. \u041E\u0447\u0456\u043A\u0443\u0439\u0442\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u044C!", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
          ],
        },
      });
      return;
    }

    const user = await storage.getBotUser(tgId);
    if (!user) return;

    if (user.currentStep === "PAYMENT" && user.paymentSubStep === "custom_amount") {
      const amount = parseInt(msg.text || "");
      if (isNaN(amount) || amount <= 0) {
        await bot!.sendMessage(chatId, "\u274C \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0443 \u0441\u0443\u043C\u0443 (\u043F\u043E\u0437\u0438\u0442\u0438\u0432\u043D\u0435 \u0447\u0438\u0441\u043B\u043E):", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
            ],
          },
        });
        return;
      }
      await storage.updateBotUser(tgId, { paymentAmount: amount, paymentSubStep: "player_id" });
      await showPaymentStep2(chatId, amount);
      return;
    }

    if (user.currentStep === "PAYMENT" && user.paymentSubStep === "player_id") {
      const playerId = msg.text?.trim() || "";
      if (!playerId) {
        await bot!.sendMessage(chatId, "\u274C \u0412\u0432\u0435\u0434\u0456\u0442\u044C \u043A\u043E\u0440\u0435\u043A\u0442\u043D\u0438\u0439 Player ID:", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "\u{1F3E0} \u0413\u043E\u043B\u043E\u0432\u043D\u0430", callback_data: "go_home" }],
            ],
          },
        });
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
