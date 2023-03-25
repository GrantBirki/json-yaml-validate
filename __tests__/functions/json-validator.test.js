import {jsonValidator} from '../../src/functions/json-validator'
import * as core from '@actions/core'

const errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})
const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema1.json'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/valid'
  process.env.INPUT_JSON_EXTENSION = '.json'
})

test('successfully validates a json file with a schema', async () => {
  expect(await jsonValidator()).toStrictEqual({
    failed: 0,
    passed: 1,
    success: true,
    violations: []
  })
})

test('successfully validates a json file without using a schema', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  expect(await jsonValidator()).toStrictEqual({
    failed: 0,
    passed: 1,
    success: true,
    violations: []
  })
})

test('fails to validate a json file without using a schema', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/invalid'
  expect(await jsonValidator()).toStrictEqual({
    failed: 1,
    passed: 0,
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
  expect(infoMock).not.toHaveBeenCalled()
})

test('fails to validate a json file with an incorrect schema', async () => {
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema2.json'
  expect(await jsonValidator()).toStrictEqual({
    failed: 1,
    passed: 0,
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
  expect(await jsonValidator()).toStrictEqual({
    failed: 1,
    passed: 1,
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
    '✅ ./__tests__/fixtures/json/mixture/json2.json is valid'
  )
  expect(errorMock).toHaveBeenCalledWith(
    expect.stringMatching(
      '❌ failed to parse JSON file: ./__tests__/fixtures/json/mixture/json1.json'
    )
  )
})
