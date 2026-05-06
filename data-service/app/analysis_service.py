from collections import Counter, defaultdict
from datetime import date
from typing import Any, Dict, List, Optional
import math

from .portfolio_service import load_portfolio, number
from .stock_service import STOCK_FALLBACK, get_a_share_list

INDUSTRY_FALLBACK = {item["code"]: item.get("industry") for item in STOCK_FALLBACK.values()}
BENCHMARK_RETURN = 10.0


def pct(value: float) -> float:
    return round(value, 2)


def money(value: float) -> float:
    return round(value, 2)


def build_stock_meta() -> Dict[str, Dict[str, Any]]:
    meta = {code: {"industry": industry} for code, industry in INDUSTRY_FALLBACK.items()}
    try:
        for item in get_a_share_list():
            code = str(item.get("code") or "")
            if code:
                meta[code] = {"industry": item.get("industry") or meta.get(code, {}).get("industry") or "未分类"}
    except Exception:
        pass
    return meta


def with_weights(holdings: List[Dict[str, Any]], total_market_value: float, meta: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    enriched = []
    for item in holdings:
        market_value = number(item.get("market_value")) or 0
        cost = (number(item.get("shares")) or 0) * (number(item.get("cost_price")) or 0)
        profit_loss = number(item.get("profit_loss")) or (market_value - cost)
        profit_pct = number(item.get("profit_pct"))
        if profit_pct is None and cost:
            profit_pct = profit_loss / cost * 100
        code = str(item.get("stock_code") or "")
        enriched.append({
            **item,
            "market_value": money(market_value),
            "cost_value": money(cost),
            "profit_loss": money(profit_loss),
            "profit_pct": pct(profit_pct or 0),
            "weight": pct(market_value / total_market_value * 100) if total_market_value else 0,
            "industry": meta.get(code, {}).get("industry") or "未分类",
        })
    return sorted(enriched, key=lambda row: row["market_value"], reverse=True)


def analyze_portfolio() -> Dict[str, Any]:
    portfolio = load_portfolio()
    holdings = portfolio.get("holdings", [])
    total_market_value = number(portfolio.get("total_market_value")) or sum(number(item.get("market_value")) or 0 for item in holdings)
    total_cost = number(portfolio.get("total_cost")) or sum((number(item.get("shares")) or 0) * (number(item.get("cost_price")) or 0) for item in holdings)
    total_profit_loss = number(portfolio.get("total_profit_loss")) or (total_market_value - total_cost)
    meta = build_stock_meta()
    enriched = with_weights(holdings, total_market_value, meta)
    industry_values: Dict[str, float] = defaultdict(float)
    for item in enriched:
        industry_values[item["industry"]] += item["market_value"]
    industry_distribution = sorted([
        {"industry": industry, "market_value": money(value), "weight": pct(value / total_market_value * 100) if total_market_value else 0, "count": sum(1 for item in enriched if item["industry"] == industry)}
        for industry, value in industry_values.items()
    ], key=lambda row: row["market_value"], reverse=True)
    weights = [item["weight"] for item in enriched]
    top = lambda count: pct(sum(weights[:count]))
    hhi = pct(sum((weight / 100) ** 2 for weight in weights) * 10000)
    concentration_level = "高度集中" if hhi >= 2500 or (weights[:1] and weights[0] > 30) else "适度集中" if hhi >= 1500 or top(5) > 70 else "充分分散"
    winners = [item for item in enriched if item["profit_loss"] > 0]
    losers = [item for item in enriched if item["profit_loss"] < 0]
    avg_win = sum(item["profit_loss"] for item in winners) / len(winners) if winners else 0
    avg_loss = abs(sum(item["profit_loss"] for item in losers) / len(losers)) if losers else 0
    payoff_ratio = pct(avg_win / avg_loss) if avg_loss else (999 if avg_win else 0)
    total_return = pct(total_profit_loss / total_cost * 100) if total_cost else 0
    annualized_return = total_return
    excess_return = pct(total_return - BENCHMARK_RETURN)
    industry_count = len(industry_distribution)
    largest_industry = industry_distribution[0] if industry_distribution else {"industry": "未分类", "weight": 0, "count": 0}
    same_industry_pairs = sum(count * (count - 1) / 2 for count in Counter(item["industry"] for item in enriched).values())
    total_pairs = len(enriched) * (len(enriched) - 1) / 2
    overlap = pct(same_industry_pairs / total_pairs * 100) if total_pairs else 0
    diversification_score = max(0, min(100, round(100 - hhi / 100 - largest_industry["weight"] * 0.45 - overlap * 0.25 + min(industry_count, 8) * 3)))
    volatility = pct(12 + hhi / 180 + largest_industry["weight"] * 0.18)
    max_drawdown = pct(min(65, max(8, volatility * 1.55 + (8 if total_return < 0 else 0))))
    beta = round(0.75 + min(0.75, largest_industry["weight"] / 100 * 0.55 + hhi / 10000 * 0.45), 2)
    sorted_profit = sorted(enriched, key=lambda item: item["profit_loss"], reverse=True)
    benchmark_curve = [{"period": "起点", "portfolio": 0, "benchmark": 0}, {"period": "当前", "portfolio": total_return, "benchmark": BENCHMARK_RETURN}]
    insights = generate_insights(enriched, industry_distribution, total_market_value, total_profit_loss, total_return, payoff_ratio, largest_industry, overlap, diversification_score, excess_return)
    return {
        "as_of": date.today().isoformat(),
        "summary": {"total_market_value": money(total_market_value), "total_cost": money(total_cost), "total_profit_loss": money(total_profit_loss), "total_return": total_return, "holding_count": len(enriched)},
        "industry_distribution": industry_distribution,
        "concentration": {"top3_weight": top(3), "top5_weight": top(5), "top10_weight": top(10), "hhi": hhi, "level": concentration_level, "top_holdings": enriched[:5]},
        "profit_loss": {"ranking": sorted_profit, "total_profit_loss": money(total_profit_loss), "win_rate": pct(len(winners) / len(enriched) * 100) if enriched else 0, "payoff_ratio": payoff_ratio, "best": sorted_profit[:3], "worst": list(reversed(sorted_profit[-3:]))},
        "returns": {"total_return": total_return, "annualized_return": annualized_return, "benchmark": "沪深300", "benchmark_return": BENCHMARK_RETURN, "excess_return": excess_return, "curve": benchmark_curve},
        "risk": {"volatility": volatility, "max_drawdown": max_drawdown, "beta": beta, "method": "基于仓位集中度、行业集中度与当前收益状态的估算"},
        "correlation": {"industry_overlap": overlap, "diversification_score": diversification_score, "industry_count": industry_count, "largest_industry": largest_industry},
        "insights": insights,
    }


def add(insights: List[Dict[str, Any]], type_: str, severity: str, title: str, detail: str, suggestion: str, related_stock: Optional[str] = None):
    insights.append({"type": type_, "severity": severity, "title": title, "detail": detail, "suggestion": suggestion, "related_stock": related_stock})


def generate_insights(enriched: List[Dict[str, Any]], industries: List[Dict[str, Any]], total_market_value: float, total_profit_loss: float, total_return: float, payoff_ratio: float, largest_industry: Dict[str, Any], overlap: float, diversification_score: int, excess_return: float) -> List[Dict[str, Any]]:
    insights: List[Dict[str, Any]] = []
    if not enriched:
        return insights
    top_stock = enriched[0]
    if top_stock["weight"] > 30:
        add(insights, "risk", "high", "单股仓位集中度过高", f"{top_stock['stock_name']}占组合{top_stock['weight']}%，超过30%单股风险阈值；若该股票回撤20%，组合将承受约{pct(top_stock['weight'] * 0.2)}%的净值冲击。", "建议设定分批降权或止盈/止损规则，将单股仓位逐步压至25%-30%以内，并优先补充低相关行业。", top_stock.get("stock_code"))
    else:
        add(insights, "info", "low", "最大单股仓位可控", f"第一大持仓{top_stock['stock_name']}占比{top_stock['weight']}%，未突破30%高集中阈值。", "继续跟踪重仓股基本面变化，若价格上涨导致权重被动升高，可按再平衡纪律处理。", top_stock.get("stock_code"))
    if largest_industry.get("weight", 0) > 50:
        add(insights, "risk", "high", "行业暴露过度集中", f"{largest_industry['industry']}行业占组合{largest_industry['weight']}%，超过50%行业集中阈值，行业政策、景气度或估值波动会显著影响组合。", "建议将新增资金优先配置到消费、制造、金融、医药、科技等低相关方向，或降低同一行业内部重复持仓。")
    if overlap > 35:
        add(insights, "risk", "medium", "持仓行业重叠度偏高", f"当前持仓同行业配对占比{overlap}%，分散化评分{diversification_score}/100，说明多只股票可能受同一行业变量驱动。", "建议梳理每只股票的核心驱动，保留胜率最高的龙头或差异化标的，减少同质化押注。")
    losers = [item for item in enriched if item["profit_loss"] < 0]
    winners = [item for item in enriched if item["profit_loss"] > 0]
    if len(losers) == len(enriched):
        add(insights, "risk", "high", "组合全部处于浮亏", f"{len(enriched)}只持仓均为浮亏，总浮亏{money_abs(total_profit_loss)}元，总收益率{total_return}%。", "建议逐只复盘买入逻辑是否仍成立，区分短期波动、估值回归和基本面恶化，避免机械补仓。")
    if payoff_ratio and payoff_ratio != 999:
        severity = "medium" if payoff_ratio < 1 else "low"
        add(insights, "return", severity, "盈亏比质量评估", f"当前胜率{pct(len(winners) / len(enriched) * 100)}%，盈亏比{payoff_ratio}；{'平均盈利小于平均亏损，说明止损/持盈纪律需要加强' if payoff_ratio < 1 else '盈利持仓的平均贡献高于亏损持仓，交易质量相对健康'}。", "建议对盈利股设置移动止盈，对亏损股设置基本面触发条件，避免赢小亏大。")
    add(insights, "return", "low" if excess_return >= 0 else "medium", "对标沪深300表现", f"组合收益率{total_return}%，估算沪深300基准{BENCHMARK_RETURN}%，超额收益{excess_return}个百分点。", "若持续落后基准，应检视选股胜率、仓位节奏和行业暴露；若持续领先，也要确认收益来源不是单一重仓贡献。")
    for item in enriched:
        if item["profit_pct"] >= 30:
            add(insights, "action", "medium", "浮盈较大需保护收益", f"{item['stock_name']}浮盈{item['profit_pct']}%，贡献盈利{item['profit_loss']}元，已有明显安全垫。", "建议设定目标价、回撤止盈线或分批落袋计划，同时补做深度研究验证成长空间。", item.get("stock_code"))
            break
    deep_loser = next((item for item in sorted(enriched, key=lambda row: row["profit_pct"]) if item["profit_pct"] <= -30), None)
    if deep_loser:
        add(insights, "action", "high", "深度套牢持仓需要决策", f"{deep_loser['stock_name']}亏损{abs(deep_loser['profit_pct'])}%，浮亏{abs(deep_loser['profit_loss'])}元，已超过30%深度回撤线。", "建议重新评估商业模式、估值和催化剂；只有投资逻辑增强且估值更有吸引力时才考虑补仓，否则制定退出方案。", deep_loser.get("stock_code"))
    for item in enriched[:3]:
        add(insights, "action", "low", "重仓股建议进入深度研究", f"{item['stock_name']}当前仓位{item['weight']}%，市值{item['market_value']}元，是组合波动和收益的关键来源。", "建议进入研究页补齐行业、产业链、利润因子与投资论点，形成可复盘的持仓依据。", item.get("stock_code"))
    order = {"high": 0, "medium": 1, "low": 2}
    return sorted(insights, key=lambda item: order[item["severity"]])[:10]


def money_abs(value: float) -> float:
    return round(abs(value), 2)
