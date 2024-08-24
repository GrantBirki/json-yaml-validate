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
