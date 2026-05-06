"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { modules, loadJson, progressKey, type ModuleKey } from "@/lib/researchStore";

export function ResearchNav({ code, current }: { code: string; current: ModuleKey }) {
  const [done, setDone] = useState<ModuleKey[]>([]);
  useEffect(() => setDone(loadJson<ModuleKey[]>(progressKey(code), [])), [code]);
  const index = modules.findIndex((item) => item.key === current);
  const next = modules[index + 1];

  return (
    <div className="premium-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        {modules.map((item, idx) => {
          const tone = item.key === current ? "border-amber/60 bg-amber/15 text-amber" : done.includes(item.key) ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-line text-slate-500 hover:border-amber/40 hover:text-amber";
          return (
            <Link key={item.key} href={item.href(code)} className={`glow-hover group relative z-10 flex items-center gap-2 border px-3 py-2 font-mono text-[11px] transition ${tone}`}>
              <span>{idx + 1}</span>
              <span>{item.title}</span>
            </Link>
          );
        })}
        {next ? <Link href={next.href(code)} className="ml-auto border border-cyan/50 bg-cyan/10 px-3 py-2 font-mono text-[11px] text-cyan transition hover:bg-cyan/20">下一步：{next.title} →</Link> : null}
      </div>
    </div>
  );
}
