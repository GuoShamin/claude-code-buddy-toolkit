# 来源链接与说明

本仓库基于公开社区讨论做工程化整理，以下两篇是明确引用的来源：

## 1. Claude Code /buddy 宠物系统逆向分析 —— 如何重置并刷到你想要的宠物

- 原文链接：[https://linux.do/t/topic/1871870/22](https://linux.do/t/topic/1871870/22)
- 主要贡献：
  - `/buddy` 的外观、物种、稀有度、属性由 `hash(userID + SALT)` 决定
  - Native 版本应按 `Bun.hash()` 思路匹配，而不是直接用 Node.js fallback 结果
  - 可通过重置或定向搜索 `userID` 来控制宠物结果

## 2. Claude Oauth登录刷 /buddy 宠物的方法找到了

- 原文链接：[https://linux.do/t/topic/1873901](https://linux.do/t/topic/1873901)
- 主要贡献：
  - 解释了 `oauthAccount.accountUuid` 可能覆盖 `userID`
  - 给出了 `claude setup-token` + `CLAUDE_CODE_OAUTH_TOKEN` 路径下，重新生成不带 `oauthAccount` 的 `~/.claude.json` 的思路

## 本仓库做了什么

- 把搜索逻辑整理成可直接运行的 CLI 脚本
- 把配置修改封装成会自动备份的本地脚本
- 把 API/token 调用路径 与 `/buddy` 本地种子来源 的差异单独写成说明，减少误判
- 把来源链接写清楚，方便后续追溯和版本校对

## 声明

- 以上来源均为社区逆向分析结果，不是官方说明
- 本仓库不搬运完整原文，只保留必要来源链接与工程化整理
