import {realpathSync, statSync} from 'node:fs'
import {dirname, isAbsolute, relative, resolve} from 'node:path'
import {isBuiltInMetaSchemaId} from './json-meta-schema.js'

export type InlineSchemaReference =
  | {
      kind: 'none'
    }
  | {
      kind: 'local'
      schemaPath: string
    }
  | {
      kind: 'built-in'
      schemaId: string
    }
  | {
      kind: 'error'
      message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isPathEscape(relativePath: string): boolean {
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

function unsupportedRemoteReference(reference: string): InlineSchemaReference {
  return {
    kind: 'error',
    message: `Remote inline schemas are not supported: ${reference}`
  }
}

function unsupportedUrlReference(reference: string): InlineSchemaReference {
  return {
    kind: 'error',
    message: `Unsupported inline schema URL: ${reference}`
  }
}

export function extractJsonInlineSchema(data: unknown): string | undefined | Error {
  if (!isRecord(data) || !('$schema' in data)) {
    return undefined
  }

  if (typeof data.$schema !== 'string') {
    return new Error('Inline JSON schema reference must be a string')
  }

  const reference = data.$schema.trim()
  if (reference === '') {
    return new Error('Inline JSON schema reference must be non-empty')
  }

  return reference
}

export function extractYamlInlineSchema(source: string): string | undefined | Error {
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '') {
      continue
    }

    if (!trimmed.startsWith('#')) {
      return undefined
    }

    const match = /^\s*#\s*yaml-language-server:\s*\$schema=(.*)$/.exec(line)
    if (!match) {
      continue
    }

    const reference = match[1].trim()
    if (reference === '') {
      return new Error('Inline YAML schema reference must be non-empty')
    }

    return reference
  }

  return undefined
}

export function resolveInlineSchemaReference(
  reference: string,
  sourceFile: string,
  workspace?: string
): InlineSchemaReference {
  if (isBuiltInMetaSchemaId(reference)) {
    return {
      kind: 'built-in',
      schemaId: reference
    }
  }

  if (/^https?:\/\//i.test(reference)) {
    return unsupportedRemoteReference(reference)
  }

  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(reference)) {
    return unsupportedUrlReference(reference)
  }

  const candidatePath = isAbsolute(reference)
    ? reference
    : resolve(dirname(sourceFile), reference)

  let schemaPath: string
  try {
    schemaPath = realpathSync(candidatePath)
  } catch {
    return {
      kind: 'error',
      message: `Inline schema file does not exist: ${candidatePath}`
    }
  }

  const root = workspaceRoot(workspace)
  if (!isPathInside(schemaPath, root)) {
    return {
      kind: 'error',
      message: `Inline schema file must be inside the workspace: ${candidatePath}`
    }
  }

  if (!statSync(schemaPath).isFile()) {
    return {
      kind: 'error',
      message: `Inline schema path must be a file: ${candidatePath}`
    }
  }

  return {
    kind: 'local',
    schemaPath
  }
}

export function jsonInlineSchemaReference(
  data: unknown,
  sourceFile: string,
  workspace?: string
): InlineSchemaReference {
  const reference = extractJsonInlineSchema(data)
  if (reference === undefined) {
    return {kind: 'none'}
  }

  if (reference instanceof Error) {
    return {
      kind: 'error',
      message: reference.message
    }
  }

  return resolveInlineSchemaReference(reference, sourceFile, workspace)
}

export function yamlInlineSchemaReference(
  source: string,
  sourceFile: string,
  workspace?: string
): InlineSchemaReference {
  const reference = extractYamlInlineSchema(source)
  if (reference === undefined) {
    return {kind: 'none'}
  }

  if (reference instanceof Error) {
    return {
      kind: 'error',
      message: reference.message
    }
  }

  return resolveInlineSchemaReference(reference, sourceFile, workspace)
}
