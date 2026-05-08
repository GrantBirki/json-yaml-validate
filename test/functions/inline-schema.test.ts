import {
  extractJsonInlineSchema,
  extractYamlInlineSchema,
  isPathEscape,
  jsonInlineSchemaReference,
  resolveInlineSchemaReference,
  yamlInlineSchemaReference
} from '../../src/functions/inline-schema.js'

test('extracts top-level json schema references', () => {
  expect(extractJsonInlineSchema({$schema: './schema.json'})).toBe(
    './schema.json'
  )
  expect(extractJsonInlineSchema({name: 'Ada'})).toBe(undefined)
  expect(extractJsonInlineSchema(['not an object'])).toBe(undefined)
})

test('rejects empty json schema references', () => {
  const result = extractJsonInlineSchema({$schema: '   '})

  expect(result instanceof Error).toBe(true)
  expect((result as Error).message).toBe(
    'Inline JSON schema reference must be non-empty'
  )
})

test('rejects non-string json schema references', () => {
  const result = extractJsonInlineSchema({$schema: false})

  expect(result instanceof Error).toBe(true)
  expect((result as Error).message).toBe(
    'Inline JSON schema reference must be a string'
  )
})

test('extracts yaml language-server schema directives from leading comments', () => {
  expect(
    extractYamlInlineSchema(
      '# yaml-language-server: $schema=./schema.json\nname: Ada'
    )
  ).toBe('./schema.json')
  expect(
    extractYamlInlineSchema(
      '\n# yaml-language-server: $schema=./schema.json\nname: Ada'
    )
  ).toBe('./schema.json')
  expect(
    extractYamlInlineSchema('# another comment\nname: Ada')
  ).toBe(undefined)
  expect(extractYamlInlineSchema('# another comment\n')).toBe(undefined)
})

test('rejects empty yaml language-server schema directives', () => {
  const result = extractYamlInlineSchema(
    '# yaml-language-server: $schema=\nname: Ada'
  )

  expect(result instanceof Error).toBe(true)
  expect((result as Error).message).toBe(
    'Inline YAML schema reference must be non-empty'
  )
})

test('resolves relative and absolute inline schema paths inside the workspace', () => {
  const schemaPath =
    '__tests__/fixtures/inline_schema/schemas/person.schema.json'
  const sourceFile = '__tests__/fixtures/inline_schema/json/valid-person.json'
  const relativeReference = resolveInlineSchemaReference(
    '../schemas/person.schema.json',
    sourceFile
  )
  const absoluteReference = resolveInlineSchemaReference(
    `${process.cwd()}/${schemaPath}`,
    sourceFile
  )

  expect(relativeReference).toStrictEqual({
    kind: 'local',
    schemaPath: `${process.cwd()}/${schemaPath}`
  })
  expect(absoluteReference).toStrictEqual({
    kind: 'local',
    schemaPath: `${process.cwd()}/${schemaPath}`
  })
})

test('detects parent path escapes for posix and windows relative paths', () => {
  expect(isPathEscape('..')).toBe(true)
  expect(isPathEscape('../outside/schema.json')).toBe(true)
  expect(isPathEscape('..\\outside\\schema.json')).toBe(true)
  expect(isPathEscape('schemas/person.schema.json')).toBe(false)
  expect(isPathEscape('..schemas/person.schema.json')).toBe(false)
})

test('rejects missing inline schema files', () => {
  expect(
    resolveInlineSchemaReference(
      '../schemas/missing.schema.json',
      '__tests__/fixtures/inline_schema/json/valid-person.json'
    )
  ).toStrictEqual({
    kind: 'error',
    message: `Inline schema file does not exist: ${process.cwd()}/__tests__/fixtures/inline_schema/schemas/missing.schema.json`
  })
})

test('rejects directory inline schema paths', () => {
  const result = resolveInlineSchemaReference(
    '../schemas',
    '__tests__/fixtures/inline_schema/json/valid-person.json'
  )

  expect(result.kind).toBe('error')
  if (result.kind === 'error') {
    expect(result.message).toContain('Inline schema path must be a file')
  }
})

test('rejects remote inline schema urls except built-in meta-schema ids', () => {
  expect(
    resolveInlineSchemaReference(
      'https://example.com/schema.json',
      '__tests__/fixtures/inline_schema/json/valid-person.json'
    )
  ).toStrictEqual({
    kind: 'error',
    message: 'Remote inline schemas are not supported: https://example.com/schema.json'
  })

  expect(
    resolveInlineSchemaReference(
      'http://json-schema.org/draft-07/schema#',
      '__tests__/fixtures/inline_schema/json/valid-person.json'
    )
  ).toStrictEqual({
    kind: 'built-in',
    schemaId: 'http://json-schema.org/draft-07/schema#'
  })
})

test('rejects unsupported inline schema url schemes', () => {
  expect(
    resolveInlineSchemaReference(
      'file:///tmp/schema.json',
      '__tests__/fixtures/inline_schema/json/valid-person.json'
    )
  ).toStrictEqual({
    kind: 'error',
    message: 'Unsupported inline schema URL: file:///tmp/schema.json'
  })
})

test('rejects symlink escapes outside the workspace', () => {
  const fs = require('fs')
  const os = require('os')
  const path = require('path')
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'inline-schema-'))
  const workspace = path.join(tempDir, 'workspace')
  const outside = path.join(tempDir, 'outside')
  const sourceDir = path.join(workspace, 'data')
  const sourceFile = path.join(sourceDir, 'data.json')
  const outsideSchema = path.join(outside, 'schema.json')
  const schemaLink = path.join(workspace, 'schema-link.json')

  fs.mkdirSync(sourceDir, {recursive: true})
  fs.mkdirSync(outside, {recursive: true})
  fs.writeFileSync(sourceFile, '{}')
  fs.writeFileSync(outsideSchema, '{}')
  fs.symlinkSync(outsideSchema, schemaLink)

  const result = resolveInlineSchemaReference(
    '../schema-link.json',
    sourceFile,
    workspace
  )

  expect(result.kind).toBe('error')
  if (result.kind === 'error') {
    expect(result.message).toContain(
      'Inline schema file must be inside the workspace'
    )
  }

  fs.rmSync(tempDir, {recursive: true, force: true})
})

test('builds json and yaml inline schema references', () => {
  expect(
    jsonInlineSchemaReference(
      {$schema: '../schemas/person.schema.json'},
      '__tests__/fixtures/inline_schema/json/valid-person.json'
    ).kind
  ).toBe('local')
  expect(
    yamlInlineSchemaReference(
      '# yaml-language-server: $schema=../schemas/person.schema.json\nname: Ada',
      '__tests__/fixtures/inline_schema/yaml/valid-person.yaml'
    ).kind
  ).toBe('local')
})

test('returns no json inline schema reference when none is declared', () => {
  expect(
    jsonInlineSchemaReference(
      {name: 'Ada Lovelace'},
      '__tests__/fixtures/inline_schema/json/valid-person.json'
    )
  ).toStrictEqual({kind: 'none'})
})

test('returns json inline schema extraction errors', () => {
  expect(
    jsonInlineSchemaReference(
      {$schema: false},
      '__tests__/fixtures/inline_schema/json/valid-person.json'
    )
  ).toStrictEqual({
    kind: 'error',
    message: 'Inline JSON schema reference must be a string'
  })
})

test('returns no yaml inline schema reference when none is declared', () => {
  expect(
    yamlInlineSchemaReference(
      'name: Ada Lovelace',
      '__tests__/fixtures/inline_schema/yaml/valid-person.yaml'
    )
  ).toStrictEqual({kind: 'none'})
})

test('returns yaml inline schema extraction errors', () => {
  expect(
    yamlInlineSchemaReference(
      '# yaml-language-server: $schema=',
      '__tests__/fixtures/inline_schema/yaml/valid-person.yaml'
    )
  ).toStrictEqual({
    kind: 'error',
    message: 'Inline YAML schema reference must be non-empty'
  })
})
