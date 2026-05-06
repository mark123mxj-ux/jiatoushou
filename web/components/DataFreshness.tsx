"use client";

import { useEffect, useState } from "react";

function daysBetween(date?: string) {
  if (!date) return null;
  const time = new Date(date).getTime();
  if (!Number.isFinite(time)) return null;
  return Math.max(0, Math.floor((Date.now() - time) / 86400000));
}

export function DataFreshness({ dataDate, source, cacheAge, className = "" }: { dataDate?: string; source?: string; cacheAge?: number; className?: string }) {
  const days = daysBetween(dataDate);
  const tone = days === null ? "border-slate-500/30 bg-slate-500/10 text-slate-400" : days === 0 ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300" : days > 30 ? "border-rose-400/50 bg-rose-500/10 text-rose-300" : days > 7 ? "border-orange-400/50 bg-orange-500/10 text-orange-300" : "border-cyan/40 bg-cyan/10 text-cyan";
  const label = days === 0 ? "最新" : days !== null && days > 30 ? "数据已过期，请刷新" : days !== null && days > 7 ? "数据可能过期" : "数据更新";
  return <div className={`inline-flex flex-col gap-1 border px-3 py-2 font-mono text-[11px] ${tone} ${className}`}><span>{label}: {dataDate ?? "--"}</span>{source ? <span className="text-slate-500">来源: {source}</span> : null}{typeof cacheAge === "number" && cacheAge > 0 ? <span className="text-slate-500">缓存: {formatAge(cacheAge)}</span> : null}</div>;
}

export function RefreshButton({ onClick, refreshing, label = "刷新" }: { onClick: () => void; refreshing?: boolean; label?: string }) {
  return <button onClick={onClick} disabled={refreshing} className="inline-flex items-center gap-2 border border-line bg-panel/80 px-3 py-2 font-mono text-[11px] text-slate-300 transition hover:border-cyan/50 hover:text-cyan disabled:cursor-wait disabled:opacity-70"><span className={refreshing ? "animate-spin" : ""}>↻</span>{label}</button>;
}

export function OfflineNotice() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return <div className="border border-orange-400/50 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">网络已断开，当前显示可能是缓存数据。恢复连接后可点击刷新。</div>;
}

export function ErrorState({ title = "数据加载失败", message = "网络或数据源暂时不可用，请稍后重试。", onRetry }: { title?: string; message?: string; onRetry?: () => void }) {
  return <div className="border border-rose-400/40 bg-rose-500/10 p-6 text-sm text-slate-300"><div className="text-2xl">⚠️</div><h3 className="mt-2 font-display text-2xl text-rose-200">{title}</h3><p className="mt-2 text-slate-400">{message}</p>{onRetry ? <button onClick={onRetry} className="mt-4 border border-rose-300/50 bg-rose-500/10 px-4 py-2 font-mono text-xs text-rose-100 transition hover:bg-rose-500/20">重试</button> : null}</div>;
}

export function EmptyState({ title = "暂未形成有效数据", message = "这个维度还缺少可验证信息。建议先刷新数据，或补充公告、研报与行业协会资料。" }: { title?: string; message?: string }) {
  return <div className="border border-dashed border-cyan/30 bg-cyan/5 p-6 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-cyan/30 bg-cyan/10 text-2xl">◇</div><h3 className="mt-3 font-display text-2xl text-slate-100">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{message}</p></div>;
}

export function DataSource({ source }: { source?: string }) {
  return <div className="mt-4 border-t border-line/70 pt-3 font-mono text-[11px] text-slate-600">来源: {source ?? "AKShare/东方财富"}</div>;
}

function formatAge(seconds: number) {
  if (seconds < 60) return `${seconds}秒前`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时前`;
  return `${Math.floor(seconds / 86400)}天前`;
}
