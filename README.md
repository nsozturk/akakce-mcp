# akakce-mcp

[Akakçe](https://www.akakce.com) (Türkiye fiyat-karşılaştırma sitesi) için kapsamlı
bir **MCP (Model Context Protocol) server**. Hem public arama/fiyat API'sini hem de
**giriş yapılmış hesap özelliklerini** (favoriler, fiyat alarmları, bildirimler)
LLM ajanlarına açar.

API yüzeyi `api6.akakce.com` mobil + web trafiğinden tersine çıkarıldı; tam dökümü:
[`API_REFERENCE.md`](./API_REFERENCE.md).

## Kurulum

```bash
npm install
npm run build
```

> **`curl` gerekli.** Akakçe'nin bir kısmı (Akamai bot koruması) Node `fetch`'ini
> 403'lüyor; server istekleri sistemdeki `curl` ile atar. `node` + `curl` PATH'te
> olmalı (macOS/Linux'ta standart).

## MCP istemcisine ekleme

**Claude Code:**
```bash
claude mcp add akakce -- node /Users/ns0bj/Development/Fun/1hittite/akakce-mcp/dist/index.js
```

**OpenCode** (`~/.config/opencode/opencode.json` → `mcp` bloğu):
```json
"akakce": {
  "type": "local",
  "command": ["node", "/Users/ns0bj/Development/Fun/1hittite/akakce-mcp/dist/index.js"],
  "enabled": true,
  "environment": {
    "AKAKCE_EMAIL": "{env:AKAKCE_EMAIL}",
    "AKAKCE_PASSWORD": "{env:AKAKCE_PASSWORD}",
    "FIREWORKS_API_KEY": "{env:FIREWORKS_API_KEY}"
  }
}
```

## Tool'lar (20)

### Keşif / gezinme (public)
| Tool | Ne yapar |
|---|---|
| `akakce_autocomplete` | Arama önerileri + ürün kodları |
| `akakce_search` | Ürün arama (sayfalı, `ctCode`/`filterIds` ile filtreli) |
| `akakce_search_filters` | Bir aramaya ait filtre grupları + id'ler |
| `akakce_category_browse` | Kategori gezme + quickFilters |
| `akakce_home_feed` | Ana sayfa bileşenleri (kampanya/koleksiyon kartları) |
| `akakce_deals` | Son yakalanan indirimler |

### Ürün / fiyat (public)
| Tool | Ne yapar |
|---|---|
| `akakce_product_prices` | Ürün kod(lar)ı için en ucuz satıcılar (toplu) |
| `akakce_quickview` | Tek ürün hızlı en-ucuz |
| `akakce_product_detail` | Tam detay: özellikler + **tüm satıcılar** (puan/teslimat/gidiş linki) |
| `akakce_price_history` | Fiyat geçmişi grafiği (PNG URL'i) |

### Hesap (giriş gerektirir)
| Tool | Ne yapar |
|---|---|
| `akakce_login` | Giriş yap, oturumu kaydet |
| `akakce_logout` | Oturumu sil |
| `akakce_account_info` | Profil bilgisi |
| `akakce_favorites` | Favori listeleri / liste içeriği |
| `akakce_favorite_add` | Favoriye ekle |
| `akakce_favorite_remove` | Favoriden çıkar |
| `akakce_price_alerts` | Fiyat alarmlarını listele |
| `akakce_price_alert_set` | Fiyat alarmı kur/güncelle |
| `akakce_notifications` | Fiyat düşüşü bildirimleri |

### LLM
| Tool | Ne yapar |
|---|---|
| `akakce_llm_enrich` | Sonuçları yorumlar/özetler — **sadece Fire-Pass Kimi turbo** |

## Giriş & oturum

```bash
export AKAKCE_EMAIL="..."
export AKAKCE_PASSWORD="..."
```

- `akakce_login` (parametresiz) bu env'leri kullanır; ya da `email`/`password`
  parametresi verilebilir.
- Başarılı girişte oturum çerezi (`AAATLGST`) `~/.config/akakce-mcp/session.json`
  içine **0600** izniyle yazılır. Çerez ~1 yıl geçerli (`rememberMe`), tekrar giriş
  gerekmez. `akakce_logout` ile silinir.
- Çerez/şifre repo'ya veya log'a yazılmaz.

## Fiyat geçmişi

Akakçe geçmişi sayısal vermez; yalnızca render edilmiş bir PNG grafiği sunar
(`akakce-g.akamaized.net/{code}:{fiyat*100}:{sürüm}`). `akakce_price_history` bu
görselin URL'ini döndürür.

## LLM zenginleştirme (Fire-Pass — maliyet-kritik)

`akakce_llm_enrich` **yalnızca** `accounts/fireworks/routers/kimi-k2p6-turbo` ile
çalışır (`src/llm/firepass.ts` — her çağrı öncesi slug hard-assert). `FIREWORKS_API_KEY`
yoksa devre dışıdır; diğer 19 tool tam çalışır. Detay:
`/Users/ns0bj/.config/agent-rules/fire-pass-kimi-k2.6-turbo.md`

## Mimari

```
src/
  index.ts        # MCP server + 20 tool kaydı (stdio)
  client.ts       # curl tabanlı HTTP: web/app UA, AAATLGST cookie, base64 decode, POST/DELETE, retry
  session.ts      # oturum kalıcılığı (~/.config/akakce-mcp/session.json, 0600)
  types.ts        # api6 yanıt tipleri
  tools/          # search, category, prices, history, home, account, enrich
  llm/firepass.ts # Fire-Pass guard + Fireworks chat
```
