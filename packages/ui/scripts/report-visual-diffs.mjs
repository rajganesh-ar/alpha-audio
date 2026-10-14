#!/usr/bin/env node
/**
 * Prints failing visual tests as GitHub annotations (`::error::`), with Playwright's
 * pixel-difference line, so a failure can be read from the PR checks without the report.
 * Reads the JSON reporter output: node scripts/report-visual-diffs.mjs test-results/results.json
 */
import { existsSync, readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'test-results/results.json'
if (!existsSync(file)) process.exit(0)
const report = JSON.parse(readFileSync(file, 'utf8'))
const failures = []
const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const result = test.results?.at(-1)
      if (result && result.status !== 'passed' && result.status !== 'skipped') {
        const message = (result.error?.message ?? '').replace(/\u001b\[[0-9;]*m/g, '')
        const diff = message.match(
          /\d+ pixels \(ratio [\d.]+ of all image pixels\) are different/,
        )?.[0]
        failures.push(
          `${spec.title}: ${diff ?? message.split('\n').find((l) => l.trim()) ?? result.status}`,
        )
      }
    }
  }
  for (const child of suite.suites ?? []) walk(child)
}
for (const suite of report.suites ?? []) walk(suite)
console.log(`::error title=Visual snapshots::${failures.length} failing`)
for (const line of failures.slice(0, 40)) console.log(`::error title=Visual diff::${line}`)
