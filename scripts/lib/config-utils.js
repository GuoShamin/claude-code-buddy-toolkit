const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const DEFAULT_CONFIG_PATH = "~/.claude.json";
const DEFAULT_SETTINGS_PATH = "~/.claude/settings.json";

function expandHome(inputPath) {
  if (!inputPath) {
    return inputPath;
  }
  if (inputPath === "~") {
    return os.homedir();
  }
  if (inputPath.startsWith("~/")) {
    return path.join(os.homedir(), inputPath.slice(2));
  }
  return inputPath;
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function maskValue(value) {
  if (!value) {
    return null;
  }
  if (value.length <= 12) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function summarizeConfig(config, options = {}) {
  const safeConfig = config || {};
  const includeSensitive = Boolean(options.includeSensitive);
  const userID = safeConfig.userID || null;
  const oauthUuid = safeConfig.oauthAccount && safeConfig.oauthAccount.accountUuid ? safeConfig.oauthAccount.accountUuid : null;

  return {
    companionName: safeConfig.companion && safeConfig.companion.name ? safeConfig.companion.name : null,
    hasCompanion: Boolean(safeConfig.companion),
    hasOAuthAccount: Boolean(safeConfig.oauthAccount),
    hasUserID: Boolean(userID),
    oauthAccountUuid: includeSensitive ? oauthUuid : maskValue(oauthUuid),
    userID: includeSensitive ? userID : maskValue(userID)
  };
}

function summarizeSettings(settings) {
  const env = settings && settings.env ? settings.env : {};
  return {
    hasAnthropicApiKey: Boolean(env.ANTHROPIC_API_KEY),
    hasAnthropicAuthToken: Boolean(env.ANTHROPIC_AUTH_TOKEN),
    hasAnthropicBaseUrl: Boolean(env.ANTHROPIC_BASE_URL),
    hasClaudeCodeDisableExperimentalBetas: Boolean(env.CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS)
  };
}

function summarizeProcessEnv() {
  return {
    hasAnthropicApiKey: Boolean(process.env.ANTHROPIC_API_KEY),
    hasAnthropicAuthToken: Boolean(process.env.ANTHROPIC_AUTH_TOKEN),
    hasAnthropicBaseUrl: Boolean(process.env.ANTHROPIC_BASE_URL),
    hasClaudeCodeOAuthToken: Boolean(process.env.CLAUDE_CODE_OAUTH_TOKEN)
  };
}

function readClaudeAuthStatus() {
  const result = spawnSync("claude", ["auth", "status"], {
    encoding: "utf8"
  });

  if (result.error && result.error.code === "ENOENT") {
    return {
      available: false,
      message: "claude command not found"
    };
  }

  if (result.status !== 0) {
    return {
      available: true,
      message: result.stderr ? result.stderr.trim() : "claude auth status failed"
    };
  }

  try {
    const parsed = JSON.parse(result.stdout);
    return {
      available: true,
      ...parsed
    };
  } catch (error) {
    return {
      available: true,
      message: "Failed to parse `claude auth status` output"
    };
  }
}

function buildRiskFlags(details) {
  const flags = [];
  if (!details.runtime.isBunRuntime) {
    flags.push("run_search_with_bun_for_exact_results");
  }
  if (!details.config.exists) {
    flags.push("claude_config_missing");
  }
  if (details.config.summary.hasOAuthAccount) {
    flags.push("oauth_account_present_may_override_userid");
  }
  if (details.settings.summary.hasAnthropicBaseUrl || details.settings.summary.hasAnthropicAuthToken || details.settings.summary.hasAnthropicApiKey) {
    flags.push("custom_api_provider_configured");
  }
  if (details.processEnv.hasClaudeCodeOAuthToken) {
    flags.push("oauth_token_env_present");
  }
  return flags;
}

function buildRecommendations(details) {
  const recommendations = [];
  if (!details.runtime.isBunRuntime) {
    recommendations.push("用 Bun 运行 search/full 子命令，才能与 Claude Code Native 的 `/buddy` 结果严格对齐。");
  }
  if (details.config.summary.hasOAuthAccount) {
    recommendations.push("检测到 oauthAccount；如果你希望 `/buddy` 严格按 userID 生效，先确认 token 工作流，或显式传入 --remove-oauth-account。");
  }
  if (!details.config.summary.hasUserID) {
    recommendations.push("当前配置中没有 userID；先启动一次 Claude Code，或用 apply/full 子命令写入目标 userID。");
  }
  return recommendations;
}

function inspectLocalState(options = {}) {
  const configPath = expandHome(options.configPath || DEFAULT_CONFIG_PATH);
  const settingsPath = expandHome(options.settingsPath || DEFAULT_SETTINGS_PATH);
  const config = readJsonFile(configPath);
  const settings = readJsonFile(settingsPath);

  const details = {
    claudeAuth: readClaudeAuthStatus(),
    config: {
      exists: Boolean(config),
      path: configPath,
      summary: summarizeConfig(config, { includeSensitive: options.includeSensitive })
    },
    processEnv: summarizeProcessEnv(),
    runtime: {
      bunVersion: typeof Bun !== "undefined" && Bun.version ? Bun.version : null,
      isBunRuntime: typeof Bun !== "undefined" && typeof Bun.hash === "function",
      nodeVersion: process.version
    },
    settings: {
      exists: Boolean(settings),
      path: settingsPath,
      summary: summarizeSettings(settings)
    }
  };

  details.riskFlags = buildRiskFlags(details);
  details.recommendations = buildRecommendations(details);

  return details;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function applyConfigChanges(options = {}) {
  const configPath = expandHome(options.configPath || options.config || DEFAULT_CONFIG_PATH);
  const beforeConfig = readJsonFile(configPath) || {};
  const afterConfig = cloneJson(beforeConfig);
  const changed = {};
  const shouldWrite = !options.dryRun;

  if (options.uid) {
    if (!/^[a-f0-9]{64}$/i.test(options.uid)) {
      throw new Error("--uid must be a 64-char hex string");
    }
    afterConfig.userID = options.uid;
    changed.userID = options.uid;
  }

  if (options.removeOAuthAccount && Object.prototype.hasOwnProperty.call(afterConfig, "oauthAccount")) {
    delete afterConfig.oauthAccount;
    changed.oauthAccount = "removed";
  }

  if (options.removeCompanion) {
    if (Object.prototype.hasOwnProperty.call(afterConfig, "companion")) {
      delete afterConfig.companion;
    }
    changed.companion = "removed";
  } else if (options.name || options.personality || options.hatchedAt !== undefined) {
    const companion = { ...(afterConfig.companion || {}) };
    if (options.name) {
      companion.name = options.name;
    }
    if (options.personality) {
      companion.personality = options.personality;
    }
    if (options.hatchedAt !== undefined) {
      if (!Number.isFinite(Number(options.hatchedAt))) {
        throw new Error("--hatched-at must be a valid number");
      }
      companion.hatchedAt = Number(options.hatchedAt);
    } else if (!companion.hatchedAt) {
      companion.hatchedAt = Date.now();
    }
    afterConfig.companion = companion;
    changed.companion = companion;
  }

  if (Object.keys(changed).length === 0) {
    throw new Error("Nothing to do. Pass at least one mutation flag.");
  }

  let backupPath = null;
  if (shouldWrite && fs.existsSync(configPath)) {
    backupPath = `${configPath}.bak-${timestamp()}`;
    fs.copyFileSync(configPath, backupPath);
  }

  if (shouldWrite) {
    writeJsonFile(configPath, afterConfig);
  }

  return {
    afterSummary: summarizeConfig(afterConfig, { includeSensitive: options.includeSensitive }),
    backupPath,
    beforeSummary: summarizeConfig(beforeConfig, { includeSensitive: options.includeSensitive }),
    changed,
    configPath,
    wrote: shouldWrite
  };
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  DEFAULT_SETTINGS_PATH,
  applyConfigChanges,
  expandHome,
  inspectLocalState,
  readJsonFile,
  summarizeConfig
};
