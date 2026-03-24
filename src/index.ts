import { handleUpdate } from "./telegram";
import { Env } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Bot is running", { status: 200 });
    }

    // Telegram webhook endpoint
    if (url.pathname === "/webhook" && request.method === "POST") {
      try {
        const update = await request.json();
        await handleUpdate(env, update);
        return new Response("OK", { status: 200 });
      } catch (error) {
        console.error("Webhook error:", error);
        return new Response("Error", { status: 500 });
      }
    }

    // Set webhook (call once after deploy)
    // GET /set-webhook?url=https://your-worker.workers.dev/webhook
    if (url.pathname === "/set-webhook" && request.method === "GET") {
      const webhookUrl = url.searchParams.get("url");
      if (!webhookUrl) {
        return new Response("Missing ?url= parameter", { status: 400 });
      }

      const res = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${webhookUrl}`
      );
      const data = await res.json();
      return Response.json(data);
    }

    return new Response("Not Found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
