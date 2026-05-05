import {readdirSync} from 'fs'
import {join, sep} from 'path'

function normalizePath(filePath) {
  return filePath.split(sep).join('/')
}

export function discoverFilesByExtension(baseDir, extensions, useDotMatch) {
  const files = []

  function walk(directory) {
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
