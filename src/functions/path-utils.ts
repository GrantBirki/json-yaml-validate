import {realpathSync, statSync} from 'node:fs'
import {isAbsolute, relative, resolve, sep} from 'node:path'

export interface ValidationFile {
  displayPath: string
  fullPath: string
  relativePath: string
}

export type WorkspacePathResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      displayPath: string
      message: string
      ok: false
    }

export function normalizePath(filePath: string): string {
  return filePath.split(sep).join('/')
}

export function safeLogPath(filePath: string): string {
  const escaped = filePath.replace(/\r/g, '\\r').replace(/\n/g, '\\n')
  return escaped.startsWith('::') ? `./${escaped}` : escaped
}

function isPathEscape(relativePath: string): boolean {
  return (
    relativePath === '..' ||
    relativePath.startsWith('../') ||
    relativePath.startsWith('..\\') ||
    isAbsolute(relativePath)
  )
}

function isPathInside(childPath: string, parentPath: string): boolean {
  const path = relative(parentPath, childPath)
  return path === '' || !isPathEscape(path)
}

function workspaceRoot(workspace = process.env.GITHUB_WORKSPACE): string {
  return realpathSync(workspace && workspace !== '' ? workspace : process.cwd())
}

function workspaceInputRoot(workspace = process.env.GITHUB_WORKSPACE): string {
  return resolve(workspace && workspace !== '' ? workspace : process.cwd())
}

function workspaceRelativePath(root: string, fullPath: string): string {
  return normalizePath(relative(root, fullPath))
}

function displayPathFor(
  filePath: string,
  root: string,
  inputRoot = workspaceInputRoot()
): string {
  const resolvedPath = resolve(filePath)
  if (isPathInside(resolvedPath, inputRoot)) {
    return normalizePath(relative(inputRoot, resolvedPath))
  }

  return isPathInside(resolvedPath, root)
    ? workspaceRelativePath(root, resolvedPath)
    : normalizePath(filePath)
}

function resolveWorkspacePath(filePath: string): WorkspacePathResult<{
  fullPath: string
  root: string
}> {
  const root = workspaceRoot()
  const inputRoot = workspaceInputRoot()
  const displayPath = displayPathFor(filePath, root, inputRoot)

  let fullPath: string
  try {
    fullPath = realpathSync(resolve(filePath))
  } catch {
    return {
      displayPath,
      message: `validation path does not exist: ${displayPath}`,
      ok: false
    }
  }

  if (!isPathInside(fullPath, root)) {
    return {
      displayPath,
      message: `validation path must be inside the workspace: ${displayPath}`,
      ok: false
    }
  }

  return {
    ok: true,
    value: {
      fullPath,
      root
    }
  }
}

export function resolveValidationFile(
  filePath: string
): WorkspacePathResult<ValidationFile> {
  const resolved = resolveWorkspacePath(filePath)
  if (!resolved.ok) {
    return resolved
  }

  if (!statSync(resolved.value.fullPath).isFile()) {
    const displayPath = displayPathFor(filePath, resolved.value.root)
    return {
      displayPath,
      message: `validation path must be a regular file: ${displayPath}`,
      ok: false
    }
  }

  const relativePath = workspaceRelativePath(
    resolved.value.root,
    resolved.value.fullPath
  )

  return {
    ok: true,
    value: {
      displayPath: relativePath,
      fullPath: resolved.value.fullPath,
      relativePath
    }
  }
}

export function resolveWorkspaceDirectory(
  directoryPath: string
): WorkspacePathResult<string> {
  const resolved = resolveWorkspacePath(directoryPath)
  if (!resolved.ok) {
    return resolved
  }

  if (!statSync(resolved.value.fullPath).isDirectory()) {
    const displayPath = displayPathFor(directoryPath, resolved.value.root)
    return {
      displayPath,
      message: `base_dir must be a directory: ${displayPath}`,
      ok: false
    }
  }

  return {
    ok: true,
    value: resolved.value.fullPath
  }
}

export function isSameFile(leftPath: string, rightPath: string): boolean {
  try {
    return realpathSync(resolve(leftPath)) === realpathSync(resolve(rightPath))
  } catch {
    return false
  }
}
