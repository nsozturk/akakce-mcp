import { apiGet, fetchText, absoluteUrl, codeFromUrl } from "../client.js";
import { ApiEnvelope, PrQueryResult } from "../types.js";
import { ToolDef, z } from "./tool.js";

/**
 * Akakçe does not expose price-history datapoints as JSON; instead it renders a
 * price-graph PNG on `akakce-g.akamaized.net` at the path
 *   /{code}:{price*100}:{version}
 * embedded in the product page as `data-u="..."` on the price-analysis widget.
 *
 * We resolve the product page and extract that image URL — it is the authoritative
 * chart for the product. No numeric series is available publicly.
 */
const GRAPH_URL_RE =
  /https:\/\/akakce-g\.akamaized\.net\/[0-9]+:[0-9]+:[0-9.]+/;

export const priceHistoryTool: ToolDef = {
  name: "akakce_price_history",
  config: {
    title: "Akakçe price history",
    description:
      "Bir ürünün fiyat geçmişi grafiğini döndürür. Akakçe geçmişi yalnızca hazır bir grafik GÖRSELİ (PNG) olarak sunar — sayısal veri noktası yoktur. Sonuçta grafiğin doğrudan görüntü URL'i döner (kullanıcıya gösterilebilir). Sadece ürün `code`'u yeterli.",
    inputSchema: {
      code: z
        .number()
        .int()
        .optional()
        .describe("Ürün kodu (akakce_search/autocomplete sonucundan)."),
      url: z
        .string()
        .optional()
        .describe("Ürün sayfası URL'i (opsiyonel)."),
    },
  },
  handler: async ({ code, url }: { code?: number; url?: string }) => {
    if (code === undefined && !url) {
      throw new Error("En az 'code' veya 'url' verilmelidir.");
    }
    const resolvedCode = code ?? (url ? codeFromUrl(url) : undefined);

    let pageUrl = url;
    if (!pageUrl && resolvedCode !== undefined) {
      const d = await apiGet<ApiEnvelope<PrQueryResult>>("/product/prQuery", {
        PrCode: resolvedCode,
        Page: 1,
      }).catch(() => undefined);
      pageUrl = d?.result?.metadata?.redirectUrl;
    }

    if (!pageUrl) {
      return {
        code: resolvedCode,
        supported: false,
        note: "Ürün sayfası çözülemedi; geçerli bir code ya da url verin.",
      };
    }

    const htmlText = await fetchText(absoluteUrl(pageUrl)!, "text/html");
    const m = htmlText.match(GRAPH_URL_RE);
    if (!m) {
      return {
        code: resolvedCode,
        productUrl: absoluteUrl(pageUrl),
        supported: false,
        note: "Bu ürün için fiyat geçmişi grafiği bulunamadı (yeni/az veri olan ürün olabilir).",
      };
    }
    return {
      code: resolvedCode,
      productUrl: absoluteUrl(pageUrl),
      format: "png",
      note: "Akakçe fiyat geçmişini sayısal değil, hazır grafik görseli olarak sunar. Aşağıdaki URL fiyat-zaman grafiğinin PNG'sidir.",
      priceGraphImageUrl: m[0],
    };
  },
};
