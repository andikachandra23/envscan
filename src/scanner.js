import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname, relative } from "node:path";

// Directories we never want to scan.
const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
  ".next",
  ".nuxt",
  ".output",
  ".cache",
  ".vercel",
  "out",
]);

// File extensions worth scanning for env usage.
const SCAN_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".vue",
  ".svelte",
  ".astro",
]);

// Matches process.env.FOO and process.env["FOO"] / process.env['FOO']
// Also matches import.meta.env.FOO (Vite).
// Capture group 1/2/3 hold the variable name depending on which form matched.
const ENV_PATTERNS = [
  // process.env.FOO  |  import.meta.env.FOO
  /(?:process\.env|import\.meta\.env)\.([A-Z_][A-Z0-9_]*)/g,
  // process.env["FOO"]  |  import.meta.env['FOO']
  /(?:process\.env|import\.meta\.env)\[\s*["'`]([A-Z_][A-Z0-9_]*)["'`]\s*\]/g,
];

// Names that are runtime built-ins, not things a user needs to define.
const IGNORED_NAMES = new Set(["NODE_ENV", "BASE_URL", "MODE", "DEV", "PROD", "SSR"]);

/**
 * Recursively collect scannable file paths under `dir`.
 */
async function collectFiles(dir, rootDir, ignoreDirs, acc) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return acc; // unreadable dir — skip silently
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      await collectFiles(fullPath, rootDir, ignoreDirs, acc);
    } else if (entry.isFile()) {
      if (SCAN_EXTENSIONS.has(extname(entry.name))) {
        acc.push(fullPath);
      }
    }
  }
  return acc;
}

/**
 * Extract env variable references from a single file's contents.
 * Returns array of { name, line }.
 */
function extractFromContent(content) {
  const found = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const pattern of ENV_PATTERNS) {
      pattern.lastIndex = 0; // reset stateful global regex
      let match;
      while ((match = pattern.exec(line)) !== null) {
        const name = match[1];
        if (IGNORED_NAMES.has(name)) continue;
        found.push({ name, line: i + 1 });
      }
    }
  }
  return found;
}

/**
 * Scan a project directory for environment variable usage.
 *
 * @param {string} rootDir - directory to scan
 * @param {object} [options]
 * @param {string[]} [options.ignore] - extra directory names to ignore
 * @returns {Promise<Map<string, Array<{file: string, line: number}>>>}
 *          Map of env var name -> list of locations where it's referenced.
 */
export async function scan(rootDir, options = {}) {
  const ignoreDirs = new Set(DEFAULT_IGNORE_DIRS);
  for (const extra of options.ignore ?? []) ignoreDirs.add(extra);

  const rootStat = await stat(rootDir);
  if (!rootStat.isDirectory()) {
    throw new Error(`Not a directory: ${rootDir}`);
  }

  const files = await collectFiles(rootDir, rootDir, ignoreDirs, []);

  // Map: VAR_NAME -> [{ file, line }, ...]
  const results = new Map();

  for (const file of files) {
    let content;
    try {
      content = await readFile(file, "utf8");
    } catch {
      continue;
    }
    const refs = extractFromContent(content);
    for (const { name, line } of refs) {
      if (!results.has(name)) results.set(name, []);
      results.get(name).push({ file: relative(rootDir, file), line });
    }
  }

  return results;
}
