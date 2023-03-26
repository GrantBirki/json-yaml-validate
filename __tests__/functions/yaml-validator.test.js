import {yamlValidator} from '../../src/functions/yaml-validator'
import * as core from '@actions/core'

const errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})
const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_YAML_SCHEMA = './__tests__/fixtures/schemas/schema1.yaml'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/yaml/valid'
  process.env.INPUT_YAML_EXTENSION = '.yaml'
  process.env.INPUT_YAML_EXTENSION_SHORT = '.yml'
  process.env.INPUT_YAML_EXCLUDE_REGEX = '.*bad.*\\.yaml'
})

test('successfully validates a yaml file with a schema', async () => {
  expect(await yamlValidator()).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('successfully validates a yaml file without using a schema', async () => {
  process.env.INPUT_YAML_SCHEMA = ''
  expect(await yamlValidator()).toStrictEqual({
    failed: 0,
    passed: 1,
    skipped: 0,
    success: true,
    violations: []
  })
})

test('fails to validate a yaml file without using a schema', async () => {
  process.env.INPUT_YAML_SCHEMA = ''
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/yaml/invalid'
  expect(await yamlValidator()).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 1,
    success: false,
    violations: [
      {
        file: './__tests__/fixtures/yaml/invalid/yaml1.yaml',
        errors: [
          {
            path: null,
            message: 'Invalid YAML'
          }
        ]
      }
    ]
  })
  expect(errorMock).toHaveBeenCalledWith(
    '❌ failed to parse YAML file: ./__tests__/fixtures/yaml/invalid/yaml1.yaml'
  )
  expect(infoMock).toHaveBeenCalledWith(
    'skipping due to exclude match: ./__tests__/fixtures/yaml/invalid/skip-bad.yaml'
  )
})

test('fails to validate a yaml file with an incorrect schema', async () => {
  process.env.INPUT_YAML_SCHEMA = './__tests__/fixtures/schemas/schema2.yml'
  expect(await yamlValidator()).toStrictEqual({
    failed: 1,
    passed: 0,
    skipped: 0,
    success: false,
    violations: [
      {
        file: './__tests__/fixtures/yaml/valid/yaml1.yaml',
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
      '❌ failed to parse YAML file: ./__tests__/fixtures/yaml/valid/yaml1.yaml'
    )
  )
})

test('fails to validate one yaml file with an incorrect schema and succeeds on the other', async () => {
  process.env.INPUT_YAML_SCHEMA = './__tests__/fixtures/schemas/schema2.yml'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/yaml/mixture'
  expect(await yamlValidator()).toStrictEqual({
    failed: 1,
    passed: 1,
    skipped: 0,
    success: false,
    violations: [
      {
        file: './__tests__/fixtures/yaml/mixture/yaml1.yaml',
        errors: [
          {
            path: 'person.age',
            message: 'person.age must be of type String.'
          }
        ]
      }
    ]
  })
  expect(infoMock).toHaveBeenCalledWith(
    './__tests__/fixtures/yaml/mixture/yaml2.yml is valid'
  )
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse YAML file: ./__tests__/fixtures/yaml/mixture/yaml1.yaml'
    )
  )
})
