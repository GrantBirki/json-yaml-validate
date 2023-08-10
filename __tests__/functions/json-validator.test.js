import {jsonValidator} from '../../src/functions/json-validator'
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
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema1.json'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/valid'
  process.env.INPUT_JSON_EXTENSION = '.json'
  process.env.INPUT_JSON_EXCLUDE_REGEX = '.*bad.*\\.json'
  process.env.INPUT_YAML_AS_JSON = 'false'
  process.env.INPUT_USE_DOT_MATCH = 'true'
  process.env.INPUT_USE_AJV_FORMATS = true
})

test('successfully validates a json file with a schema', async () => {
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(
    'using ajv-formats with json-validator'
  )
})

test('successfully validates a json file without using a schema', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('successfully validates a json file without using a schema or ajv-formats', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  process.env.INPUT_USE_AJV_FORMATS = false
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
  expect(debugMock).toHaveBeenCalledWith(
    'ajv-formats will not be used with the json-validator'
  )
})

test('successfully skips a file found in the exclude txt file', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  class Exclude {
    isExcluded() {
      return true
    }
  }
  const excludeMock = new Exclude()
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 0,
    skipped: 1,
    success: true,
    violations: []
  })
})

test('successfully validates a json file with a schema and skips the schema as well while using the dot match in a disabled mode', async () => {
  process.env.INPUT_USE_DOT_MATCH = 'false'
  process.env.INPUT_JSON_SCHEMA =
    './__tests__/fixtures/json/project_dir/schemas/schema.json'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/project_dir'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
  expect(debugMock).toHaveBeenCalledWith(
    `skipping json schema file: ${process.env.INPUT_JSON_SCHEMA}`
  )
})

test('successfully validates a json file with a schema and skips the schema as well', async () => {
  process.env.INPUT_JSON_SCHEMA =
    './__tests__/fixtures/json/project_dir/schemas/schema.json'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/project_dir'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 2,
    skipped: 0,
    success: true,
    violations: []
  })
  expect(debugMock).toHaveBeenCalledWith(
    `skipping json schema file: ${process.env.INPUT_JSON_SCHEMA}`
  )
})

test('fails to validate a json file without using a schema', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/invalid'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 1,
    success: false,
    violations: [
      {
        file: './__tests__/fixtures/json/invalid/json1.json',
        errors: [
          {
            path: null,
            message: 'Invalid JSON'
          }
        ]
      }
    ]
  })
  expect(errorMock).toHaveBeenCalledWith(
    '❌ failed to parse JSON file: ./__tests__/fixtures/json/invalid/json1.json'
  )
  expect(infoMock).toHaveBeenCalledWith(
    'skipping due to exclude match: ./__tests__/fixtures/json/invalid/skip-bad.json'
  )
})

test('fails to validate a json file with an incorrect schema', async () => {
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema2.json'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: './__tests__/fixtures/json/valid/json1.json',
        errors: [
          {
            path: '/foo',
            message: 'must be string'
          }
        ]
      }
    ]
  })
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse JSON file: ./__tests__/fixtures/json/valid/json1.json'
    )
  )
})

test('fails to validate one json file with an incorrect schema and succeeds on the other', async () => {
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema2.json'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/mixture'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 1,
    skipped: 0,
    success: false,
    violations: [
      {
        file: './__tests__/fixtures/json/mixture/json1.json',
        errors: [
          {
            path: '/foo',
            message: 'must be string'
          }
        ]
      }
    ]
  })
  expect(infoMock).toHaveBeenCalledWith(
    './__tests__/fixtures/json/mixture/json2.json is valid'
  )
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse JSON file: ./__tests__/fixtures/json/mixture/json1.json'
    )
  )
})

test('successfully validates a yaml file with a schema when yaml_as_json is true', async () => {
  process.env.INPUT_YAML_AS_JSON = true
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/yaml_as_json/valid'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('fails to validate a yaml file with an incorrect schema when yaml_as_json is true', async () => {
  process.env.INPUT_YAML_AS_JSON = true
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/yaml_as_json/invalid'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: './__tests__/fixtures/yaml_as_json/invalid/yaml1.yaml',
        errors: [
          {
            path: null,
            message: "must have required property 'foo'"
          }
        ]
      }
    ]
  })
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse JSON file: ./__tests__/fixtures/yaml_as_json/invalid/yaml1.yaml'
    )
  )
})
