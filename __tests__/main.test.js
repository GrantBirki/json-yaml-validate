import {run} from '../src/main'
import * as jsonValidator from '../src/functions/json-validator'

beforeEach(() => {
  jest.clearAllMocks()
})

test('successfully runs the action', async () => {
  jest.spyOn(jsonValidator, 'jsonValidator').mockImplementation(() => {
    return undefined
  })
  expect(await run()).toBe(undefined)
})
