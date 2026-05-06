import { DataFreshness, DataSource } from "@/components/DataFreshness";
import Link from "next/link";

async function fetchStock(code: string) {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  const response = await fetch(`${baseUrl}/api/stocks/${code}/profile`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

export default async function ResearchPage({ params }: { params: { code: string } }) {
  const stock = await fetchStock(params.code);
  const steps = [
    { step: "01", title: "基本面概览", desc: "当前页", href: `/research/${params.code}`, status: "done" },
    { step: "02", title: "行业竞争格局", desc: "对比同行", href: `/research/${params.code}/industry`, status: "ready" },
    { step: "03", title: "产业链分析", desc: "即将上线", href: `/research/${params.code}/chain`, status: "soon" },
    { step: "04", title: "利润驱动因子", desc: "即将上线", href: `/research/${params.code}/drivers`, status: "soon" },
    { step: "05", title: "投资论点", desc: "构建买入与卖出纪律", href: `/research/${params.code}/thesis`, status: "ready" },
    { step: "06", title: "决策记录", desc: "Step 5", href: `/research/${params.code}/decisions`, status: "soon" }
  ];

  return (
    <section className="space-y-5">
      <div className="border border-line bg-carbon/80 p-6">
        <div className="flex items-start justify-between gap-3"><div className="font-mono text-xs uppercase tracking-[0.32em] text-cyan">Research / {params.code}</div><DataFreshness dataDate={stock?.data_date} source={stock?.source} cacheAge={stock?.cache_age} /></div>
        <h1 className="mt-3 font-display text-5xl text-slate-100">{stock?.name ?? "数据加载失败"}</h1>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="代码" value={stock?.code} />
          <Metric label="行业" value={stock?.industry} />
          <Metric label="子行业" value={stock?.sub_industry} />
          <Metric label="总市值" value={stock?.market_cap} />
        </div>
        <DataSource source={stock?.source} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <LinkCard href={`/research/${params.code}/industry`} title="行业对比" desc="同行公司估值与规模横向比较" />
        <LinkCard href={`/research/${params.code}/chain`} title="产业链" desc="上游、中游、下游结构与关键变量" />
        <LinkCard href={`/research/${params.code}/thesis`} title="论点构建" desc="行业、公司、估值与卖出条件" />
      </div>
      <div className="border border-line bg-carbon/80 p-6">
        <div className="font-mono text-xs uppercase tracking-[0.32em] text-cyan">Research Flow</div>
        <h2 className="mt-3 font-display text-4xl text-slate-100">六步研究导航</h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          {steps.map((item, index) => (
            <Link key={item.step} href={item.href} className="group relative border border-line bg-panel/75 p-4 transition hover:border-amber/60 hover:bg-amber/10">
              {index < steps.length - 1 ? <div className="absolute -right-3 top-1/2 hidden text-slate-600 lg:block">→</div> : null}
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-slate-500">{item.step}</span>
                <span className={item.status === "done" ? "text-amber" : item.status === "ready" ? "text-cyan" : "text-slate-600"}>{item.status === "done" ? "✓" : item.status === "ready" ? "●" : "○"}</span>
              </div>
              <div className="mt-4 font-display text-2xl text-slate-100 group-hover:text-amber">{item.title}</div>
              <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="border border-line bg-panel/75 p-4">
      <div className="font-mono text-xs text-slate-500">{label}</div>
      <div className="mt-2 truncate font-mono text-sm text-amber">{value ? String(value) : "--"}</div>
    </div>
  );
}

function LinkCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="border border-line bg-panel/75 p-5 transition hover:border-amber/60 hover:bg-amber/10">
      <div className="font-display text-2xl text-slate-100">{title}</div>
      <p className="mt-2 text-sm text-slate-400">{desc}</p>
    </Link>
  );
}