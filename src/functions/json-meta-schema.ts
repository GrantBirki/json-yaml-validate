import type {ValidateFunction} from 'ajv'
import {createRequire} from 'node:module'
import type {AjvLike} from '../types.js'

const require = createRequire(import.meta.url)

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

const BUILT_IN_META_SCHEMAS: Record<string, string> = {
  'http://json-schema.org/draft-04/schema': stableStringify(
    require('ajv-draft-04/dist/refs/json-schema-draft-04.json')
  ),
  'http://json-schema.org/draft-07/schema': stableStringify(
    require('ajv/dist/refs/json-schema-draft-07.json')
  ),
  'https://json-schema.org/draft/2019-09/schema': stableStringify(
    require('ajv/dist/refs/json-schema-2019-09/schema.json')
  ),
  'https://json-schema.org/draft/2020-12/schema': stableStringify(
    require('ajv/dist/refs/json-schema-2020-12/schema.json')
  )
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
  const expectedSchema = BUILT_IN_META_SCHEMAS[normalizedId]
  if (
    expectedSchema === undefined ||
    stableStringify(schemaValue) !== expectedSchema
  ) {
    return null
  }

  return (
    ajv.getSchema(schemaId(schemaValue)) ??
    ajv.getSchema(normalizedId) ??
    ajv.getSchema(`${normalizedId}#`) ??
    null
  )
}
