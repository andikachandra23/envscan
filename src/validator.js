import { readEnvFile } from "./env-parser.js";

/**
 * Validate an .env file against the variables required by the codebase.
 *
 * @param {Map<string, Array<{file: string, line: number}>>} scanResults
 *        Variables the code references (from scanner).
 * @param {string} envPath - path to the .env file to validate.
 * @returns {Promise<{
 *   missing: Array<{ name: string, file: string, line: number }>,
 *   defined: string[],
 *   unused: string[],
 *   envExists: boolean
 * }>}
 */
export async function validate(scanResults, envPath) {
  const env = await readEnvFile(envPath);
  const required = [...scanResults.keys()];

  if (env === null) {
    // No .env at all — everything required is missing.
    return {
      missing: required.map((name) => {
        const first = scanResults.get(name)[0];
        return { name, file: first.file, line: first.line };
      }),
      defined: [],
      unused: [],
      envExists: false,
    };
  }

  const missing = [];
  const defined = [];

  for (const name of required) {
    // Present but empty counts as missing — an empty value usually breaks things.
    const value = env.get(name);
    if (value === undefined || value === "") {
      const first = scanResults.get(name)[0];
      missing.push({ name, file: first.file, line: first.line });
    } else {
      defined.push(name);
    }
  }

  // Variables defined in .env but never referenced in code.
  const requiredSet = new Set(required);
  const unused = [...env.keys()].filter((k) => !requiredSet.has(k));

  return {
    missing: missing.sort((a, b) => a.name.localeCompare(b.name)),
    defined: defined.sort(),
    unused: unused.sort(),
    envExists: true,
  };
}
