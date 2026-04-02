#!/usr/bin/env node

const crypto = require("crypto");

const SALT = "friend-2026-401";
const SPECIES = [
  "duck",
  "goose",
  "blob",
  "cat",
  "dragon",
  "octopus",
  "owl",
  "penguin",
  "turtle",
  "snail",
  "ghost",
  "axolotl",
  "capybara",
  "cactus",
  "robot",
  "rabbit",
  "mushroom",
  "chonk"
];
const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
const RARITY_WEIGHTS = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1
};
const RARITY_RANK = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4
};
const EYES = ["·", "✦", "×", "◉", "@", "°"];
const HATS = ["none", "crown", "tophat", "propeller", "halo", "wizard", "beanie", "tinyduck"];
const STAT_NAMES = ["DEBUGGING", "PATIENCE", "CHAOS", "WISDOM", "SNARK"];
const RARITY_FLOOR = {
  common: 5,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50
};
const RARITY_STARS = {
  common: "★",
  uncommon: "★★",
  rare: "★★★",
  epic: "★★★★",
  legendary: "★★★★★"
};

function usage() {
  console.log(`Usage: node/bun scripts/buddy-reroll.js [options]

Options:
  --species <name>       ${SPECIES.join(", ")}
  --rarity <name>        ${RARITIES.join(", ")} (minimum rarity)
  --eye <char>           ${EYES.join(" ")}
  --hat <name>           ${HATS.join(", ")}
  --shiny                Require shiny
  --min-stats [value]    Require all stats >= value (default: 90)
  --max <number>         Max iterations (default: 50000000)
  --count <number>       Number of results to find (default: 3)
  --check <uid>          Preview one specific userID
  --json                 Output JSON in check mode or search matches
  -h, --help             Show help

Examples:
  bun scripts/buddy-reroll.js --species chonk --rarity legendary --eye "✦" --hat crown --shiny --count 1
  bun scripts/buddy-reroll.js --check 0782ce9914700102a4b6262ae572493a7d348e745cfff9ebd7a19cf7d66babe4
`);
}

function hashFNV1a(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashBun(input) {
  return Number(BigInt(Bun.hash(input)) & 0xffffffffn);
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return function next() {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let temp = Math.imul(value ^ (value >>> 15), 1 | value);
    temp = (temp + Math.imul(temp ^ (temp >>> 7), 61 | temp)) ^ temp;
    return ((temp ^ (temp >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(rng, values) {
  return values[Math.floor(rng() * values.length)];
}

function rollRarity(rng) {
  let roll = rng() * 100;
  for (const rarity of RARITIES) {
    roll -= RARITY_WEIGHTS[rarity];
    if (roll < 0) {
      return rarity;
    }
  }
  return "common";
}

function rollStats(rng, rarity) {
  const floor = RARITY_FLOOR[rarity];
  const peak = pick(rng, STAT_NAMES);
  let dump = pick(rng, STAT_NAMES);

  while (dump === peak) {
    dump = pick(rng, STAT_NAMES);
  }

  const stats = {};
  for (const name of STAT_NAMES) {
    if (name === peak) {
      stats[name] = Math.min(100, floor + 50 + Math.floor(rng() * 30));
    } else if (name === dump) {
      stats[name] = Math.max(1, floor - 10 + Math.floor(rng() * 15));
    } else {
      stats[name] = floor + Math.floor(rng() * 40);
    }
  }

  return stats;
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

function validateOptions(options) {
  if (options.species && !SPECIES.includes(options.species)) {
    throw new Error(`Unknown species: ${options.species}`);
  }
  if (options.rarity && !RARITIES.includes(options.rarity)) {
    throw new Error(`Unknown rarity: ${options.rarity}`);
  }
  if (options.eye && !EYES.includes(options.eye)) {
    throw new Error(`Unknown eye: ${options.eye}`);
  }
  if (options.hat && !HATS.includes(options.hat)) {
    throw new Error(`Unknown hat: ${options.hat}`);
  }
  if (options.max && (!Number.isFinite(options.max) || options.max <= 0)) {
    throw new Error("--max must be a positive number");
  }
  if (options.count && (!Number.isFinite(options.count) || options.count <= 0)) {
    throw new Error("--count must be a positive number");
  }
  if (options.minStats !== undefined && (!Number.isFinite(options.minStats) || options.minStats < 1)) {
    throw new Error("--min-stats must be a positive number");
  }
}

function createRoller(hashFn) {
  return function roll(uid) {
    const rng = mulberry32(hashFn(uid + SALT));
    const rarity = rollRarity(rng);
    const species = pick(rng, SPECIES);
    const eye = pick(rng, EYES);
    const hat = rarity === "common" ? "none" : pick(rng, HATS);
    const shiny = rng() < 0.01;
    const stats = rollStats(rng, rarity);

    return {
      uid,
      rarity,
      species,
      eye,
      hat,
      shiny,
      stats
    };
  };
}

function formatBuddy(result) {
  const lines = [
    `uid     : ${result.uid}`,
    `species : ${result.species}`,
    `rarity  : ${result.rarity} ${RARITY_STARS[result.rarity]}`,
    `eye     : ${result.eye}`,
    `hat     : ${result.hat}`,
    `shiny   : ${result.shiny}`
  ];

  for (const name of STAT_NAMES) {
    const value = result.stats[name];
    const bar = "█".repeat(Math.floor(value / 5)) + "░".repeat(20 - Math.floor(value / 5));
    lines.push(`${name.padEnd(10)} ${bar} ${value}`);
  }

  return lines.join("\n");
}

function matchFilters(result, options) {
  if (options.rarity && RARITY_RANK[result.rarity] < RARITY_RANK[options.rarity]) {
    return false;
  }
  if (options.species && result.species !== options.species) {
    return false;
  }
  if (options.eye && result.eye !== options.eye) {
    return false;
  }
  if (options.hat && result.hat !== options.hat) {
    return false;
  }
  if (options.shiny && !result.shiny) {
    return false;
  }
  if (options.minStats !== undefined && !Object.values(result.stats).every((value) => value >= options.minStats)) {
    return false;
  }
  return true;
}

function main() {
  try {
    const options = parseArgs(process.argv);

    if (options.help) {
      usage();
      process.exit(0);
    }

    validateOptions(options);

    const isBun = typeof Bun !== "undefined" && typeof Bun.hash === "function";
    const runtime = isBun ? "bun (Bun.hash)" : "node (FNV-1a fallback)";
    const hashFn = isBun ? hashBun : hashFNV1a;
    const roll = createRoller(hashFn);

    if (options.check) {
      const result = roll(options.check);
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Runtime: ${runtime}`);
        console.log("");
        console.log(formatBuddy(result));
      }
      return;
    }

    const filters = [];
    if (options.species) {
      filters.push(`species=${options.species}`);
    }
    if (options.rarity) {
      filters.push(`rarity>=${options.rarity}`);
    }
    if (options.eye) {
      filters.push(`eye=${options.eye}`);
    }
    if (options.hat) {
      filters.push(`hat=${options.hat}`);
    }
    if (options.shiny) {
      filters.push("shiny=true");
    }
    if (options.minStats !== undefined) {
      filters.push(`all-stats>=${options.minStats}`);
    }

    if (!options.json) {
      console.log(`Runtime: ${runtime}${isBun ? "" : " (results will NOT match Claude Code Native exactly)"}`);
      console.log(`Searching: ${filters.join(", ") || "any"} | max=${options.max.toLocaleString()} | count=${options.count}`);
      console.log("");
    }

    const matches = [];
    const startedAt = Date.now();

    for (let i = 1; i <= options.max; i += 1) {
      const uid = crypto.randomBytes(32).toString("hex");
      const result = roll(uid);

      if (!matchFilters(result, options)) {
        if (!options.json && i % 5_000_000 === 0) {
          const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
          console.error(`searched=${i.toLocaleString()} elapsed=${elapsed}s`);
        }
        continue;
      }

      matches.push(result);

      if (!options.json) {
        console.log(`#${matches.length}`);
        console.log(formatBuddy(result));
        console.log("");
      }

      if (matches.length >= options.count) {
        break;
      }
    }

    if (options.json) {
      console.log(JSON.stringify(matches, null, 2));
      return;
    }

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`Found ${matches.length} match(es) in ${elapsed}s`);
  } catch (error) {
    console.error(error.message);
    console.error("");
    usage();
    process.exit(1);
  }
}

main();
