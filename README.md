# envscan

Scan your codebase for environment variables, generate a `.env.example`, and validate your `.env` — **zero config**.

You clone a repo, run it, and it crashes because `.env` is missing a key nobody documented. `envscan` fixes that by reading your code and figuring out which environment variables you actually use.

## Install

```bash
# run without installing
npx envscan

# or install globally
npm install -g envscan
```

## Usage

### Scan — see what your code uses

```bash
envscan            # scans current directory
envscan ./src      # scan a specific directory
```

```
Found 5 environment variable(s):

  DATABASE_URL   src/db.js:1
  DB_POOL_SIZE   src/db.js:2
  SECRET_TOKEN   src/api.jsx:3
  VITE_API_BASE  src/api.jsx:2
  VITE_API_KEY   src/api.jsx:1
```

### Generate — create or update `.env.example`

```bash
envscan generate
envscan generate -o config/.env.example   # custom output path
```

Existing entries (including hand-written comments and example values) are **preserved**. Only newly discovered variables are appended.

### Validate — check your `.env` is complete

```bash
envscan validate
envscan validate --strict   # also fail on unused variables
```

```
✗ 2 required variable(s) missing or empty:

  missing SECRET_TOKEN   src/api.jsx:3
  missing VITE_API_BASE  src/api.jsx:2

⚠ 1 variable(s) in .env not referenced in code:
  LEGACY_UNUSED_VAR
```

Exits with code `1` when something is missing — drop it straight into CI:

```yaml
# .github/workflows/ci.yml
- run: npx envscan validate
```

## What it detects

- `process.env.FOO`
- `process.env["FOO"]` / `process.env['FOO']`
- `import.meta.env.FOO` (Vite)

Scans `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.vue`, `.svelte`, `.astro`.
Skips `node_modules`, `.git`, `dist`, `build`, and other common output dirs.

## Limitations (by design, for v1)

`envscan` reads source text — it does not run your code. So it intentionally does **not** catch:

- **Dynamic keys:** `process.env[someVariable]`
- **Destructuring:** `const { FOO } = process.env`
- **Computed names:** `process.env['PREFIX_' + name]`

These are rare and ambiguous; supporting them reliably needs full AST parsing. If your project relies on them heavily, document those variables manually.

Built-in names (`NODE_ENV`, `MODE`, `DEV`, `PROD`, `SSR`, `BASE_URL`) are ignored since they don't need to be defined by you.

## License

MIT
