import { Env, ComplaintTarget } from "./types";
import { getSession, saveSession, clearSession } from "./session";
import { transcribeVoice, generateComplaint } from "./groq";
import { TARGET_LABELS, TARGET_DESCRIPTIONS } from "./complaints";

const TG_BASE = "https://api.telegram.org/bot";

// --- Telegram API helpers ---

async function tg(env: Env, method: string, body?: Record<string, unknown>): Promise<Response> {
  return fetch(`${TG_BASE}${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function sendMessage(env: Env, chatId: number, text: string, extra?: Record<string, unknown>) {
  const res = await tg(env, "sendMessage", { chat_id: chatId, text, ...extra });
  return res.json() as Promise<{ ok: boolean; result?: { message_id: number } }>;
}

async function editMessage(env: Env, chatId: number, messageId: number, text: string, extra?: Record<string, unknown>) {
  await tg(env, "editMessageText", { chat_id: chatId, message_id: messageId, text, ...extra });
}

async function answerCbQuery(env: Env, id: string, text?: string) {
  await tg(env, "answerCallbackQuery", { callback_query_id: id, ...(text ? { text } : {}) });
}

async function getFileUrl(env: Env, fileId: string): Promise<string> {
  const res = await tg(env, "getFile", { file_id: fileId });
  const data = (await res.json()) as { result: { file_path: string } };
  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

// --- Keyboard builders ---

function targetKeyboard() {
  return {
    inline_keyboard: [
      [{ text: TARGET_LABELS.client, callback_data: "target:client" }],
      [{ text: TARGET_LABELS.yandex_eda, callback_data: "target:yandex_eda" }],
      [{ text: TARGET_LABELS.restaurant, callback_data: "target:restaurant" }],
    ],
  };
}

function newComplaintKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "📝 Новая жалоба", callback_data: "cmd:new" }],
    ],
  };
}

// --- Main handler ---

export async function handleUpdate(env: Env, update: any): Promise<void> {
  // --- Callback queries ---
  if (update.callback_query) {
    const cq = update.callback_query;
    const data = cq.data;
    const userId = cq.from.id;
    const chatId = cq.message?.chat?.id ?? userId;

    if (data === "cmd:new") {
      await clearSession(env, userId);
      await answerCbQuery(env, cq.id);
      await sendMessage(env, chatId, "Выберите тип жалобы:", {
        reply_markup: targetKeyboard(),
      });
      return;
    }

    if (data?.startsWith("target:")) {
      const target = data.split(":")[1] as ComplaintTarget;
      const session = await getSession(env, userId);
      session.target = target;
      session.awaitingText = true;
      await saveSession(env, session);

      await answerCbQuery(env, cq.id);
      await editMessage(env, chatId, cq.message.message_id,
        `✅ Выбрано: *${TARGET_LABELS[target]}*\n\n` +
        `${TARGET_DESCRIPTIONS[target]}\n\n` +
        `📝 Опишите ситуацию своими словами — отправьте текст или голосовое 🎤\n\n` +
        `Чем подробнее — тем качественнее жалоба.`,
        { parse_mode: "Markdown" }
      );
      return;
    }

    await answerCbQuery(env, cq.id);
    return;
  }

  // --- Messages ---
  if (update.message) {
    const msg = update.message;
    const userId = msg.from?.id;
    const chatId = msg.chat.id;

    if (!userId) return;

    // /start
    if (msg.text === "/start") {
      await clearSession(env, userId);
      await sendMessage(env, chatId,
        "🤖 *Бот для составления жалоб*\n\nВыберите, на кого хотите пожаловаться:",
        { parse_mode: "Markdown", reply_markup: targetKeyboard() }
      );
      return;
    }

    // /new
    if (msg.text === "/new") {
      await clearSession(env, userId);
      await sendMessage(env, chatId, "Выберите тип жалобы:", {
        reply_markup: targetKeyboard(),
      });
      return;
    }

    const session = await getSession(env, userId);

    if (!session.awaitingText || !session.target) {
      await sendMessage(env, chatId, "Сначала выберите тип жалобы — /start или /new");
      return;
    }

    // --- Text message ---
    if (msg.text && !msg.text.startsWith("/")) {
      const text = msg.text;
      if (text.length < 10) {
        await sendMessage(env, chatId, "⚠️ Опишите подробнее. Минимум 10 символов.");
        return;
      }
      await processComplaint(env, chatId, userId, session.target, text);
      return;
    }

    // --- Voice message ---
    if (msg.voice) {
      const voice = msg.voice;
      if (voice.duration > 120) {
        await sendMessage(env, chatId, "⚠️ Максимум 2 минуты.");
        return;
      }

      const res = await sendMessage(env, chatId, "🎤 Распознаю голосовое...");
      const statusMsgId = res.result?.message_id;

      try {
        const fileUrl = await getFileUrl(env, voice.file_id);
        const audioRes = await fetch(fileUrl);
        const audioBuffer = await audioRes.arrayBuffer();

        const transcribed = await transcribeVoice(env, audioBuffer, `${voice.file_id}.ogg`);

        if (statusMsgId) {
          await editMessage(env, chatId, statusMsgId,
            `🎤 Распознано: "${transcribed}"\n\n⏳ Генерирую жалобу...`);
        }

        await processComplaint(env, chatId, userId, session.target, transcribed);
      } catch (error) {
        console.error("Voice error:", error);
        if (statusMsgId) {
          await editMessage(env, chatId, statusMsgId,
            "❌ Ошибка распознавания. Попробуйте текстом — /new");
        }
      }
      return;
    }

    await sendMessage(env, chatId, "Отправьте текстовое или голосовое сообщение с описанием жалобы.");
  }
}

// --- Complaint processing ---

async function processComplaint(
  env: Env,
  chatId: number,
  userId: number,
  target: ComplaintTarget,
  description: string
): Promise<void> {
  const res = await sendMessage(env, chatId, "⏳ Составляю жалобу...");
  const statusMsgId = res.result?.message_id;

  try {
    const complaint = await generateComplaint(env, target, description);
    const chunks = splitText(complaint);

    if (statusMsgId) {
      await editMessage(env, chatId, statusMsgId, "✅ Жалоба готова!");
    }

    for (let i = 0; i < chunks.length; i++) {
      const prefix = chunks.length > 1 ? `📄 Часть ${i + 1}/${chunks.length}\n\n` : "";
      await sendMessage(env, chatId, `${prefix}${chunks[i]}`);
    }

    await clearSession(env, userId);
    await sendMessage(env, chatId, "📌 Ещё одна жалоба?", {
      reply_markup: newComplaintKeyboard(),
    });
  } catch (error) {
    console.error("Generation error:", error);
    if (statusMsgId) {
      await editMessage(env, chatId, statusMsgId,
        "❌ Ошибка генерации. Попробуйте /new");
    }
  }
}

function splitText(text: string, maxLen = 4000): string[] {
  if (text.length <= maxLen) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) { chunks.push(remaining); break; }
    let splitAt = remaining.lastIndexOf("\n\n", maxLen);
    if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf("\n", maxLen);
    if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf(" ", maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;
    chunks.push(remaining.substring(0, splitAt));
    remaining = remaining.substring(splitAt).trimStart();
  }
  return chunks;
}
