# Claude Code Buddy Toolkit

> About: Bun-compatible Claude Code `/buddy` reroll toolkit with config backup, OAuth-token workflow notes, and source-linked documentation.

这是一个把 Claude Code `/buddy` 社区逆向分析整理成可复用工程化工具的小仓库，目标是把“刷宠物”这件事从零散帖子，变成可搜索、可验证、可安全落配置的一套最小工作流。

## 仓库内容

- `scripts/buddy-reroll.js`
  用 Bun 兼容的哈希逻辑搜索目标 `userID`，也支持检查某个 `userID` 对应的宠物结果。
- `scripts/apply-buddy-config.js`
  备份并更新 `~/.claude.json`，可写入 `userID`、名字、性格，也可按需移除 `oauthAccount`。
- `docs/workflows.md`
  解释 API/token 请求路径、OAuth 登录态、`/buddy` 实际种子来源之间的关系，并给出推荐流程。
- `docs/source-links.md`
  明确列出本仓库整理所依据的来源链接与用途。

## 适用范围

- 主要面向 Claude Code Native 安装场景
- 当前脚本默认按 `SALT = friend-2026-401` 处理
- 已按 Claude Code `2.1.89` / `2.1.90` 的社区逆向结论整理

如果后续 Claude Code 改了 `SALT`、随机逻辑、字段结构或 `oauthAccount` 读取逻辑，这套脚本可能需要同步调整。

## 来源链接

以下是本仓库明确引用的两篇来源贴，链接保留原文：

1. [Claude Code /buddy 宠物系统逆向分析 —— 如何重置并刷到你想要的宠物](https://linux.do/t/topic/1871870/22)
2. [Claude Oauth登录刷 /buddy 宠物的方法找到了](https://linux.do/t/topic/1873901)

说明：

- 这两篇都是社区逆向分析结论，不是 Anthropic 官方文档
- 本仓库只做工程化整理、脚本封装与流程补全，不主张把原文整篇搬运到这里

## 快速开始

### 1. 安装依赖

- 推荐安装 Bun。Claude Code Native 场景下，Bun 的哈希结果才和实际 `/buddy` 一致。
- `apply-buddy-config.js` 用 Node.js 运行即可。

### 2. 搜索目标宠物

```bash
bun scripts/buddy-reroll.js \
  --species chonk \
  --rarity legendary \
  --eye "✦" \
  --hat crown \
  --shiny \
  --count 1
```

### 3. 把目标 `userID` 写入本地配置

```bash
node scripts/apply-buddy-config.js \
  --uid <YOUR_UID> \
  --name "King Pudding" \
  --personality "A radiant little monarch who rules with soft paws, dramatic stares, and absolute confidence. He acts spoiled, but somehow always saves the day."
```

### 4. 完全退出 Claude Code 并重新打开

然后执行：

```text
/buddy
```

## 常见命令

### 检查某个 `userID` 对应的宠物

```bash
bun scripts/buddy-reroll.js --check <UID>
```

### 搜索指定物种与最低稀有度

```bash
bun scripts/buddy-reroll.js --species duck --rarity legendary --count 3
```

### 同时更新 `userID`、名字和性格，并删除 `oauthAccount`

```bash
node scripts/apply-buddy-config.js \
  --uid <YOUR_UID> \
  --remove-oauth-account \
  --name "King Pudding" \
  --personality "A radiant little monarch who rules with soft paws, dramatic stares, and absolute confidence. He acts spoiled, but somehow always saves the day."
```

## 目录结构

```text
.
├── README.md
├── package.json
├── LICENSE
├── scripts
│   ├── apply-buddy-config.js
│   └── buddy-reroll.js
└── docs
    ├── source-links.md
    └── workflows.md
```

## 注意事项

1. Claude Code Native 场景下请优先使用 Bun 运行搜索脚本。Node.js fallback 只适合阅读逻辑，不适合拿来刷真实宠物。
2. 修改 `~/.claude.json` 前务必备份。本仓库的配置脚本会自动生成时间戳备份，但你仍然应该自己确认。
3. 如果 `~/.claude.json` 里仍有 `oauthAccount`，`/buddy` 可能优先使用 `accountUuid`，导致你改的 `userID` 不生效。详见 [docs/workflows.md](docs/workflows.md)。
4. 你可以同时使用自定义 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 调模型请求，这并不等于 `/buddy` 一定按 API key 模式取种子。两者是不同层。
5. 不要把自己的 token、邮箱、完整 `~/.claude.json`、或带敏感信息的日志提交到 GitHub。
6. 条件越苛刻，搜索时间越久。像 `legendary + shiny + 指定物种 + 指定眼睛 + 指定帽子` 这种组合本身就是低概率事件。
7. 本仓库仅用于学习、验证和个人研究；请自行评估其与官方产品条款、版本变动和账户风险的关系。

## 推荐阅读

- [工作流说明](docs/workflows.md)
- [来源链接与说明](docs/source-links.md)

## 作者

- 仓库作者与工程化整理：Codex
- 原始思路来源：LINUX DO 社区帖子，见上方来源链接

## License

MIT
