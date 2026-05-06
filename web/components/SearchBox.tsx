"use client";

import { dataBaseUrl, type StockSearchItem } from "@/lib/api";
import { loadJson, saveJson } from "@/lib/researchStore";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const historyKey = "jiatoushou:stock-search-history";

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchItem[]>([]);
  const [history, setHistory] = useState<StockSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => setHistory(loadJson<StockSearchItem[]>(historyKey, [])), []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`${dataBaseUrl}/api/stocks/search?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => setResults(payload?.items ?? []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function choose(stock: StockSearchItem) {
    const next = [stock, ...history.filter((item) => item.code !== stock.code)].slice(0, 5);
    setHistory(next);
    saveJson(historyKey, next);
    router.push(`/research/${stock.code}`);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (results[0]) choose(results[0]);
    else {
      const code = query.match(/\d{6}/)?.[0];
      if (code) choose({ code, name: code });
    }
  }

  return (
    <div className="relative">
      <form onSubmit={onSubmit} className="relative flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_0_45px_rgba(76,201,216,.08)] backdrop-blur-xl">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索任意A股：代码 600058 / 名称 五粮液" className="h-14 flex-1 bg-transparent px-4 font-mono text-sm text-slate-100 outline-none placeholder:text-slate-600" />
        <button className="h-14 rounded-xl border border-amber/70 bg-gradient-to-r from-amber to-[#f0bd68] px-7 font-mono text-sm font-bold text-carbon transition hover:brightness-110">SEARCH</button>
      </form>
      {(query.trim() || history.length > 0) ? <div className="absolute z-30 mt-3 w-full overflow-hidden rounded-2xl border border-line bg-carbon/95 shadow-2xl shadow-black/50 backdrop-blur-xl">
        {query.trim() ? <div className="border-b border-line/70 p-2">
          {loading ? <div className="space-y-2 p-3">{[0, 1, 2].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-white/[0.06]" />)}</div> : results.length ? results.map((stock) => <button key={stock.code} onClick={() => choose(stock)} className="grid w-full grid-cols-[90px_1fr_120px_80px] items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition hover:bg-cyan/10"><span className="font-mono text-amber">{stock.code}</span><span className="font-display text-xl text-slate-100">{stock.name}</span><span className="truncate text-xs text-slate-500">{stock.industry ?? "行业待识别"}</span><span className="font-mono text-xs text-cyan">{stock.change_pct ?? "--"}%</span></button>) : <div className="p-4 text-sm text-slate-500">暂无匹配结果，可输入6位代码直接进入。</div>}
        </div> : null}
        {history.length ? <div className="p-3"><div className="mb-2 font-mono text-[11px] uppercase tracking-[0.25em] text-slate-500">Recent Research</div><div className="flex flex-wrap gap-2">{history.map((stock) => <button key={stock.code} onClick={() => choose(stock)} className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1.5 font-mono text-xs text-cyan transition hover:bg-cyan/20">{stock.name} {stock.code}</button>)}</div></div> : null}
      </div> : null}
    </div>
  );
}
