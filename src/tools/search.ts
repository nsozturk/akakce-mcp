import { apiGet, absoluteUrl, WEB_BASE } from "../client.js";
import {
  ApiEnvelope,
  AutocompleteResult,
  SearchCoreResult,
  SearchPageResult,
  ApiProduct,
} from "../types.js";
import { ToolDef, z } from "./tool.js";

/** Trim a raw product to the fields agents actually need. */
function slimProduct(p: ApiProduct) {
  return {
    code: p.code,
    name: p.name,
    brand: p.mkName,
    price: p.price,
    unit: p.unit,
    sellerCount: p.countOfPrices,
    rating: p.rating,
    followCount: p.followCount,
    hasPriceHistory: p.hasGraph ?? false,
    colorVariants: p.colorVariants,
    image: absoluteUrl(p.imageUrl),
    productUrl: absoluteUrl(p.url),
  };
}

export const autocompleteTool: ToolDef = {
  name: "akakce_autocomplete",
  config: {
    title: "Akakçe autocomplete",
    description:
      "Akakçe arama önerileri. Bir arama ifadesi için ürün/kategori önerilerini ve (varsa) ürün kodlarını döndürür. Kullanıcı tam ürün adını bilmiyorsa önce bununla doğru ifadeyi/kodu bul.",
    inputSchema: {
      query: z.string().min(1).describe("Aranacak ifade, örn. 'rtx 5070'"),
    },
  },
  handler: async ({ query }: { query: string }) => {
    const data = await apiGet<ApiEnvelope<AutocompleteResult>>("/autocomplete", {
      p: 8,
      q: query,
    });
    const groups = data.result?.groups ?? [];
    return {
      query,
      suggestions: groups.map((g) => ({
        title: g.title,
        items: g.items.map((it) => ({
          text: it.text,
          type: it.action?.type,
          code: it.action?.code,
          url: absoluteUrl(it.action?.url),
        })),
      })),
    };
  },
};

export const searchTool: ToolDef = {
  name: "akakce_search",
  config: {
    title: "Akakçe product search",
    description:
      "Akakçe'de ürün arar ve fiyatlı sonuç listesi döndürür. Her ürün: ad, marka, en düşük fiyat, satıcı sayısı, rating, ürün kodu (price/detail için kullan) ve ürün sayfası URL'i. Sayfalama (page) ve filtreleme (ctCode + filterIds, bunları akakce_search_filters'tan al) destekler.",
    inputSchema: {
      phrase: z.string().min(1).describe("Arama ifadesi"),
      page: z.number().int().positive().default(1).describe("Sayfa (1'den başlar)"),
      sort: z
        .number()
        .int()
        .default(1)
        .describe("Sıralama kodu (1 = varsayılan/önerilen)"),
      ctCode: z
        .number()
        .int()
        .optional()
        .describe("Kategori kodu — sonucu tek kategoriye daraltır (opsiyonel)"),
      filterIds: z
        .array(z.number().int())
        .optional()
        .describe("Filtre id'leri (akakce_search_filters'tan). Verilirse filtreli arama yapılır."),
    },
  },
  handler: async ({
    phrase,
    page = 1,
    sort = 1,
    ctCode,
    filterIds,
  }: {
    phrase: string;
    page?: number;
    sort?: number;
    ctCode?: number;
    filterIds?: number[];
  }) => {
    const useFilter = ctCode !== undefined || (filterIds && filterIds.length > 0);

    if (useFilter) {
      const data = await apiGet<ApiEnvelope<SearchPageResult>>("/search/filter", {
        Phrase: phrase,
        Page: page,
        Sort: sort,
        CtCode: ctCode,
        FilterIds: filterIds && filterIds.length ? filterIds : undefined,
      });
      const list = data.result?.productList;
      return {
        phrase,
        page,
        appliedCtCode: ctCode,
        appliedFilterIds: filterIds,
        totalProducts: list?.countOfProducts,
        products: (list?.products ?? []).map(slimProduct),
      };
    }

    // page 1 uses /search/core (carries metadata + total); later pages use /search/page
    if (page <= 1) {
      const data = await apiGet<ApiEnvelope<SearchCoreResult>>("/search/core", {
        Phrase: phrase,
        Page: 1,
        Sort: sort,
      });
      const list = data.result?.productList;
      return {
        phrase,
        page: 1,
        title: data.result?.metadata?.title,
        shareUrl: data.result?.metadata?.shareUrl ?? `${WEB_BASE}/arama/?q=${encodeURIComponent(phrase)}`,
        totalProducts: list?.countOfProducts,
        products: (list?.products ?? []).map(slimProduct),
      };
    }

    const data = await apiGet<ApiEnvelope<SearchPageResult>>("/search/page", {
      Phrase: phrase,
      Page: page,
      Sort: sort,
    });
    const list = data.result?.productList;
    return {
      phrase,
      page,
      products: (list?.products ?? []).map(slimProduct),
    };
  },
};

export { slimProduct };
