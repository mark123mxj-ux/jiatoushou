CREATE TABLE IF NOT EXISTS stocks (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(50),
  industry VARCHAR(50),
  sub_industry VARCHAR(50),
  market_cap DECIMAL,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financials (
  id SERIAL PRIMARY KEY,
  stock_code VARCHAR(10) REFERENCES stocks(code),
  year INTEGER,
  revenue DECIMAL,
  net_profit DECIMAL,
  gross_margin DECIMAL,
  net_margin DECIMAL,
  roe DECIMAL,
  total_assets DECIMAL,
  total_debt DECIMAL,
  operating_cash_flow DECIMAL,
  UNIQUE(stock_code, year)
);

CREATE TABLE IF NOT EXISTS theses (
  id SERIAL PRIMARY KEY,
  stock_code VARCHAR(10) REFERENCES stocks(code),
  industry_logic TEXT,
  company_logic TEXT,
  valuation_logic TEXT,
  sell_conditions TEXT,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisions (
  id SERIAL PRIMARY KEY,
  stock_code VARCHAR(10) REFERENCES stocks(code),
  thesis_id INTEGER REFERENCES theses(id),
  action VARCHAR(10),
  price DECIMAL,
  quantity INTEGER,
  reasoning TEXT,
  emotion VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);