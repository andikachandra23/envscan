import { readFile } from "node:fs/promises";

/**
 * Parse the contents of a .env-style file into a Map of KEY -> value.
 * Intentionally minimal: handles KEY=value, quoted values, blank lines,
 * and # comments. Does not do variable expansion.
 *
 * @param {string} content
 * @returns {Map<string, string>}
 */
export function parseEnv(content) {
  const result = new Map();
  const lines = content.split("\n");

  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    const eq = line.indexOf("=");
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    // Strip surrounding matching quotes.
    if (
      value.length >= 2 &&
      ((value[0] === '"' && value.at(-1) === '"') ||
        (value[0] === "'" && value.at(-1) === "'"))
    ) {
      value = value.slice(1, -1);
    }
    result.set(key, value);
  }
  return result;
}

/**
 * Read and parse a .env file from disk. Returns null if the file
 * does not exist; rethrows other errors.
 *
 * @param {string} path
 * @returns {Promise<Map<string, string> | null>}
 */
export async function readEnvFile(path) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
  return parseEnv(content);
}
