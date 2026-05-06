from datetime import date, datetime
from typing import Any, Dict, List, Optional

from .portfolio_service import load_trades, number
from .stock_service import get_stock


def pct(value: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    return round(value, 2)


def days_between(start: str, end: Optional[str] = None) -> int:
    try:
        return (datetime.fromisoformat(end or date.today().isoformat()) - datetime.fromisoformat(start)).days
    except Exception:
        return 0


def current_price(code: str, fallback: float) -> float:
    try:
        return number(get_stock(code).get("current_price")) or fallback
    except Exception:
        return fallback


def analyze_trades() -> Dict[str, Any]:
    trades = sorted(load_trades().get("trades", []), key=lambda item: (item.get("date", ""), int(item.get("id", 0) or 0)))
    if not trades:
        return {
            "timeline": [],
            "decision_review": {"items": [], "best": [], "worst": []},
            "behavior": {"chasing_index": 0, "timing_score": 0, "avg_holding_days": 0, "min_holding_days": 0, "max_holding_days": 0, "holding_periods": [], "monthly_frequency": [], "avg_monthly_trades": 0, "overtrading": False, "price_pattern_note": "暂无交易记录，无法评估追涨杀跌。"},
            "profit": {"realized_profit": 0, "max_profit": 0, "max_loss": 0, "win_rate": 0, "avg_profit": 0, "avg_loss": 0, "closed_trades": []},
        }
    timeline = [{"id": item["id"], "date": item["date"], "month": item["date"][:7], "stock_code": item["stock_code"], "stock_name": item["stock_name"], "action": item["action"], "amount": item["amount"], "price": item["price"], "shares": item["shares"]} for item in trades]
    review_items = []
    for item in trades:
        latest = current_price(item["stock_code"], item["price"])
        performance = (latest - item["price"]) / item["price"] * 100 if item["price"] else 0
        score = performance if item["action"] == "buy" else -performance
        review_items.append({**item, "current_price": latest, "performance_pct": pct(performance), "decision_score": pct(score), "label": "买入后表现" if item["action"] == "buy" else "卖出后表现"})
    best = sorted(review_items, key=lambda item: item["decision_score"] or 0, reverse=True)[:3]
    worst = sorted(review_items, key=lambda item: item["decision_score"] or 0)[:3]
    lots: Dict[str, List[Dict[str, Any]]] = {}
    closed = []
    for item in trades:
        code = item["stock_code"]
        lots.setdefault(code, [])
        if item["action"] == "buy":
            lots[code].append({"date": item["date"], "price": item["price"], "shares": item["shares"], "remain": item["shares"]})
        else:
            remain = item["shares"]
            cost = 0.0
            holding_days = []
            while remain > 0 and lots[code]:
                lot = lots[code][0]
                qty = min(remain, lot["remain"])
                cost += qty * lot["price"]
                holding_days.append(days_between(lot["date"], item["date"]))
                lot["remain"] -= qty
                remain -= qty
                if lot["remain"] <= 0:
                    lots[code].pop(0)
            sold_qty = item["shares"] - remain
            if sold_qty > 0:
                profit = item["price"] * sold_qty - cost
                closed.append({"stock_code": code, "stock_name": item["stock_name"], "sell_date": item["date"], "shares": sold_qty, "profit": round(profit, 2), "holding_days": round(sum(holding_days) / len(holding_days), 1) if holding_days else 0})
    profits = [item["profit"] for item in closed]
    wins = [item for item in profits if item > 0]
    losses = [item for item in profits if item < 0]
    holding_periods = [{"range": "0-7天", "count": 0}, {"range": "8-30天", "count": 0}, {"range": "31-90天", "count": 0}, {"range": "90天+", "count": 0}]
    for item in closed:
        days = item["holding_days"]
        holding_periods[0 if days <= 7 else 1 if days <= 30 else 2 if days <= 90 else 3]["count"] += 1
    months: Dict[str, int] = {}
    for item in trades:
        months[item["date"][:7]] = months.get(item["date"][:7], 0) + 1
    monthly_frequency = [{"month": key, "count": months[key]} for key in sorted(months)]
    avg_monthly = round(sum(months.values()) / len(months), 2) if months else 0
    negative_buys = len([item for item in review_items if item["action"] == "buy" and (item["performance_pct"] or 0) < 0])
    bad_sells = len([item for item in review_items if item["action"] == "sell" and (item["performance_pct"] or 0) > 0])
    chasing_index = round((negative_buys + bad_sells) / len(review_items) * 100, 1) if review_items else 0
    timing_score = max(0, round(100 - chasing_index, 1))
    holding_values = [item["holding_days"] for item in closed]
    return {
        "timeline": timeline,
        "decision_review": {"items": review_items, "best": best, "worst": worst},
        "behavior": {"chasing_index": chasing_index, "timing_score": timing_score, "avg_holding_days": round(sum(holding_values) / len(holding_values), 1) if holding_values else 0, "min_holding_days": min(holding_values) if holding_values else 0, "max_holding_days": max(holding_values) if holding_values else 0, "holding_periods": holding_periods, "monthly_frequency": monthly_frequency, "avg_monthly_trades": avg_monthly, "overtrading": avg_monthly > 12, "price_pattern_note": "历史高低点数据不足，当前以交易后表现近似评估追涨杀跌。"},
        "profit": {"realized_profit": round(sum(profits), 2), "max_profit": max(profits) if profits else 0, "max_loss": min(profits) if profits else 0, "win_rate": round(len(wins) / len(profits) * 100, 1) if profits else 0, "avg_profit": round(sum(wins) / len(wins), 2) if wins else 0, "avg_loss": round(sum(losses) / len(losses), 2) if losses else 0, "closed_trades": closed},
    }