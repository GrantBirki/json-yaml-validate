import {run} from '../src/main'
import * as jsonValidator from '../src/functions/json-validator'
import * as processResults from '../src/functions/process-results'

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(jsonValidator, 'jsonValidator').mockImplementation(() => {
    return {success: true, failed: 0, passed: 8, violations: []}
  })
  jest.spyOn(processResults, 'processResults').mockImplementation(() => {
    return true
  })
})

test('successfully runs the action', async () => {
  expect(await run()).toBe(undefined)
})
