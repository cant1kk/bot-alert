export type ComplaintTarget = "client" | "yandex_eda" | "restaurant";

export interface Session {
  userId: number;
  target: ComplaintTarget | null;
  awaitingText: boolean;
  createdAt: number;
}

export interface Env {
  SESSIONS: KVNamespace;
  GROQ_API_KEY: string;
  TELEGRAM_BOT_TOKEN: string;
}

export interface GroqWhisperResponse {
  text: string;
}

export interface GroqChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
