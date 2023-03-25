import {jsonValidator} from '../../src/functions/json-validator'
import * as core from '@actions/core'

const errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema1.json'
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/valid'
  process.env.INPUT_JSON_EXTENSION = '.json'
})

test('successfully validates a json file with a schema', async () => {
  expect(await jsonValidator()).toBe(true)
})

test('successfully validates a json file without using a schema', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  expect(await jsonValidator()).toBe(true)
})

test('fails to validate a json file without using a schema', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  process.env.INPUT_BASE_DIR = './__tests__/fixtures/json/invalid'
  expect(await jsonValidator()).toBe(false)
  expect(errorMock).toHaveBeenCalledWith(
    'failed to parse JSON file: ./__tests__/fixtures/json/invalid/json1.json'
  )
})

test('fails to validate a json file with an incorrect schema', async () => {
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema2.json'
  expect(await jsonValidator()).toBe(false)
  expect(errorMock).toHaveBeenCalledWith([
    {
      instancePath: '/foo',
      keyword: 'type',
      message: 'must be string',
      params: {type: 'string'},
      schemaPath: '#/properties/foo/type'
    }
  ])
})
