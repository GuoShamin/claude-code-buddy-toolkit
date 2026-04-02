# 工作流说明

这份说明专门解决一个常见混淆：

- 你“怎么向模型发请求”
- Claude Code “本地怎么认定 `/buddy` 的种子”

这两件事不一定是一回事。

## 一、先判断你当前处于哪种状态

### 1. 看 Claude CLI 的登录状态

```bash
claude auth status
```

### 2. 看本地配置里有没有 `oauthAccount`

```bash
rg -n '"userID"|"oauthAccount"|"companion"' ~/.claude.json
```

如果 `~/.claude.json` 里仍然有 `oauthAccount`，则 `/buddy` 可能优先使用 `accountUuid` 而不是 `userID`。

## 二、为什么“我明明走 API/token 了”，宠物还是不按 `userID` 来

一些用户会在 `~/.claude/settings.json` 里配置：

- `ANTHROPIC_BASE_URL`
- `ANTHROPIC_AUTH_TOKEN`

这只代表“模型请求”走了自定义接口或 token。

但 `/buddy` 用哪个种子，还要看 Claude Code 本地配置里是不是有：

```json
"oauthAccount": {
  "accountUuid": "..."
}
```

如果这个字段存在，`/buddy` 仍然可能优先读取 `accountUuid`。

## 三、推荐流程

### 场景 A：`~/.claude.json` 里没有 `oauthAccount`

这是最简单的情况：

1. 用 Bun 搜索目标 `userID`
2. 写入 `~/.claude.json`
3. 如有需要，修改 `companion.name` / `companion.personality`
4. 重启 Claude Code
5. 执行 `/buddy`

命令示例：

```bash
bun scripts/buddy-reroll.js --species chonk --rarity legendary --eye "✦" --hat crown --shiny --count 1
node scripts/apply-buddy-config.js --uid <YOUR_UID> --name "King Pudding" --personality "<YOUR_PERSONALITY>"
```

### 场景 B：`~/.claude.json` 里有 `oauthAccount`

参考来源贴给出的思路，推荐顺序如下：

1. 获取长期 token

```bash
claude setup-token
```

2. 备份并临时重建最小化 `~/.claude.json`

```json
{
  "hasCompletedOnboarding": true,
  "theme": "dark"
}
```

3. 设置环境变量 `CLAUDE_CODE_OAUTH_TOKEN`
4. 启动 `claude`，让其重新生成配置
5. 确认生成后的 `~/.claude.json` 不再包含 `oauthAccount`
6. 再用本仓库脚本写入目标 `userID`
7. 重启 Claude Code 后执行 `/buddy`

## 四、配置脚本说明

### 搜索脚本

```bash
bun scripts/buddy-reroll.js --help
```

支持的核心筛选项：

- `--species`
- `--rarity`
- `--eye`
- `--hat`
- `--shiny`
- `--min-stats`
- `--count`
- `--check`

### 配置脚本

```bash
node scripts/apply-buddy-config.js --help
```

支持的核心操作：

- 写入 `userID`
- 写入名字和性格
- 删除 `oauthAccount`
- 删除 `companion`
- 自动备份原始配置

## 五、风险提醒

1. 版本一变，`SALT`、字段结构或哈希路径都可能变，脚本需要重新对齐。
2. 不要把带敏感信息的 `~/.claude.json` 直接上传到 GitHub。
3. 搜索结果本质上是概率搜索，条件越复杂越耗时。
4. 这不是官方工作流，请自行评估账户和条款风险。
