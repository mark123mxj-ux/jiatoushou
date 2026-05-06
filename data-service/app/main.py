from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analysis_service import analyze_portfolio
from .portfolio_service import import_excel, import_image, import_trades_excel, import_trades_image, load_portfolio, load_trades, save_portfolio, save_trades
from .stock_service import get_chain, get_financials, get_peers, get_stock, get_valuation, search_stocks
from .trade_analysis_service import analyze_trades

app = FastAPI(title="价投手 Data Service", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/portfolio/import-image")
async def portfolio_import_image(file: UploadFile = File(...)):
    return await import_image(file)


@app.post("/api/portfolio/import-excel")
async def portfolio_import_excel(file: UploadFile = File(...)):
    return await import_excel(file)


@app.post("/api/portfolio/save")
def portfolio_save(payload: dict):
    return save_portfolio(payload)


@app.get("/api/portfolio")
def portfolio_get():
    return load_portfolio()


@app.get("/api/portfolio/analysis")
def portfolio_analysis():
    return analyze_portfolio()


@app.post("/api/portfolio/trades/import-excel")
async def portfolio_trades_import_excel(file: UploadFile = File(...)):
    return await import_trades_excel(file)


@app.post("/api/portfolio/trades/import-image")
async def portfolio_trades_import_image(file: UploadFile = File(...)):
    return await import_trades_image(file)


@app.post("/api/portfolio/trades/save")
def portfolio_trades_save(payload: dict):
    return save_trades(payload)


@app.get("/api/portfolio/trades")
def portfolio_trades_get():
    return load_trades()


@app.get("/api/portfolio/trades/analysis")
def portfolio_trades_analysis():
    return analyze_trades()


@app.get("/api/stocks/search")
def stocks_search(q: str = Query("", min_length=0)):
    return search_stocks(q)


@app.get("/api/stocks/{code}/profile")
def stock_profile(code: str, refresh: bool = False):
    try:
        return get_stock(code, refresh)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/stocks/{code}/financials")
def stock_financials(code: str, refresh: bool = False):
    try:
        return get_financials(code, refresh)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/stocks/{code}/industry-peers")
def stock_industry_peers(code: str, refresh: bool = False):
    try:
        return get_peers(code, refresh)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/stocks/{code}/chain")
def stock_chain(code: str, refresh: bool = False):
    try:
        return get_chain(code, refresh)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/stocks/{code}/chain-deep")
def stock_chain_deep(code: str, refresh: bool = False):
    return stock_chain(code, refresh)


@app.get("/api/stock/{code}")
def stock(code: str, refresh: bool = False):
    return stock_profile(code, refresh)


@app.get("/api/stock/{code}/financials")
def financials(code: str, refresh: bool = False):
    return stock_financials(code, refresh)


@app.get("/api/stock/{code}/peers")
def peers(code: str, refresh: bool = False):
    return stock_industry_peers(code, refresh)


@app.get("/api/stock/{code}/valuation")
def valuation(code: str, refresh: bool = False):
    try:
        return get_valuation(code, refresh)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
