import Link from "next/link";

const nav = [
  { href: "/", label: "Dashboard" },
  { href: "/research/600058", label: "研究台" },
  { href: "/portfolio", label: "📊 持仓分析" },
  { href: "/research/600058/industry", label: "行业对比" },
  { href: "/research/600058/chain", label: "产业链" },
  { href: "/research/600058/thesis", label: "论点构建" },
  { href: "/research/600058/drivers", label: "利润因子" },
  { href: "/research/600058/decisions", label: "决策日志" },
  { href: "/research/600058/review", label: "复盘系统" }
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="market-grid min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-line/80 bg-carbon/75 p-5 shadow-[inset_-1px_0_0_rgba(255,255,255,.04),0_0_60px_rgba(0,0,0,.35)] backdrop-blur-xl xl:block">
        <div className="mb-8">
          <div className="metal-text font-display text-2xl tracking-[0.28em]">价投手</div>
          <div className="mt-2 text-xs uppercase tracking-[0.34em] text-slate-500">Value Workbench</div>
        </div>
        <nav className="space-y-2">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="glow-hover block border border-transparent px-3 py-2 text-sm text-slate-300 transition hover:border-amber/40 hover:bg-amber/10 hover:text-amber hover:shadow-[0_0_24px_rgba(214,160,75,.12)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-h-screen px-4 py-5 xl:pl-72 xl:pr-8">{children}</main>
    </div>
  );
}