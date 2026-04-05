#!/usr/bin/env node

const { applyConfigChanges, DEFAULT_CONFIG_PATH } = require("./lib/config-utils");

function usage() {
  console.log(`Usage: node scripts/apply-buddy-config.js [options]

Options:
  --uid <hex>                Write userID
  --name <text>              Set companion name
  --personality <text>       Set companion personality
  --hatched-at <ms>          Override companion hatchedAt
  --config <path>            Config path (default: ${DEFAULT_CONFIG_PATH})
  --remove-oauth-account     Remove oauthAccount from config
  --remove-companion         Remove companion from config
  --dry-run                  Preview without writing
  --json                     Output JSON
  -h, --help                 Show help

Examples:
  node scripts/apply-buddy-config.js --uid <UID> --name "My Buddy" --personality "Calm, curious, and a little dramatic."
  node scripts/apply-buddy-config.js --uid <UID> --remove-oauth-account
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    config: DEFAULT_CONFIG_PATH
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
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--json":
        options.json = true;
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

function main() {
  try {
    const options = parseArgs(process.argv);

    if (options.help) {
      usage();
      process.exit(0);
    }

    const result = applyConfigChanges({
      config: options.config,
      dryRun: Boolean(options.dryRun),
      hatchedAt: options.hatchedAt,
      name: options.name,
      personality: options.personality,
      removeCompanion: options.removeCompanion,
      removeOAuthAccount: options.removeOAuthAccount,
      uid: options.uid
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    if (process.argv.includes("--json")) {
      console.log(JSON.stringify({ error: error.message, ok: false }, null, 2));
      process.exit(1);
    }
    console.error(error.message);
    console.error("");
    usage();
    process.exit(1);
  }
}

main();
