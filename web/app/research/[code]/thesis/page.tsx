"use client";

import { LearningGuide } from "@/components/LearningGuide";
import { ResearchNav } from "@/components/ResearchNav";
import { markProgress } from "@/lib/researchStore";
import { useEffect, useMemo, useRef, useState } from "react";

type Thesis = {
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

const emptyThesis: Thesis = {
  industryTags: [],
  industryText: "",
  companyTags: [],
  companyText: "",
  currentPe: "",
  pePercentile: "",
  growth: "",
  catalyst: "",
  invalidation: "",
  maxPe: "",
  stopLoss: "",
  holdingMonths: "",
};

const industryOptions = ["行业增速>GDP", "格局在集中", "政策利好", "需求刚性", "其他"];
const companyOptions = ["成本优势", "规模优势", "品牌壁垒", "管理层优秀", "技术领先", "渠道优势", "其他"];

export default function ThesisPage({ params }: { params: { code: string } }) {
  const storageKey = `jiatoushou:thesis:${params.code}`;
  const [thesis, setThesis] = useState<Thesis>(emptyThesis);
  const [savedAt, setSavedAt] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    markProgress(params.code, "thesis");
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw) as Thesis;
      setThesis({ ...emptyThesis, ...parsed });
      setSavedAt(parsed.createdAt ?? "");
      return;
    }
    setThesis(emptyThesis);
  }, [storageKey]);

  const stockName = "研究标的";
  const textOutput = useMemo(() => {
    return `${stockName}（${params.code}）投资论点\n行业逻辑：${thesis.industryTags.join("、")}。${thesis.industryText}\n公司逻辑：${thesis.companyTags.join("、")}。${thesis.companyText}\n估值逻辑：当前PE ${thesis.currentPe || "--"}，历史分位 ${thesis.pePercentile || "--"}%，未来3年净利增速 ${thesis.growth || "--"}%。催化剂：${thesis.catalyst || "--"}\n卖出条件：${thesis.invalidation || "--"}；PE超过 ${thesis.maxPe || "--"} 减仓；亏损超过 ${thesis.stopLoss || "--"}% 止损；最长持有 ${thesis.holdingMonths || "--"} 个月后复盘。`;
  }, [params.code, stockName, thesis]);

  function update<K extends keyof Thesis>(key: K, value: Thesis[K]) {
    setThesis((current) => ({ ...current, [key]: value }));
  }

  function toggle(key: "industryTags" | "companyTags", value: string) {
    setThesis((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value]
    }));
  }

  function save() {
    const payload = { ...thesis, createdAt: new Date().toLocaleString("zh-CN") };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    setThesis(payload);
    setSavedAt(payload.createdAt);
  }

  async function copyText() {
    await navigator.clipboard.writeText(textOutput);
    setSavedAt("已复制文本");
  }

  async function exportImage() {
    try {
      const html2canvas = (await import("html2canvas")).default;
      if (!cardRef.current) return;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#080b0f", scale: 2 });
      const link = document.createElement("a");
      link.download = `${params.code}-thesis.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      await copyText();
    }
  }

  return (
    <section className="space-y-5">
      <LearningGuide module="thesis" />
      <ResearchNav code={params.code} current="thesis" />
      <div className="border border-line bg-carbon/85 p-6">
        <div className="font-mono text-xs uppercase tracking-[0.32em] text-cyan">Investment Thesis / {params.code}</div>
        <h1 className="mt-3 font-display text-5xl text-slate-100">投资论点构建器</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">把看多理由和卖出纪律写在买入前，形成可复盘、可复制的投资身份证。</p>
        <p className="mt-3 inline-flex border border-cyan/30 bg-cyan/10 px-3 py-2 font-mono text-xs text-cyan/80 shadow-[0_0_22px_rgba(76,201,216,.08)]">通用空白模板：先完成行业、产业链与利润因子，再填写论点。</p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.86fr]">
        <div className="space-y-4">
          <Block icon="Ⅰ" title="行业逻辑" hint="先判断池塘是否足够好，再判断鱼是否足够强。">
            <TagGroup options={industryOptions} selected={thesis.industryTags} onToggle={(value) => toggle("industryTags", value)} />
            <Textarea value={thesis.industryText} maxLength={200} placeholder="简述为什么看好这个行业（200字以内）" onChange={(value) => update("industryText", value)} />
          </Block>

          <Block icon="Ⅱ" title="公司逻辑" hint="必须回答：为什么是它，而不是同业其他公司？">
            <TagGroup options={companyOptions} selected={thesis.companyTags} onToggle={(value) => toggle("companyTags", value)} />
            <Textarea value={thesis.companyText} maxLength={300} placeholder="为什么是这家公司而不是同行？（300字以内）" onChange={(value) => update("companyText", value)} />
          </Block>

          <Block icon="Ⅲ" title="估值逻辑" hint="把价格、成长和催化剂放在同一张检查表里。">
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="当前PE" value={thesis.currentPe} onChange={(value) => update("currentPe", value)} />
              <Input label="历史分位%" value={thesis.pePercentile} onChange={(value) => update("pePercentile", value)} />
              <Input label="3年净利增速%" value={thesis.growth} onChange={(value) => update("growth", value)} />
            </div>
            <Textarea value={thesis.catalyst} placeholder="催化剂是什么？如产能释放、行业拐点、新品上市" onChange={(value) => update("catalyst", value)} />
          </Block>

          <Block icon="Ⅳ" title="卖出条件" hint="最重要的部分：在情绪升温前预先写下离场规则。">
            <Textarea value={thesis.invalidation} placeholder="逻辑证伪条件：___发生时卖出" onChange={(value) => update("invalidation", value)} />
            <div className="grid gap-3 md:grid-cols-3">
              <Input label="PE超过" value={thesis.maxPe} onChange={(value) => update("maxPe", value)} />
              <Input label="止损线%" value={thesis.stopLoss} onChange={(value) => update("stopLoss", value)} />
              <Input label="持有期限/月" value={thesis.holdingMonths} onChange={(value) => update("holdingMonths", value)} />
            </div>
          </Block>

          <div className="flex flex-wrap gap-3">
            <button onClick={save} className="border border-amber/60 bg-amber/15 px-5 py-3 font-mono text-xs text-amber transition hover:bg-amber/25">保存论点</button>
            <button onClick={copyText} className="border border-cyan/60 bg-cyan/10 px-5 py-3 font-mono text-xs text-cyan transition hover:bg-cyan/20">复制文本</button>
            <button onClick={exportImage} className="border border-line bg-panel px-5 py-3 font-mono text-xs text-slate-300 transition hover:border-amber/50">导出图片</button>
            {savedAt ? <span className="self-center font-mono text-xs text-slate-500">{savedAt}</span> : null}
          </div>
        </div>

        <div className="xl:sticky xl:top-5 xl:self-start">
          <div ref={cardRef} className="relative overflow-hidden border border-amber/40 bg-carbon p-6 shadow-2xl shadow-amber/5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(214,160,75,0.18),transparent_35%),radial-gradient(circle_at_100%_20%,rgba(76,201,216,0.13),transparent_30%)]" />
            <div className="relative">
              <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.28em] text-cyan">Thesis Card</div>
                  <h2 className="mt-2 font-display text-4xl text-slate-100">{stockName}</h2>
                  <div className="font-mono text-sm text-amber">{params.code}</div>
                </div>
                <div className="border border-amber/40 px-3 py-2 text-center font-mono text-xs text-amber">投资身份证</div>
              </div>
              <CardSection title="行业" tags={thesis.industryTags} text={thesis.industryText} />
              <CardSection title="公司" tags={thesis.companyTags} text={thesis.companyText} />
              <CardSection title="估值" text={`PE ${thesis.currentPe || "--"} / 分位 ${thesis.pePercentile || "--"}% / 增速 ${thesis.growth || "--"}%。${thesis.catalyst || "等待填写催化剂。"}`} />
              <CardSection title="卖出纪律" text={`${thesis.invalidation || "等待填写证伪条件"}；PE>${thesis.maxPe || "--"} 减仓；亏损>${thesis.stopLoss || "--"}% 止损；${thesis.holdingMonths || "--"}个月复盘。`} />
              <div className="mt-5 border-t border-line pt-3 font-mono text-[11px] text-slate-500">创建时间：{thesis.createdAt ?? savedAt ?? "尚未保存"}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Block({ icon, title, hint, children }: { icon: string; title: string; hint: string; children: React.ReactNode }) {
  return <div className="glass-card p-5"><div className="relative mb-4 flex gap-3"><div className="grid h-10 w-10 place-items-center border border-amber/50 font-display text-xl text-amber">{icon}</div><div><h2 className="metal-text font-display text-3xl">{title}</h2><p className="text-sm text-slate-500">{hint}</p></div></div><div className="relative space-y-3">{children}</div></div>;
}

function TagGroup({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (value: string) => void }) {
  return <div className="flex flex-wrap gap-2">{options.map((option) => <button key={option} onClick={() => onToggle(option)} className={`border px-3 py-1.5 font-mono text-xs transition ${selected.includes(option) ? "border-cyan/60 bg-cyan/10 text-cyan" : "border-line text-slate-500 hover:border-amber/50 hover:text-amber"}`}>{option}</button>)}</div>;
}

function Textarea({ value, placeholder, maxLength, onChange }: { value: string; placeholder: string; maxLength?: number; onChange: (value: string) => void }) {
  return <div><textarea value={value} maxLength={maxLength} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-24 w-full resize-y border border-line bg-carbon/80 px-3 py-3 text-sm text-slate-200 outline-none placeholder:text-slate-600 focus:border-cyan" />{maxLength ? <div className="mt-1 text-right font-mono text-[11px] text-slate-600">{value.length}/{maxLength}</div> : null}</div>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="font-mono text-xs text-slate-500">{label}</span><input type="number" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full border border-line bg-carbon/80 px-3 py-2 font-mono text-sm text-amber outline-none focus:border-cyan" /></label>;
}

function CardSection({ title, tags, text }: { title: string; tags?: string[]; text: string }) {
  return <div className="mt-5"><div className="font-mono text-xs text-cyan">{title}</div>{tags?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag} className="border border-amber/30 px-2 py-1 font-mono text-[10px] text-amber">{tag}</span>)}</div> : null}<p className="mt-2 text-sm leading-6 text-slate-300">{text || "等待填写。"}</p></div>;
}
