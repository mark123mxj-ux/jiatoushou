"use client";

import { DataFreshness, EmptyState, ErrorState, OfflineNotice, RefreshButton } from "@/components/DataFreshness";
import { LearningGuide } from "@/components/LearningGuide";
import { ResearchNav } from "@/components/ResearchNav";
import { dataBaseUrl } from "@/lib/api";
import { markProgress } from "@/lib/researchStore";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type Peer = {
  code: string;
  name: string;
  revenue: number;
  netProfit: number;
  grossMargin: number;
  netMargin: number;
  roe: number;
  pe: number;
  pb: number;
  marketCap: number;
  growth: number;
};

type SortKey = keyof Peer;

type Column = {
  key: SortKey;
  label: string;
  unit?: string;
};

const columns: Column[] = [
  { key: "name", label: "公司名" },
  { key: "code", label: "代码" },
  { key: "revenue", label: "营收", unit: "亿" },
  { key: "netProfit", label: "净利润", unit: "亿" },
  { key: "grossMargin", label: "毛利率", unit: "%" },
  { key: "netMargin", label: "净利率", unit: "%" },
  { key: "roe", label: "ROE", unit: "%" },
  { key: "pe", label: "PE" },
  { key: "pb", label: "PB" },
  { key: "marketCap", label: "市值", unit: "亿" }
];

function normalizePeer(item: any): Peer | null {
  const code = String(item?.code ?? "").padStart(6, "0").slice(-6);
  if (!code || !item?.name) return null;
  const revenue = Number(item.revenue ?? 0) / (Number(item.revenue ?? 0) > 100000000 ? 100000000 : 1);
  const netProfit = Number(item.net_profit ?? item.netProfit ?? 0) / (Number(item.net_profit ?? item.netProfit ?? 0) > 100000000 ? 100000000 : 1);
  const marketCap = Number(item.market_cap ?? item.marketCap ?? 0) / (Number(item.market_cap ?? item.marketCap ?? 0) > 100000000 ? 100000000 : 1);
  return {
    code,
    name: String(item.name),
    revenue,
    netProfit,
    grossMargin: Number(item.gross_margin ?? item.grossMargin ?? 0),
    netMargin: Number(item.net_margin ?? item.netMargin ?? 0),
    roe: Number(item.roe ?? 0),
    pe: Number(item.pe ?? 0),
    pb: Number(item.pb ?? 0),
    marketCap,
    growth: Number(item.growth ?? 8)
  };
}

function usePeers(code: string) {
  const [data, setData] = useState<{ industry: string; peers: Peer[]; loading: boolean; refreshing: boolean; error: boolean; dataDate?: string; source?: string; cacheAge?: number }>(() => ({ industry: "同行业", peers: [], loading: true, refreshing: false, error: false }));

  function load(refresh = false) {
    let alive = true;
    setData((current) => ({ ...current, error: false, loading: refresh ? current.loading : true, refreshing: refresh }));
    fetch(`${dataBaseUrl}/api/stocks/${code}/industry-peers${refresh ? "?refresh=true" : ""}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (!alive) return;
        const normalized = (payload?.items ?? []).map(normalizePeer).filter(Boolean) as Peer[];
        const usable = normalized.filter((peer) => peer.revenue || peer.netProfit || peer.roe || peer.marketCap || peer.pe || peer.pb);
        if (!payload) setData((current) => ({ ...current, loading: false, refreshing: false, error: true }));
        else setData({ industry: payload?.industry ?? "同行业", peers: usable, loading: false, refreshing: false, error: false, dataDate: payload?.data_date, source: payload?.source, cacheAge: payload?.cache_age });
      })
      .catch(() => setData((current) => ({ ...current, loading: false, refreshing: false, error: true })));
    return () => { alive = false; };
  }
  useEffect(() => { load(false); }, [code]);

  return { ...data, reload: load };
}

export default function IndustryPage({ params }: { params: { code: string } }) {
  const { industry, peers, loading, refreshing, error, dataDate, source, cacheAge, reload } = usePeers(params.code);
  const [sortKey, setSortKey] = useState<SortKey>("marketCap");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState<SortKey[]>(columns.map((column) => column.key));
  const [scatterX, setScatterX] = useState<"marketCap" | "revenue">("marketCap");
  const [scatterY, setScatterY] = useState<"roe" | "netMargin">("roe");

  useEffect(() => markProgress(params.code, "industry"), [params.code]);

  const visibleColumns = columns.filter((column) => visible.includes(column.key));
  const current = peers.find((peer) => peer.code === params.code);
  const sortedPeers = useMemo(() => {
    return peers
      .filter((peer) => `${peer.name}${peer.code}`.includes(query.trim()))
      .sort((left, right) => {
        const leftValue = left[sortKey];
        const rightValue = right[sortKey];
        const result = typeof leftValue === "number" && typeof rightValue === "number" ? leftValue - rightValue : String(leftValue).localeCompare(String(rightValue));
        return direction === "asc" ? result : -result;
      });
  }, [direction, peers, query, sortKey]);

  function switchSort(key: SortKey) {
    if (sortKey === key) setDirection(direction === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setDirection("desc");
    }
  }

  function toggleColumn(key: SortKey) {
    setVisible((items) => (items.includes(key) ? items.filter((item) => item !== key) : [...items, key]));
  }

  return (
    <section className="space-y-5">
      <LearningGuide module="industry" />
      <ResearchNav code={params.code} current="industry" />
      <div className="relative overflow-hidden border border-line bg-carbon/85 p-6 shadow-2xl shadow-black/30">
        <div className="absolute right-8 top-8 h-32 w-32 rounded-full bg-cyan/10 blur-3xl" />
        <div className="font-mono text-xs uppercase tracking-[0.32em] text-cyan">Industry Terminal / {params.code}</div>
        <div className="mt-3 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="font-display text-5xl text-slate-100">{industry}竞争格局</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">从规模、盈利能力、估值与成长性四个维度定位目标公司，数据来自AKShare，网络异常时显示空态以便稍后重试。</p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><DataFreshness dataDate={dataDate} source={source} cacheAge={cacheAge} /><RefreshButton onClick={() => reload(true)} refreshing={refreshing} label="全部刷新" /><Link href={`/research/${params.code}/thesis`} className="border border-amber/60 bg-amber/10 px-4 py-3 font-mono text-xs text-amber transition hover:bg-amber/20">进入投资论点 →</Link></div>
        </div>
      </div>

      <OfflineNotice />
      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="当前公司" value={current?.name ?? params.code} accent="cyan" />
        <Metric label="ROE" value={`${current?.roe ?? "--"}%`} accent="amber" />
        <Metric label="PE" value={current?.pe ?? "--"} accent="amber" />
        <Metric label="同行数量" value={peers.length} accent="cyan" />
        <Metric label="数据日期" value={dataDate ?? "--"} accent="cyan" />
      </div>

      {error ? <ErrorState onRetry={() => reload(true)} /> : loading ? <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-52 animate-pulse border border-line bg-white/[0.04]" />)}</div> : peers.length ? <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <ChartPanel title="规模 × 回报散点" action={
          <div className="flex gap-2">
            <select value={scatterX} onChange={(event) => setScatterX(event.target.value as any)} className="bg-panel px-2 py-1 text-xs text-slate-300 outline-none ring-1 ring-line">
              <option value="marketCap">X 市值</option>
              <option value="revenue">X 营收</option>
            </select>
            <select value={scatterY} onChange={(event) => setScatterY(event.target.value as any)} className="bg-panel px-2 py-1 text-xs text-slate-300 outline-none ring-1 ring-line">
              <option value="roe">Y ROE</option>
              <option value="netMargin">Y 净利率</option>
            </select>
          </div>
        }>
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart margin={{ top: 16, right: 22, bottom: 16, left: 0 }}>
              <CartesianGrid stroke="#26313d" strokeDasharray="3 3" />
              <XAxis dataKey={scatterX} name={scatterX === "marketCap" ? "市值" : "营收"} unit="亿" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis dataKey={scatterY} name={scatterY === "roe" ? "ROE" : "净利率"} unit="%" stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} content={<ScatterTooltip xKey={scatterX} yKey={scatterY} />} />
              <Scatter data={peers} shape="circle">
                {peers.map((peer) => <Cell key={peer.code} fill={peer.code === params.code ? "#d6a04b" : "#4cc9d8"} fillOpacity={peer.code === params.code ? 0.95 : 0.62} stroke={peer.code === params.code ? "#f8d38d" : "#4cc9d8"} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="关键指标排名" action={<span className="font-mono text-xs text-slate-500">营收 / ROE</span>}>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={[...peers].sort((a, b) => b.revenue - a.revenue)} margin={{ top: 16, right: 18, bottom: 16, left: 0 }}>
              <CartesianGrid stroke="#26313d" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" stroke="#64748b" tick={{ fontSize: 10 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#10151c", border: "1px solid #26313d", color: "#e8edf2" }} />
              <Bar dataKey="revenue" name="营收(亿)" radius={[4, 4, 0, 0]}>
                {peers.map((peer) => <Cell key={peer.code} fill={peer.code === params.code ? "#d6a04b" : "#4cc9d8"} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div> : <EmptyState title="暂无同行对比数据" message="当前行业板块暂未返回可用同行指标。建议点击刷新，或先进入产业链与利润因子完成定性分析。" />}

      <div className="border border-line bg-carbon/85 p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="font-display text-3xl text-slate-100">同行公司对比矩阵</h2>
            <p className="text-sm text-slate-500">点击表头排序，勾选指标控制显示。</p>
          </div>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选公司/代码" className="border border-line bg-panel px-3 py-2 font-mono text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {columns.map((column) => (
            <button key={column.key} onClick={() => toggleColumn(column.key)} className={`border px-2.5 py-1 font-mono text-[11px] transition ${visible.includes(column.key) ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-line text-slate-500"}`}>
              {column.label}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full min-w-[980px] border-collapse font-mono text-xs">
            <thead className="bg-panel text-slate-500">
              <tr>
                {visibleColumns.map((column) => (
                  <th key={column.key} className="border-b border-line px-3 py-3 text-left font-medium">
                    <button onClick={() => switchSort(column.key)} className="flex items-center gap-1 transition hover:text-amber">
                      {column.label}{sortKey === column.key ? <span className="text-amber">{direction === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPeers.map((peer) => (
                <tr key={peer.code} className={`border-b border-line/60 transition hover:bg-amber/10 ${peer.code === params.code ? "bg-amber/10 text-amber ring-1 ring-inset ring-amber/40" : "odd:bg-white/[0.025] text-slate-300"}`}>
                  {visibleColumns.map((column) => <td key={column.key} className="px-3 py-3">{formatValue(peer[column.key], column.unit)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, accent }: { label: string; value: unknown; accent: "amber" | "cyan" }) {
  return <div className="border border-line bg-panel/80 p-4"><div className="font-mono text-xs text-slate-500">{label}</div><div className={`mt-2 font-mono text-2xl ${accent === "amber" ? "text-amber" : "text-cyan"}`}>{String(value)}</div></div>;
}

function ChartPanel({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) {
  return <div className="border border-line bg-panel/80 p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-3xl text-slate-100">{title}</h2>{action}</div>{children}</div>;
}

function ScatterTooltip({ active, payload, xKey, yKey }: any) {
  if (!active || !payload?.length) return null;
  const peer = payload[0].payload;
  return <div className="border border-line bg-panel p-3 font-mono text-xs text-slate-200 shadow-xl"><div className="mb-2 text-amber">{peer.name} {peer.code}</div><div>{xKey === "marketCap" ? "市值" : "营收"}: {formatValue(peer[xKey], "亿")}</div><div>{yKey === "roe" ? "ROE" : "净利率"}: {formatValue(peer[yKey], "%")}</div><div>增速: {peer.growth}%</div></div>;
}

function formatValue(value: string | number, unit?: string) {
  if (typeof value === "string") return value;
  if (!Number.isFinite(value) || value === 0) return "--";
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })}${unit ?? ""}`;
}
