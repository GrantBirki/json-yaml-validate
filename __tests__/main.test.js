import {run} from '../src/main'
import * as jsonValidator from '../src/functions/json-validator'
import * as yamlValidator from '../src/functions/yaml-validator'
import * as processResults from '../src/functions/process-results'

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(jsonValidator, 'jsonValidator').mockImplementation(() => {
    return {success: true, failed: 0, passed: 8, skipped: 0, violations: []}
  })
  jest.spyOn(yamlValidator, 'yamlValidator').mockImplementation(() => {
    return {success: true, failed: 0, passed: 3, skipped: 0, violations: []}
  })
  jest.spyOn(processResults, 'processResults').mockImplementation(() => {
    return true
  })

  process.env.INPUT_USE_GITIGNORE = 'false'
  process.env.INPUT_EXCLUDE_FILE_REQUIRED = 'true'
})

test('successfully runs the action', async () => {
  expect(await run()).toBe(undefined)
})
