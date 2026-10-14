#!/usr/bin/env node
/**
 * Copies the self-hosted font files listed in src/fonts/faces.json into a public folder:
 *
 *   alpha-sync-fonts <outDir>     e.g. alpha-sync-fonts public/fonts
 *
 * Files land at <outDir>/<version>/<file>, next to each package's OFL licence. The folder is
 * rebuilt every run and is not committed (the files come from the pinned npm packages).
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const faces = JSON.parse(readFileSync(join(here, '../src/fonts/faces.json'), 'utf8'))
const require = createRequire(join(here, '../package.json'))

const outDir = process.argv[2]
if (!outDir) {
  console.error('usage: alpha-sync-fonts <outDir>')
  process.exit(1)
}
const target = resolve(process.cwd(), outDir)
rmSync(target, { recursive: true, force: true })

const licences = new Set()
for (const face of faces) {
  const source = require.resolve(`${face.package}/files/${face.file}`)
  const installed = JSON.parse(readFileSync(join(source, '../../package.json'), 'utf8')).version
  if (installed !== face.version) {
    console.error(
      `${face.package} is ${installed} but faces.json says ${face.version}; update the manifest.`,
    )
    process.exit(1)
  }
  const dir = join(target, face.version)
  mkdirSync(dir, { recursive: true })
  copyFileSync(source, join(dir, face.file))
  if (!licences.has(face.package)) {
    licences.add(face.package)
    const name = face.package.replace(/^@/, '').replace(/\//g, '-')
    copyFileSync(require.resolve(`${face.package}/LICENSE`), join(dir, `${name}-LICENSE.txt`))
  }
}
console.log(`alpha-sync-fonts: ${faces.length} faces → ${outDir}`)
