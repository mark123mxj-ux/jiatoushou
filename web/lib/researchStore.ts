export type ModuleKey = "industry" | "chain" | "drivers" | "thesis" | "decisions" | "review";

export type Thesis = {
  industryTags: string[];
  industryText: string;
  companyTags: string[];
  companyText: string;
  currentPe: string;
  pePercentile: string;
  growth: string;
  catalyst: string;
  invalidation: string;
  maxPe: string;
  stopLoss: string;
  holdingMonths: string;
  createdAt?: string;
};

export type Decision = {
  id: string;
  code: string;
  action: "买入" | "卖出" | "加仓" | "减仓";
  thesisRef: string;
  emotion: "贪婪" | "恐惧" | "理性" | "犹豫";
  date: string;
  price: number;
  quantity: number;
  amount: number;
  note: string;
  createdAt: string;
};

export type Review = {
  decisionId: string;
  x: number;
  y: number;
  actual: string;
  updatedAt: string;
};

export const stockNames: Record<string, string> = { "600058": "五矿发展", "000858": "五粮液" };
export const modules: { key: ModuleKey; title: string; href: (code: string) => string }[] = [
  { key: "industry", title: "行业", href: (code) => `/research/${code}/industry` },
  { key: "chain", title: "产业链", href: (code) => `/research/${code}/chain` },
  { key: "drivers", title: "利润", href: (code) => `/research/${code}/drivers` },
  { key: "thesis", title: "论点", href: (code) => `/research/${code}/thesis` },
  { key: "decisions", title: "决策", href: (code) => `/research/${code}/decisions` },
  { key: "review", title: "复盘", href: (code) => `/research/${code}/review` }
];

export function thesisKey(code: string) { return `jiatoushou:thesis:${code}`; }
export function decisionsKey(code: string) { return `jiatoushou:decisions:${code}`; }
export function reviewKey(code: string) { return `jiatoushou:reviews:${code}`; }
export function progressKey(code: string) { return `jiatoushou:progress:${code}`; }

export function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return JSON.parse(window.localStorage.getItem(key) || "") as T; } catch { return fallback; }
}

export function saveJson<T>(key: string, value: T) {
  if (typeof window !== "undefined") window.localStorage.setItem(key, JSON.stringify(value));
}

export function markProgress(code: string, module: ModuleKey) {
  const current = loadJson<ModuleKey[]>(progressKey(code), []);
  if (!current.includes(module)) saveJson(progressKey(code), [...current, module]);
}

export function thesisOptions(thesis: Thesis | null) {
  if (!thesis) return ["未关联论点"];
  return [
    thesis.industryText ? `行业论点：${thesis.industryText.slice(0, 34)}` : "行业论点",
    thesis.companyText ? `公司论点：${thesis.companyText.slice(0, 34)}` : "公司论点",
    thesis.catalyst ? `估值/催化：${thesis.catalyst.slice(0, 34)}` : "估值/催化论点",
    thesis.invalidation ? `卖出纪律：${thesis.invalidation.slice(0, 34)}` : "卖出纪律"
  ];
}

export function netPosition(decisions: Decision[]) {
  return decisions.reduce((sum, item) => sum + (item.action === "买入" || item.action === "加仓" ? item.quantity : -item.quantity), 0);
}

export function daysSince(date: string) {
  const time = new Date(date).getTime();
  if (!time) return 0;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}