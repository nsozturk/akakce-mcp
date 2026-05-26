import { apiGet, apiSend, loginRequest, absoluteUrl } from "../client.js";
import {
  loadSession,
  saveSession,
  clearSession,
} from "../session.js";
import { ToolDef, z } from "./tool.js";

/* ----------------------------------------------------------------------------
 * Auth
 * ------------------------------------------------------------------------- */

export const loginTool: ToolDef = {
  name: "akakce_login",
  config: {
    title: "Akakçe login",
    description:
      "Akakçe hesabına giriş yapar ve oturumu (AAATLGST çerezi) ~/.config/akakce-mcp/session.json içine kaydeder. Giriş sonrası favoriler, fiyat alarmları ve bildirim tool'ları çalışır. Kimlik bilgilerini parametre vermezsen AKAKCE_EMAIL / AKAKCE_PASSWORD ortam değişkenleri kullanılır. Oturum ~1 yıl geçerlidir; tekrar giriş gerekmez.",
    inputSchema: {
      email: z.string().optional().describe("E-posta (verilmezse AKAKCE_EMAIL env)"),
      password: z.string().optional().describe("Şifre (verilmezse AKAKCE_PASSWORD env)"),
    },
  },
  handler: async ({ email, password }: { email?: string; password?: string }) => {
    const e = email ?? process.env.AKAKCE_EMAIL;
    const p = password ?? process.env.AKAKCE_PASSWORD;
    if (!e || !p) {
      throw new Error(
        "Kimlik bilgisi yok: email/password parametresi verin ya da AKAKCE_EMAIL / AKAKCE_PASSWORD env tanımlayın.",
      );
    }
    const { cookie, result } = await loginRequest(e, p);
    saveSession({
      cookie,
      userId: result?.id,
      email: result?.email,
      name: result?.name,
      savedAt: new Date().toISOString(),
    });
    return {
      loggedIn: true,
      user: { id: result?.id, name: result?.name, surname: result?.surname, email: result?.email },
      followedProductCount: Array.isArray(result?.followedProducts)
        ? result.followedProducts.length
        : undefined,
      note: "Oturum kaydedildi; favori/alarm/bildirim tool'ları artık kullanılabilir.",
    };
  },
};

export const logoutTool: ToolDef = {
  name: "akakce_logout",
  config: {
    title: "Akakçe logout",
    description: "Kaydedilmiş Akakçe oturumunu siler (session.json).",
  },
  handler: async () => ({ loggedOut: clearSession() }),
};

export const accountInfoTool: ToolDef = {
  name: "akakce_account_info",
  config: {
    title: "Akakçe account info",
    description:
      "Giriş yapılmış kullanıcının profil bilgisini döndürür (ad, e-posta, il/ilçe, bildirim sayısı). Giriş gerektirir.",
  },
  handler: async () => {
    const session = loadSession();
    const d = await apiGet<any>("/user/info", {}, { app: true, auth: true });
    const r = d?.result ?? {};
    return {
      id: r.id,
      name: r.name,
      surname: r.surname,
      email: r.email,
      provinceId: r.provinceId,
      districtId: r.districtId,
      notificationCount: r.notificationCount,
      sessionSavedAt: session?.savedAt,
    };
  },
};

/* ----------------------------------------------------------------------------
 * Favorites (lists)
 * ------------------------------------------------------------------------- */

export const favoritesTool: ToolDef = {
  name: "akakce_favorites",
  config: {
    title: "Akakçe favorites",
    description:
      "Favori listelerini döndürür. `listId` verilmezse tüm listeleri (id, ad, ürün sayısı) listeler; `listId` verilirse o listenin ürünlerini (ad, fiyat, url) döndürür. Giriş gerektirir.",
    inputSchema: {
      listId: z.number().int().optional().describe("Belirli bir favori listesinin id'si (akakce_favorites'in listesinden)"),
    },
  },
  handler: async ({ listId }: { listId?: number }) => {
    if (listId === undefined) {
      const d = await apiGet<any>("/user/list/all", {}, { app: true, auth: true });
      return {
        lists: (d?.result?.lists ?? []).map((l: any) => ({
          listId: l.listId,
          name: l.listName,
          isDefault: l.isDefault,
          itemCount: l.countOfItems,
        })),
      };
    }
    const d = await apiGet<any>("/user/list", { userListId: listId }, { app: true, auth: true });
    const r = d?.result ?? {};
    return {
      listId: r.listId,
      name: r.listName,
      itemCount: r.countOfItems,
      priceDropCount: r.countOfPriceDropProduct,
      items: (r.listOfItems ?? []).map((it: any) => ({
        code: it.itemID,
        name: it.prName,
        price: it.price,
        shipPrice: it.shipPrice,
        image: absoluteUrl(it.prImgURL),
        url: absoluteUrl(it.url),
      })),
    };
  },
};

export const favoriteAddTool: ToolDef = {
  name: "akakce_favorite_add",
  config: {
    title: "Akakçe favorite add",
    description:
      "Bir veya daha fazla ürünü favorilere (varsayılan listeye) ekler. Ürün kod(lar)ını ver. Giriş gerektirir.",
    inputSchema: {
      codes: z.array(z.number().int()).min(1).describe("Eklenecek ürün kodları"),
    },
  },
  handler: async ({ codes }: { codes: number[] }) => {
    const d = await apiSend<any>(
      "POST",
      "/user/list/items/add",
      { items: codes.map((c) => ({ itemID: c })), itemType: 1 },
      { app: true, auth: true },
    );
    const fav: string[] = d?.result?.favoriteProducts ?? [];
    return {
      added: codes,
      totalFavorites: fav.length,
      message: d?.result?.message ?? "Favorilere eklendi.",
    };
  },
};

export const favoriteRemoveTool: ToolDef = {
  name: "akakce_favorite_remove",
  config: {
    title: "Akakçe favorite remove",
    description:
      "Bir ürünü favori listesinden çıkarır. Ürün kodu (code) ve listId ver (listId'yi akakce_favorites'ten al). Giriş gerektirir.",
    inputSchema: {
      code: z.number().int().describe("Çıkarılacak ürün kodu"),
      listId: z.number().int().describe("Ürünün bulunduğu favori listesi id'si"),
    },
  },
  handler: async ({ code, listId }: { code: number; listId: number }) => {
    const d = await apiSend<any>(
      "DELETE",
      "/user/list/items/delete",
      { itemType: 1, items: [{ itemID: code, listID: listId }] },
      { app: true, auth: true },
    );
    return {
      removed: code,
      message: d?.result?.message ?? "Üründen listeden silindi.",
      totalFavorites: (d?.result?.favoriteProducts ?? []).length,
    };
  },
};

/* ----------------------------------------------------------------------------
 * Price alerts
 * ------------------------------------------------------------------------- */

export const priceAlertsTool: ToolDef = {
  name: "akakce_price_alerts",
  config: {
    title: "Akakçe price alerts",
    description:
      "Kurulu fiyat alarmlarını listeler: ürün, hedef fiyat ve mevcut fiyat. Giriş gerektirir.",
  },
  handler: async () => {
    const d = await apiGet<any>("/user/priceAlert/list", {}, { app: true, auth: true });
    return {
      note: "Hedef fiyat alarm listesinde dönmez; tek alarmın hedefini görmek için akakce_price_alert_set ile güncelle ya da ürün detayına bak. Aşağıda mevcut en düşük fiyat ve alarm kurulduğundaki fiyat var.",
      alerts: (d?.result?.alerts ?? []).map((a: any) => ({
        code: a.itemID,
        name: a.prName,
        currentMinPrice: a.minOfSortPrice,
        priceWhenAdded: a.addPrice,
        low6Month: a.minPriceLast6Month,
        sellerCount: a.countOfPrices,
        addedDate: a.addDate,
        image: absoluteUrl(a.prImgURL),
        url: absoluteUrl(a.url),
      })),
    };
  },
};

export const priceAlertSetTool: ToolDef = {
  name: "akakce_price_alert_set",
  config: {
    title: "Akakçe set price alert",
    description:
      "Bir ürün için fiyat alarmı kurar/günceller: fiyat hedef değere düşünce bildirim gelir. Ürün kodu ve hedef fiyat (TL) ver. Giriş gerektirir.",
    inputSchema: {
      code: z.number().int().describe("Ürün kodu"),
      targetPrice: z.number().positive().describe("Hedef fiyat (TL) — fiyat buraya düşünce alarm"),
    },
  },
  handler: async ({ code, targetPrice }: { code: number; targetPrice: number }) => {
    const d = await apiSend<any>(
      "POST",
      "/user/priceAlert/set",
      { prCode: code, targetPrice },
      { app: true, auth: true },
    );
    return {
      code,
      targetPrice,
      message: d?.result?.message ?? "Fiyat alarmı kuruldu.",
      activeAlertCount: (d?.result?.prCodes ?? []).length,
    };
  },
};

/* ----------------------------------------------------------------------------
 * Notifications
 * ------------------------------------------------------------------------- */

export const notificationsTool: ToolDef = {
  name: "akakce_notifications",
  config: {
    title: "Akakçe notifications",
    description:
      "Fiyat düşüşü bildirimlerini döndürür (ürün, yeni fiyat, düşüş oranı, tarih). Giriş gerektirir.",
  },
  handler: async () => {
    const [all, count] = await Promise.all([
      apiGet<any>("/user/notification/all", {}, { app: true, auth: true }),
      apiGet<any>("/user/notification/count", {}, { app: true, auth: true }).catch(() => undefined),
    ]);
    return {
      unreadCount: count?.result?.count,
      notifications: (all?.result?.notifications ?? []).map((n: any) => ({
        code: n.prCode,
        name: n.prName,
        price: n.price,
        dropRatio: n.dropRatio,
        date: n.date,
        url: absoluteUrl(n.prURL),
      })),
    };
  },
};
