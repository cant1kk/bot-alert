import { Session, Env } from "./types";

const SESSION_TTL = 3600; // 1 hour

export async function getSession(env: Env, userId: number): Promise<Session> {
  const key = `session:${userId}`;
  const data = await env.SESSIONS.get(key);
  if (data) {
    return JSON.parse(data);
  }
  return {
    userId,
    target: null,
    awaitingText: false,
    createdAt: Date.now(),
  };
}

export async function saveSession(env: Env, session: Session): Promise<void> {
  const key = `session:${session.userId}`;
  await env.SESSIONS.put(key, JSON.stringify(session), { expirationTtl: SESSION_TTL });
}

export async function clearSession(env: Env, userId: number): Promise<void> {
  const key = `session:${userId}`;
  await env.SESSIONS.delete(key);
}
