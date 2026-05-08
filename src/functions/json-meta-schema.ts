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

export function builtInMetaSchema(
  ajv: AjvLike,
  schemaValue: unknown
): ValidateFunction | null {
  const id = schemaId(schemaValue)
  if (!BUILT_IN_META_SCHEMA_IDS.has(normalizeSchemaId(id))) {
    return null
  }

  return (
    ajv.getSchema(id) ??
    ajv.getSchema(normalizeSchemaId(id)) ??
    ajv.getSchema(`${normalizeSchemaId(id)}#`) ??
    null
  )
}
