import { apiGet, fetchText, absoluteUrl, codeFromUrl, WEB_BASE } from "../client.js";
import {
  ApiEnvelope,
  QuickViewResult,
  QvPrice,
  PgListResult,
  PgListEntry,
  PrQueryResult,
} from "../types.js";
import { ToolDef, z } from "./tool.js";

/**
 * The quickview outbound url looks like
 *   #/111/?z=...&f=%2fr%2f%3fpr%3d903116822%26vd%3d317%26pg%3d1221121221
 * The `f` param, url-decoded, is the real akakce redirect path (/r/?pr=..&vd=..).
 */
function goUrl(qvUrl?: string): string | undefined {
  if (!qvUrl) return undefined;
  const m = qvUrl.match(/[?&]f=([^&]+)/);
  if (!m) return undefined;
  try {
    return `${WEB_BASE}${decodeURIComponent(m[1])}`;
  } catch {
    return undefined;
  }
}

function slimPrice(p: QvPrice) {
  return {
    price: p.price,
    shipPrice: p.shipPrice,
    seller: p.vdName,
    badge: p.badge,
    lastUpdate: p.lastUpdateText,
    goUrl: goUrl(p.url),
  };
}

export const productPricesTool: ToolDef = {
  name: "akakce_product_prices",
  config: {
    title: "Akakçe product prices",
    description:
      "Bir veya daha fazla ürün kodu için Akakçe'deki en ucuz satıcıları (quickview) döndürür: fiyat, kargo, satıcı adı, son güncelleme ve satıcıya gidiş linki. Ürün kodlarını akakce_search / akakce_autocomplete sonuçlarından al. Birden çok kodu tek çağrıda ver (toplu).",
    inputSchema: {
      codes: z
        .array(z.number().int())
        .min(1)
        .max(50)
        .describe("Ürün kodları listesi (en fazla 50)"),
    },
  },
  handler: async ({ codes }: { codes: number[] }) => {
    const data = await apiGet<ApiEnvelope<QuickViewResult>>(
      "/quickview/getall",
      { prCodes: codes },
    );
    const products = data.result?.products ?? [];
    return {
      products: products.map((p) => ({
        code: p.prCode,
        cheapest: p.qvPrices?.[0] ? slimPrice(p.qvPrices[0]) : undefined,
        sellers: (p.qvPrices ?? []).map(slimPrice),
      })),
    };
  },
};

interface LdProduct {
  name?: string;
  sku?: string;
  brand?: { name?: string };
  image?: Array<{ contentUrl?: string }> | { contentUrl?: string };
  aggregateRating?: { ratingValue?: string; ratingCount?: string };
  additionalProperty?: Array<{ name?: string; value?: string }>;
  offers?: {
    offerCount?: string;
    lowPrice?: string;
    highPrice?: string;
    priceCurrency?: string;
    offers?: Array<{
      price?: string;
      url?: string;
      availability?: string;
      seller?: { name?: string };
    }>;
  };
}

function extractLdProduct(htmlText: string): LdProduct | undefined {
  const re = /<script type="application\/ld\+json">(.*?)<\/script>/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(htmlText)) !== null) {
    try {
      const obj = JSON.parse(m[1]);
      if (obj && obj["@type"] === "Product") return obj as LdProduct;
    } catch {
      /* ignore non-product / malformed blocks */
    }
  }
  return undefined;
}

/** Resolve a product's canonical page URL from its code via prQuery. */
async function resolveUrl(code: number): Promise<string | undefined> {
  try {
    const d = await apiGet<ApiEnvelope<PrQueryResult>>("/product/prQuery", {
      PrCode: code,
      Page: 1,
    });
    return d.result?.metadata?.redirectUrl;
  } catch {
    return undefined;
  }
}

function slimSeller(s: PgListEntry) {
  return {
    seller: s.vdName,
    price: s.price,
    shipPrice: s.shipPrice,
    badge: s.badge,
    delivery: s.deliveryText,
    sellerRating: s.vdRating,
    sellerRatingCount: s.vdRatingCount,
    lastUpdate: s.lastUpdateTime,
    goUrl: goUrl(s.url),
  };
}

export const productDetailTool: ToolDef = {
  name: "akakce_product_detail",
  config: {
    title: "Akakçe product detail",
    description:
      "Bir ürünün tam detayını döndürür: ad, marka, teknik özellikler, ortalama puan, en düşük/en yüksek fiyat ve TÜM satıcıların listesi (fiyat, kargo, satıcı puanı, teslimat, satıcıya direkt gidiş linki). Sadece ürün `code`'u yeterli — URL otomatik çözülür. İstersen `url` (akakce_search'teki productUrl) vererek bir istek atlayabilirsin.",
    inputSchema: {
      code: z
        .number()
        .int()
        .optional()
        .describe("Ürün kodu (akakce_search/autocomplete sonucundan). Tek başına yeterli."),
      url: z
        .string()
        .optional()
        .describe("Ürün sayfası URL'i (opsiyonel; verilirse code'dan çözmeye gerek kalmaz)."),
    },
  },
  handler: async ({ code, url }: { code?: number; url?: string }) => {
    if (code === undefined && !url) {
      throw new Error("En az 'code' veya 'url' verilmelidir.");
    }
    const resolvedCode = code ?? (url ? codeFromUrl(url) : undefined);
    if (resolvedCode === undefined) {
      throw new Error("Ürün kodu çözülemedi (url'den de çıkarılamadı).");
    }

    let pageUrl = url ?? (await resolveUrl(resolvedCode));

    // Full seller list (pgList) + product page (ld+json specs) in parallel.
    const [pgRes, htmlText] = await Promise.all([
      apiGet<ApiEnvelope<PgListResult>>("/product/pgList", {
        PrCode: resolvedCode,
        Page: 1,
      }).catch(() => undefined),
      pageUrl
        ? fetchText(absoluteUrl(pageUrl)!, "text/html").catch(() => undefined)
        : Promise.resolve(undefined),
    ]);

    const sellers = (pgRes?.result?.pgList ?? []).map(slimSeller);
    const ld = htmlText ? extractLdProduct(htmlText) : undefined;
    const image = Array.isArray(ld?.image)
      ? ld?.image[0]?.contentUrl
      : ld?.image?.contentUrl;

    return {
      code: resolvedCode,
      name: ld?.name,
      brand: ld?.brand?.name,
      productUrl: absoluteUrl(pageUrl),
      image,
      rating: ld?.aggregateRating
        ? {
            value: ld.aggregateRating.ratingValue,
            count: ld.aggregateRating.ratingCount,
          }
        : undefined,
      priceSummary: ld?.offers
        ? {
            sellerCount: ld.offers.offerCount,
            lowPrice: ld.offers.lowPrice,
            highPrice: ld.offers.highPrice,
            currency: ld.offers.priceCurrency ?? "TRY",
          }
        : undefined,
      specs: (ld?.additionalProperty ?? []).map((p) => ({
        name: p.name,
        value: p.value,
      })),
      // Full seller list from /product/pgList — every listed seller with go-links.
      sellers,
    };
  },
};
