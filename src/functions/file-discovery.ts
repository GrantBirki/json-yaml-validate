import {globSync, readdirSync} from 'node:fs'
import {join} from 'node:path'
import {normalizePath} from './path-utils.js'

function expandFilePatterns(patterns: string[]): string[] {
  const files: string[] = []

  for (const pattern of patterns) {
    files.push(...globSync(pattern))
  }

  return files
}

export function discoverExplicitFiles(patterns: string[]): string[] {
  const files = expandFilePatterns(patterns)
  const flatListPatterns =
    patterns.length === 1 ? patterns[0].split(/\s+/).filter(Boolean) : []

  return files.length > 0 || flatListPatterns.length <= 1
    ? files
    : expandFilePatterns(flatListPatterns)
}

export function discoverFilesByExtension(
  baseDir: string,
  extensions: string[],
  useDotMatch: boolean
): string[] {
  const files: string[] = []

  function walk(directory: string): void {
    const entries = readdirSync(directory, {withFileTypes: true})

    for (const entry of entries) {
      if (!useDotMatch && entry.name.startsWith('.')) {
        continue
      }

      const fullPath = join(directory, entry.name)

      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }

      if (
        entry.isFile() &&
        extensions.some(extension => fullPath.endsWith(extension))
      ) {
        files.push(normalizePath(fullPath))
      }
    }
  }

  walk(baseDir)
  return files
}
