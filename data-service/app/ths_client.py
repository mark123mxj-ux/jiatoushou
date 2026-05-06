import json
import re
from typing import Any, Dict

import pandas as pd
import requests

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://basic.10jqka.com.cn/",
}
TIMEOUT_SECONDS = 5
_INDICATOR_KEY = {"按报告期": "report", "按单季度": "simple", "按年度": "year"}


def _frame_from_payload(data_json: Dict[str, Any], indicator: str) -> pd.DataFrame:
    key = _INDICATOR_KEY.get(indicator, "year")
    titles = [item[0] if isinstance(item, list) else item for item in data_json.get("title", [])]
    rows = data_json.get(key) or []
    if not titles or not rows:
        return pd.DataFrame()
    frame = pd.DataFrame(rows[1:], columns=rows[0], index=titles[1:])
    frame = frame.T.reset_index().rename(columns={"index": "报告期"})
    return frame


def _get_json_finance(symbol: str, statement: str, indicator: str) -> pd.DataFrame:
    url = f"https://basic.10jqka.com.cn/api/stock/finance/{symbol}_{statement}.json"
    response = requests.get(url, headers=HEADERS, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    payload = response.json()
    data_json = json.loads(payload["flashData"])
    return _frame_from_payload(data_json, indicator)


def stock_financial_benefit_ths(symbol: str, indicator: str = "按年度") -> pd.DataFrame:
    return _get_json_finance(symbol, "benefit", indicator)


def stock_financial_cash_ths(symbol: str, indicator: str = "按年度") -> pd.DataFrame:
    return _get_json_finance(symbol, "cash", indicator)


def stock_financial_abstract_ths(symbol: str, indicator: str = "按年度") -> pd.DataFrame:
    url = f"https://basic.10jqka.com.cn/new/{symbol}/finance.html"
    response = requests.get(url, headers=HEADERS, timeout=TIMEOUT_SECONDS)
    response.raise_for_status()
    match = re.search(r'<p[^>]+id=["\\\']main["\\\'][^>]*>(.*?)</p>', response.text, re.S)
    if not match:
        raise ValueError("THS main financial payload not found")
    data_json = json.loads(match.group(1))
    frame = _frame_from_payload(data_json, indicator)
    if not frame.empty and "报告期" in frame.columns:
        frame.sort_values(by="报告期", ignore_index=True, inplace=True)
    return frame
