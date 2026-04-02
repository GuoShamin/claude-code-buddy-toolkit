# Claude Code Buddy Toolkit

> About: Bun-compatible Claude Code `/buddy` toolkit for environment checks, deterministic rerolls, safe config updates, and source-linked workflow notes.

这是一个把 Claude Code `/buddy` 社区逆向分析整理成可复用工程化工具的小仓库。

它不是单纯的“刷宠脚本集合”，而是一个更适合真实使用的最小工具链：

- 能检查本地 Claude 状态
- 能搜索目标宠物
- 能安全备份并更新 `~/.claude.json`
- 能同时服务人类用户与 agent
- 能保留来源链接、风险提醒和使用边界

## 来源链接

本仓库明确基于以下两篇来源做工程化整理：

1. [Claude Code /buddy 宠物系统逆向分析 —— 如何重置并刷到你想要的宠物](https://linux.do/t/topic/1871870/22)
2. [Claude Oauth登录刷 /buddy 宠物的方法找到了](https://linux.do/t/topic/1873901)

说明：

- 这两篇是社区逆向分析，不是 Anthropic 官方文档
- 本仓库不搬运整篇原文，只保留来源链接与必要的工程化整理

## 仓库目标

这个仓库优先解决三个真实问题：

1. 很多人分不清“Claude Code 如何请求模型”和“`/buddy` 实际按谁算种子”
2. 原始帖子里方法可行，但缺少统一入口、配置安全措施和结构化输出
3. 实际使用者很多会直接让 agent 帮自己做，所以需要让 agent 也能稳定执行

## 适用范围

- 主要面向 Claude Code Native 安装场景
- 当前脚本默认按 `SALT = friend-2026-401` 处理
- 当前整理基于 Claude Code `2.1.89` / `2.1.90` 的社区逆向结论

如果后续 Claude Code 修改了 `SALT`、随机逻辑、字段结构或 `oauthAccount` 读取逻辑，这套脚本可能需要同步调整。

## 给人类用户

### 最推荐的命令

先检查环境：

```bash
bun scripts/buddy-toolkit.js doctor
```

只搜索，不写本地配置：

```bash
bun scripts/buddy-toolkit.js full \
  --species chonk \
  --rarity legendary \
  --eye "✦" \
  --hat crown \
  --shiny \
  --name "King Pudding" \
  --personality "A radiant little monarch who rules with soft paws, dramatic stares, and absolute confidence. He acts spoiled, but somehow always saves the day."
```

确认结果后，真正写入本地配置：

```bash
bun scripts/buddy-toolkit.js full \
  --species chonk \
  --rarity legendary \
  --eye "✦" \
  --hat crown \
  --shiny \
  --name "King Pudding" \
  --personality "A radiant little monarch who rules with soft paws, dramatic stares, and absolute confidence. He acts spoiled, but somehow always saves the day." \
  --write
```

写入后：

1. 完全退出 Claude Code
2. 重新打开
3. 执行 `/buddy`

### 如果你只想做单步操作

检查某个 `userID`：

```bash
bun scripts/buddy-toolkit.js check --check 0782ce9914700102a4b6262ae572493a7d348e745cfff9ebd7a19cf7d66babe4
```

只搜索：

```bash
bun scripts/buddy-toolkit.js search --species duck --rarity legendary --count 3
```

只更新配置：

```bash
node scripts/buddy-toolkit.js apply \
  --uid <YOUR_UID> \
  --name "King Pudding" \
  --personality "A radiant little monarch who rules with soft paws, dramatic stares, and absolute confidence. He acts spoiled, but somehow always saves the day."
```

## 给 Agent

### 推荐执行顺序

1. 先读取本地状态：

```bash
bun scripts/buddy-toolkit.js doctor --json
```

2. 用结构化 spec 执行 dry-run：

```bash
bun scripts/buddy-toolkit.js full --spec examples/full-run.spec.json --json
```

3. 仅在用户明确授权时才写入：

```bash
bun scripts/buddy-toolkit.js full --spec examples/full-run.spec.json --write --json
```

### 为什么 agent 应优先用 `--spec`

- 少掉 shell 转义问题
- 适合长 personality 文本
- 适合包含 `✦` 之类的非 ASCII 字符
- 更容易做自动化复用

模板文件见：

- [examples/full-run.spec.json](examples/full-run.spec.json)
- [AGENTS.md](AGENTS.md)

## 核心文件

- [scripts/buddy-toolkit.js](scripts/buddy-toolkit.js)
  统一 CLI 入口，适合大多数使用场景
- [scripts/lib/buddy-core.js](scripts/lib/buddy-core.js)
  `/buddy` 搜索与校验核心逻辑
- [scripts/lib/config-utils.js](scripts/lib/config-utils.js)
  Claude 本地配置检查、备份与更新逻辑
- [scripts/buddy-reroll.js](scripts/buddy-reroll.js)
  兼容旧用法的搜索脚本包装层
- [scripts/apply-buddy-config.js](scripts/apply-buddy-config.js)
  兼容旧用法的配置脚本包装层
- [docs/workflows.md](docs/workflows.md)
  OAuth/token/API 路径与 `/buddy` 本地种子的关系说明
- [docs/source-links.md](docs/source-links.md)
  来源链接与整理边界

## 目录结构

```text
.
├── AGENTS.md
├── README.md
├── LICENSE
├── package.json
├── docs
│   ├── source-links.md
│   └── workflows.md
├── examples
│   └── full-run.spec.json
└── scripts
    ├── apply-buddy-config.js
    ├── buddy-reroll.js
    ├── buddy-toolkit.js
    └── lib
        ├── buddy-core.js
        └── config-utils.js
```

## 注意事项

1. Claude Code Native 场景下，精确搜索请优先使用 Bun。Node fallback 仅适合近似预览，不适合真实 `/buddy` 结果。
2. 修改 `~/.claude.json` 前务必备份。本仓库的写入逻辑会自动生成时间戳备份，但你仍然应该自己确认。
3. 如果 `~/.claude.json` 里仍有 `oauthAccount`，`/buddy` 可能优先使用 `accountUuid`，导致你改的 `userID` 不生效。详见 [docs/workflows.md](docs/workflows.md)。
4. 统一入口 `scripts/buddy-toolkit.js` 在 `apply/full --write` 场景下，默认会拦住“带 `oauthAccount` 但未显式移除”的写入，避免你误以为已经成功切换宠物种子。
5. 你可以同时使用自定义 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 请求模型，但这不等于 `/buddy` 一定按 API key 模式取种子。两者是不同层。
6. 不要把自己的 token、邮箱、完整 `~/.claude.json`、或敏感日志上传到 GitHub。
7. 条件越苛刻，搜索时间越久。像 `legendary + shiny + 指定物种 + 指定眼睛 + 指定帽子` 这种组合本身就是低概率事件。
8. 本仓库仅用于学习、验证和个人研究；请自行评估其与官方产品条款、版本变动和账户风险的关系。

## 常用 npm Scripts

```bash
npm run buddy:doctor
npm run buddy:search -- --species chonk --rarity legendary
npm run buddy:full -- --spec examples/full-run.spec.json
npm run buddy:apply -- --uid <YOUR_UID> --dry-run
```

## 作者

- 仓库作者与工程化整理：Codex
- 原始思路来源：LINUX DO 社区帖子，见上方来源链接

## License

MIT
