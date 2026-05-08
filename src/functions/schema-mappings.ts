import {parse} from 'yaml'
import {realpathSync} from 'node:fs'
import {resolve} from 'node:path'
import {discoverExplicitFiles} from './file-discovery.js'

export type SchemaMappingType = 'json' | 'yaml'

/* node:coverage ignore next 6 */
export interface SchemaMapping {
  type: SchemaMappingType
  schema: string
  files: string[]
  jsonSchemaVersion?: string
}

interface SchemaMappingOptions {
  yamlAsJson: boolean
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function schemaMappingError(index: number, message: string): Error {
  return new Error(`schema_mappings[${index}]: ${message}`)
}

function canonicalFileKey(file: string): string {
  return realpathSync(resolve(file))
}

function deduplicateFiles(files: string[]): string[] {
  const seen = new Set<string>()
  const deduplicated: string[] = []

  for (const file of files) {
    const key = canonicalFileKey(file)
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduplicated.push(file)
  }

  return deduplicated
}

function normalizeType(value: unknown, index: number): SchemaMappingType {
  if (value === 'json' || value === 'yaml') {
    return value
  }

  throw schemaMappingError(index, 'type must be "json" or "yaml"')
}

function normalizeSchema(value: unknown, index: number): string {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }

  throw schemaMappingError(index, 'schema must be a non-empty string')
}

function normalizeFilePatterns(value: unknown, index: number): string[] {
  const patterns =
    typeof value === 'string'
      ? [value]
      : Array.isArray(value)
        ? value
        : null

  if (patterns === null) {
    throw schemaMappingError(index, 'files must be a string or list of strings')
  }

  if (!patterns.every(pattern => typeof pattern === 'string')) {
    throw schemaMappingError(index, 'files must only contain strings')
  }

  const normalizedPatterns = patterns
    .map(pattern => pattern.trim())
    .filter(Boolean)

  if (normalizedPatterns.length === 0) {
    throw schemaMappingError(index, 'files must include at least one pattern')
  }

  const files = deduplicateFiles(discoverExplicitFiles(normalizedPatterns))
  if (files.length === 0) {
    throw schemaMappingError(index, 'files matched no files')
  }

  return files
}

function normalizeJsonSchemaVersion(
  value: unknown,
  type: SchemaMappingType,
  index: number
): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }

  if (type !== 'json') {
    throw schemaMappingError(
      index,
      'json_schema_version is only supported for json mappings'
    )
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim()
  }

  throw schemaMappingError(
    index,
    'json_schema_version must be a non-empty string'
  )
}

function normalizeMapping(value: unknown, index: number): SchemaMapping {
  if (!isRecord(value)) {
    throw schemaMappingError(index, 'mapping must be an object')
  }

  const type = normalizeType(value.type, index)
  return {
    type,
    schema: normalizeSchema(value.schema, index),
    files: normalizeFilePatterns(value.files, index),
    jsonSchemaVersion: normalizeJsonSchemaVersion(
      value.json_schema_version,
      type,
      index
    )
  }
}

function assertNoOverlappingFiles(mappings: SchemaMapping[]): void {
  const filesByType = new Map<SchemaMappingType, Map<string, string>>()

  for (const mapping of mappings) {
    const files =
      filesByType.get(mapping.type) ?? new Map<string, string>()
    filesByType.set(mapping.type, files)

    for (const file of mapping.files) {
      const fileKey = canonicalFileKey(file)
      const previousSchema = files.get(fileKey)
      if (previousSchema !== undefined) {
        throw new Error(
          `schema_mappings maps "${file}" to multiple ${mapping.type} schemas: ${previousSchema}, ${mapping.schema}`
        )
      }

      files.set(fileKey, mapping.schema)
    }
  }
}

export function loadSchemaMappings(
  input: string,
  options: SchemaMappingOptions
): SchemaMapping[] {
  if (input.trim() === '') {
    return []
  }

  let parsed: unknown
  try {
    parsed = parse(input)
  } catch (error) {
    throw new Error(`schema_mappings must be valid YAML: ${errorMessage(error)}`)
  }

  if (!Array.isArray(parsed)) {
    throw new Error('schema_mappings must be a YAML list')
  }

  const mappings = parsed.map(normalizeMapping)
  if (options.yamlAsJson && mappings.some(mapping => mapping.type === 'yaml')) {
    throw new Error(
      'schema_mappings entries with type "yaml" cannot be used when yaml_as_json is true'
    )
  }

  assertNoOverlappingFiles(mappings)
  return mappings
}
