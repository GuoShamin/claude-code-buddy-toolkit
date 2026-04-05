#!/usr/bin/env node

const fs = require("fs");

const {
  BUDDY_CONSTANTS,
  buildFilterSummary,
  formatBuddy,
  isBunRuntime,
  searchMatches,
  validateSearchOptions
} = require("./lib/buddy-core");
const {
  DEFAULT_CONFIG_PATH,
  DEFAULT_SETTINGS_PATH,
  applyConfigChanges,
  expandHome,
  inspectLocalState,
  readJsonFile
} = require("./lib/config-utils");

function usage() {
  console.log(`Claude Code Buddy Toolkit

Usage:
  bun scripts/buddy-toolkit.js <command> [options]
  node scripts/buddy-toolkit.js doctor [options]
  node scripts/buddy-toolkit.js apply [options]

Commands:
  init-spec  Create a personal spec template instead of reusing the repo author's sample
  doctor    Inspect local Claude/Buddy state and highlight risks
  search    Search matching buddy results
  check     Inspect one specific userID
  apply     Backup and update ~/.claude.json
  full      Search + optional write in one flow

Common options:
  --json                 Output machine-readable JSON
  --spec <path>          Load a JSON spec file. CLI flags override spec fields.
  --config <path>        Override Claude config path (default: ${DEFAULT_CONFIG_PATH})
  --settings <path>      Override Claude settings path (default: ${DEFAULT_SETTINGS_PATH})
  --include-sensitive    Show full IDs in doctor/apply JSON instead of masked values
  --output <path>        Output path for init-spec
  --force                Overwrite init-spec output if it already exists
  -h, --help             Show help

Search options:
  --species <name>       ${BUDDY_CONSTANTS.SPECIES.join(", ")}
  --rarity <name>        ${BUDDY_CONSTANTS.RARITIES.join(", ")} (minimum rarity)
  --eye <char>           ${BUDDY_CONSTANTS.EYES.join(" ")}
  --hat <name>           ${BUDDY_CONSTANTS.HATS.join(", ")}
  --shiny                Require shiny
  --min-stats <value>    Require all stats >= value
  --max <number>         Max iterations (default: 50000000)
  --count <number>       Result count (default: 3)
  --allow-fallback-hash  Allow Node fallback hash for approximate preview only

Apply options:
  --uid <hex>                Write userID
  --name <text>              Set companion name
  --personality <text>       Set companion personality
  --hatched-at <ms>          Override companion hatchedAt
  --remove-oauth-account     Remove oauthAccount
  --remove-companion         Remove companion
  --dry-run                  Preview changes without writing
  --write                    In full mode, actually write to config

Examples:
  node scripts/buddy-toolkit.js init-spec --output my-buddy.spec.json
  bun scripts/buddy-toolkit.js doctor
  bun scripts/buddy-toolkit.js search --species duck --rarity epic --count 1
  bun scripts/buddy-toolkit.js full --species dragon --rarity rare --name "My Buddy" --personality "Calm, curious, and a little dramatic." --write
  bun scripts/buddy-toolkit.js full --spec my-buddy.spec.json --write --json
`);
}

function parseArgs(argv) {
  const command = argv[2];
  const args = argv.slice(3);
  const options = {};

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--species":
        options.species = args[++i];
        break;
      case "--rarity":
        options.rarity = args[++i];
        break;
      case "--eye":
        options.eye = args[++i];
        break;
      case "--hat":
        options.hat = args[++i];
        break;
      case "--shiny":
        options.shiny = true;
        break;
      case "--min-stats":
        options.minStats = Number(args[++i]);
        break;
      case "--max":
        options.max = Number(args[++i]);
        break;
      case "--count":
        options.count = Number(args[++i]);
        break;
      case "--check":
        options.check = args[++i];
        break;
      case "--uid":
        options.uid = args[++i];
        break;
      case "--name":
        options.name = args[++i];
        break;
      case "--personality":
        options.personality = args[++i];
        break;
      case "--hatched-at":
        options.hatchedAt = Number(args[++i]);
        break;
      case "--config":
        options.config = args[++i];
        break;
      case "--settings":
        options.settings = args[++i];
        break;
      case "--spec":
        options.spec = args[++i];
        break;
      case "--output":
        options.output = args[++i];
        break;
      case "--json":
        options.json = true;
        break;
      case "--include-sensitive":
        options.includeSensitive = true;
        break;
      case "--force":
        options.force = true;
        break;
      case "--allow-fallback-hash":
        options.allowFallbackHash = true;
        break;
      case "--remove-oauth-account":
        options.removeOAuthAccount = true;
        break;
      case "--remove-companion":
        options.removeCompanion = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--write":
        options.write = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { command, options };
}

function definedEntries(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, entry]) => entry !== undefined));
}

function loadSpec(specPath) {
  if (!specPath) {
    return {};
  }
  const resolved = expandHome(specPath);
  const spec = readJsonFile(resolved);
  if (!spec) {
    throw new Error(`Spec file not found: ${resolved}`);
  }
  return spec;
}

function mergeSpecOptions(cliOptions) {
  const spec = loadSpec(cliOptions.spec);
  const specOptions = definedEntries({
    ...(spec.search || {}),
    ...(spec.apply || {}),
    ...spec
  });
  delete specOptions.search;
  delete specOptions.apply;

  return {
    ...specOptions,
    ...definedEntries(cliOptions)
  };
}

function isPlaceholderString(value) {
  return typeof value === "string" && /^<.+>$/.test(value.trim());
}

function assertNoTemplatePlaceholders(options, fields) {
  const placeholderFields = fields.filter((field) => isPlaceholderString(options[field]));
  if (placeholderFields.length > 0) {
    throw new Error(`Spec 里还有未替换的模板占位符：${placeholderFields.join(", ")}。请先运行 init-spec 生成你的文件并改成自己的目标值。`);
  }
}

function buildPersonalSpecTemplate(options = {}) {
  const search = {
    species: options.species || "<required: choose one species>",
    rarity: options.rarity || "<optional: common|uncommon|rare|epic|legendary>",
    eye: options.eye || "",
    hat: options.hat || "",
    shiny: Boolean(options.shiny),
    count: Number.isFinite(options.count) ? options.count : 1,
    max: Number.isFinite(options.max) ? options.max : 50000000
  };

  const apply = {
    name: options.name || "<required: choose your own buddy name>",
    personality: options.personality || "<required: write your own buddy personality>",
    removeOAuthAccount: Boolean(options.removeOAuthAccount)
  };

  return {
    search,
    apply,
    write: false
  };
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printDoctorHuman(details) {
  console.log("Local State");
  console.log(`- runtime: ${details.runtime.isBunRuntime ? `bun ${details.runtime.bunVersion}` : `node ${details.runtime.nodeVersion}`}`);
  console.log(`- config path: ${details.config.path}`);
  console.log(`- config exists: ${details.config.exists}`);
  console.log(`- userID: ${details.config.summary.userID || "none"}`);
  console.log(`- oauthAccount: ${details.config.summary.hasOAuthAccount ? "present" : "absent"}`);
  console.log(`- companion: ${details.config.summary.hasCompanion ? `present (${details.config.summary.companionName || "unnamed"})` : "absent"}`);
  console.log(`- settings path: ${details.settings.path}`);
  console.log(`- settings has ANTHROPIC_BASE_URL: ${details.settings.summary.hasAnthropicBaseUrl}`);
  console.log(`- settings has ANTHROPIC_AUTH_TOKEN: ${details.settings.summary.hasAnthropicAuthToken}`);
  console.log(`- settings has ANTHROPIC_API_KEY: ${details.settings.summary.hasAnthropicApiKey}`);
  console.log(`- env has CLAUDE_CODE_OAUTH_TOKEN: ${details.processEnv.hasClaudeCodeOAuthToken}`);

  if (details.claudeAuth.available) {
    const authMethod = details.claudeAuth.authMethod || "unknown";
    const apiProvider = details.claudeAuth.apiProvider || "unknown";
    const loggedIn = details.claudeAuth.loggedIn === undefined ? "unknown" : String(details.claudeAuth.loggedIn);
    console.log(`- claude auth: loggedIn=${loggedIn}, authMethod=${authMethod}, apiProvider=${apiProvider}`);
  } else {
    console.log(`- claude auth: unavailable (${details.claudeAuth.message})`);
  }

  console.log("");
  console.log("Risk Flags");
  if (details.riskFlags.length === 0) {
    console.log("- none");
  } else {
    for (const flag of details.riskFlags) {
      console.log(`- ${flag}`);
    }
  }

  console.log("");
  console.log("Recommended Next Steps");
  if (details.recommendations.length === 0) {
    console.log("- 状态正常，可以继续搜索或应用目标宠物。");
  } else {
    for (const recommendation of details.recommendations) {
      console.log(`- ${recommendation}`);
    }
  }
}

function printSearchHuman(searchOptions, result) {
  const filterSummary = buildFilterSummary(searchOptions);
  console.log(`Runtime: ${result.runtimeLabel}${result.exact ? "" : " (approximate only)"}`);
  if (searchOptions.check) {
    console.log("");
    console.log(formatBuddy(result.matches[0]));
    return;
  }

  console.log(`Searching: ${filterSummary.join(", ") || "any"} | max=${searchOptions.max.toLocaleString()} | count=${searchOptions.count}`);
  console.log("");

  if (result.matches.length === 0) {
    console.log(`No match found in ${searchOptions.max.toLocaleString()} iterations (${result.elapsedSeconds}s)`);
    return;
  }

  result.matches.forEach((match, index) => {
    console.log(`#${index + 1}`);
    console.log(formatBuddy(match));
    console.log("");
  });

  console.log(`Found ${result.matches.length} match(es) in ${result.elapsedSeconds}s`);
}

function printApplyHuman(result) {
  console.log(result.wrote ? "Config Updated" : "Dry Run");
  console.log(`- config path: ${result.configPath}`);
  console.log(`- backup path: ${result.backupPath || "not written"}`);
  console.log(`- userID before: ${result.beforeSummary.userID || "none"}`);
  console.log(`- userID after: ${result.afterSummary.userID || "none"}`);
  console.log(`- oauthAccount after: ${result.afterSummary.hasOAuthAccount ? "present" : "absent"}`);
  console.log(`- companion after: ${result.afterSummary.hasCompanion ? `present (${result.afterSummary.companionName || "unnamed"})` : "absent"}`);
}

function buildFullOutput(searchOptions, details, searchResult, applyResult, warnings) {
  const nextSteps = [];
  if (applyResult && applyResult.wrote) {
    nextSteps.push("完全退出 Claude Code 后重新打开。");
    nextSteps.push("启动后执行 `/buddy`。");
  } else {
    nextSteps.push("确认输出结果后，重新加上 `--write` 执行 full 命令，或使用 apply 子命令落配置。");
  }
  if (details.config.summary.hasOAuthAccount && !searchOptions.removeOAuthAccount) {
    nextSteps.push("当前仍检测到 oauthAccount；如果 `/buddy` 没按新 userID 生效，先阅读 docs/workflows.md 再决定是否移除。");
  }

  return {
    applyResult,
    doctorSummary: details,
    matchedBuddy: searchResult.matches[0] || null,
    nextSteps,
    runtimeLabel: searchResult.runtimeLabel,
    warnings
  };
}

function printFullHuman(output) {
  if (!output.matchedBuddy) {
    console.log("未找到匹配结果。");
    return;
  }

  console.log(`Runtime: ${output.runtimeLabel}`);
  console.log("");
  console.log("Matched Buddy");
  console.log(formatBuddy(output.matchedBuddy));

  if (output.warnings.length > 0) {
    console.log("");
    console.log("Warnings");
    output.warnings.forEach((warning) => console.log(`- ${warning}`));
  }

  console.log("");
  if (output.applyResult) {
    printApplyHuman(output.applyResult);
  } else {
    console.log("Dry Run");
    console.log("- 未执行写入。使用 --write 可把搜索到的 userID 落到本地配置。");
  }

  console.log("");
  console.log("Next Steps");
  output.nextSteps.forEach((step) => console.log(`- ${step}`));
}

function commandDoctor(options) {
  const details = inspectLocalState({
    configPath: options.config,
    includeSensitive: options.includeSensitive,
    settingsPath: options.settings
  });

  if (options.json) {
    printJson(details);
    return;
  }

  printDoctorHuman(details);
}

function commandSearch(options) {
  assertNoTemplatePlaceholders(options, ["species", "rarity", "eye", "hat"]);
  const searchOptions = {
    allowFallbackHash: options.allowFallbackHash,
    check: options.check,
    count: options.count,
    eye: options.eye,
    hat: options.hat,
    json: options.json,
    max: options.max,
    minStats: options.minStats,
    rarity: options.rarity,
    shiny: options.shiny,
    species: options.species
  };

  validateSearchOptions({
    allowFallbackHash: Boolean(searchOptions.allowFallbackHash),
    check: searchOptions.check,
    count: searchOptions.count === undefined ? 3 : searchOptions.count,
    eye: searchOptions.eye,
    hat: searchOptions.hat,
    max: searchOptions.max === undefined ? 50_000_000 : searchOptions.max,
    minStats: searchOptions.minStats,
    rarity: searchOptions.rarity,
    shiny: Boolean(searchOptions.shiny),
    species: searchOptions.species
  });

  const result = searchMatches(searchOptions, {
    onProgress(progress) {
      if (!options.json) {
        console.error(`searched=${progress.iterations.toLocaleString()} elapsed=${progress.elapsedSeconds}s`);
      }
    }
  });

  if (options.json) {
    printJson({
      ...result,
      filters: buildFilterSummary(searchOptions)
    });
    return;
  }

  printSearchHuman(
    {
      ...searchOptions,
      count: searchOptions.count === undefined ? 3 : searchOptions.count,
      max: searchOptions.max === undefined ? 50_000_000 : searchOptions.max
    },
    result
  );
}

function commandApply(options) {
  assertNoTemplatePlaceholders(options, ["uid", "name", "personality"]);
  const localState = inspectLocalState({
    configPath: options.config,
    includeSensitive: options.includeSensitive,
    settingsPath: options.settings
  });
  if (!options.dryRun && options.uid && localState.config.summary.hasOAuthAccount && !options.removeOAuthAccount) {
    throw new Error("检测到 oauthAccount。若直接写入 userID，`/buddy` 仍可能优先读取 accountUuid。请先阅读 docs/workflows.md，或显式传入 --remove-oauth-account。");
  }

  const result = applyConfigChanges({
    config: options.config,
    dryRun: Boolean(options.dryRun),
    hatchedAt: options.hatchedAt,
    includeSensitive: options.includeSensitive,
    name: options.name,
    personality: options.personality,
    removeCompanion: options.removeCompanion,
    removeOAuthAccount: options.removeOAuthAccount,
    uid: options.uid
  });

  if (options.json) {
    printJson(result);
    return;
  }

  printApplyHuman(result);
}

function commandFull(options) {
  assertNoTemplatePlaceholders(options, ["species", "rarity", "eye", "hat", "name", "personality"]);
  const doctorSummary = inspectLocalState({
    configPath: options.config,
    includeSensitive: options.includeSensitive,
    settingsPath: options.settings
  });

  const searchOptions = {
    allowFallbackHash: options.allowFallbackHash,
    count: 1,
    eye: options.eye,
    hat: options.hat,
    max: options.max,
    minStats: options.minStats,
    rarity: options.rarity,
    removeOAuthAccount: options.removeOAuthAccount,
    shiny: options.shiny,
    species: options.species
  };

  const warnings = [];
  if (doctorSummary.config.summary.hasOAuthAccount && !options.removeOAuthAccount) {
    warnings.push("检测到 oauthAccount；即便写入了新 userID，`/buddy` 仍可能优先读取 accountUuid。");
  }
  if (!isBunRuntime() && !options.allowFallbackHash) {
    throw new Error("full 子命令默认要求 Bun 精确哈希。请改用 `bun scripts/buddy-toolkit.js full ...`。");
  }

  const searchResult = searchMatches(searchOptions, {
    onProgress(progress) {
      if (!options.json) {
        console.error(`searched=${progress.iterations.toLocaleString()} elapsed=${progress.elapsedSeconds}s`);
      }
    }
  });

  if (searchResult.matches.length === 0) {
    const output = buildFullOutput(searchOptions, doctorSummary, searchResult, null, warnings);
    if (options.json) {
      printJson(output);
      return;
    }
    printFullHuman(output);
    return;
  }

  const matchedBuddy = searchResult.matches[0];
  const shouldWrite = Boolean(options.write) && !options.dryRun;
  if (shouldWrite && doctorSummary.config.summary.hasOAuthAccount && !options.removeOAuthAccount) {
    throw new Error("检测到 oauthAccount。为避免写入后 `/buddy` 仍不按新 userID 生效，full --write 默认拒绝执行。请先阅读 docs/workflows.md，或显式传入 --remove-oauth-account。");
  }
  const applyResult = applyConfigChanges({
    config: options.config,
    dryRun: !shouldWrite,
    hatchedAt: options.hatchedAt,
    includeSensitive: options.includeSensitive,
    name: options.name,
    personality: options.personality,
    removeCompanion: options.removeCompanion,
    removeOAuthAccount: options.removeOAuthAccount,
    uid: matchedBuddy.uid
  });

  const output = buildFullOutput(searchOptions, doctorSummary, searchResult, applyResult, warnings);

  if (options.json) {
    printJson(output);
    return;
  }

  printFullHuman(output);
}

function commandInitSpec(options) {
  const outputPath = expandHome(options.output || "my-buddy.spec.json");
  if (!options.force && fs.existsSync(outputPath)) {
    throw new Error(`输出文件已存在：${outputPath}。如需覆盖，请追加 --force。`);
  }

  const template = buildPersonalSpecTemplate(options);
  fs.writeFileSync(outputPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");

  const result = {
    ok: true,
    outputPath,
    template,
    nextSteps: [
      "编辑这个 spec 文件，把占位符替换成你自己的物种、稀有度、名字和 personality。",
      "先运行 `bun scripts/buddy-toolkit.js full --spec <your-spec>` 做 dry-run。",
      "确认结果后，再追加 `--write` 真正写入本地配置。"
    ]
  };

  if (options.json) {
    printJson(result);
    return;
  }

  console.log("Spec Template Created");
  console.log(`- output: ${outputPath}`);
  console.log("- next: 先编辑占位符，再用 full --spec 执行 dry-run");
}

function main() {
  try {
    const parsed = parseArgs(process.argv);
    const command = parsed.command;

    if (!command || command === "help" || parsed.options.help) {
      usage();
      process.exit(0);
    }

    const options = mergeSpecOptions(parsed.options);

    switch (command) {
      case "init-spec":
        commandInitSpec(options);
        break;
      case "doctor":
        commandDoctor(options);
        break;
      case "search":
        commandSearch(options);
        break;
      case "check":
        commandSearch({ ...options, check: options.check || options.uid });
        break;
      case "apply":
        commandApply(options);
        break;
      case "full":
        commandFull(options);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    if (process.argv.includes("--json")) {
      printJson({
        error: error.message,
        ok: false
      });
      process.exit(1);
    }
    console.error(error.message);
    console.error("");
    usage();
    process.exit(1);
  }
}

main();
