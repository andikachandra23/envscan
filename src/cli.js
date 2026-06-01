#!/usr/bin/env node
import { Command } from "commander";
import pc from "picocolors";
import { resolve, join } from "node:path";
import { scan } from "./scanner.js";
import { generate } from "./generator.js";
import { validate } from "./validator.js";

const program = new Command();

program
  .name("envscan")
  .description(
    "Scan your codebase for environment variables, generate .env.example, and validate .env."
  )
  .version("0.1.0");

/**
 * Shared helper: run a scan and print a one-line summary.
 */
async function runScan(dir, opts) {
  const root = resolve(dir);
  const results = await scan(root, { ignore: opts.ignore });
  return { root, results };
}

// envscan scan [dir]
program
  .command("scan", { isDefault: true })
  .description("List all environment variables referenced in the codebase")
  .argument("[dir]", "directory to scan", ".")
  .option("--ignore <dirs...>", "extra directory names to ignore")
  .action(async (dir, opts) => {
    const { results } = await runScan(dir, opts);
    const names = [...results.keys()].sort();

    if (names.length === 0) {
      console.log(pc.yellow("No environment variables found."));
      return;
    }

    console.log(
      pc.bold(`Found ${names.length} environment variable(s):\n`)
    );
    for (const name of names) {
      const refs = results.get(name);
      const first = refs[0];
      const more = refs.length > 1 ? pc.dim(` (+${refs.length - 1} more)`) : "";
      console.log(
        `  ${pc.cyan(name)}  ${pc.dim(`${first.file}:${first.line}`)}${more}`
      );
    }
  });

// envscan generate [dir]
program
  .command("generate")
  .alias("gen")
  .description("Generate or update .env.example from the codebase")
  .argument("[dir]", "directory to scan", ".")
  .option("-o, --output <path>", "output file path", ".env.example")
  .option("--ignore <dirs...>", "extra directory names to ignore")
  .action(async (dir, opts) => {
    const { root, results } = await runScan(dir, opts);
    const outPath = resolve(root, opts.output);
    const { added, existing } = await generate(results, outPath);

    console.log(pc.green(`✓ Wrote ${opts.output}`));
    if (added.length > 0) {
      console.log(
        pc.dim(`  added ${added.length}: `) + added.join(", ")
      );
    }
    if (existing.length > 0) {
      console.log(
        pc.dim(`  preserved ${existing.length} existing entr(y/ies)`)
      );
    }
    if (added.length === 0) {
      console.log(pc.dim("  nothing new to add — already up to date"));
    }
  });

// envscan validate [dir]
program
  .command("validate")
  .alias("check")
  .description("Check that your .env defines everything the code requires")
  .argument("[dir]", "directory to scan", ".")
  .option("-e, --env <path>", "path to .env file", ".env")
  .option("--ignore <dirs...>", "extra directory names to ignore")
  .option("--strict", "fail if .env has variables not used in code")
  .action(async (dir, opts) => {
    const { root, results } = await runScan(dir, opts);
    const envPath = resolve(root, opts.env);
    const report = await validate(results, envPath);

    if (!report.envExists) {
      console.log(
        pc.red(`✗ No ${opts.env} file found.`) +
          pc.dim(` ${report.missing.length} variable(s) required by code.`)
      );
      for (const m of report.missing) {
        console.log(
          `  ${pc.red("missing")} ${pc.cyan(m.name)}  ${pc.dim(`${m.file}:${m.line}`)}`
        );
      }
      process.exitCode = 1;
      return;
    }

    if (report.missing.length === 0) {
      console.log(
        pc.green(`✓ All ${report.defined.length} required variable(s) are set.`)
      );
    } else {
      console.log(
        pc.red(`✗ ${report.missing.length} required variable(s) missing or empty:\n`)
      );
      for (const m of report.missing) {
        console.log(
          `  ${pc.red("missing")} ${pc.cyan(m.name)}  ${pc.dim(`${m.file}:${m.line}`)}`
        );
      }
      process.exitCode = 1;
    }

    if (report.unused.length > 0) {
      console.log(
        pc.yellow(
          `\n⚠ ${report.unused.length} variable(s) in ${opts.env} not referenced in code:`
        )
      );
      console.log(pc.dim("  " + report.unused.join(", ")));
      if (opts.strict) process.exitCode = 1;
    }
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(pc.red(`envscan: ${err.message}`));
  process.exitCode = 1;
});
