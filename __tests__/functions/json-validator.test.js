import {jsonValidator} from '../../src/functions/json-validator'

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_JSON_SCHEMA = './__tests__/fixtures/schemas/schema1.json'
})

test('successfully validates a json file with a schema', async () => {
  expect(await jsonValidator()).toBe(undefined)
})

test('successfully validates a json file with no schema', async () => {
  process.env.INPUT_JSON_SCHEMA = ''
  expect(await jsonValidator()).toBe(undefined)
})
