import json
from datetime import date, datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import akshare as ak
import numpy as np
import pandas as pd

DATA_DATE = date.today().isoformat()
A_SHARE_LIST_PATH = Path(__file__).resolve().parent.parent / "data" / "a_share_list.json"
CACHE: Dict[Tuple[str, str], Dict[str, Any]] = {}
TTL_SECONDS = {"profile": 3600, "peers": 3600, "valuation": 3600, "financials": 86400, "chain": 604800}
SOURCE_NOTE = {"profile": "AKShare/东方财富", "peers": "AKShare/东方财富", "valuation": "AKShare/乐咕乐股", "financials": "AKShare/财务指标", "chain": "行业模板/预置分析"}


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def stamp_payload(payload: Dict[str, Any], endpoint: str, fetched_at: Optional[datetime] = None, cache_age: int = 0, from_cache: bool = False) -> Dict[str, Any]:
    moment = fetched_at or utc_now()
    result = dict(payload)
    result["data_date"] = moment.date().isoformat()
    result["fetched_at"] = moment.isoformat()
    result["cache_age"] = cache_age
    result["from_cache"] = from_cache
    result["source"] = SOURCE_NOTE.get(endpoint, "AKShare")
    return result


def get_cached_or_fetch(code: str, endpoint: str, fetcher, refresh: bool = False) -> Dict[str, Any]:
    symbol = clean_code(code)
    key = (symbol, endpoint)
    now = utc_now()
    cached = CACHE.get(key)
    ttl = TTL_SECONDS.get(endpoint, 3600)
    if cached and not refresh:
        age = int((now - cached["fetched_at"]).total_seconds())
        if age < ttl:
            return stamp_payload(cached["payload"], endpoint, cached["fetched_at"], age, True)
    try:
        payload = fetcher(symbol)
        CACHE[key] = {"payload": payload, "fetched_at": now}
        return stamp_payload(payload, endpoint, now, 0, False)
    except Exception:
        if cached:
            age = int((now - cached["fetched_at"]).total_seconds())
            result = stamp_payload(cached["payload"], endpoint, cached["fetched_at"], age, True)
            result["cache_warning"] = "实时数据获取失败，已返回缓存数据"
            return result
        raise

STOCK_FALLBACK = {
    "600058": {"code": "600058", "name": "五矿发展", "industry": "贸易行业", "current_price": None, "change_pct": None},
    "000858": {"code": "000858", "name": "五粮液", "industry": "酿酒行业", "current_price": None, "change_pct": None},
    "002594": {"code": "002594", "name": "比亚迪", "industry": "汽车整车", "current_price": None, "change_pct": None},
    "601058": {"code": "601058", "name": "赛轮轮胎", "industry": "橡胶制品", "current_price": None, "change_pct": None},
}


def _normalize_stock_item(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    code = clean_code(item.get("code") or item.get("代码") or "")
    name = item.get("name") or item.get("名称") or item.get("股票简称")
    if not code or not name:
        return None
    return {
        "code": code,
        "name": str(name),
        "industry": safe_value(item.get("industry") or item.get("行业") or item.get("所属行业") or item.get("板块") or "综合行业"),
        "current_price": safe_value(item.get("current_price") or item.get("最新价") or item.get("现价")),
        "change_pct": safe_value(item.get("change_pct") or item.get("涨跌幅") or item.get("涨幅")),
    }


def _append_missing_fallback(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    existing_codes = {item["code"] for item in items}
    return items + [item for code, item in STOCK_FALLBACK.items() if code not in existing_codes]


def _load_local_a_share_list() -> Optional[List[Dict[str, Any]]]:
    if not A_SHARE_LIST_PATH.exists():
        return None
    try:
        raw_items = json.loads(A_SHARE_LIST_PATH.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(raw_items, list):
        return None
    items: List[Dict[str, Any]] = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        item = _normalize_stock_item(raw_item)
        if item:
            items.append(item)
    return _append_missing_fallback(items) if items else None

INDUSTRY_TEMPLATES = {
    "酿酒": ("高粱/小麦/包装材料", "品牌酿造与渠道运营", "宴席/礼赠/商务消费"),
    "食品": ("农产品/包材/添加剂", "食品饮料生产", "商超/餐饮/电商"),
    "橡胶": ("天然橡胶/合成胶/碳黑", "轮胎与橡胶制品制造", "整车配套/替换市场/出口"),
    "汽车": ("钢铝/电池/电子件", "整车及零部件制造", "经销商/出行/后市场"),
    "医药": ("原料药/耗材/研发服务", "药品器械生产", "医院/药店/医保支付"),
    "银行": ("存款/同业负债", "信贷与金融服务", "企业/居民/财富管理"),
    "证券": ("资本金/客户资产", "经纪投行资管", "机构与个人投资者"),
    "煤炭": ("矿权/设备/运输", "煤炭开采洗选", "电力/钢铁/化工"),
    "电力": ("煤炭/天然气/风光设备", "发电与电网调度", "工商业/居民用电"),
    "半导体": ("硅片/设备/材料/IP", "芯片设计制造封测", "消费电子/汽车/AI"),
    "软件": ("云资源/研发人才", "软件产品与解决方案", "政企客户/订阅服务"),
    "地产": ("土地/资金/建材", "开发建设与运营", "居民购房/租赁/物业"),
    "贸易": ("大宗商品/供应商资源", "供应链服务与分销", "制造业客户/终端渠道"),
}

DEEP_ANALYSIS_TEMPLATES = {
    "new_energy_vehicle": {
        "matched_keywords": ["汽车", "电池", "新能源", "整车", "零部件"],
        "focus": ["技术路线", "政策补贴", "原材料价格"],
        "policies": [
            {"title": "新能源汽车购置税减免延续并退坡", "date": "2024-01", "source": "财政部/税务总局/工信部公告口径，政策有效期覆盖2024-2027年", "impact": "利好", "summary": "2024-2025年免征车辆购置税单车减免额不超过3万元，2026-2027年减半征收且单车减免额不超过1.5万元。", "insight": "政策从直接补贴转向税费优惠与技术门槛约束，利好具备规模、成本控制和车型迭代能力的整车厂。"},
            {"title": "欧盟对中国电动汽车反补贴关税落地", "date": "2024-10", "source": "欧盟委员会公开公告，2024年10月起实施最终反补贴税", "impact": "利空", "summary": "欧盟对中国电动汽车加征不同税率反补贴税，出口欧洲车型盈利和定价策略承压。", "insight": "具备海外建厂、本地化供应链和多区域市场能力的企业更容易消化贸易壁垒。"},
            {"title": "双积分与碳减排目标持续约束车企", "date": "2024-2025", "source": "工信部乘用车企业平均燃料消耗量与新能源汽车积分管理框架", "impact": "中性", "summary": "积分约束强化燃油车节能与新能源占比要求，推动产品结构继续向电动化迁移。", "insight": "行业竞争焦点从牌照和补贴转向成本曲线、智能化体验和渠道效率。"},
        ],
        "technologies": [
            {"route": "磷酸铁锂电池", "maturity": "量产成熟", "cost": "低", "advantages": ["成本低", "安全性较好", "循环寿命长"], "risks": ["低温性能弱", "能量密度上限受约束"], "latest": "2024-2025年继续在主流乘用车和储能场景占据高份额。"},
            {"route": "三元锂电池", "maturity": "量产成熟", "cost": "中高", "advantages": ["能量密度高", "高端长续航车型适配"], "risks": ["镍钴价格波动", "热管理要求高"], "latest": "高端车型仍有需求，但在性价比市场受到磷酸铁锂挤压。"},
            {"route": "钠离子电池", "maturity": "示范导入", "cost": "潜在较低", "advantages": ["资源约束小", "低温性能较好"], "risks": ["能量密度较低", "产业链配套不足"], "latest": "2024年后更多用于两轮车、储能和低速/短途场景验证。"},
            {"route": "固态/半固态电池", "maturity": "小批量/验证期", "cost": "高", "advantages": ["安全性和能量密度潜力高"], "risks": ["良率、材料体系和成本仍待突破"], "latest": "2024-2025年多家车企发布装车规划，但大规模降本仍需观察。"},
        ],
        "supply_chain": [
            {"metric": "碳酸锂价格", "value": "较2022高点显著回落", "date": "2024-2025", "impact": "利好", "insight": "锂价下行改善电池厂和整车厂成本，但上游锂资源企业盈利弹性被压缩。"},
            {"metric": "动力电池集中度", "value": "头部企业份额高", "date": "2024-2025", "impact": "中性", "insight": "头部电池厂具备规模和客户绑定优势，二线厂商更依赖差异化技术或海外客户突破。"},
            {"metric": "整车产能与价格战", "value": "供给扩张快于部分需求释放", "date": "2024-2025", "impact": "利空", "insight": "价格战提升消费者渗透率，但挤压弱品牌和低效率产能利润。"},
        ],
        "events": [
            {"date": "2024-01", "title": "新能源汽车购置税减免新阶段执行", "impact": "利好", "affected": ["整车", "电池", "充电基础设施"], "summary": "税费优惠延续稳定中长期需求预期。"},
            {"date": "2024-05", "title": "美国宣布提高中国电动汽车等产品关税", "impact": "利空", "affected": ["整车出口", "海外供应链"], "summary": "海外贸易摩擦加速车企本地化产能布局。"},
            {"date": "2024-10", "title": "欧盟中国电动汽车反补贴税落地", "impact": "利空", "affected": ["欧洲出口", "海外定价"], "summary": "出口毛利与市场份额需要在关税和本地化之间重新平衡。"},
            {"date": "2025-01", "title": "固态/半固态电池装车预期升温", "impact": "中性", "affected": ["电池材料", "高端车型"], "summary": "技术叙事提升估值关注度，但商业化仍取决于良率和成本。"},
        ],
        "viewpoints": {
            "bullish": [{"source": "主流券商新能源研究框架", "date": "2024-2025", "view": "渗透率提升、出口和智能化升级仍是中长期主线，龙头凭成本与供应链效率扩大份额。"}],
            "neutral": [{"source": "产业链企业公开战略", "date": "2024-2025", "view": "企业普遍转向插混、纯电、智能驾驶和海外产能多线布局，短期盈利取决于价格战节奏。"}],
            "bearish": [{"source": "行业风险跟踪", "date": "2024-2025", "view": "产能扩张、贸易壁垒和价格战可能导致行业盈利分化，缺乏规模或品牌壁垒的环节承压。"}],
        },
    },
    "baijiu": {
        "matched_keywords": ["酿酒", "白酒", "酒"],
        "focus": ["消费升级/降级", "渠道变革", "库存周期"],
        "policies": [
            {"title": "理性饮酒、食品安全和广告合规监管常态化", "date": "2024-2025", "source": "食品安全与广告监管公开框架", "impact": "中性", "summary": "白酒行业监管重点在质量安全、标签广告和未成年人保护等方面。", "insight": "合规成本对龙头影响有限，反而有助于出清低端和不规范产能。"},
            {"title": "扩大内需政策强调服务消费与居民消费修复", "date": "2024-2025", "source": "国务院及部委促消费政策公开口径", "impact": "中性", "summary": "消费刺激方向偏普惠，白酒需求仍取决于商务宴席、礼赠和居民收入预期。", "insight": "政策不是直接催化，关键看高端价格带稳定性和大众价格带动销。"},
        ],
        "technologies": [],
        "supply_chain": [
            {"metric": "渠道库存", "value": "行业重点变量", "date": "2024-2025", "impact": "利空", "insight": "若批价倒挂和渠道库存偏高，经销商回款和厂家发货节奏会受到约束。"},
            {"metric": "高端酒批价", "value": "价格体系锚", "date": "2024-2025", "impact": "中性", "insight": "高端批价稳定代表渠道信心，若持续走弱会向次高端价格带传导。"},
            {"metric": "包材/粮食成本", "value": "占比低于品牌与渠道变量", "date": "2024-2025", "impact": "中性", "insight": "白酒核心不是原材料成本，而是品牌定价权、渠道库存和现金回款质量。"},
        ],
        "events": [
            {"date": "2024-02", "title": "春节动销验证高端与大众价格带分化", "impact": "中性", "affected": ["终端需求", "渠道库存"], "summary": "节庆需求仍是全年观察窗口，高端礼赠和大众宴席表现分化。"},
            {"date": "2024-06", "title": "618及宴席淡季渠道价格压力显现", "impact": "利空", "affected": ["经销商", "批价"], "summary": "淡季批价和库存变化成为判断报表质量的重要前置信号。"},
            {"date": "2025-01", "title": "春节备货关注回款与库存去化", "impact": "中性", "affected": ["酒企", "渠道"], "summary": "若回款质量强于发货增长，说明需求韧性更真实。"},
        ],
        "viewpoints": {
            "bullish": [{"source": "消费品研究常用框架", "date": "2024-2025", "view": "高端白酒品牌壁垒和现金流质量仍强，龙头可通过控货挺价穿越周期。"}],
            "neutral": [{"source": "渠道跟踪框架", "date": "2024-2025", "view": "行业从量价齐升转向结构分化，应重点跟踪批价、库存和经销商利润。"}],
            "bearish": [{"source": "消费降级风险视角", "date": "2024-2025", "view": "商务需求和居民收入预期偏弱时，次高端和区域酒库存压力可能放大。"}],
        },
    },
    "tire_chemical": {
        "matched_keywords": ["橡胶", "轮胎", "化工"],
        "focus": ["原材料成本", "产能周期", "出口政策"],
        "policies": [
            {"title": "海外轮胎贸易壁垒持续扰动出口", "date": "2024-2025", "source": "欧美及新兴市场贸易救济公开案件框架", "impact": "利空", "summary": "反倾销、反补贴和关税调查仍是中国轮胎出口企业长期变量。", "insight": "海外基地布局越完善，越能绕开单一区域贸易壁垒。"},
            {"title": "双碳与环保监管推动化工产能规范化", "date": "2024-2025", "source": "双碳和环保监管公开政策框架", "impact": "中性", "summary": "能耗、排放和安全生产要求提高落后产能成本。", "insight": "合规产能和规模企业受益于供给端约束，小产能出清加速。"},
        ],
        "technologies": [],
        "supply_chain": [
            {"metric": "天然橡胶/合成胶价格", "value": "随原油、天气和供需波动", "date": "2024-2025", "impact": "中性", "insight": "原料上涨短期压制毛利，具备品牌和出口渠道的轮胎企业转嫁能力更强。"},
            {"metric": "海外产能", "value": "头部企业加速布局", "date": "2024-2025", "impact": "利好", "insight": "海外工厂降低关税风险并贴近客户，是估值分化的重要变量。"},
        ],
        "events": [
            {"date": "2024-04", "title": "海运费与红海扰动抬升出口链不确定性", "impact": "利空", "affected": ["出口", "库存"], "summary": "运输周期和费用影响订单交付与短期利润。"},
            {"date": "2024-09", "title": "头部轮胎企业海外基地扩产推进", "impact": "利好", "affected": ["海外市场", "产能"], "summary": "本地化产能增强对贸易壁垒的缓冲能力。"},
        ],
        "viewpoints": {
            "bullish": [{"source": "制造出口研究框架", "date": "2024-2025", "view": "中国轮胎企业凭性价比、海外产能和品牌升级提升全球份额。"}],
            "neutral": [{"source": "周期品研究框架", "date": "2024-2025", "view": "盈利核心取决于原材料价格、海运费和产能利用率的组合。"}],
            "bearish": [{"source": "贸易风险视角", "date": "2024-2025", "view": "贸易救济和海外需求波动可能压制出口订单与估值。"}],
        },
    },
    "semiconductor": {
        "matched_keywords": ["半导体", "芯片", "集成电路"],
        "focus": ["国产替代", "技术封锁", "产能扩张"],
        "policies": [
            {"title": "先进制程与AI芯片出口管制持续升级", "date": "2024-2025", "source": "美国商务部出口管制公开规则框架", "impact": "利空", "summary": "先进设备、EDA、GPU和高端制造能力仍受外部限制。", "insight": "短期压制先进制程效率，长期强化国产设备材料和算力替代需求。"},
            {"title": "大基金三期成立支持集成电路产业链", "date": "2024-05", "source": "国家集成电路产业投资基金三期工商公开信息", "impact": "利好", "summary": "大基金三期注册资本超过前两期，重点支持半导体关键环节。", "insight": "政策资本更可能流向设备、材料、制造等卡脖子环节。"},
        ],
        "technologies": [
            {"route": "成熟制程国产替代", "maturity": "量产推进", "cost": "中", "advantages": ["需求广", "国产设备材料验证快"], "risks": ["价格周期波动", "同质化竞争"], "latest": "汽车、工业和电源管理等场景持续导入。"},
            {"route": "先进制程突破", "maturity": "受限推进", "cost": "高", "advantages": ["战略价值高", "AI与高性能计算需求强"], "risks": ["设备受限", "良率和生态挑战"], "latest": "外部管制倒逼制造、封装和设计协同。"},
            {"route": "先进封装", "maturity": "加速扩产", "cost": "中高", "advantages": ["绕开部分制程瓶颈", "提升系统性能"], "risks": ["客户认证周期长", "设备材料要求高"], "latest": "AI算力需求带动CoWoS/Chiplet相关方向关注。"},
        ],
        "supply_chain": [
            {"metric": "设备材料国产化率", "value": "环节差异大", "date": "2024-2025", "impact": "利好", "insight": "清洗、刻蚀、薄膜等环节替代进展较快，光刻等高壁垒环节仍需长期投入。"},
            {"metric": "晶圆厂产能利用率", "value": "周期修复中", "date": "2024-2025", "impact": "中性", "insight": "消费电子复苏和AI需求拉动结构性改善，但成熟制程扩产可能压制价格。"},
        ],
        "events": [
            {"date": "2024-05", "title": "国家大基金三期成立", "impact": "利好", "affected": ["设备", "材料", "制造"], "summary": "产业资本继续支持关键短板。"},
            {"date": "2024-12", "title": "美国更新半导体出口管制规则", "impact": "利空", "affected": ["先进设备", "AI芯片"], "summary": "外部限制增加先进环节不确定性。"},
            {"date": "2025-01", "title": "AI算力投资延续先进封装景气", "impact": "利好", "affected": ["封测", "载板", "设备"], "summary": "算力需求推动封装环节价值量提升。"},
        ],
        "viewpoints": {
            "bullish": [{"source": "科技制造研究框架", "date": "2024-2025", "view": "国产替代和AI算力需求构成长期成长主线，设备材料龙头受益。"}],
            "neutral": [{"source": "产业周期视角", "date": "2024-2025", "view": "不同环节景气差异明显，应区分设计、制造、设备、材料和封测周期位置。"}],
            "bearish": [{"source": "外部限制风险视角", "date": "2024-2025", "view": "先进制程受限和成熟制程扩产可能导致估值与盈利波动。"}],
        },
    },
    "generic": {
        "matched_keywords": [],
        "focus": ["政策监管", "供需周期", "竞争格局"],
        "policies": [],
        "technologies": [],
        "supply_chain": [
            {"metric": "成本传导能力", "value": "待结合公司披露验证", "date": "2024-2025", "impact": "中性", "insight": "优先跟踪主要原材料、费用率和毛利率稳定性，避免在缺少数据时做确定性判断。"},
            {"metric": "行业集中度", "value": "暂无统一数据", "date": "2024-2025", "impact": "中性", "insight": "若龙头份额提升且价格稳定，说明竞争格局改善；否则需警惕低端产能扰动。"},
        ],
        "events": [],
        "viewpoints": {
            "bullish": [],
            "neutral": [{"source": "通用行业分析框架", "date": "2024-2025", "view": "当前缺少该细分行业的结构化深度数据，建议补充研报、公告和行业协会数据后再做判断。"}],
            "bearish": [],
        },
    },
}


def clean_code(code: str) -> str:
    return "".join(ch for ch in str(code) if ch.isdigit())[:6]


def safe_value(value: Any) -> Any:
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return float(value)
    return value


def first_existing(row: Any, names: List[str]) -> Any:
    for name in names:
        if name in row:
            value = row[name]
            if not pd.isna(value):
                return value
    return None


def numeric(value: Any):
    if value is None:
        return None
    try:
        text = str(value).replace(",", "").replace("%", "")
        return float(text)
    except Exception:
        return None


def money_to_yi(value: Any):
    number = numeric(value)
    if number is None:
        return None
    return round(number / 100000000, 2) if abs(number) > 100000000 else round(number, 2)


@lru_cache(maxsize=1)
def get_a_share_list() -> List[Dict[str, Any]]:
    local_items = _load_local_a_share_list()
    if local_items:
        return local_items
    try:
        frame = ak.stock_zh_a_spot_em()
    except Exception:
        return list(STOCK_FALLBACK.values())
    items: List[Dict[str, Any]] = []
    for _, row in frame.iterrows():
        item = _normalize_stock_item(dict(row))
        if item:
            items.append(item)
    return _append_missing_fallback(items)


def search_stocks(q: str) -> Dict[str, Any]:
    keyword = q.strip().lower()
    if not keyword:
        matches: List[Dict[str, Any]] = []
    else:
        matches = [item for item in get_a_share_list() if keyword in item["code"] or keyword in item["name"].lower()]
        matches.sort(key=lambda item: (item["name"].lower() != keyword, not item["code"].startswith(keyword), item["code"]))
    return {"query": q, "data_date": DATA_DATE, "items": matches[:20]}


def _fetch_stock(symbol: str) -> Dict[str, Any]:
    spot = next((item for item in get_a_share_list() if item["code"] == symbol), STOCK_FALLBACK.get(symbol, {"code": symbol}))
    try:
        info = ak.stock_individual_info_em(symbol=symbol)
        records = dict(zip(info["item"], info["value"]))
    except Exception:
        records = {}
    industry = records.get("行业") or records.get("所属行业") or spot.get("industry") or "综合行业"
    name = records.get("股票简称") or records.get("简称") or records.get("名称") or spot.get("name") or symbol
    return {
        "code": symbol,
        "name": name,
        "industry": industry,
        "sub_industry": industry,
        "current_price": spot.get("current_price"),
        "change_pct": spot.get("change_pct"),
        "market_cap": safe_value(records.get("总市值")),
        "raw": {str(key): safe_value(value) for key, value in records.items()},
    }


def get_stock(code: str, refresh: bool = False) -> Dict[str, Any]:
    return get_cached_or_fetch(code, "profile", _fetch_stock, refresh)


def _fetch_financials(symbol: str) -> Dict[str, Any]:
    try:
        indicator = ak.stock_financial_analysis_indicator(symbol=symbol)
        if indicator.empty:
            indicator = ak.stock_financial_benefit_ths(symbol=symbol, indicator="按年度")
    except Exception:
        indicator = pd.DataFrame()
    rows = []
    for _, row in indicator.head(3).iterrows():
        date_value = str(first_existing(row, ["日期", "报告期", "公告日期", "截止日期"]) or "")
        year = int(date_value[:4]) if date_value[:4].isdigit() else None
        rows.append({
            "year": year,
            "revenue": money_to_yi(first_existing(row, ["营业总收入", "营业收入", "主营业务收入"])),
            "net_profit": money_to_yi(first_existing(row, ["净利润", "归母净利润", "扣非净利润"])),
            "gross_margin": safe_value(first_existing(row, ["销售毛利率", "毛利率"])),
            "net_margin": safe_value(first_existing(row, ["销售净利率", "净利率"])),
            "roe": safe_value(first_existing(row, ["净资产收益率", "加权净资产收益率", "摊薄净资产收益率"])),
            "total_assets": money_to_yi(first_existing(row, ["资产总计", "总资产"])),
            "total_debt": money_to_yi(first_existing(row, ["负债合计", "总负债"])),
            "operating_cash_flow": money_to_yi(first_existing(row, ["经营活动产生的现金流量净额", "每股经营性现金流"])),
        })
    return {"code": symbol, "items": rows}


def get_financials(code: str, refresh: bool = False) -> Dict[str, Any]:
    return get_cached_or_fetch(code, "financials", _fetch_financials, refresh)


def _fetch_peers(symbol: str) -> Dict[str, Any]:
    stock = get_stock(symbol)
    industry = stock.get("industry") or "综合行业"
    try:
        peers = ak.stock_board_industry_cons_em(symbol=str(industry))
    except Exception:
        peers = pd.DataFrame()
    items = []
    for _, row in peers.iterrows():
        items.append({
            "code": clean_code(first_existing(row, ["代码", "股票代码"]) or ""),
            "name": safe_value(first_existing(row, ["名称", "股票简称"])),
            "price": safe_value(first_existing(row, ["最新价"])),
            "change_pct": safe_value(first_existing(row, ["涨跌幅"])),
            "market_cap": money_to_yi(first_existing(row, ["总市值"])),
            "pe": safe_value(first_existing(row, ["市盈率-动态", "市盈率"])),
            "pb": safe_value(first_existing(row, ["市净率"])),
            "revenue": None,
            "net_profit": None,
            "roe": None,
        })
    if not items:
        items = [{"code": stock["code"], "name": stock["name"], "price": stock.get("current_price"), "change_pct": stock.get("change_pct"), "market_cap": money_to_yi(stock.get("market_cap")), "pe": None, "pb": None, "revenue": None, "net_profit": None, "roe": None}]
    return {"code": stock["code"], "industry": industry, "items": items[:30]}


def get_peers(code: str, refresh: bool = False) -> Dict[str, Any]:
    return get_cached_or_fetch(code, "peers", _fetch_peers, refresh)


def _fetch_chain(symbol: str) -> Dict[str, Any]:
    stock = get_stock(symbol)
    industry = str(stock.get("industry") or "综合行业")
    upstream, midstream, downstream = next((tpl for key, tpl in INDUSTRY_TEMPLATES.items() if key in industry), INDUSTRY_TEMPLATES["贸易"])
    deep = build_deep_analysis(industry)
    return {
        "code": stock["code"],
        "name": stock["name"],
        "industry": industry,
        "subtitle": f"基于{industry}通用经营逻辑生成，上游关注成本，中游关注效率与竞争壁垒，下游关注需求与渠道。",
        "nodes": [
            {"id": "upstream", "label": upstream, "detail": "上游原材料/资源", "stage": "upstream", "body": ["跟踪采购价格、供给周期与议价权", "识别成本能否向下游传导"]},
            {"id": "company", "label": stock["name"], "detail": midstream, "stage": "midstream", "current": True, "body": ["关注产能利用率、费用率、研发/品牌投入", "用ROE与现金流验证商业模式质量"]},
            {"id": "downstream", "label": downstream, "detail": "下游应用/客户", "stage": "downstream", "body": ["观察终端需求、库存与价格体系", "评估客户集中度和渠道健康度"]},
        ],
        "edges": [{"source": "upstream", "target": "company", "label": "成本传导"}, {"source": "company", "target": "downstream", "label": "产品/服务"}],
        "insights": [
            {"type": "成本结构", "title": f"{industry}成本传导", "body": "先确认关键原材料或资金成本占比，再判断公司是否具备提价、效率改善或套保能力。", "highlights": ["成本占比", "提价"]},
            {"type": "竞争壁垒", "title": "中游壁垒验证", "body": "用毛利率稳定性、ROE、现金流和市场份额变化验证竞争优势是否真实。", "highlights": ["ROE", "现金流"]},
            {"type": "增长驱动", "title": "下游需求跟踪", "body": "跟踪订单、库存、价格和渠道反馈，区分周期修复与长期成长。", "highlights": ["订单", "库存"]},
        ],
        "deep_analysis": deep,
    }


def get_chain(code: str, refresh: bool = False) -> Dict[str, Any]:
    return get_cached_or_fetch(code, "chain", _fetch_chain, refresh)


def build_deep_analysis(industry: str) -> Dict[str, Any]:
    template_key = next((key for key, item in DEEP_ANALYSIS_TEMPLATES.items() if any(word in industry for word in item["matched_keywords"])), "generic")
    template = DEEP_ANALYSIS_TEMPLATES[template_key]
    events = sorted(template["events"], key=lambda item: item["date"])
    return {
        "template": template_key,
        "focus": template["focus"],
        "source_note": "当前为结构化行业模板，基于2024-2025年公开政策、监管公告和主流产业研究框架整理；缺少确认数据的维度保留为空或标注暂无数据，后续可接入研报API/公告库替换。",
        "policies": template["policies"],
        "technologies": template["technologies"],
        "supply_chain": template["supply_chain"],
        "events": events,
        "viewpoints": template["viewpoints"],
    }


def _fetch_valuation(symbol: str) -> Dict[str, Any]:
    try:
        valuation = ak.stock_a_indicator_lg(symbol=symbol)
    except Exception:
        valuation = pd.DataFrame()
    if valuation.empty:
        return {"code": symbol, "current_pe": None, "current_pb": None, "pe_percentile": None, "pb_percentile": None, "items": []}
    valuation = valuation.tail(1250)
    pe_col = "pe" if "pe" in valuation.columns else "市盈率"
    pb_col = "pb" if "pb" in valuation.columns else "市净率"
    date_col = "trade_date" if "trade_date" in valuation.columns else valuation.columns[0]
    pe = pd.to_numeric(valuation[pe_col], errors="coerce") if pe_col in valuation.columns else pd.Series(dtype=float)
    pb = pd.to_numeric(valuation[pb_col], errors="coerce") if pb_col in valuation.columns else pd.Series(dtype=float)
    current_pe = float(pe.dropna().iloc[-1]) if not pe.dropna().empty else None
    current_pb = float(pb.dropna().iloc[-1]) if not pb.dropna().empty else None
    return {"code": symbol, "current_pe": current_pe, "current_pb": current_pb, "pe_percentile": float((pe.dropna() <= current_pe).mean()) if current_pe is not None else None, "pb_percentile": float((pb.dropna() <= current_pb).mean()) if current_pb is not None else None, "items": [{"date": str(row[date_col]), "pe": safe_value(row[pe_col]) if pe_col in row else None, "pb": safe_value(row[pb_col]) if pb_col in row else None} for _, row in valuation.iterrows()]}


def get_valuation(code: str, refresh: bool = False) -> Dict[str, Any]:
    return get_cached_or_fetch(code, "valuation", _fetch_valuation, refresh)
