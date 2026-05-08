import type {ValidateFunction} from 'ajv'
import type {AjvLike} from '../types.js'

const BUILT_IN_META_SCHEMA_IDS = new Set([
  'http://json-schema.org/draft-04/schema',
  'http://json-schema.org/draft-07/schema',
  'https://json-schema.org/draft/2019-09/schema',
  'https://json-schema.org/draft/2020-12/schema'
])

function normalizeSchemaId(id: string): string {
  return id.replace(/#$/, '')
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right)
    )
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

function schemaId(schemaValue: unknown): string {
  if (
    typeof schemaValue !== 'object' ||
    schemaValue === null ||
    Array.isArray(schemaValue)
  ) {
    return ''
  }

  const schemaRecord = schemaValue as Record<string, unknown>
  if (typeof schemaRecord.$id === 'string') {
    return schemaRecord.$id
  }

  if (typeof schemaRecord.id === 'string') {
    return schemaRecord.id
  }

  return ''
}

export function builtInMetaSchema(ajv: AjvLike, schemaValue: unknown): ValidateFunction | null {
  const normalizedId = normalizeSchemaId(schemaId(schemaValue))
  if (!BUILT_IN_META_SCHEMA_IDS.has(normalizedId)) {
    return null
  }

  const validate =
    ajv.getSchema(schemaId(schemaValue)) ??
    ajv.getSchema(normalizedId) ??
    ajv.getSchema(`${normalizedId}#`)
  if (validate === undefined) return null

  return stableStringify(validate.schema) === stableStringify(schemaValue)
    ? validate
    : null
}
