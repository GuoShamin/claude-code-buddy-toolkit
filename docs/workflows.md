# 工作流说明

这份说明专门解决一个高频混淆：

- 你“怎么向模型发请求”
- Claude Code “本地怎么认定 `/buddy` 的种子”

这两件事不一定是一回事。

## 一、先判断你当前处于哪种状态

推荐直接运行：

```bash
bun scripts/buddy-toolkit.js doctor
```

如果你是 agent，则优先：

```bash
bun scripts/buddy-toolkit.js doctor --json
```

这个命令会帮你检查：

- `~/.claude.json` 是否存在
- 是否存在 `userID`
- 是否存在 `oauthAccount`
- 是否存在 `companion`
- `~/.claude/settings.json` 里是否配置了自定义 API 路径或 token
- `claude auth status` 当前显示的登录方式

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

这是最简单的情况，推荐直接用统一入口：

```bash
bun scripts/buddy-toolkit.js full \
  --species chonk \
  --rarity legendary \
  --eye "✦" \
  --hat crown \
  --shiny \
  --name "King Pudding"
```

上面这条命令默认只是 dry-run，不会改本地配置。

确认输出结果没问题后，再执行：

```bash
bun scripts/buddy-toolkit.js full \
  --species chonk \
  --rarity legendary \
  --eye "✦" \
  --hat crown \
  --shiny \
  --name "King Pudding" \
  --write
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

说明：

- 本仓库支持显式传入 `--remove-oauth-account`
- 但这一步有实际影响，除非你明确知道自己在做什么，否则不要让 agent 默认帮你移除
- 出于安全考虑，统一入口在检测到 `oauthAccount` 且未显式传入 `--remove-oauth-account` 时，会拒绝 `apply/full --write`

## 四、推荐命令

### 1. 环境检查

```bash
bun scripts/buddy-toolkit.js doctor
```

### 2. 搜索目标宠物

```bash
bun scripts/buddy-toolkit.js search --species chonk --rarity legendary --eye "✦" --hat crown --shiny --count 1
```

### 3. 检查某个指定 `userID`

```bash
bun scripts/buddy-toolkit.js check --check 0782ce9914700102a4b6262ae572493a7d348e745cfff9ebd7a19cf7d66babe4
```

### 4. 只更新配置

```bash
node scripts/buddy-toolkit.js apply \
  --uid <YOUR_UID> \
  --name "King Pudding" \
  --personality "<YOUR_PERSONALITY>"
```

### 5. 结构化 spec 工作流

```bash
bun scripts/buddy-toolkit.js full --spec examples/full-run.spec.json
```

agent 实际使用时，推荐改为：

```bash
bun scripts/buddy-toolkit.js full --spec examples/full-run.spec.json --json
```

## 五、为什么要保留旧脚本

仓库仍然保留了：

- `scripts/buddy-reroll.js`
- `scripts/apply-buddy-config.js`

原因是：

- 方便兼容旧教程与旧命令
- 便于用户单独调用某一层能力
- 统一入口坏了时，仍然有可用的低层命令

但如果你是新用户，优先使用：

- `scripts/buddy-toolkit.js`

## 六、风险提醒

1. 版本一变，`SALT`、字段结构或哈希路径都可能变，脚本需要重新对齐。
2. 不要把带敏感信息的 `~/.claude.json`、`~/.claude/settings.json`、token 或日志直接上传到 GitHub。
3. 搜索结果本质上是概率搜索，条件越复杂越耗时。
4. `--write` 会真正修改本地配置。让 agent 执行前，最好先做一次 dry-run。
5. 这不是官方工作流，请自行评估账户和条款风险。
