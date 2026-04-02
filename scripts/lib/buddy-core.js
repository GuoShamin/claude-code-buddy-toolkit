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

function isBunRuntime() {
  return typeof Bun !== "undefined" && typeof Bun.hash === "function";
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

function getHashContext(options = {}) {
  if (isBunRuntime()) {
    return {
      exact: true,
      hashFn: hashBun,
      runtimeLabel: "bun (Bun.hash)"
    };
  }

  if (!options.allowFallbackHash) {
    throw new Error(
      "精确搜索 Claude Code Native `/buddy` 结果需要 Bun。请使用 `bun ...` 运行，或显式传入 `--allow-fallback-hash` 仅做近似预览。"
    );
  }

  return {
    exact: false,
    hashFn: hashFNV1a,
    runtimeLabel: "node (FNV-1a fallback)"
  };
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

function normalizeSearchOptions(options = {}) {
  return {
    allowFallbackHash: Boolean(options.allowFallbackHash),
    check: options.check,
    count: options.count === undefined ? 3 : Number(options.count),
    eye: options.eye,
    hat: options.hat,
    json: Boolean(options.json),
    max: options.max === undefined ? 50_000_000 : Number(options.max),
    minStats: options.minStats === undefined ? undefined : Number(options.minStats),
    rarity: options.rarity,
    shiny: Boolean(options.shiny),
    species: options.species
  };
}

function validateSearchOptions(options) {
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
  if (options.check && !/^[a-f0-9]{64}$/i.test(options.check)) {
    throw new Error("--check expects a 64-char hex string");
  }
  if (!Number.isFinite(options.max) || options.max <= 0) {
    throw new Error("--max must be a positive number");
  }
  if (!Number.isFinite(options.count) || options.count <= 0) {
    throw new Error("--count must be a positive number");
  }
  if (options.minStats !== undefined && (!Number.isFinite(options.minStats) || options.minStats < 1)) {
    throw new Error("--min-stats must be a positive number");
  }
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

function buildFilterSummary(options) {
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
  return filters;
}

function rollBuddyForUid(uid, options = {}) {
  const hashContext = getHashContext(options);
  const roll = createRoller(hashContext.hashFn);
  return {
    ...hashContext,
    result: roll(uid)
  };
}

function searchMatches(options = {}, hooks = {}) {
  const normalized = normalizeSearchOptions(options);
  validateSearchOptions(normalized);

  const hashContext = getHashContext(normalized);
  const roll = createRoller(hashContext.hashFn);
  const matches = [];
  const startedAt = Date.now();

  if (normalized.check) {
    return {
      elapsedSeconds: 0,
      exact: hashContext.exact,
      matches: [roll(normalized.check)],
      runtimeLabel: hashContext.runtimeLabel
    };
  }

  for (let i = 1; i <= normalized.max; i += 1) {
    const uid = crypto.randomBytes(32).toString("hex");
    const result = roll(uid);

    if (!matchFilters(result, normalized)) {
      if (hooks.onProgress && i % 5_000_000 === 0) {
        hooks.onProgress({
          elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
          iterations: i
        });
      }
      continue;
    }

    matches.push(result);
    if (hooks.onMatch) {
      hooks.onMatch(result, matches.length);
    }
    if (matches.length >= normalized.count) {
      break;
    }
  }

  return {
    elapsedSeconds: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
    exact: hashContext.exact,
    matches,
    runtimeLabel: hashContext.runtimeLabel
  };
}

module.exports = {
  BUDDY_CONSTANTS: {
    EYES,
    HATS,
    RARITIES,
    RARITY_STARS,
    SALT,
    SPECIES,
    STAT_NAMES
  },
  buildFilterSummary,
  formatBuddy,
  getHashContext,
  isBunRuntime,
  normalizeSearchOptions,
  rollBuddyForUid,
  searchMatches,
  validateSearchOptions
};
