import {yamlValidator} from '../../src/functions/yaml-validator'
import * as core from '@actions/core'

const debugMock = jest.spyOn(core, 'debug').mockImplementation(() => {})
const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
const errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})

class Exclude {
  isExcluded() {
    return false
  }
}

const excludeMock = new Exclude()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_YAML_SCHEMA = '__tests__/fixtures/schemas/schema1.yaml'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/valid'
  process.env.INPUT_YAML_EXTENSION = '.yaml'
  process.env.INPUT_YAML_EXTENSION_SHORT = '.yml'
  process.env.INPUT_YAML_EXCLUDE_REGEX = '.*bad.*\\.yaml'
  process.env.INPUT_YAML_AS_JSON = false
  process.env.INPUT_USE_DOT_MATCH = 'true'
  process.env.INPUT_FILES = ''
  process.env.INPUT_ALLOW_MULTIPLE_DOCUMENTS = 'false'
})

test('successfully validates a yaml file with a schema', async () => {
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('successfully skips a file found in the exclude txt file', async () => {
  class Exclude {
    isExcluded() {
      return true
    }
  }
  const excludeMock = new Exclude()
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 0,
    skipped: 1,
    success: true,
    violations: []
  })
})

test('successfully validates a yaml file without using a schema', async () => {
  process.env.INPUT_YAML_SCHEMA = ''
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('successfully validates a yaml file with a schema and skips the schema as well with the dot mode disabled', async () => {
  process.env.INPUT_USE_DOT_MATCH = 'false'
  process.env.INPUT_YAML_SCHEMA =
    '__tests__/fixtures/yaml/project_dir/schemas/schema.yml'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/project_dir'
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(
    `skipping yaml schema file: ${process.env.INPUT_YAML_SCHEMA}`
  )
})

test('successfully validates a yaml file with a schema and skips the schema as well', async () => {
  process.env.INPUT_YAML_SCHEMA =
    '__tests__/fixtures/yaml/project_dir/schemas/schema.yml'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/project_dir'
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 2,
    skipped: 0,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(
    `skipping yaml schema file: ${process.env.INPUT_YAML_SCHEMA}`
  )
})

test('fails to validate a yaml file without using a schema', async () => {
  process.env.INPUT_YAML_SCHEMA = ''
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/invalid'
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 1,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/yaml/invalid/yaml1.yaml',
        errors: [
          {
            path: null,
            message: 'Invalid YAML',
            error:
              'YAMLParseError Nested mappings are not allowed in compact mappings at line 4, column 17'
          }
        ]
      }
    ]
  })
  expect(errorMock).toHaveBeenCalledWith(
    '❌ failed to parse YAML file: __tests__/fixtures/yaml/invalid/yaml1.yaml'
  )
  expect(infoMock).toHaveBeenCalledWith(
    'skipping due to exclude match: __tests__/fixtures/yaml/invalid/skip-bad.yaml'
  )
})

test('successfully validates yaml files with a schema when files is defined and there are duplicates', async () => {
  // this file should only be validated once and not duplicated
  const files = [
    '__tests__/fixtures/yaml/valid/yaml1.yaml',
    '__tests__/fixtures/yaml/valid/yaml1.yaml'
  ]
  process.env.INPUT_FILES = files.join('\n')

  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(`using files: ${files.join(', ')}`)
})

test('fails to validate a yaml file with an incorrect schema', async () => {
  process.env.INPUT_YAML_SCHEMA = '__tests__/fixtures/schemas/schema2.yml'
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/yaml/valid/yaml1.yaml',
        errors: [
          {
            path: 'person.age',
            message: 'person.age must be of type String.'
          }
        ]
      }
    ]
  })
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse YAML file: __tests__/fixtures/yaml/valid/yaml1.yaml'
    )
  )
})

test('fails to validate one yaml file with an incorrect schema and succeeds on the other', async () => {
  process.env.INPUT_YAML_SCHEMA = '__tests__/fixtures/schemas/schema2.yml'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/mixture'
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 1,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/yaml/mixture/yaml1.yaml',
        errors: [
          {
            path: 'person.age',
            message: 'person.age must be of type String.'
          },
          {
            path: 'person.hobbies.1',
            message:
              'person.hobbies.1 must be either football, basketball or tennis.'
          }
        ]
      }
    ]
  })
  expect(infoMock).toHaveBeenCalledWith(
    '__tests__/fixtures/yaml/mixture/yaml2.yml is valid'
  )
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse YAML file: __tests__/fixtures/yaml/mixture/yaml1.yaml'
    )
  )
})

test('skips all files when yaml_as_json is true', async () => {
  process.env.INPUT_YAML_AS_JSON = true
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 0,
    skipped: 1,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(
    'skipping yaml since it should be treated as json: __tests__/fixtures/yaml/valid/yaml1.yaml'
  )
})

test('skips all files when yaml_as_json is true, even invalid ones', async () => {
  process.env.INPUT_YAML_AS_JSON = true
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/invalid'
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 0,
    skipped: 2,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(
    'skipping yaml since it should be treated as json: __tests__/fixtures/yaml/invalid/yaml1.yaml'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'skipping yaml since it should be treated as json: __tests__/fixtures/yaml/invalid/skip-bad.yaml'
  )
})

test('successfully validates a yaml file with multiple documents but fails on the other', async () => {
  process.env.INPUT_ALLOW_MULTIPLE_DOCUMENTS = 'true'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/multiple'
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 1,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/yaml/multiple/invalid.yaml',
        errors: [
          {
            path: null,
            message: 'Invalid YAML',
            error:
              'YAMLParseError Nested mappings are not allowed in compact mappings at line 13, column 9'
          }
        ]
      }
    ]
  })
  expect(infoMock).toHaveBeenCalledWith(
    `multiple documents found in file: __tests__/fixtures/yaml/multiple/yaml1.yaml`
  )
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse YAML file: __tests__/fixtures/yaml/multiple/invalid.yaml'
    )
  )
})

test('successfully skips YAML files that match yaml_exclude_regex', async () => {
  process.env.INPUT_YAML_EXCLUDE_REGEX = '.*valid.*\\.yaml'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/valid'
  
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 0,
    skipped: 1,
    success: true,
    violations: []
  })
  
  expect(infoMock).toHaveBeenCalledWith(
    expect.stringMatching('skipping due to exclude match:')
  )
})

test('handles yaml_exclude_regex with empty string (no exclusion)', async () => {
  process.env.INPUT_YAML_EXCLUDE_REGEX = ''
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/valid'
  
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('successfully validates YAML with multiple documents enabled but single document', async () => {
  process.env.INPUT_ALLOW_MULTIPLE_DOCUMENTS = 'true'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/valid'
  
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('processes YAML files with custom file patterns', async () => {
  process.env.INPUT_FILES = '__tests__/fixtures/yaml/valid/yaml1.yaml'
  process.env.INPUT_BASE_DIR = '.'

  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(
    expect.stringMatching('using files:')
  )
})

test('handles use_dot_match disabled', async () => {
  process.env.INPUT_USE_DOT_MATCH = 'false'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/valid'
  
  expect(await yamlValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('handles schema validation error with null path (covers line 177)', async () => {
  // This test requires a schema validation error with no path
  process.env.INPUT_YAML_SCHEMA = '__tests__/fixtures/schemas/schema1.yaml'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/invalid'
  
  const result = await yamlValidator(excludeMock)
  expect(result.success).toBe(false)
  expect(result.failed).toBeGreaterThan(0)
  
  // Check that we have at least one error with path: null
  const hasNullPath = result.violations.some(v => 
    v.errors.some(e => e.path === null)
  )
  expect(hasNullPath).toBe(true)
})

test('edge case: empty yaml_exclude_regex with complex file structure', async () => {
  process.env.INPUT_YAML_EXCLUDE_REGEX = ''
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/mixture'
  
  const result = await yamlValidator(excludeMock)
  expect(result.passed + result.failed).toBeGreaterThan(0)
})

test('edge case: yaml files with custom extensions', async () => {
  process.env.INPUT_YAML_EXTENSION = '.custom'
  process.env.INPUT_YAML_EXTENSION_SHORT = '.cust'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/valid'
  
  // Should find no files with custom extensions
  const result = await yamlValidator(excludeMock)
  expect(result.passed + result.failed + result.skipped).toBe(0)
})

test('edge case: yaml schema file skipping', async () => {
  process.env.INPUT_YAML_SCHEMA = '__tests__/fixtures/schemas/schema1.yaml'
  process.env.INPUT_FILES = '__tests__/fixtures/schemas/schema1.yaml\n__tests__/fixtures/yaml/valid/yaml1.yaml'
  process.env.INPUT_BASE_DIR = '.'
  
  const result = await yamlValidator(excludeMock)
  expect(result.passed).toBe(1) // Only yaml1.yaml should be processed
  
  expect(debugMock).toHaveBeenCalledWith(
    expect.stringMatching('skipping yaml schema file:')
  )
})

test('edge case: mixed valid and invalid yaml with multiple documents disabled', async () => {
  process.env.INPUT_ALLOW_MULTIPLE_DOCUMENTS = 'false'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml/mixture'
  
  const result = await yamlValidator(excludeMock)
  expect(result.passed + result.failed).toBeGreaterThan(0)
})

test('edge case: yaml with empty/minimal data structure', async () => {
  // Create a temporary minimal YAML file
  const fs = require('fs')
  const tempFile = '/tmp/minimal.yaml'
  fs.writeFileSync(tempFile, 'null')
  
  process.env.INPUT_FILES = tempFile
  process.env.INPUT_BASE_DIR = '.'
  process.env.INPUT_YAML_SCHEMA = ''
  
  const result = await yamlValidator(excludeMock)
  expect(result.passed).toBe(1)
  
  // Cleanup
  fs.unlinkSync(tempFile)
})

test('edge case: yaml with undefined/null values in error paths', async () => {
  // This test tries to trigger a schema error with a null/undefined path
  const fs = require('fs')
  const tempFile = '/tmp/null_path_error.yaml'
  fs.writeFileSync(tempFile, 'invalid_structure: true\nextra_field: not_allowed')
  
  process.env.INPUT_FILES = tempFile
  process.env.INPUT_BASE_DIR = '.'
  process.env.INPUT_YAML_SCHEMA = '__tests__/fixtures/schemas/schema1.yaml'
  
  const result = await yamlValidator(excludeMock)
  expect(result.failed + result.passed).toBeGreaterThan(0)
  
  // Cleanup
  fs.unlinkSync(tempFile)
})
