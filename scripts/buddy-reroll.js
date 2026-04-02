#!/usr/bin/env node

const {
  BUDDY_CONSTANTS,
  buildFilterSummary,
  formatBuddy,
  searchMatches
} = require("./lib/buddy-core");

function usage() {
  console.log(`Usage: node/bun scripts/buddy-reroll.js [options]

Options:
  --species <name>       ${BUDDY_CONSTANTS.SPECIES.join(", ")}
  --rarity <name>        ${BUDDY_CONSTANTS.RARITIES.join(", ")} (minimum rarity)
  --eye <char>           ${BUDDY_CONSTANTS.EYES.join(" ")}
  --hat <name>           ${BUDDY_CONSTANTS.HATS.join(", ")}
  --shiny                Require shiny
  --min-stats [value]    Require all stats >= value (default: 90)
  --max <number>         Max iterations (default: 50000000)
  --count <number>       Number of results to find (default: 3)
  --check <uid>          Preview one specific userID
  --allow-fallback-hash  Allow Node fallback hash for approximate preview only
  --json                 Output JSON in check mode or search matches
  -h, --help             Show help

Examples:
  bun scripts/buddy-reroll.js --species chonk --rarity legendary --eye "✦" --hat crown --shiny --count 1
  bun scripts/buddy-reroll.js --check 0782ce9914700102a4b6262ae572493a7d348e745cfff9ebd7a19cf7d66babe4
`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    count: 3,
    max: 50_000_000,
    json: false
  };

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
      case "--min-stats": {
        const next = args[i + 1];
        options.minStats = next && !next.startsWith("--") ? Number(args[++i]) : 90;
        break;
      }
      case "--max":
        options.max = Number(args[++i]);
        break;
      case "--count":
        options.count = Number(args[++i]);
        break;
      case "--check":
        options.check = args[++i];
        break;
      case "--allow-fallback-hash":
        options.allowFallbackHash = true;
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

    const result = searchMatches(options, {
      onProgress(progress) {
        if (!options.json) {
          console.error(`searched=${progress.iterations.toLocaleString()} elapsed=${progress.elapsedSeconds}s`);
        }
      }
    });

    if (options.json) {
      console.log(JSON.stringify(options.check ? result.matches[0] : result.matches, null, 2));
      return;
    }

    console.log(`Runtime: ${result.runtimeLabel}${result.exact ? "" : " (approximate only)"}`);
    console.log("");

    if (options.check) {
      console.log(formatBuddy(result.matches[0]));
      return;
    }

    const filters = buildFilterSummary(options);
    console.log(`Searching: ${filters.join(", ") || "any"} | max=${options.max.toLocaleString()} | count=${options.count}`);
    console.log("");

    if (result.matches.length === 0) {
      console.log(`No match found in ${options.max.toLocaleString()} iterations (${result.elapsedSeconds}s)`);
      return;
    }

    result.matches.forEach((match, index) => {
      console.log(`#${index + 1}`);
      console.log(formatBuddy(match));
      console.log("");
    });

    console.log(`Found ${result.matches.length} match(es) in ${result.elapsedSeconds}s`);
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
