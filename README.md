# 价投手

价投手是面向价值投资者的 A 股研究工作台，提供股票检索、基本面概览、行业同行对比、投资论点记录、组合导入与交易复盘等能力。

本仓库采用前后端分离架构：`web/` 部署到 Vercel，`data-service/` 部署到 Railway，前端通过环境变量 `NEXT_PUBLIC_API_URL` 调用后端 API。

## 目录结构

```text
.
├── web/                 # Next.js 14 App Router 前端
├── data-service/        # FastAPI + AKShare A 股数据服务
├── docker-compose.yml   # 本地辅助服务
└── README.md
```

## 技术栈

- 前端：Next.js 14 App Router、React、TypeScript、TailwindCSS、Recharts、@xyflow/react
- 后端：FastAPI、Uvicorn、AKShare、pandas、openpyxl、rapidocr-onnxruntime
- 部署：GitHub public repo、Vercel（前端）、Railway（后端）

## 快速开始

### 1. 启动基础设施

```bash
docker compose up -d
```

### 2. 启动数据服务

```bash
cd data-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

数据服务默认运行在 `http://localhost:8000`。

### 3. 启动前端

```bash
cd web
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm install
pnpm dev
```

前端默认运行在 `http://localhost:3000`。

如需连接非本地后端，请在 `web/.env.local` 设置：

```bash
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
```

## API

- `GET /api/stock/{code}`：股票基本信息与行业
- `GET /api/stock/{code}/financials`：近 5 年关键财务数据
- `GET /api/stock/{code}/peers`：同行业上市公司与关键指标
- `GET /api/stock/{code}/valuation`：近 5 年 PE/PB 历史数据与当前分位数

示例：

```bash
curl http://localhost:8000/api/stock/601058
curl http://localhost:8000/api/stock/601058/financials
curl http://localhost:8000/api/stock/601058/peers
curl http://localhost:8000/api/stock/601058/valuation
```

## 部署说明

### 1. GitHub

```bash
gh repo create maxiangjin/jiatoushou --public --source=. --remote=origin --push
```

如仓库已存在，可改用：

```bash
git remote add origin git@github.com:maxiangjin/jiatoushou.git
git push -u origin main
```

### 2. Railway 后端

1. 在 Railway 新建 Project，选择 GitHub 仓库 `maxiangjin/jiatoushou`。
2. Root Directory 设置为 `data-service`。
3. Railway 会读取：
   - `requirements.txt`
   - `runtime.txt`
   - `Procfile`
4. 部署完成后确认健康检查：

```bash
curl https://your-railway-app.up.railway.app/health
```

`data-service/data/a_share_list.json` 已纳入仓库，部署时会随代码一起发布。

### 3. Vercel 前端

1. 在 Vercel 导入 GitHub 仓库 `maxiangjin/jiatoushou`。
2. Framework 选择 Next.js，Root Directory 设置为 `web`。
3. Build Command 使用 `corepack enable && corepack prepare pnpm@9.12.3 --activate && pnpm build`。
4. Install Command 使用 `corepack enable && corepack prepare pnpm@9.12.3 --activate && pnpm install --frozen-lockfile`。
5. 添加环境变量：

```bash
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
```

6. 部署后访问 Vercel 分配的域名，确认股票搜索和研究页面能正常调用 Railway 后端。