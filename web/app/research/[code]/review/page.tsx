"use client";

import { LearningGuide } from "@/components/LearningGuide";
import { ResearchNav } from "@/components/ResearchNav";
import { Decision, Review, decisionsKey, daysSince, loadJson, markProgress, reviewKey, saveJson, stockNames, thesisKey, type Thesis } from "@/lib/researchStore";
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from "recharts";

const quadrants = [{ label: "技术精湛", x: 75, y: 78 }, { label: "运气不好", x: 25, y: 78 }, { label: "运气好", x: 75, y: 25 }, { label: "需改进", x: 25, y: 25 }];

export default function ReviewPage({ params }: { params: { code: string } }) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const rKey = reviewKey(params.code);

  useEffect(() => {
    markProgress(params.code, "review");
    setDecisions(loadJson<Decision[]>(decisionsKey(params.code), []));
    setReviews(loadJson<Review[]>(rKey, []));
    setThesis(loadJson<Thesis | null>(thesisKey(params.code), null));
  }, [params.code, rKey]);

  const buys = decisions.filter((item) => item.action === "买入" || item.action === "加仓");
  const reminders = buys.flatMap((item) => [30, 90, 180].map((days) => ({ item, days, due: daysSince(item.date) >= days }))).filter((item) => item.due);
  const chartData = decisions.map((item) => ({ name: `${item.action}-${item.date}`, decisionId: item.id, x: reviews.find((r) => r.decisionId === item.id)?.x ?? 50, y: reviews.find((r) => r.decisionId === item.id)?.y ?? 50, z: 90, action: item.action }));
  const selected = useMemo(() => decisions[0], [decisions]);

  function classify(id: string, x: number, y: number) {
    const next = reviews.filter((item) => item.decisionId !== id).concat({ decisionId: id, x, y, actual: reviews.find((item) => item.decisionId === id)?.actual ?? "", updatedAt: new Date().toLocaleString("zh-CN") });
    setReviews(next);
    saveJson(rKey, next);
  }

  function setActual(id: string, actual: string) {
    const current = reviews.find((item) => item.decisionId === id) ?? { decisionId: id, x: 50, y: 50, actual: "", updatedAt: "" };
    const next = reviews.filter((item) => item.decisionId !== id).concat({ ...current, actual, updatedAt: new Date().toLocaleString("zh-CN") });
    setReviews(next);
    saveJson(rKey, next);
  }

  return <section className="space-y-5"><LearningGuide module="review" /><ResearchNav code={params.code} current="review" /><div className="relative overflow-hidden border border-line bg-carbon/90 p-6"><div className="absolute right-10 top-0 h-40 w-40 rounded-full bg-cyan/15 blur-3xl" /><div className="font-mono text-xs uppercase tracking-[0.32em] text-cyan">Review Matrix / {params.code}</div><h1 className="mt-3 font-display text-5xl text-slate-100">{stockNames[params.code] ?? params.code} · 复盘系统</h1><p className="mt-2 text-sm text-slate-400">把买入后的现实反馈映射到“结果 × 逻辑”矩阵。</p></div><div className="grid gap-4 md:grid-cols-3">{[30, 90, 180].map((days) => <div key={days} className="border border-line bg-panel/80 p-4"><div className="font-mono text-xs text-cyan">{days} DAYS</div><div className="mt-2 font-display text-3xl text-slate-100">{reminders.filter((item) => item.days === days).length}</div><div className="text-sm text-slate-500">到期复盘提醒</div></div>)}</div><div className="grid gap-5 xl:grid-cols-[1fr_420px]"><div className="border border-line bg-panel/85 p-5"><h2 className="font-display text-3xl text-slate-100">决策质量四象限</h2><div className="mt-4 h-[470px]"><ResponsiveContainer width="100%" height="100%"><ScatterChart margin={{ top: 20, right: 24, bottom: 20, left: 10 }}><CartesianGrid stroke="#26313d" strokeDasharray="3 3" /><XAxis type="number" dataKey="x" domain={[0, 100]} name="结果好坏" stroke="#64748b" tick={{ fontSize: 11 }} /><YAxis type="number" dataKey="y" domain={[0, 100]} name="逻辑正确" stroke="#64748b" tick={{ fontSize: 11 }} /><ZAxis type="number" dataKey="z" range={[90, 180]} /><ReferenceLine x={50} stroke="#d6a04b" strokeDasharray="4 4" /><ReferenceLine y={50} stroke="#d6a04b" strokeDasharray="4 4" /><Tooltip content={<ChartTip />} /><Scatter data={quadrants} fill="transparent" shape={(props: any) => <text x={props.cx - 28} y={props.cy} fill="#64748b" fontSize="12">{props.payload.label}</text>} /><Scatter data={chartData} fill="#4cc9d8" stroke="#d6a04b" /></ScatterChart></ResponsiveContainer></div></div><div className="space-y-5"><div className="border border-line bg-carbon/85 p-5"><h2 className="font-display text-3xl text-slate-100">论点回顾</h2><p className="mt-3 text-sm leading-6 text-slate-400">你当时说：{thesis?.companyText || thesis?.industryText || "尚未保存论点"}</p><p className="mt-2 text-sm leading-6 text-slate-400">实际发生了什么？请在下方为每笔交易记录现实反馈。</p></div><div className="border border-line bg-panel/85 p-5"><h2 className="font-display text-3xl text-slate-100">交易归类</h2><div className="mt-4 space-y-4">{decisions.length ? decisions.map((item) => <div key={item.id} className="border border-line bg-carbon/70 p-4"><div className="flex justify-between gap-3"><div><div className="font-mono text-xs text-cyan">{item.date} · {item.action}</div><div className="mt-1 text-sm text-slate-300">{item.thesisRef}</div></div><div className="text-right font-mono text-xs text-amber">¥{item.amount.toLocaleString("zh-CN")}</div></div><div className="mt-3 grid grid-cols-2 gap-2">{quadrants.map((q) => <button key={q.label} onClick={() => classify(item.id, q.x, q.y)} className="border border-line px-2 py-2 font-mono text-[11px] text-slate-400 transition hover:border-amber/50 hover:text-amber">{q.label}</button>)}</div><textarea value={reviews.find((r) => r.decisionId === item.id)?.actual ?? ""} onChange={(e) => setActual(item.id, e.target.value)} placeholder="实际发生了什么？" className="mt-3 min-h-20 w-full border border-line bg-panel px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan" /></div>) : <div className="text-sm text-slate-500">暂无决策记录，请先进入决策日志。</div>}</div></div></div></div></section>;
}

function ChartTip({ active, payload }: any) { if (!active || !payload?.length) return null; const item = payload[0].payload; return <div className="border border-line bg-carbon/95 px-3 py-2 text-xs"><div className="text-cyan">{item.name}</div><div className="text-slate-400">结果 {item.x} / 逻辑 {item.y}</div></div>; }
