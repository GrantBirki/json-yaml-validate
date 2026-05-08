import {resolve} from 'node:path'
import {loadSchemaMappings} from '../../src/functions/schema-mappings.js'

test('returns no schema mappings when input is empty', () => {
  expect(loadSchemaMappings('', {yamlAsJson: false})).toStrictEqual([])
})

test('normalizes schema mappings with string and list file patterns', () => {
  expect(
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files: __tests__/fixtures/json/valid/json1.json __tests__/fixtures/json/mixture/json2.json
        json_schema_version: draft-04
      - type: yaml
        schema: __tests__/fixtures/schemas/schema1.yaml
        files:
          - __tests__/fixtures/yaml/valid/yaml1.yaml
          - __tests__/fixtures/yaml/valid/yaml1.yaml
      `,
      {yamlAsJson: false}
    )
  ).toStrictEqual([
    {
      type: 'json',
      schema: '__tests__/fixtures/schemas/schema1.json',
      files: [
        '__tests__/fixtures/json/valid/json1.json',
        '__tests__/fixtures/json/mixture/json2.json'
      ],
      jsonSchemaVersion: 'draft-04'
    },
    {
      type: 'yaml',
      schema: '__tests__/fixtures/schemas/schema1.yaml',
      files: ['__tests__/fixtures/yaml/valid/yaml1.yaml'],
      jsonSchemaVersion: undefined
    }
  ])
})

test('fails when schema mappings input is invalid yaml', () => {
  expect(() =>
    loadSchemaMappings('- type: json\n  files: [', {yamlAsJson: false})
  ).toThrow('schema_mappings must be valid YAML')
})

test('fails when schema mappings input is not a list', () => {
  expect(() =>
    loadSchemaMappings('type: json', {yamlAsJson: false})
  ).toThrow('schema_mappings must be a YAML list')
})

test('fails when a schema mapping item is not an object', () => {
  expect(() => loadSchemaMappings('- json', {yamlAsJson: false})).toThrow(
    'schema_mappings[0]: mapping must be an object'
  )
})

test('fails when a schema mapping has an invalid type', () => {
  expect(() =>
    loadSchemaMappings(
      `
      - type: xml
        schema: __tests__/fixtures/schemas/schema1.json
        files: __tests__/fixtures/json/valid/json1.json
      `,
      {yamlAsJson: false}
    )
  ).toThrow('schema_mappings[0]: type must be "json" or "yaml"')
})

test('fails when a schema mapping has no schema', () => {
  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        files: __tests__/fixtures/json/valid/json1.json
      `,
      {yamlAsJson: false}
    )
  ).toThrow('schema_mappings[0]: schema must be a non-empty string')
})

test('fails when schema mapping files are not strings', () => {
  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files:
          name: __tests__/fixtures/json/valid/json1.json
      `,
      {yamlAsJson: false}
    )
  ).toThrow('schema_mappings[0]: files must be a string or list of strings')

  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files:
          - __tests__/fixtures/json/valid/json1.json
          - 12
      `,
      {yamlAsJson: false}
    )
  ).toThrow('schema_mappings[0]: files must only contain strings')
})

test('fails when schema mapping files are empty or unmatched', () => {
  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files:
          - ''
      `,
      {yamlAsJson: false}
    )
  ).toThrow('schema_mappings[0]: files must include at least one pattern')

  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files: __tests__/fixtures/json/missing/*.json
      `,
      {yamlAsJson: false}
    )
  ).toThrow('schema_mappings[0]: files matched no files')
})

test('fails when yaml schema mappings are used with yaml_as_json', () => {
  expect(() =>
    loadSchemaMappings(
      `
      - type: yaml
        schema: __tests__/fixtures/schemas/schema1.yaml
        files: __tests__/fixtures/yaml/valid/yaml1.yaml
      `,
      {yamlAsJson: true}
    )
  ).toThrow(
    'schema_mappings entries with type "yaml" cannot be used when yaml_as_json is true'
  )
})

test('fails when json_schema_version is invalid or used on yaml mappings', () => {
  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files: __tests__/fixtures/json/valid/json1.json
        json_schema_version: ''
      `,
      {yamlAsJson: false}
    )
  ).toThrow(
    'schema_mappings[0]: json_schema_version must be a non-empty string'
  )

  expect(() =>
    loadSchemaMappings(
      `
      - type: yaml
        schema: __tests__/fixtures/schemas/schema1.yaml
        files: __tests__/fixtures/yaml/valid/yaml1.yaml
        json_schema_version: draft-07
      `,
      {yamlAsJson: false}
    )
  ).toThrow(
    'schema_mappings[0]: json_schema_version is only supported for json mappings'
  )
})

test('fails when the same file is mapped to multiple schemas of the same type', () => {
  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files: __tests__/fixtures/json/valid/json1.json
      - type: json
        schema: __tests__/fixtures/schemas/schema2.json
        files: __tests__/fixtures/json/valid/json1.json
      `,
      {yamlAsJson: false}
    )
  ).toThrow(
    'schema_mappings maps "__tests__/fixtures/json/valid/json1.json" to multiple json schemas'
  )
})

test('deduplicates files within a schema mapping by real path', () => {
  const relativeFile = '__tests__/fixtures/yaml/valid/yaml1.yaml'
  const absoluteFile = resolve(relativeFile)

  expect(
    loadSchemaMappings(
      `
      - type: yaml
        schema: __tests__/fixtures/schemas/schema1.yaml
        files:
          - ${relativeFile}
          - ${absoluteFile}
      `,
      {yamlAsJson: false}
    )
  ).toStrictEqual([
    {
      type: 'yaml',
      schema: '__tests__/fixtures/schemas/schema1.yaml',
      files: [relativeFile],
      jsonSchemaVersion: undefined
    }
  ])
})

test('fails when the same real file is mapped by different path forms', () => {
  const relativeFile = '__tests__/fixtures/json/valid/json1.json'
  const absoluteFile = resolve(relativeFile)

  expect(() =>
    loadSchemaMappings(
      `
      - type: json
        schema: __tests__/fixtures/schemas/schema1.json
        files: ${relativeFile}
      - type: json
        schema: __tests__/fixtures/schemas/schema2.json
        files: ${absoluteFile}
      `,
      {yamlAsJson: false}
    )
  ).toThrow(
    `schema_mappings maps "${absoluteFile}" to multiple json schemas`
  )
})
