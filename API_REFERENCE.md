# Akakçe API — Reference (mobil + web)

Kaynak: `akakce-ios.har` (iOS app 6.7.3 trafiği) + `www.akakce.com.har` (web).
Tüm uçlar `https://api6.akakce.com` üzerinde. Web ve mobil aynı backend'i kullanır.

## Auth (oturum)

| Adım | İstek | Not |
|---|---|---|
| Login | `POST /auth/user/login` body `{"email","password","rememberMe":true}` | Yanıt **base64**. `Set-Cookie: AAATLGST=<token>%7C<userId>` döner. |
| E-posta kontrol | `POST /auth/user/checkemail` `{"email"}` | base64 |
| App init | `POST /auth/init/application` `{app,device,fcm,userId}` | base64; FCM/push kaydı (MCP'de gereksiz) |

- **Oturum = `AAATLGST` cookie.** `rememberMe:true` ile cookie ~1 yıl geçerli (`expires 2027`, domain `.akakce.com`).
- Sonraki tüm `/user/*` çağrıları bu cookie ile yapılır. **Authorization header yok.**
- `/auth/*` yanıtları base64-encoded JSON; `/user/*` ve diğerleri düz JSON.

## Public uçlar (auth gerektirmez)

| Uç | Param | Verir |
|---|---|---|
| `GET /autocomplete` | `p=8&q=` | öneriler + ürün kodları |
| `GET /search/core` | `Phrase&Page&Sort` | arama sayfa 1 + metadata + total |
| `GET /search/page` | `Phrase&Page&Sort` | arama sonraki sayfalar |
| `GET /search/filter` | `Phrase&CtCode&FilterIds&Page&Sort` | filtreli arama |
| `GET /search/getFilters` | `Phrase&Page&Sort` | filtre grupları + id'ler |
| `GET /search/query` | `phrase` | mobil arama (tek atış, metadata+ürünler) |
| `GET /core/v2/category/ctquery` | `ctCode&filterIds&page&isFilterRequest` | kategori + quickFilters (web, **sayfalı**) |
| `GET /core/v2/app/ctquery` | `ctCode&filterIds&p1&p2&sort&isFilterRequest` | kategori (mobil, yatay listeler). `p1/p2` = **fiyat aralığı** (min/max), pagination değil |
| `GET /quickview/getall` | `prCodes=a,b,c` | toplu en ucuz satıcılar |
| `GET /quickview/get` | `prCode=` | tek ürün hızlı görünüm |
| `GET /product/pgList` | `PrCode&Page` | **tüm satıcı listesi** (fiyat, kargo, satıcı puanı, teslimat) |
| `GET /product/prQuery` | `PrCode&Page` | code→canonical URL çözer |
| `GET /home/v3/app` | — | ana sayfa bileşenleri (explore/slider) |
| `GET /home/v3/app/lastDiscounts` | — | son yakalanan indirimler akışı |
| graph PNG | `akakce-g.akamaized.net/{code}:{price*100}:{ver}` | fiyat geçmişi **görseli** (sayısal veri yok) |

Pagination: arama ve web kategori uçları `Page`/`page` (1'den). Sonuçlar `countOfProducts` ile toplam sayıyı verir.

## Auth'lu uçlar (AAATLGST cookie ile)

| Uç | Method/Body | Verir / yapar |
|---|---|---|
| `/user/info` | GET | profil (ad, e-posta, il/ilçe, bildirim sayısı) |
| `/user/list/all` | GET | tüm favori listeleri (`listId,listName,isDefault,countOfItems`) |
| `/user/list?userListId=` | GET | bir listenin ürünleri (`listOfItems[]`: itemID, prName, price, url…) |
| `/user/list/itemLists` | POST `{itemIDs[],itemType:1}` | bir ürünün hangi listelerde olduğu |
| `/user/list/items/add` | POST `{items:[{itemID}],itemType:1}` | **favoriye ekle** → güncel favoriteProducts |
| `/user/list/items/delete` | DELETE `{itemType:1,items:[{itemID,listID}]}` | **favoriden çıkar** |
| `/user/priceAlert/list` | GET | fiyat alarmları (`alerts[]`: itemID, prName, hedef/mevcut fiyat) |
| `/user/priceAlert/detail/{prCode}` | GET | tek alarm detayı |
| `/user/priceAlert/set` | POST `{prCode,targetPrice}` | **fiyat alarmı kur/güncelle** |
| `/user/notification/all` | GET | bildirimler (fiyat düşüşleri: prCode, price, dropRatio, date) |
| `/user/notification/count` | GET | okunmamış bildirim sayısı |
| `/user/v2/pricechangedlastvisiteditems` | GET | fiyatı değişen son bakılan ürünler |
| `/user/v2/home/lastvisiteditems` | GET | son bakılan ürünler |
| `/user/provinces`, `/user/districts/{id}` | GET | il/ilçe listesi |

## Önemli notlar
- **base64**: yalnızca `/auth/*` yanıtlarında. Client otomatik decode eder (JSON değilse base64 dener).
- **User-Agent**: mobil çağrılar `Akakce/100 CFNetwork/...`; web çağrıları Chrome UA. Akamai bot koruması yüzünden istekler `curl` ile atılır (Node fetch 403).
- **Güvenlik**: `AAATLGST` token + kullanıcı kimlik bilgileri hassastır → repo'ya yazılmaz; oturum `~/.config/akakce-mcp/session.json` (0600) içinde saklanır, kimlik bilgileri env'den okunur.
