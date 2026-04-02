#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

function usage() {
  console.log(`Usage: node scripts/apply-buddy-config.js [options]

Options:
  --uid <hex>                Write userID
  --name <text>              Set companion name
  --personality <text>       Set companion personality
  --hatched-at <ms>          Override companion hatchedAt
  --config <path>            Config path (default: ~/.claude.json)
  --remove-oauth-account     Remove oauthAccount from config
  --remove-companion         Remove companion from config
  -h, --help                 Show help

Examples:
  node scripts/apply-buddy-config.js --uid <UID> --name "King Pudding" --personality "..."
  node scripts/apply-buddy-config.js --uid <UID> --remove-oauth-account
`);
}

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

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    config: "~/.claude.json"
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
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
      case "--remove-oauth-account":
        options.removeOAuthAccount = true;
        break;
      case "--remove-companion":
        options.removeCompanion = true;
        break;
      case "-h":
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function validate(options) {
  if (options.uid && !/^[a-f0-9]{64}$/i.test(options.uid)) {
    throw new Error("--uid must be a 64-char hex string");
  }
  if (options.hatchedAt !== undefined && !Number.isFinite(options.hatchedAt)) {
    throw new Error("--hatched-at must be a valid number");
  }

  const hasWork =
    Boolean(options.uid) ||
    Boolean(options.name) ||
    Boolean(options.personality) ||
    options.hatchedAt !== undefined ||
    Boolean(options.removeOAuthAccount) ||
    Boolean(options.removeCompanion);

  if (!hasWork && !options.help) {
    throw new Error("Nothing to do. Pass at least one mutation flag.");
  }
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function main() {
  try {
    const options = parseArgs(process.argv);

    if (options.help) {
      usage();
      process.exit(0);
    }

    validate(options);

    const configPath = expandHome(options.config);
    const config = readJson(configPath);
    let backupPath = null;

    if (fs.existsSync(configPath)) {
      backupPath = `${configPath}.bak-${timestamp()}`;
      fs.copyFileSync(configPath, backupPath);
    }

    const changed = {};

    if (options.uid) {
      config.userID = options.uid;
      changed.userID = options.uid;
    }

    if (options.removeOAuthAccount && Object.prototype.hasOwnProperty.call(config, "oauthAccount")) {
      delete config.oauthAccount;
      changed.oauthAccount = "removed";
    }

    if (options.removeCompanion) {
      if (Object.prototype.hasOwnProperty.call(config, "companion")) {
        delete config.companion;
      }
      changed.companion = "removed";
    } else if (options.name || options.personality || options.hatchedAt !== undefined) {
      const companion = { ...(config.companion || {}) };
      if (options.name) {
        companion.name = options.name;
      }
      if (options.personality) {
        companion.personality = options.personality;
      }
      if (options.hatchedAt !== undefined) {
        companion.hatchedAt = options.hatchedAt;
      } else if (!companion.hatchedAt) {
        companion.hatchedAt = Date.now();
      }
      config.companion = companion;
      changed.companion = companion;
    }

    fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

    const result = {
      configPath,
      backupPath,
      changed
    };

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.message);
    console.error("");
    usage();
    process.exit(1);
  }
}

main();
