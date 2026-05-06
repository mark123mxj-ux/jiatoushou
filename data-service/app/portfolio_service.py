from datetime import date
from pathlib import Path
from typing import Any, Dict, List, Optional
import io
import json
import re

import pandas as pd
from fastapi import HTTPException, UploadFile

from .stock_service import clean_code, get_a_share_list, safe_value

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
PORTFOLIO_FILE = DATA_DIR / "portfolio.json"
TRADES_FILE = DATA_DIR / "trades.json"
MAX_UPLOAD_SIZE = 10 * 1024 * 1024

COLUMN_ALIASES = {
    "stock_code": ["代码", "股票代码", "证券代码", "stock_code", "code", "symbol"],
    "stock_name": ["名称", "股票名称", "证券名称", "stock_name", "name"],
    "shares": ["持仓数量", "数量", "股份", "股数", "可用数量", "shares", "amount", "quantity"],
    "cost_price": ["成本价", "成本", "持仓成本", "买入均价", "cost_price", "cost"],
    "current_price": ["现价", "最新价", "当前价", "市价", "current_price", "price"],
    "market_value": ["市值", "持仓市值", "market_value"],
    "profit_loss": ["浮动盈亏", "盈亏", "收益", "profit_loss", "profit"],
    "profit_pct": ["盈亏比例", "收益率", "盈亏率", "profit_pct", "profit%"],
}

TRADE_COLUMN_ALIASES = {
    "date": ["日期", "交易日期", "成交日期", "date", "trade_date"],
    "stock_code": ["代码", "股票代码", "证券代码", "stock_code", "code", "symbol"],
    "stock_name": ["名称", "股票名称", "证券名称", "stock_name", "name"],
    "action": ["买卖", "操作", "方向", "业务名称", "action", "side"],
    "price": ["价格", "成交价", "成交价格", "price"],
    "shares": ["数量", "成交数量", "股数", "shares", "quantity"],
    "note": ["备注", "说明", "note"],
}


def number(value: Any) -> Optional[float]:
    if value is None or value == "":
        return None
    try:
        text = str(value).strip().replace(",", "").replace("¥", "").replace("元", "").replace("%", "")
        if text in {"--", "-", "nan", "None"}:
            return None
        return float(text)
    except Exception:
        return None


def stock_lookup() -> Dict[str, Dict[str, Any]]:
    items = get_a_share_list()
    by_code = {item["code"]: item for item in items}
    by_name = {str(item.get("name", "")): item for item in items}
    return {**by_code, **by_name}


def normalize_rows(rows: List[Dict[str, Any]], source: str) -> Dict[str, Any]:
    lookup = stock_lookup()
    holdings = []
    for row in rows:
        code = clean_code(row.get("stock_code") or "")
        name = str(row.get("stock_name") or "").strip()
        matched = lookup.get(code) if code else lookup.get(name)
        if matched:
            code = code or matched.get("code", "")
            name = name or matched.get("name", "")
        shares = number(row.get("shares")) or 0
        cost_price = number(row.get("cost_price"))
        current_price = number(row.get("current_price"))
        market_value = number(row.get("market_value"))
        profit_loss = number(row.get("profit_loss"))
        profit_pct = number(row.get("profit_pct"))
        if current_price is None and matched:
            current_price = number(matched.get("current_price"))
        if market_value is None and current_price is not None:
            market_value = shares * current_price
        total_cost_item = shares * cost_price if cost_price is not None else None
        if profit_loss is None and market_value is not None and total_cost_item is not None:
            profit_loss = market_value - total_cost_item
        if profit_pct is None and profit_loss is not None and total_cost_item:
            profit_pct = profit_loss / total_cost_item * 100
        if not code and not name:
            continue
        confidences = row.get("confidence") if isinstance(row.get("confidence"), dict) else {}
        holding = {
            "stock_code": code,
            "stock_name": name or code,
            "shares": shares,
            "cost_price": cost_price,
            "current_price": current_price,
            "market_value": market_value,
            "profit_loss": profit_loss,
            "profit_pct": profit_pct,
            "confidence": {
                "stock_code": confidences.get("stock_code", "high" if code else "low"),
                "stock_name": confidences.get("stock_name", "high" if name else "low"),
                "shares": confidences.get("shares", "high" if shares else "low"),
                "cost_price": confidences.get("cost_price", "high" if cost_price is not None else "low"),
                "current_price": confidences.get("current_price", "high" if current_price is not None else "low"),
                "market_value": confidences.get("market_value", "high" if market_value is not None else "low"),
                "profit_loss": confidences.get("profit_loss", "high" if profit_loss is not None else "low"),
                "profit_pct": confidences.get("profit_pct", "high" if profit_pct is not None else "low"),
            },
        }
        holdings.append(holding)
    total_market_value = sum(number(item.get("market_value")) or 0 for item in holdings)
    total_cost = sum((number(item.get("shares")) or 0) * (number(item.get("cost_price")) or 0) for item in holdings)
    total_profit_loss = sum(number(item.get("profit_loss")) or 0 for item in holdings)
    return {
        "holdings": holdings,
        "total_market_value": round(total_market_value, 2),
        "total_cost": round(total_cost, 2),
        "total_profit_loss": round(total_profit_loss, 2),
        "import_source": source,
        "import_date": date.today().isoformat(),
    }


def map_columns(frame: pd.DataFrame) -> List[Dict[str, Any]]:
    columns = {str(column).strip(): column for column in frame.columns}
    mapping: Dict[str, Any] = {}
    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            matched = next((original for label, original in columns.items() if alias.lower() in label.lower()), None)
            if matched is not None:
                mapping[target] = matched
                break
    rows = []
    for _, source_row in frame.iterrows():
        row = {target: safe_value(source_row[column]) for target, column in mapping.items()}
        rows.append(row)
    return rows


def parse_trade_action(value: Any) -> str:
    text = str(value or "").strip().lower()
    if any(word in text for word in ["卖", "sell", "减仓"]):
        return "sell"
    return "buy"


def parse_trade_date(value: Any) -> str:
    try:
        parsed = pd.to_datetime(value)
        if not pd.isna(parsed):
            return parsed.strftime("%Y-%m-%d")
    except Exception:
        pass
    text = str(value or "").strip().replace("/", "-").replace(".", "-")
    match = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", text)
    if match:
        return f"{match.group(1)}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"
    return date.today().isoformat()


def normalize_trades(rows: List[Dict[str, Any]], source: str = "manual", assign_ids: bool = False) -> Dict[str, Any]:
    lookup = stock_lookup()
    existing = load_trades().get("trades", []) if assign_ids else []
    next_id = max([int(item.get("id", 0) or 0) for item in existing] + [0]) + 1
    trades = []
    for row in rows:
        code = clean_code(row.get("stock_code") or "")
        name = str(row.get("stock_name") or "").strip()
        matched = lookup.get(code) if code else lookup.get(name)
        if matched:
            code = code or matched.get("code", "")
            name = name or matched.get("name", "")
        price = number(row.get("price")) or 0
        shares = number(row.get("shares")) or 0
        if not code and not name:
            continue
        trade = {
            "id": int(row.get("id") or next_id),
            "date": parse_trade_date(row.get("date")),
            "stock_code": code,
            "stock_name": name or code,
            "action": parse_trade_action(row.get("action")),
            "price": round(price, 4),
            "shares": round(shares, 2),
            "amount": round(price * shares, 2),
            "note": str(row.get("note") or "").strip(),
        }
        if assign_ids:
            next_id += 1
        trades.append(trade)
    return {"trades": trades, "import_source": source, "import_date": date.today().isoformat()}


def map_trade_columns(frame: pd.DataFrame) -> List[Dict[str, Any]]:
    columns = {str(column).strip(): column for column in frame.columns}
    mapping: Dict[str, Any] = {}
    for target, aliases in TRADE_COLUMN_ALIASES.items():
        for alias in aliases:
            matched = next((original for label, original in columns.items() if alias.lower() in label.lower()), None)
            if matched is not None:
                mapping[target] = matched
                break
    return [{target: safe_value(source_row[column]) for target, column in mapping.items()} for _, source_row in frame.iterrows()]


async def import_excel(file: UploadFile) -> Dict[str, Any]:
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="文件大小不能超过10MB")
    name = (file.filename or "").lower()
    try:
        if name.endswith(".csv"):
            frame = pd.read_csv(io.BytesIO(content))
        else:
            frame = pd.read_excel(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {exc}") from exc
    return normalize_rows(map_columns(frame), "excel")


async def import_trades_excel(file: UploadFile) -> Dict[str, Any]:
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="文件大小不能超过10MB")
    name = (file.filename or "").lower()
    try:
        frame = pd.read_csv(io.BytesIO(content)) if name.endswith(".csv") else pd.read_excel(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {exc}") from exc
    return normalize_trades(map_trade_columns(frame), "excel")


def parse_ocr_text(text: str) -> List[Dict[str, Any]]:
    rows = []
    lookup = stock_lookup()
    names = sorted([key for key in lookup if not str(key).isdigit()], key=len, reverse=True)
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or any(header in line for header in ["股票名称", "持仓数量", "可用数量", "盈亏比例", "持仓市值"]):
            continue
        code_match = re.search(r"(?<!\d)([036]\d{5})(?!\d)", line)
        code = code_match.group(1) if code_match else ""
        matched_name = ""
        for name in names:
            if name and name in line:
                matched_name = name
                break
        values = [float(item.replace(",", "")) for item in re.findall(r"[-+]?\d+(?:,\d{3})*(?:\.\d+)?%?", line) if clean_code(item) != code]
        if not code and not matched_name:
            continue
        row = {"stock_code": code, "stock_name": matched_name, "confidence": {}}
        if "(" in line or "（" in line:
            fields = ["current_price", "market_value", "cost_price", "profit_loss", "profit_pct"]
        else:
            fields = ["shares", "cost_price", "current_price", "profit_loss", "profit_pct"]
        for field, value in zip(fields, values):
            row[field] = value
        for field in ["stock_code", "stock_name", "shares", "cost_price", "current_price", "market_value", "profit_loss", "profit_pct"]:
            row["confidence"][field] = "high" if row.get(field) not in (None, "") else "low"
        rows.append(row)
    return rows


def parse_trade_ocr_text(text: str) -> List[Dict[str, Any]]:
    rows = []
    lookup = stock_lookup()
    names = sorted([key for key in lookup if not str(key).isdigit()], key=len, reverse=True)
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or any(header in line for header in ["成交记录", "成交日期", "证券代码", "成交价"]):
            continue
        code_match = re.search(r"(?<!\d)([036]\d{5})(?!\d)", line)
        code = code_match.group(1) if code_match else ""
        matched_name = next((name for name in names if name and name in line), "")
        if not code and not matched_name:
            continue
        values = [float(item.replace(",", "")) for item in re.findall(r"[-+]?\d+(?:,\d{3})*(?:\.\d+)?", line) if clean_code(item) != code and len(clean_code(item)) != 8]
        row = {"date": parse_trade_date(line), "stock_code": code, "stock_name": matched_name, "action": "sell" if "卖" in line else "buy"}
        if values:
            row["price"] = values[0]
        if len(values) > 1:
            row["shares"] = values[1]
        rows.append(row)
    return rows


async def import_image(file: UploadFile) -> Dict[str, Any]:
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="图片大小不能超过10MB")
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as exc:
        raise HTTPException(status_code=500, detail="OCR依赖未安装，请安装 rapidocr-onnxruntime") from exc
    try:
        engine = RapidOCR()
        result, _ = engine(content)
        lines = [item[1] for item in result or [] if len(item) > 1]
        text = "\n".join(lines)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OCR识别失败: {exc}") from exc
    payload = normalize_rows(parse_ocr_text(text), "screenshot_broker")
    payload["raw_text"] = text
    return payload


async def import_trades_image(file: UploadFile) -> Dict[str, Any]:
    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="图片大小不能超过10MB")
    try:
        from rapidocr_onnxruntime import RapidOCR
    except Exception as exc:
        raise HTTPException(status_code=500, detail="OCR依赖未安装，请安装 rapidocr-onnxruntime") from exc
    try:
        engine = RapidOCR()
        result, _ = engine(content)
        text = "\n".join([item[1] for item in result or [] if len(item) > 1])
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"OCR识别失败: {exc}") from exc
    payload = normalize_trades(parse_trade_ocr_text(text), "screenshot_trade")
    payload["raw_text"] = text
    return payload


def save_portfolio(payload: Dict[str, Any]) -> Dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    normalized = normalize_rows(payload.get("holdings", []), payload.get("import_source") or "manual")
    normalized["import_date"] = payload.get("import_date") or date.today().isoformat()
    PORTFOLIO_FILE.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized


def load_portfolio() -> Dict[str, Any]:
    if not PORTFOLIO_FILE.exists():
        return normalize_rows([], "saved")
    payload = json.loads(PORTFOLIO_FILE.read_text(encoding="utf-8"))
    return normalize_rows(payload.get("holdings", []), payload.get("import_source") or "saved")


def save_trades(payload: Dict[str, Any]) -> Dict[str, Any]:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    normalized = normalize_trades(payload.get("trades", []), payload.get("import_source") or "manual", False)
    for index, item in enumerate(normalized["trades"], start=1):
        item["id"] = index
    TRADES_FILE.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding="utf-8")
    return normalized


def load_trades() -> Dict[str, Any]:
    if not TRADES_FILE.exists():
        return {"trades": [], "import_source": "saved", "import_date": date.today().isoformat()}
    payload = json.loads(TRADES_FILE.read_text(encoding="utf-8"))
    return normalize_trades(payload.get("trades", []), payload.get("import_source") or "saved")
