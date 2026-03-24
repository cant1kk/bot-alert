import { ComplaintTarget } from "./types";

export const TARGET_LABELS: Record<ComplaintTarget, string> = {
  client: "👤 На клиента",
  yandex_eda: "📦 На Яндекс.Еду",
  restaurant: "🍽️ На ресторан/магазин",
};

export const TARGET_DESCRIPTIONS: Record<ComplaintTarget, string> = {
  client:
    "Жалоба на действия клиента (ложные жалобы, оскорбления, мошенничество и т.д.)",
  yandex_eda:
    "Жалоба на сам сервис Яндекс.Еда (задержка, отказ возврата, списания и т.д.)",
  restaurant:
    "Жалоба на ресторан или магазин в Яндекс.Еда (качество еды, санитария, обман и т.д.)",
};
