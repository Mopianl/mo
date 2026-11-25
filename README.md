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

## 状态

- [x] T0 牌义 JSON（22 张，已校验）
- [x] T1 静态原型：口令页 / 首页 / 抽牌翻牌 / 降级文案
- [ ] T2 `/api/reading` 接 DeepSeek 流式
- [ ] T3 危机词拦截 + 免责 + 年龄门（年龄门已完成）
- [ ] T4 三张牌阵（v1.2）
