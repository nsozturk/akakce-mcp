import { ToolDef, z } from "./tool.js";
import { firePassChat, fireworksKeyAvailable } from "../llm/firepass.js";

/**
 * Optional LLM enrichment over Akakçe results. Runs ONLY on the Fire-Pass guarded
 * Kimi K2.6 Turbo router (see src/llm/firepass.ts). Disabled when FIREWORKS_API_KEY
 * is absent — the rest of the server works without it.
 */
export const llmEnrichTool: ToolDef = {
  name: "akakce_llm_enrich",
  config: {
    title: "Akakçe LLM enrich (Fire-Pass Kimi turbo)",
    description:
      "Akakçe arama/fiyat sonuçlarını bir LLM ile yorumlar: özetler, normalize eder, karşılaştırır veya verilen talimata göre filtreler. SADECE Fire-Pass guard'lı Kimi K2.6 Turbo ile çalışır. FIREWORKS_API_KEY tanımlı değilse devre dışıdır. Girdi olarak diğer akakce_* tool'larından aldığın JSON'u (ürünler/satıcılar) ver.",
    inputSchema: {
      data: z
        .string()
        .min(1)
        .describe("İşlenecek Akakçe verisi (genelde başka bir akakce_* tool çıktısının JSON metni)."),
      instruction: z
        .string()
        .min(1)
        .describe("Ne yapılacağı, örn. 'en iyi fiyat/performans 3 ürünü seç ve neden olduğunu açıkla'."),
    },
  },
  handler: async ({
    data,
    instruction,
  }: {
    data: string;
    instruction: string;
  }) => {
    if (!fireworksKeyAvailable()) {
      return {
        enabled: false,
        note: "akakce_llm_enrich devre dışı: FIREWORKS_API_KEY ortam değişkeni tanımlı değil. Diğer akakce_* tool'ları LLM olmadan tam çalışır.",
      };
    }
    const content = await firePassChat([
      {
        role: "system",
        content:
          "Sen Akakçe (Türk fiyat-karşılaştırma sitesi) verisi üzerinde çalışan bir asistansın. " +
          "Sana verilen JSON ürün/fiyat verisini, kullanıcının talimatına göre kısa ve net biçimde işle. " +
          "Yalnızca verideki bilgilere dayan, fiyat uydurma. Türkçe yanıt ver.",
      },
      {
        role: "user",
        content: `Talimat: ${instruction}\n\nVeri:\n${data}`,
      },
    ]);
    return { enabled: true, result: content };
  },
};
