import {jsonValidator} from '../../src/functions/json-validator'
import * as core from '@actions/core'

const debugMock = jest.spyOn(core, 'debug').mockImplementation(() => {})
const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
const errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})
const warningMock = jest.spyOn(core, 'warning').mockImplementation(() => {})

class Exclude {
  isExcluded() {
    return false
  }
}

const excludeMock = new Exclude()

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_JSON_SCHEMA = '__tests__/fixtures/schemas/schema1.json'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/json/valid'
  process.env.INPUT_JSON_EXTENSION = '.json'
  process.env.INPUT_JSON_EXCLUDE_REGEX = '.*bad.*\\.json'
  process.env.INPUT_YAML_AS_JSON = 'false'
  process.env.INPUT_USE_DOT_MATCH = 'true'
  process.env.INPUT_USE_AJV_FORMATS = true
  process.env.INPUT_YAML_EXTENSION = '.yaml'
  process.env.INPUT_YAML_EXTENSION_SHORT = '.yml'
  process.env.INPUT_FILES = ''
  process.env.INPUT_JSON_SCHEMA_VERSION = 'draft-07'
  process.env.INPUT_AJV_STRICT_MODE = 'true'
  process.env.INPUT_AJV_CUSTOM_REGEXP_FORMATS = ''
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

test('successfully validates a json file with a schema and defaults to the draft-07 schema version when none is set', async () => {
  const badJsonSchemaVersion = 'evil-draft-999'
  process.env.INPUT_JSON_SCHEMA_VERSION = badJsonSchemaVersion
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
  expect(warningMock).toHaveBeenCalledWith(
    `json_schema_version '${badJsonSchemaVersion}' is not supported. Defaulting to 'draft-07'`
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
    '__tests__/fixtures/json/project_dir/schemas/schema.json'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/json/project_dir'
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
    '__tests__/fixtures/json/project_dir/schemas/schema.json'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/json/project_dir'
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
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/json/invalid'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 1,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/json/invalid/json1.json',
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
    '❌ failed to parse JSON file: __tests__/fixtures/json/invalid/json1.json'
  )
  expect(infoMock).toHaveBeenCalledWith(
    'skipping due to exclude match: __tests__/fixtures/json/invalid/skip-bad.json'
  )
})

test('fails to validate a json file with an incorrect schema', async () => {
  process.env.INPUT_JSON_SCHEMA = '__tests__/fixtures/schemas/schema2.json'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/json/valid/json1.json',
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
      '❌ failed to parse JSON file: __tests__/fixtures/json/valid/json1.json'
    )
  )
})

test('fails to validate one json file with an incorrect schema and succeeds on the other', async () => {
  process.env.INPUT_JSON_SCHEMA = '__tests__/fixtures/schemas/schema2.json'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/json/mixture'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 1,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/json/mixture/json1.json',
        errors: [
          {
            path: '/foo',
            message: 'must be string'
          },
          {
            path: '/bar',
            message: 'must be string'
          }
        ]
      }
    ]
  })
  expect(infoMock).toHaveBeenCalledWith(
    '__tests__/fixtures/json/mixture/json2.json is valid'
  )
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse JSON file: __tests__/fixtures/json/mixture/json1.json'
    )
  )
})

test('successfully validates a yaml file with a schema when yaml_as_json is true', async () => {
  process.env.INPUT_YAML_AS_JSON = 'true'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml_as_json/valid'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('successfully validates a json file and skips over the yaml one in the json processor', async () => {
  process.env.INPUT_YAML_AS_JSON = 'false'
  process.env.INPUT_BASE_DIR = '.'
  process.env.INPUT_JSON_SCHEMA = ''
  process.env.INPUT_FILES = `
  __tests__/fixtures/json/with_yaml/**/test1.yml,
  __tests__/fixtures/json/with_yaml/**/test*.json
`

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 2,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('processes multiple files when yaml_as_json is true and also a mixture of other json files with yaml are present', async () => {
  process.env.INPUT_YAML_AS_JSON = 'true'
  process.env.INPUT_JSON_SCHEMA = ''
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml_as_json/mixture'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 3,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/yaml_as_json/mixture/invalid-json.json',
        errors: [
          {
            path: null,
            message: 'Invalid JSON'
          }
        ]
      }
    ]
  })

  expect(debugMock).toHaveBeenCalledWith(
    'using ajv-formats with json-validator'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using baseDir: __tests__/fixtures/yaml_as_json/mixture'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using glob: **/*{.json,yaml,yml}'
  )
  expect(debugMock).toHaveBeenCalledWith(
    `attempting to process yaml file: '__tests__/fixtures/yaml_as_json/mixture/yaml1.yaml' as json`
  )
  expect(debugMock).toHaveBeenCalledWith(
    `attempting to process yaml file: '__tests__/fixtures/yaml_as_json/mixture/yaml2.yml' as json`
  )
})

test('processes a real world example when yaml_as_json is true and the single file contains multiple schema errors', async () => {
  process.env.INPUT_YAML_AS_JSON = 'true'
  process.env.INPUT_JSON_SCHEMA = '__tests__/fixtures/schemas/challenge.json'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/real_world/challenges'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/real_world/challenges/challenge.yml',
        errors: [
          {
            path: null,
            message: `must have required property 'inputFormat'`
          },
          {
            path: null,
            message: `must have required property 'publicTests'`
          }
        ]
      }
    ]
  })

  expect(debugMock).toHaveBeenCalledWith(
    'using ajv-formats with json-validator'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using baseDir: __tests__/fixtures/real_world/challenges'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using glob: **/*{.json,yaml,yml}'
  )
  expect(debugMock).toHaveBeenCalledWith(
    `attempting to process yaml file: '__tests__/fixtures/real_world/challenges/challenge.yml' as json`
  )
})

test('processes a real world example when yaml_as_json is true and the single file contains multiple schema errors and uses the 2020 ajv schema', async () => {
  process.env.INPUT_YAML_AS_JSON = 'true'
  process.env.INPUT_JSON_SCHEMA = '__tests__/fixtures/schemas/challenge.json'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/real_world/challenges'
  process.env.INPUT_JSON_SCHEMA_VERSION = 'draft-2020-12'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/real_world/challenges/challenge.yml',
        errors: [
          {
            path: null,
            message: `must have required property 'inputFormat'`
          },
          {
            path: null,
            message: `must have required property 'publicTests'`
          }
        ]
      }
    ]
  })

  expect(debugMock).toHaveBeenCalledWith(
    'using ajv-formats with json-validator'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using baseDir: __tests__/fixtures/real_world/challenges'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using glob: **/*{.json,yaml,yml}'
  )
  expect(debugMock).toHaveBeenCalledWith(
    `attempting to process yaml file: '__tests__/fixtures/real_world/challenges/challenge.yml' as json`
  )
})

test('processes a real world example when yaml_as_json is true and the single file contains multiple schema errors and uses the 2019 ajv schema', async () => {
  process.env.INPUT_YAML_AS_JSON = 'true'
  process.env.INPUT_JSON_SCHEMA = '__tests__/fixtures/schemas/challenge.json'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/real_world/challenges'
  process.env.INPUT_JSON_SCHEMA_VERSION = 'draft-2019-09'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/real_world/challenges/challenge.yml',
        errors: [
          {
            path: null,
            message: `must have required property 'inputFormat'`
          },
          {
            path: null,
            message: `must have required property 'publicTests'`
          }
        ]
      }
    ]
  })

  expect(debugMock).toHaveBeenCalledWith(
    'using ajv-formats with json-validator'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using baseDir: __tests__/fixtures/real_world/challenges'
  )
  expect(debugMock).toHaveBeenCalledWith(
    'json - using glob: **/*{.json,yaml,yml}'
  )
  expect(debugMock).toHaveBeenCalledWith(
    `attempting to process yaml file: '__tests__/fixtures/real_world/challenges/challenge.yml' as json`
  )
})

test('successfully validates json files with a schema when files is defined', async () => {
  const files = [
    '__tests__/fixtures/json/valid/json1.json',
    '__tests__/fixtures/json/project_dir/data/config/json1.json'
  ]
  process.env.INPUT_FILES = files.join('\n')

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 2,
    skipped: 0,
    success: true,
    violations: []
  })

  expect(debugMock).toHaveBeenCalledWith(`using files: ${files.join(', ')}`)
})

test('fails to validate a yaml file with an incorrect schema when yaml_as_json is true', async () => {
  process.env.INPUT_YAML_AS_JSON = 'true'
  process.env.INPUT_BASE_DIR = '__tests__/fixtures/yaml_as_json/invalid'

  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/yaml_as_json/invalid/yaml1.yaml',
        errors: [
          {
            path: null,
            message: "must have required property 'foo'"
          },
          {
            path: null,
            message: 'must NOT have additional properties'
          }
        ]
      }
    ]
  })
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse JSON file: __tests__/fixtures/yaml_as_json/invalid/yaml1.yaml'
    )
  )
})

test('successfully validates a json file with a schema containing a custom ajv format when custom format was added', async () => {
  process.env.INPUT_JSON_SCHEMA =
    '__tests__/fixtures/schemas/schema_with_custom_ajv_regexp_format.json'
  process.env.INPUT_FILES =
    '__tests__/fixtures/json/custom_ajv_regexp_format/valid.json'
  process.env.INPUT_AJV_CUSTOM_REGEXP_FORMATS =
    'lowercase_char=^[a-z]*$\nlowercase_alphanumeric=^[a-z0-9]*$'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('fails to validate a json file with a schema containing a custom ajv format when custom format added', async () => {
  process.env.INPUT_JSON_SCHEMA =
    '__tests__/fixtures/schemas/schema_with_custom_ajv_regexp_format.json'
  process.env.INPUT_FILES =
    '__tests__/fixtures/json/custom_ajv_regexp_format/invalid.json'
  process.env.INPUT_AJV_CUSTOM_REGEXP_FORMATS =
    'lowercase_char=^[a-z]*$\nlowercase_alphanumeric=^[a-z0-9]*$'
  expect(await jsonValidator(excludeMock)).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: '__tests__/fixtures/json/custom_ajv_regexp_format/invalid.json',
        errors: [
          {
            path: '/lowercase_char_property',
            message: 'must match format "lowercase_char"'
          },
          {
            path: '/lowercase_alphanumeric_property',
            message: 'must match format "lowercase_alphanumeric"'
          }
        ]
      }
    ]
  })
})

test('todo - testcase needed for format referenced in schema but not added?', async () => {})

test('todo - testcase needed for invalid INPUT_AJV_CUSTOM_REGEXP_FORMATS input (structure, regex etc.)?', async () => {})
