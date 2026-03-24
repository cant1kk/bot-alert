import { ComplaintTarget } from "./types";

export const TARGET_LABELS: Record<ComplaintTarget, string> = {
  client: "👤 На клиента",
  yandex_eda: "📦 На Яндекс.Еду",
  restaurant: "🍽️ На ресторан/магазин",
};

export const TARGET_DESCRIPTIONS: Record<ComplaintTarget, string> = {
  client:
    "Жалоба на клиента: оскорбления, ложные жалобы, невыход за заказом и т.д.",
  yandex_eda:
    "Жалоба на Яндекс.Еду: штрафы, задержка выплат, баги приложения и т.д.",
  restaurant:
    "Жалоба на ресторан: долгое ожидание, грубость персонала, неполный заказ и т.д.",
};
