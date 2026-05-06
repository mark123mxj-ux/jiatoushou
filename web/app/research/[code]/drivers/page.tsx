"use client";

import { DataFreshness, DataSource, EmptyState, ErrorState, OfflineNotice, RefreshButton } from "@/components/DataFreshness";
import { LearningGuide } from "@/components/LearningGuide";
import { ResearchNav } from "@/components/ResearchNav";
import { ApiMeta, FinancialItem, StockProfile, fetchJson, withRefresh } from "@/lib/api";
import { markProgress } from "@/lib/researchStore";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Payload = ApiMeta & { items: FinancialItem[] };

export default function DriversPage({ params }: { params: { code: string } }) {
  const [profile, setProfile] = useState<StockProfile | null>(null);
  const [financials, setFinancials] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  function load(refresh = false) {
    setError(false);
    refresh ? setRefreshing(true) : setLoading(true);
    Promise.all([fetchJson<StockProfile>(withRefresh(`/api/stocks/${params.code}/profile`, refresh)), fetchJson<Payload>(withRefresh(`/api/stocks/${params.code}/financials`, refresh))])
      .then(([profilePayload, financialPayload]) => {
        if (!profilePayload || !financialPayload) setError(true);
        setProfile(profilePayload);
        setFinancials(financialPayload);
      })
      .catch(() => setError(true))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    markProgress(params.code, "drivers");
    load(false);
  }, [params.code]);

  const rows = useMemo(() => [...(financials?.items ?? [])].filter((item) => item.year).reverse(), [financials]);
  const latest = rows[rows.length - 1];
  const cost = latest?.revenue != null && latest?.net_profit != null ? Math.max(latest.revenue - latest.net_profit, 0) : 0;
  const waterfall = latest ? [{ name: "营收", value: latest.revenue ?? 0 }, { name: "成本费用", value: -cost }, { name: "净利润", value: latest.net_profit ?? 0 }] : [];

  return <section className="space-y-5"><LearningGuide module="drivers" /><ResearchNav code={params.code} current="drivers" /><div className="relative overflow-hidden border border-line bg-carbon/90 p-6 shadow-2xl shadow-black/30"><div className="absolute -right-16 top-0 h-56 w-56 rounded-full bg-amber/15 blur-3xl" /><div className="font-mono text-xs uppercase tracking-[0.34em] text-cyan">Profit Driver Terminal / {params.code}</div><div className="mt-3 flex flex-col justify-between gap-4 xl:flex-row xl:items-end"><div><DataFreshness dataDate={financials?.data_date} source={financials?.source} cacheAge={financials?.cache_age} /><h1 className="font-display text-5xl text-slate-100">{profile?.name ?? params.code} · 利润因子拆解</h1><p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">从AKShare动态读取近三年财务指标，观察营收、净利润、ROE、毛利率与现金流的变化。</p></div><RefreshButton onClick={() => load(true)} refreshing={refreshing} label="全部刷新" /></div></div><OfflineNotice />{error ? <ErrorState onRetry={() => load(true)} /> : loading ? <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse border border-line bg-white/[0.04]" />)}</div> : rows.length ? <><div className="grid gap-4 md:grid-cols-5"><Metric label="最新营收" value={latest?.revenue} suffix="亿" /><Metric label="最新净利润" value={latest?.net_profit} suffix="亿" primary /><Metric label="毛利率" value={latest?.gross_margin} suffix="%" /><Metric label="净利率" value={latest?.net_margin} suffix="%" /><Metric label="ROE" value={latest?.roe} suffix="%" /></div><div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]"><Panel title="近三年核心指标" kicker="Revenue / Profit / ROE"><ResponsiveContainer width="100%" height={360}><LineChart data={rows}><CartesianGrid stroke="#26313d" strokeDasharray="3 3" /><XAxis dataKey="year" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip contentStyle={{ background: "#10151c", border: "1px solid #26313d", color: "#e8edf2" }} /><Line type="monotone" dataKey="revenue" name="营收(亿)" stroke="#4cc9d8" strokeWidth={2} /><Line type="monotone" dataKey="net_profit" name="净利润(亿)" stroke="#d6a04b" strokeWidth={2} /><Line type="monotone" dataKey="roe" name="ROE(%)" stroke="#34d399" strokeWidth={2} /></LineChart></ResponsiveContainer></Panel><Panel title="最新年度利润瀑布" kicker="Revenue → Net Profit"><ResponsiveContainer width="100%" height={360}><BarChart data={waterfall}><CartesianGrid stroke="#26313d" strokeDasharray="3 3" /><XAxis dataKey="name" stroke="#64748b" /><YAxis stroke="#64748b" /><Tooltip contentStyle={{ background: "#10151c", border: "1px solid #26313d", color: "#e8edf2" }} /><Bar dataKey="value" fill="#d6a04b" radius={[6, 6, 0, 0]}><LabelList dataKey="value" position="top" formatter={(value: number) => `${value.toFixed(1)}亿`} fill="#e8edf2" /></Bar></BarChart></ResponsiveContainer></Panel></div><Panel title="财务数据表" kicker="Last 3 fiscal years"><div className="overflow-x-auto"><table className="w-full min-w-[760px] font-mono text-xs"><thead className="text-slate-500"><tr>{["年份", "营收(亿)", "净利润(亿)", "毛利率", "净利率", "ROE", "经营现金流(亿)"].map((h) => <th key={h} className="border-b border-line px-3 py-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((item) => <tr key={item.year} className="border-b border-line/70 text-slate-300"><td className="px-3 py-3 text-amber">{item.year}</td><td className="px-3 py-3">{fmt(item.revenue)}</td><td className="px-3 py-3">{fmt(item.net_profit)}</td><td className="px-3 py-3">{fmt(item.gross_margin)}%</td><td className="px-3 py-3">{fmt(item.net_margin)}%</td><td className="px-3 py-3">{fmt(item.roe)}%</td><td className="px-3 py-3">{fmt(item.operating_cash_flow)}</td></tr>)}</tbody></table></div></Panel></> : <EmptyState title="暂无财务指标" message="AKShare 暂未返回该股票近三年财务数据。可尝试刷新，或切换到已披露完整财报的标的。" />}</section>;
}

function Panel({ title, kicker, children }: { title: string; kicker: string; children: React.ReactNode }) { return <div className="animate-[fade-in_220ms_ease-out] border border-line bg-panel/82 p-5 shadow-2xl shadow-black/20"><div className="font-mono text-xs uppercase tracking-[0.25em] text-cyan">{kicker}</div><h2 className="mt-2 font-display text-3xl text-slate-100">{title}</h2><div className="mt-5 h-full">{children}</div><DataSource source="AKShare/财务指标" /></div>; }
function Metric({ label, value, suffix, primary = false }: { label: string; value?: number; suffix: string; primary?: boolean }) { return <div className={`border p-4 ${primary ? "border-amber/60 bg-amber/10" : "border-line bg-carbon/75"}`}><div className="font-mono text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div><div className={`mt-3 font-display text-3xl ${primary ? "text-amber" : "text-slate-100"}`}>{fmt(value)}<span className="ml-1 text-base text-slate-500">{suffix}</span></div></div>; }
function fmt(value?: number) { return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2) : "--"; }
