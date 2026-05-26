import { apiGet } from "../client.js";
import {
  ApiEnvelope,
  CtQueryResult,
  GetFiltersResult,
} from "../types.js";
import { ToolDef, z } from "./tool.js";
import { slimProduct } from "./search.js";

export const searchFiltersTool: ToolDef = {
  name: "akakce_search_filters",
  config: {
    title: "Akakçe search filters",
    description:
      "Bir arama ifadesi için uygulanabilir filtre gruplarını (marka, özellik, RAM, vb.) ve her filtrenin id'sini döndürür. Dönen filtre id'lerini akakce_search'e filterIds olarak vererek sonucu daraltabilirsin.",
    inputSchema: {
      phrase: z.string().min(1).describe("Arama ifadesi"),
      sort: z.number().int().default(1),
    },
  },
  handler: async ({ phrase, sort = 1 }: { phrase: string; sort?: number }) => {
    const data = await apiGet<ApiEnvelope<GetFiltersResult>>(
      "/search/getFilters",
      { Phrase: phrase, Page: 1, Sort: sort },
    );
    const groups = data.result?.filters?.filterGroups ?? [];
    return {
      phrase,
      filterGroups: groups.map((g) => ({
        group: g.name,
        filters: g.filters.map((f) => ({ id: f.id, name: f.name })),
      })),
    };
  },
};

export const categoryBrowseTool: ToolDef = {
  name: "akakce_category_browse",
  config: {
    title: "Akakçe category browse",
    description:
      "Bir kategori kodunu (ctCode) gezerek o kategorideki ürünleri ve hızlı filtreleri (quickFilters) döndürür. filterIds vererek daraltabilirsin. ctCode'u arama sonuçlarından/ürün URL'lerinden ya da akakce_search_filters çıktısından elde edebilirsin.",
    inputSchema: {
      ctCode: z.number().int().describe("Kategori kodu, örn. 18561 (laptop)"),
      filterIds: z
        .array(z.number().int())
        .optional()
        .describe("Uygulanacak filtre id'leri (opsiyonel)"),
      page: z.number().int().positive().default(1),
    },
  },
  handler: async ({
    ctCode,
    filterIds,
    page = 1,
  }: {
    ctCode: number;
    filterIds?: number[];
    page?: number;
  }) => {
    const data = await apiGet<ApiEnvelope<CtQueryResult>>(
      "/core/v2/category/ctquery",
      {
        ctCode,
        filterIds: filterIds && filterIds.length ? filterIds : undefined,
        page,
        isFilterRequest: "true",
      },
    );
    const r = data.result;
    return {
      ctCode,
      page,
      appliedFilterIds: filterIds,
      totalProducts: r?.productList?.countOfProducts,
      quickFilters: (r?.quickFilters?.topFilters ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        group: f.groupName,
        disabled: f.disabled ?? false,
      })),
      products: (r?.productList?.products ?? []).map(slimProduct),
    };
  },
};
