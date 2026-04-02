# AGENTS.md

本仓库默认面向 agent 与人类共同使用。对 agent 来说，优先遵循以下工作流：

## 目标

- 检查 Claude Code 本地状态
- 精确搜索满足条件的 `/buddy` 结果
- 在明确授权下安全更新 `~/.claude.json`
- 保留来源链接、风险提醒和最小变更原则

## 首选命令

1. 先做环境检查

```bash
bun scripts/buddy-toolkit.js doctor --json
```

2. 搜索目标宠物

```bash
bun scripts/buddy-toolkit.js search --json --species chonk --rarity legendary --eye "✦" --hat crown --shiny --count 1
```

3. 全流程执行

```bash
bun scripts/buddy-toolkit.js full --spec examples/full-run.spec.json --json
```

4. 真正写入时，显式加上 `--write`

```bash
bun scripts/buddy-toolkit.js full --spec examples/full-run.spec.json --write --json
```

## 结构化输入建议

优先使用 `--spec`，因为这样能减少 shell 转义问题，尤其是：

- 眼睛字符如 `✦`
- 长 personality 文本
- agent 自动化场景下的稳定性

示例模板见：

- `examples/full-run.spec.json`

## 安全规则

1. 除非用户明确要求，否则不要移除 `oauthAccount`。
2. 如果 `doctor --json` 显示 `oauth_account_present_may_override_userid`，要先提醒用户：即便写入了新 `userID`，`/buddy` 也可能仍然读取 `accountUuid`。
3. 不要把用户本地的 `~/.claude.json`、token、邮箱、或完整敏感输出提交到仓库。
4. 只有在用户明确要求“写入本地配置”时，才对 `full` 加 `--write`。
5. 如果配置中仍有 `oauthAccount`，统一入口会阻止 `apply/full --write`；agent 不应绕过这个保护，除非用户明确要求移除并理解风险。
6. 运行 `search` / `full` 时优先用 Bun；Node fallback 仅用于近似预览，不适合真实 Native `/buddy` 结果。

## 输出偏好

- 对 agent：优先使用 `--json`
- 对人类：优先使用默认文本输出
- 引用风险时，简洁说明原因和下一步动作

## 关键文件

- `scripts/buddy-toolkit.js`
  统一 CLI 入口
- `scripts/lib/buddy-core.js`
  `/buddy` 搜索与校验核心逻辑
- `scripts/lib/config-utils.js`
  本地配置检查与更新逻辑
- `docs/workflows.md`
  OAuth/token/API 路径与 `/buddy` 种子的关系说明
- `docs/source-links.md`
  来源链接与整理边界

## 来源要求

在文档、issue、PR 或 agent 汇报里提到来源时，保留以下原始链接：

1. https://linux.do/t/topic/1871870/22
2. https://linux.do/t/topic/1873901
