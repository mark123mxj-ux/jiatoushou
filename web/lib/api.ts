export type ApiMeta = { data_date?: string; fetched_at?: string; cache_age?: number; from_cache?: boolean; source?: string; cache_warning?: string };
export type StockProfile = ApiMeta & { code: string; name: string; industry?: string; sub_industry?: string; market_cap?: number; current_price?: number; change_pct?: number };
export type StockSearchItem = { code: string; name: string; industry?: string; current_price?: number; change_pct?: number };
export type FinancialItem = { year?: number; revenue?: number; net_profit?: number; gross_margin?: number; net_margin?: number; roe?: number; total_assets?: number; total_debt?: number; operating_cash_flow?: number };

export const dataBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${dataBaseUrl}${path}`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export function withRefresh(path: string, refresh: boolean) {
  if (!refresh) return path;
  return `${path}${path.includes("?") ? "&" : "?"}refresh=true`;
}
