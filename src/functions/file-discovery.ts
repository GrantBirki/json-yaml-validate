import {readdirSync} from 'node:fs'
import {join, sep} from 'node:path'

function normalizePath(filePath: string): string {
  return filePath.split(sep).join('/')
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
