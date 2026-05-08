import {Ajv} from 'ajv'
import * as AjvDraft04Module from 'ajv-draft-04'
import {Ajv2019} from 'ajv/dist/2019.js'
import {Ajv2020} from 'ajv/dist/2020.js'
import {builtInMetaSchema} from '../../src/functions/json-meta-schema.js'
import type {AjvConstructor} from '../../src/types.js'

const AjvDraft04 = (AjvDraft04Module.default ??
  AjvDraft04Module) as unknown as AjvConstructor

test('returns null for schemas without built-in meta-schema ids', () => {
  const ajv = new Ajv({allErrors: true, strict: true})

  expect(builtInMetaSchema(ajv, true)).toBe(null)
  expect(builtInMetaSchema(ajv, null)).toBe(null)
  expect(builtInMetaSchema(ajv, [])).toBe(null)
  expect(builtInMetaSchema(ajv, {type: 'object'})).toBe(null)
  expect(
    builtInMetaSchema(ajv, {
      $id: 'https://example.com/schema',
      type: 'object'
    })
  ).toBe(null)
  expect(
    builtInMetaSchema(ajv, {
      $id: 'http://json-schema.org/draft-07/schema#',
      type: 'object'
    })
  ).toBe(null)
})

test('returns AJV validators for local built-in meta-schema copies', () => {
  const cases: Array<[AjvConstructor, unknown]> = [
    [
      AjvDraft04,
      require('ajv-draft-04/dist/refs/json-schema-draft-04.json')
    ],
    [Ajv, require('ajv/dist/refs/json-schema-draft-07.json')],
    [Ajv2019, require('ajv/dist/refs/json-schema-2019-09/schema.json')],
    [Ajv2020, require('ajv/dist/refs/json-schema-2020-12/schema.json')]
  ]

  for (const [AjvImplementation, metaSchema] of cases) {
    const ajv = new AjvImplementation({allErrors: true, strict: true})
    const reorderedMetaSchema = Object.fromEntries(
      Object.entries(metaSchema as Record<string, unknown>).reverse()
    )
    const validate = builtInMetaSchema(ajv, reorderedMetaSchema)

    expect(typeof validate).toBe('function')
    expect(validate?.({type: 'strng'})).toBe(false)
  }
})
