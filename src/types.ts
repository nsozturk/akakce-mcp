/**
 * Shapes returned by the Akakçe api6 endpoints. These are intentionally lenient
 * (most fields optional) because the API omits keys when empty and adds new ones
 * over time. We model only what we consume.
 */

export interface ApiEnvelope<T> {
  r: number; // 0 == ok
  result?: T;
}

export interface ApiProduct {
  code: number;
  name: string;
  mkName?: string; // brand
  price?: number;
  unit?: string;
  rating?: number;
  countOfPrices?: number; // number of sellers
  followCount?: number;
  imageUrl?: string;
  url?: string; // product page path
  hasGraph?: boolean;
  colorVariants?: string[];
  authorizedMkLogoUrl?: string;
}

export interface ProductList {
  countOfProducts?: number;
  products: ApiProduct[];
}

export interface SearchMetadata {
  title?: string;
  status?: number;
  shareUrl?: string;
  description?: string;
}

export interface SearchCoreResult {
  metadata?: SearchMetadata;
  productList?: ProductList;
}

export interface SearchPageResult {
  productList?: ProductList;
}

export interface AutocompleteItem {
  text: string;
  action?: { url?: string; type?: string; code?: number };
}
export interface AutocompleteGroup {
  title?: string;
  items: AutocompleteItem[];
}
export interface AutocompleteResult {
  groups: AutocompleteGroup[];
}

export interface QvPrice {
  price: number;
  shipPrice?: number;
  badge?: string;
  vdName?: string; // vendor/seller name
  vdCode?: number;
  lastUpdateText?: string;
  showOldPriceNotice?: boolean;
  url?: string; // outbound go-to-seller url (relative)
}
export interface QvProduct {
  prCode: number;
  qvPrices?: QvPrice[];
}
export interface QuickViewResult {
  products: QvProduct[];
}

export interface FilterEntry {
  name: string;
  id: number;
  disabled?: boolean;
  groupName?: string;
}
export interface FilterGroup {
  name: string;
  filters: FilterEntry[];
}
export interface GetFiltersResult {
  filters?: {
    selectedFilterIds?: string;
    filterGroups: FilterGroup[];
  };
}

export interface CtQueryResult {
  quickFilters?: { topFilters?: FilterEntry[] };
  productList?: ProductList;
}

export interface PgListEntry {
  pgCode?: number;
  price?: number;
  pgName?: string; // seller's listing title
  vdCode?: number;
  vdName?: string; // seller name
  shipPrice?: number;
  url?: string; // outbound (akakce /r/ redirect, escaped in `f` param)
  badge?: string;
  deliveryText?: string;
  vdRating?: string;
  vdRatingCount?: number;
  lastUpdateTime?: string;
}
export interface PgListResult {
  isEnabledSellers?: boolean;
  pgList?: PgListEntry[];
}

export interface PrQueryResult {
  metadata?: {
    status?: number;
    redirectUrl?: string;
    isEnabledSellers?: boolean;
  };
}
