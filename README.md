# 静夜牌 · 塔罗式情绪自测（v1.1 玩具版）

单页 H5：口令进门 → 18+ 确认 → 抽一张大阿卡纳 → 翻牌 → AI 流式解读。

- 前端：Vue 3 + Vite，hash 路由，移动端优先（≤430px）
- 后端：Cloudflare Pages Functions（`functions/` 目录），无独立 Worker
- 牌库：`data/cards.json`（22 张，含正逆位关键词与牌义）
- 牌面：`public/cards/*.webp`（640px 宽，单张 ≤100KB）

## 素材与牌面重压

原始大图统一放 `D:\Working\web-project`（文件名 `major-00.jpg`…`major-21.jpg`）。
新增或替换素材后重跑一次压缩即可，不必手动调参：

```bash
python scripts/compress_cards.py            # 默认读 D:\Working\web-project
python scripts/compress_cards.py <源目录>    # 也可以指定别的目录
```

脚本流程：EXIF 转正 → 宽 640 → 中值去噪 + 平滑（扫描件纸纹重，不去噪压不到 100KB）→ WebP 质量 88 起逐档下降，取第一个 ≤100KB 的档位。

## 本地开发

```bash
npm install
npm run build          # 产物在 dist/
npx wrangler pages dev dist --port 8788    # 带 /api 的完整本地环境
```

只调前端样式时可以直接 `npm run dev`（5173 端口，`/api` 已代理到 8788）。

## 口令

- 口令与签名密钥只在 Cloudflare 环境变量里：`ACCESS_PASSWORD`、`TAROT_SECRET`（本地写在 `.dev.vars`，已 gitignore）
- 校验在服务端完成，通过后种 `tarot_pass` HttpOnly + HMAC 签名 cookie（30 天）
- `/api/reading` 同样校验该 cookie，所以只拿到页面链接也烧不了 API 额度
- 试错限流：同一 IP 10 分钟 5 次

## 部署

```bash
npx wrangler pages deploy dist --project-name tarot-emotion
```

然后在 Pages 项目 Settings → Environment variables 里配置 `ACCESS_PASSWORD`、`TAROT_SECRET`、`DEEPSEEK_API_KEY`。

## 解读接口

`POST /api/reading`，请求体 `{ cardId, orientation, userNote? }`，返回 SSE：

- `data: {"delta":"..."}` 逐段文字
- `data: {"done":true,"degraded":false,"safety":{"level":"none"|"crisis"}}`
- 出错时 `data: {"error":"UPSTREAM_TIMEOUT"|"UPSTREAM_ERROR"}`

细节：

- 危机词命中（`functions/_lib/crisis.js`）**完全不调模型**，直接返回 12356／120／110 的关怀文案，`safety.level = "crisis"`
- 模型默认 `deepseek-chat`，可用 `DEEPSEEK_MODEL` 覆盖（设计文档写的 `deepseek-flash` 不是 DeepSeek 官方模型名）
- 首字 15 秒没来 → `UPSTREAM_TIMEOUT`；整段上限 60 秒
- 模型没写免责行时服务端补上
- 上游地址可用 `DEEPSEEK_API_URL` 覆盖，本地联调指向 `scripts/mock-deepseek.mjs`

## 本地跑通整条链路（不需要真 Key）

```bash
npm run build
node scripts/mock-deepseek.mjs &          # 假上游，127.0.0.1:8790
node node_modules/wrangler/bin/wrangler.js pages dev dist --port 8788
node scripts/e2e.mjs                       # 23 项端到端检查
```

## 状态

- [x] T0 牌义 JSON（22 张，已校验）
- [x] T1 静态原型：口令页 / 首页 / 抽牌翻牌 / 降级文案
- [x] T2 `/api/reading` 接 DeepSeek 流式（含首页「一句话」输入与危机词拦截）
- [ ] T3 免责 + 年龄门的收尾验收（年龄门已完成）
- [ ] T4 三张牌阵（v1.2）
- [ ] 部署到 Cloudflare Pages（等 Key 与授权）
