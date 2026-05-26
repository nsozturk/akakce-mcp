import { apiGet, absoluteUrl } from "../client.js";
import { ToolDef, z } from "./tool.js";

function slimDealProduct(p: any) {
  return {
    code: p.code,
    name: p.name,
    brand: p.mkName,
    price: p.price,
    image: absoluteUrl(p.imageUrl),
    url: absoluteUrl(p.url),
  };
}

export const dealsTool: ToolDef = {
  name: "akakce_deals",
  config: {
    title: "Akakçe deals (son indirimler)",
    description:
      "Akakçe'de son yakalanan indirimleri (fiyatı yeni düşen ürünler) döndürür. Giriş gerektirmez.",
  },
  handler: async () => {
    const d = await apiGet<any>("/home/v3/app/lastDiscounts", {}, { app: true });
    const data = d?.result?.data ?? [];
    return {
      sections: data.map((s: any) => ({
        title: s.title,
        products: (s.productList ?? []).map(slimDealProduct),
      })),
    };
  },
};

export const homeFeedTool: ToolDef = {
  name: "akakce_home_feed",
  config: {
    title: "Akakçe home feed",
    description:
      "Akakçe ana sayfasının bileşenlerini (keşfet/slider kartları: aktüel ürünler, kampanyalar, koleksiyonlar vb.) ve yönlendirme URL'lerini döndürür. Giriş gerektirmez.",
  },
  handler: async () => {
    const d = await apiGet<any>("/home/v3/app", {}, { app: true });
    const components = d?.result?.components ?? [];
    return {
      components: components.map((c: any) => ({
        type: c.type,
        items: (c.data ?? []).map((it: any) => ({
          title: it.title,
          image: absoluteUrl(it.imageUrl),
          actionUrl: it.action?.url,
          actionType: it.action?.type,
        })),
      })),
    };
  },
};

export const quickviewSingleTool: ToolDef = {
  name: "akakce_quickview",
  config: {
    title: "Akakçe quickview (tek ürün)",
    description:
      "Tek bir ürün kodu için en ucuz satıcı(ları) hızlıca döndürür (akakce_product_prices'ın tekli/hafif sürümü). Giriş gerektirmez.",
    inputSchema: {
      code: z.number().int().describe("Ürün kodu"),
    },
  },
  handler: async ({ code }: { code: number }) => {
    const d = await apiGet<any>("/quickview/get", { prCode: code });
    const prices = d?.result?.products?.[0]?.qvPrices ?? [];
    return {
      code,
      sellers: prices.map((p: any) => ({
        price: p.price,
        shipPrice: p.shipPrice,
        seller: p.vdName,
        badge: p.badge,
        lastUpdate: p.lastUpdateText,
      })),
    };
  },
};
