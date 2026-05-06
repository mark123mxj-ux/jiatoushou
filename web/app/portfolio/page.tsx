"use client";

import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { dataBaseUrl } from "@/lib/api";

type Holding = { stock_code: string; stock_name: string; shares: number; cost_price: number | null; current_price: number | null; market_value: number | null; profit_loss: number | null; profit_pct: number | null; confidence?: Record<string, string> };
type PortfolioPayload = { holdings: Holding[]; total_market_value: number; total_cost: number; total_profit_loss: number; import_source: string; import_date: string; raw_text?: string };
type Trade = { id?: number; date: string; stock_code: string; stock_name: string; action: "buy" | "sell"; price: number; shares: number; amount: number; note?: string };
type TradePayload = { trades: Trade[]; import_source: string; import_date: string; raw_text?: string };
type Tab = "image" | "excel" | "manual" | "trades";

const emptyRow = (): Holding => ({ stock_code: "", stock_name: "", shares: 0, cost_price: null, current_price: null, market_value: null, profit_loss: null, profit_pct: null, confidence: { stock_code: "low", stock_name: "low", shares: "low", cost_price: "low", current_price: "low" } });
const emptyTrade = (): Trade => ({ date: new Date().toISOString().slice(0, 10), stock_code: "", stock_name: "", action: "buy", price: 0, shares: 0, amount: 0, note: "" });
const fields: { key: keyof Holding; label: string }[] = [{ key: "stock_code", label: "股票代码" }, { key: "stock_name", label: "名称" }, { key: "shares", label: "持仓数量" }, { key: "cost_price", label: "成本价" }, { key: "current_price", label: "现价" }, { key: "market_value", label: "市值" }, { key: "profit_loss", label: "盈亏" }, { key: "profit_pct", label: "盈亏%" }];

function calculate(items: Holding[], source = "manual"): PortfolioPayload {
  const holdings = items.map((item) => {
    const shares = Number(item.shares) || 0;
    const cost = item.cost_price == null ? null : Number(item.cost_price);
    const current = item.current_price == null ? null : Number(item.current_price);
    const market = item.market_value ?? (current == null ? null : shares * current);
    const profit = item.profit_loss ?? (market != null && cost != null ? market - shares * cost : null);
    const pct = item.profit_pct ?? (profit != null && cost ? (profit / (shares * cost)) * 100 : null);
    return { ...item, shares, cost_price: cost, current_price: current, market_value: market, profit_loss: profit, profit_pct: pct };
  });
  return { holdings, total_market_value: holdings.reduce((sum, item) => sum + (Number(item.market_value) || 0), 0), total_cost: holdings.reduce((sum, item) => sum + (Number(item.shares) || 0) * (Number(item.cost_price) || 0), 0), total_profit_loss: holdings.reduce((sum, item) => sum + (Number(item.profit_loss) || 0), 0), import_source: source, import_date: new Date().toISOString().slice(0, 10) };
}

export default function PortfolioPage() {
  const [tab, setTab] = useState<Tab>("image");
  const [step, setStep] = useState<"import" | "preview">("import");
  const [preview, setPreview] = useState<PortfolioPayload>(calculate([], "manual"));
  const [manualRows, setManualRows] = useState<Holding[]>([emptyRow()]);
  const [imagePreview, setImagePreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState("");
  const [message, setMessage] = useState("");
  const [tradeRows, setTradeRows] = useState<Trade[]>([emptyTrade()]);
  const [tradePreview, setTradePreview] = useState<TradePayload>({ trades: [], import_source: "manual", import_date: new Date().toISOString().slice(0, 10) });
  const [tradeStep, setTradeStep] = useState<"import" | "preview">("import");
  const imageInput = useRef<HTMLInputElement>(null);
  const excelInput = useRef<HTMLInputElement>(null);
  const totals = useMemo(() => calculate(preview.holdings, preview.import_source), [preview]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((item) => item.type.startsWith("image/"));
      if (file) void uploadImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function upload(endpoint: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`${dataBaseUrl}${endpoint}`, { method: "POST", body: form });
    if (!response.ok) throw new Error(await response.text());
    return response.json() as Promise<PortfolioPayload>;
  }

  function normalizeTrades(rows: Trade[], source = "manual"): TradePayload {
    const trades = rows.filter((row) => row.stock_code || row.stock_name).map((row) => ({ ...row, price: Number(row.price) || 0, shares: Number(row.shares) || 0, amount: (Number(row.price) || 0) * (Number(row.shares) || 0) }));
    return { trades, import_source: source, import_date: new Date().toISOString().slice(0, 10) };
  }

  async function uploadImage(file: File) {
    setLoading("OCR识别中：正在读取截图文字并匹配持仓表格…");
    setMessage("");
    setImagePreview(URL.createObjectURL(file));
    try {
      const payload = await upload("/api/portfolio/import-image", file);
      setPreview(payload);
      setStep("preview");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "截图识别失败");
    } finally {
      setLoading("");
    }
  }

  async function uploadExcel(file: File) {
    setLoading("文件解析中：正在智能匹配代码、名称、数量、成本、现价列…");
    setFileName(file.name);
    setMessage("");
    try {
      const payload = await upload("/api/portfolio/import-excel", file);
      setPreview(payload);
      setStep("preview");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "文件解析失败");
    } finally {
      setLoading("");
    }
  }

  async function uploadTradeExcel(file: File) {
    setLoading("交易文件解析中：正在匹配日期、代码、买卖、价格、数量列…");
    setMessage("");
    try {
      const payload = await upload("/api/portfolio/trades/import-excel", file) as unknown as TradePayload;
      setTradePreview(payload);
      setTradeStep("preview");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "交易文件解析失败");
    } finally {
      setLoading("");
    }
  }

  async function uploadTradeImage(file: File) {
    setLoading("交易OCR识别中：正在读取成交记录截图…");
    setMessage("");
    setImagePreview(URL.createObjectURL(file));
    try {
      const payload = await upload("/api/portfolio/trades/import-image", file) as unknown as TradePayload;
      setTradePreview(payload);
      setTradeStep("preview");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "交易截图识别失败");
    } finally {
      setLoading("");
    }
  }

  async function searchStock(index: number, code: string) {
    setManualRows((rows) => rows.map((row, i) => i === index ? { ...row, stock_code: code } : row));
    if (code.length < 3) return;
    const response = await fetch(`${dataBaseUrl}/api/stocks/search?q=${encodeURIComponent(code)}`);
    const data = await response.json();
    const stock = data.items?.[0];
    if (stock) setManualRows((rows) => rows.map((row, i) => i === index ? { ...row, stock_code: stock.code, stock_name: stock.name, current_price: row.current_price ?? stock.current_price, confidence: { ...row.confidence, stock_code: "high", stock_name: "high", current_price: stock.current_price ? "high" : "low" } } : row));
  }

  async function autoPrices() {
    const next = await Promise.all(manualRows.map(async (row) => {
      if (!row.stock_code) return row;
      const response = await fetch(`${dataBaseUrl}/api/stocks/${row.stock_code}/profile`);
      const data = await response.json();
      return { ...row, stock_name: row.stock_name || data.name, current_price: data.current_price ?? row.current_price };
    }));
    setManualRows(next);
  }

  async function save() {
    setLoading("保存中：正在写入本地持仓JSON…");
    const response = await fetch(`${dataBaseUrl}/api/portfolio/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(totals) });
    setLoading("");
    setMessage(response.ok ? "保存成功，可通过 GET /api/portfolio 获取。" : await response.text());
  }

  async function saveTrades() {
    setLoading("保存中：正在写入交易记录JSON…");
    const response = await fetch(`${dataBaseUrl}/api/portfolio/trades/save`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tradePreview) });
    setLoading("");
    setMessage(response.ok ? "交易记录保存成功，可进入交易历史分析。" : await response.text());
  }

  function updateHolding(index: number, key: keyof Holding, value: string) {
    setPreview((payload) => ({ ...payload, holdings: payload.holdings.map((item, i) => i === index ? { ...item, [key]: ["stock_code", "stock_name"].includes(key) ? value : value === "" ? null : Number(value), confidence: { ...item.confidence, [key]: "high" } } : item) }));
  }

  if (tab === "trades") return <section className="mx-auto max-w-7xl space-y-6 pt-8"><Header /><div className="premium-panel p-5"><div className="grid gap-3 md:grid-cols-4"><TabButton id="image" label="📷 持仓截图" tab={tab} setTab={setTab} /><TabButton id="excel" label="📊 持仓Excel" tab={tab} setTab={setTab} /><TabButton id="manual" label="✏️ 手动持仓" tab={tab} setTab={setTab} /><TabButton id="trades" label="📝 交易记录" tab={tab} setTab={setTab} /></div>{tradeStep === "import" ? <div className="mt-5 space-y-5"><div className="glass-card p-5"><input ref={excelInput} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && uploadTradeExcel(e.target.files[0])} /><button onClick={() => excelInput.current?.click()} className="border border-amber/60 bg-amber/15 px-5 py-3 font-mono text-xs text-amber">上传交易Excel/CSV</button><button onClick={() => imageInput.current?.click()} className="ml-3 border border-cyan/50 px-5 py-3 font-mono text-xs text-cyan">上传成交截图OCR</button><input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadTradeImage(e.target.files[0])} /><a className="ml-4 font-mono text-xs text-cyan underline" href={'data:text/csv;charset=utf-8,' + encodeURIComponent('日期,代码,名称,买卖,价格,数量\n2026-01-05,000858,五粮液,买入,150,100\n')} download="trades-template.csv">下载交易模板</a></div><TradeRows rows={tradeRows} onChange={setTradeRows} /><div className="flex flex-wrap gap-3"><button onClick={() => setTradeRows([...tradeRows, emptyTrade()])} className="border border-cyan/50 px-4 py-2 font-mono text-xs text-cyan">添加交易</button><button onClick={() => { setTradePreview(normalizeTrades(tradeRows, "manual")); setTradeStep("preview"); }} className="border border-emerald-400/50 px-4 py-2 font-mono text-xs text-emerald-300">进入预览确认</button></div></div> : <div className="mt-5 space-y-5"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-display text-3xl text-slate-100">交易导入预览 · {tradePreview.trades.length} 笔</h2><div className="flex gap-3"><button onClick={() => setTradeStep("import")} className="border border-line px-4 py-2 font-mono text-xs text-slate-400">返回导入</button><button onClick={saveTrades} className="border border-amber/60 bg-amber/15 px-5 py-2 font-mono text-xs text-amber">确认保存</button><Link href="/portfolio/trades" className="border border-emerald-400/50 px-5 py-2 font-mono text-xs text-emerald-300">查看交易历史</Link></div></div><TradeRows rows={tradePreview.trades} onChange={(rows) => setTradePreview((payload) => ({ ...payload, trades: rows }))} /></div>}{loading && <div className="mt-5 animate-pulse border border-cyan/30 bg-cyan/10 p-4 font-mono text-sm text-cyan">{loading}</div>}{message && <div className="mt-5 border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div>}</div></section>;
  return <section className="mx-auto max-w-7xl space-y-6 pt-8"><Header />{step === "import" ? <div className="premium-panel p-5"><div className="grid gap-3 md:grid-cols-4"><TabButton id="image" label="📷 截图识别" tab={tab} setTab={setTab} /><TabButton id="excel" label="📊 Excel导入" tab={tab} setTab={setTab} /><TabButton id="manual" label="✏️ 手动输入" tab={tab} setTab={setTab} /><TabButton id="trades" label="📝 交易记录" tab={tab} setTab={setTab} /></div>{tab === "image" && <div className="mt-5"><input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadImage(e.target.files[0])} /><div onClick={() => imageInput.current?.click()} onDragOver={(e: DragEvent) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) void uploadImage(file); }} className="glow-hover flex min-h-[320px] cursor-pointer flex-col items-center justify-center border-2 border-dashed border-cyan/35 bg-cyan/5 p-8 text-center transition hover:border-amber/70 hover:bg-amber/10 hover:shadow-[0_0_42px_rgba(214,160,75,.16)]"><div className="text-6xl">📷</div><div className="mt-4 font-display text-3xl text-slate-100">拖拽截图到这里，或点击选择</div><div className="mt-2 font-mono text-xs text-slate-500">也支持 Ctrl+V 直接粘贴截图 · 图片大小 ≤ 10MB</div>{imagePreview && <img src={imagePreview} alt="持仓截图预览" className="mt-5 max-h-64 rounded-xl border border-line object-contain" />}</div><p className="mt-3 text-sm text-slate-500">支持券商APP持仓截图、雪球持仓截图</p></div>}{tab === "excel" && <div className="mt-5 glass-card p-6"><input ref={excelInput} type="file" accept=".xlsx,.csv" className="hidden" onChange={(e) => e.target.files?.[0] && uploadExcel(e.target.files[0])} /><button onClick={() => excelInput.current?.click()} className="border border-amber/60 bg-amber/15 px-5 py-3 font-mono text-xs text-amber transition hover:bg-amber/25">上传 .xlsx / .csv 文件</button><a className="ml-4 font-mono text-xs text-cyan underline" href={'data:text/csv;charset=utf-8,' + encodeURIComponent('股票代码,股票名称,持仓数量,成本价,现价\n000858,五粮液,1000,150,165.5\n')} download="portfolio-template.csv">下载标准模板</a><div className="mt-4 text-sm text-slate-400">{fileName ? `已选择：${fileName}` : "系统会通过表头关键词自动匹配代码、名称、数量、成本、现价等列。"}</div></div>}{tab === "manual" && <div className="mt-5 space-y-4"><EditableRows rows={manualRows} onCode={searchStock} onChange={setManualRows} /><div className="flex flex-wrap gap-3"><button onClick={() => setManualRows([...manualRows, emptyRow()])} className="border border-cyan/50 px-4 py-2 font-mono text-xs text-cyan">添加行</button><button onClick={autoPrices} className="border border-amber/50 px-4 py-2 font-mono text-xs text-amber">自动获取最新价</button><button onClick={() => { setPreview(calculate(manualRows, "manual")); setStep("preview"); }} className="border border-emerald-400/50 px-4 py-2 font-mono text-xs text-emerald-300">进入预览确认</button></div></div>}{loading && <div className="mt-5 animate-pulse border border-cyan/30 bg-cyan/10 p-4 font-mono text-sm text-cyan">{loading}</div>}{message && <div className="mt-5 border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-200">{message}</div>}</div> : <div className="space-y-5"><div className="premium-panel p-5"><div className="flex flex-col justify-between gap-3 md:flex-row md:items-center"><div><div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">Preview & Confirm</div><h2 className="mt-2 font-display text-4xl text-slate-100">导入预览确认</h2></div><div className="flex flex-wrap gap-3"><button onClick={() => setPreview((p) => ({ ...p, holdings: [...p.holdings, emptyRow()] }))} className="border border-cyan/50 px-4 py-2 font-mono text-xs text-cyan">添加持仓</button><button onClick={() => setStep("import")} className="border border-line px-4 py-2 font-mono text-xs text-slate-400">返回导入</button><button onClick={save} className="border border-amber/60 bg-amber/15 px-5 py-2 font-mono text-xs text-amber">确认保存</button><Link href="/portfolio/analysis" className="border border-emerald-400/50 px-5 py-2 font-mono text-xs text-emerald-300">查看分析</Link><Link href="/portfolio/trades" className="border border-cyan/50 px-5 py-2 font-mono text-xs text-cyan">查看交易历史</Link></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><Metric label="总市值" value={totals.total_market_value} /><Metric label="总成本" value={totals.total_cost} /><Metric label="总盈亏" value={totals.total_profit_loss} /></div></div><div className="overflow-x-auto premium-panel p-1"><table className="w-full min-w-[1080px] border-collapse font-mono text-xs"><thead className="text-slate-500"><tr>{fields.map((field) => <th key={field.key} className="border-b border-line px-3 py-3 text-left">{field.label}</th>)}<th className="border-b border-line px-3 py-3">确认</th><th className="border-b border-line px-3 py-3">操作</th></tr></thead><tbody>{preview.holdings.map((row, index) => <tr key={index} className="border-b border-line/70">{fields.map((field) => <td key={field.key} className="px-2 py-2"><input value={(row[field.key] as string | number | null) ?? ""} onChange={(e) => updateHolding(index, field.key, e.target.value)} className="w-full border border-line bg-carbon/80 px-2 py-2 text-slate-200 outline-none focus:border-cyan" /><div className={row.confidence?.[field.key] === "low" ? "mt-1 text-rose-300" : "mt-1 text-emerald-300"}>{row.confidence?.[field.key] === "low" ? "需人工确认" : "自动识别"}</div></td>)}<td className="px-3 py-2 text-center"><input type="checkbox" defaultChecked /></td><td className="px-3 py-2"><button onClick={() => setPreview((p) => ({ ...p, holdings: p.holdings.filter((_, i) => i !== index) }))} className="text-rose-300">删除</button></td></tr>)}</tbody></table></div>{loading && <div className="border border-cyan/30 bg-cyan/10 p-4 font-mono text-sm text-cyan">{loading}</div>}{message && <div className="border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">{message}</div>}</div>}<div className="premium-panel p-5"><Link href="/portfolio/trades" className="font-mono text-sm text-cyan">查看交易历史 →</Link></div></section>;
}

function Header() { return <div className="relative overflow-hidden premium-panel p-8"><div className="hero-orb absolute right-10 top-0 h-56 w-56 rounded-full bg-cyan/20 blur-3xl" /><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><div className="font-mono text-xs uppercase tracking-[0.38em] text-cyan">Portfolio Import Terminal</div><h1 className="metal-text mt-3 font-display text-5xl font-semibold">持仓与交易导入</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">支持持仓与交易记录的截图OCR、Excel/CSV和手动输入，形成完整投资复盘闭环。</p></div><div className="flex flex-wrap gap-3"><Link href="/portfolio/analysis" className="border border-amber/60 bg-amber/15 px-5 py-3 text-center font-mono text-xs text-amber transition hover:bg-amber/25">查看分析报告 →</Link><Link href="/portfolio/trades" className="border border-cyan/50 px-5 py-3 text-center font-mono text-xs text-cyan transition hover:bg-cyan/10">交易行为分析 →</Link></div></div></div>; }
function TabButton({ id, label, tab, setTab }: { id: Tab; label: string; tab: Tab; setTab: (tab: Tab) => void }) { return <button onClick={() => setTab(id)} className={`border px-4 py-3 font-mono text-sm transition ${tab === id ? "border-amber/60 bg-amber/15 text-amber" : "border-line text-slate-400 hover:border-cyan/50"}`}>{label}</button>; }
function TradeRows({ rows, onChange }: { rows: Trade[]; onChange: (rows: Trade[]) => void }) {
  function set(index: number, key: keyof Trade, value: string) { onChange(rows.map((row, i) => i === index ? { ...row, [key]: ["stock_code", "stock_name", "action", "date", "note"].includes(key) ? value : Number(value), amount: key === "price" ? Number(value) * row.shares : key === "shares" ? row.price * Number(value) : row.amount } : row)); }
  return <div className="overflow-x-auto"><table className="w-full min-w-[980px] font-mono text-xs"><thead className="text-slate-500"><tr>{["日期", "代码", "名称", "买卖", "价格", "数量", "金额", "备注", "操作"].map((h) => <th key={h} className="border-b border-line px-3 py-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-line/70"><td className="px-2 py-2"><input type="date" value={row.date} onChange={(e) => set(index, "date", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><input value={row.stock_code} onChange={(e) => set(index, "stock_code", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><input value={row.stock_name} onChange={(e) => set(index, "stock_name", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><select value={row.action} onChange={(e) => set(index, "action", e.target.value)} className="input-terminal w-full"><option value="buy">买入</option><option value="sell">卖出</option></select></td><td className="px-2 py-2"><input value={row.price || ""} onChange={(e) => set(index, "price", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><input value={row.shares || ""} onChange={(e) => set(index, "shares", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2 text-amber">¥{(row.amount || row.price * row.shares).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</td><td className="px-2 py-2"><input value={row.note ?? ""} onChange={(e) => set(index, "note", e.target.value)} className="input-terminal w-full" /></td><td className="px-3 py-2"><button onClick={() => onChange(rows.filter((_, i) => i !== index).length ? rows.filter((_, i) => i !== index) : [emptyTrade()])} className="text-rose-300">删除</button></td></tr>)}</tbody></table></div>;
}

function EditableRows({ rows, onChange, onCode }: { rows: Holding[]; onChange: (rows: Holding[]) => void; onCode: (index: number, code: string) => void }) {
  function set(index: number, key: keyof Holding, value: string) { onChange(rows.map((row, i) => i === index ? { ...row, [key]: ["stock_code", "stock_name"].includes(key) ? value : value === "" ? null : Number(value) } : row)); }
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] font-mono text-xs"><thead className="text-slate-500"><tr>{["股票代码", "名称", "持仓数量", "成本价", "现价", "操作"].map((h) => <th key={h} className="border-b border-line px-3 py-3 text-left">{h}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index} className="border-b border-line/70"><td className="px-2 py-2"><input value={row.stock_code} onChange={(e) => onCode(index, e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><input value={row.stock_name} onChange={(e) => set(index, "stock_name", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><input value={row.shares || ""} onChange={(e) => set(index, "shares", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><input value={row.cost_price ?? ""} onChange={(e) => set(index, "cost_price", e.target.value)} className="input-terminal w-full" /></td><td className="px-2 py-2"><input value={row.current_price ?? ""} onChange={(e) => set(index, "current_price", e.target.value)} className="input-terminal w-full" /></td><td className="px-3 py-2"><button onClick={() => onChange(rows.filter((_, i) => i !== index).length ? rows.filter((_, i) => i !== index) : [emptyRow()])} className="text-rose-300">删除</button></td></tr>)}</tbody></table></div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="glass-card p-4"><div className="font-mono text-xs text-slate-500">{label}</div><div className="data-figure mt-2 text-2xl text-slate-100">¥{value.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}</div></div>; }
