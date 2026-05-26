# akakce-mcp

[Akakçe](https://www.akakce.com) (Türkiye fiyat-karşılaştırma sitesi) için bir
**MCP (Model Context Protocol) server**. LLM ajanlarının Akakçe'de ürün araması,
fiyat karşılaştırması, satıcı listesi, kategori gezme ve fiyat geçmişi grafiği
sorgulaması yapmasını sağlar.

Akakçe'nin public JSON API'sini (`api6.akakce.com`) sarar — login/cookie/token
gerektirmez.

## Kurulum

```bash
npm install
npm run build
```

> **Not:** Server isteklerini sistemdeki `curl` üzerinden atar. Akakçe'nin
> `/product/*` uç noktaları ve ürün sayfaları Akamai bot korumasının arkasındadır
> ve Node'un yerleşik `fetch` (undici) TLS/HTTP2 parmak izini 403 ile reddeder;
> `curl` kabul edilir. `curl`'ün PATH'te olması gerekir (macOS/Linux'ta standart).

## MCP istemcisine ekleme (Claude Code)

```bash
claude mcp add akakce -- node /Users/ns0bj/Development/Fun/1hittite/akakce-mcp/dist/index.js
```

Geliştirme / manuel test:

```bash
npm run inspector   # MCP Inspector UI
```

## Tool'lar

| Tool | Ne yapar | Başlıca girdi |
|---|---|---|
| `akakce_autocomplete` | Arama önerileri + ürün kodları | `query` |
| `akakce_search` | Ürün arama (sayfalı, opsiyonel `ctCode`/`filterIds` ile filtreli) | `phrase`, `page?`, `ctCode?`, `filterIds?` |
| `akakce_search_filters` | Bir aramaya ait filtre grupları + filtre id'leri | `phrase` |
| `akakce_category_browse` | Kategori gezme + quickFilters | `ctCode`, `filterIds?`, `page?` |
| `akakce_product_prices` | Ürün kod(lar)ı için en ucuz satıcılar (toplu, hızlı) | `codes: number[]` |
| `akakce_product_detail` | Tam detay: özellikler, puan, fiyat özeti, **tüm satıcılar** (puan/teslimat/gidiş linki) | `code` (veya `url`) |
| `akakce_price_history` | Fiyat geçmişi grafiği (PNG görsel URL'i) | `code` (veya `url`) |
| `akakce_llm_enrich` | Sonuçları LLM ile yorumlar/özetler — **sadece Fire-Pass Kimi turbo** | `data`, `instruction` |

### Tipik akış

1. `akakce_autocomplete` veya `akakce_search` → ürün `code`'unu bul.
2. `akakce_product_detail { code }` → özellikler + tüm satıcılar.
3. (opsiyonel) `akakce_price_history { code }` → fiyat grafiği görseli.
4. (opsiyonel) `akakce_llm_enrich` → sonuçları yorumlat.

## Fiyat geçmişi hakkında

Akakçe fiyat geçmişini sayısal veri olarak **sunmaz**; sadece sunucu tarafında
render edilen bir PNG grafiği verir (`akakce-g.akamaized.net/{code}:{fiyat*100}:{sürüm}`).
`akakce_price_history` bu grafiğin doğrudan görüntü URL'ini döndürür.

## LLM zenginleştirme (Fire-Pass — maliyet-kritik)

`akakce_llm_enrich`, **yalnızca** Fire-Pass guard'lı
`accounts/fireworks/routers/kimi-k2p6-turbo` modeliyle çalışır
(`src/llm/firepass.ts` — her çağrı öncesi slug hard-assert; başka model =
`FirePassGuardError`). `FIREWORKS_API_KEY` ortam değişkeni tanımlı değilse tool
devre dışıdır; diğer tüm tool'lar LLM olmadan tam çalışır.

```bash
export FIREWORKS_API_KEY=...   # sadece Fire-Pass turbo key'i
```

Detaylar: `/Users/ns0bj/.config/agent-rules/fire-pass-kimi-k2.6-turbo.md`

## Mimari

```
src/
  index.ts        # MCP server + tool kayıtları (stdio transport)
  client.ts       # curl tabanlı HTTP katmanı (Akamai-uyumlu), retry/backoff
  types.ts        # api6 yanıt tipleri
  tools/          # autocomplete, search, filters, category, prices, detail, history, enrich
  llm/firepass.ts # Fire-Pass guard + Fireworks chat
```

Tüm istekler için kullanılan gerçek API uçları HAR yakalamasından
(`www.akakce.com.har`) doğrulanmıştır.
