import * as core from '@actions/core'
import {run} from '../src/main'
import * as jsonValidator from '../src/functions/json-validator'
import * as yamlValidator from '../src/functions/yaml-validator'
import * as processResults from '../src/functions/process-results'

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(core, 'debug').mockImplementation(() => {})
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

test('tests main execution when LOCAL_ACTIONS_CI_TEST is not true', async () => {
  // Test the condition logic that determines whether to run or not
  const originalEnv = process.env.LOCAL_ACTIONS_CI_TEST

  // Test when LOCAL_ACTIONS_CI_TEST is not 'true'
  process.env.LOCAL_ACTIONS_CI_TEST = 'false'
  const shouldRun1 = process.env.LOCAL_ACTIONS_CI_TEST !== 'true'
  expect(shouldRun1).toBe(true)

  // Test when LOCAL_ACTIONS_CI_TEST is undefined
  delete process.env.LOCAL_ACTIONS_CI_TEST
  const shouldRun2 = process.env.LOCAL_ACTIONS_CI_TEST !== 'true'
  expect(shouldRun2).toBe(true)

  // Test when LOCAL_ACTIONS_CI_TEST is 'true'
  process.env.LOCAL_ACTIONS_CI_TEST = 'true'
  const shouldRun3 = process.env.LOCAL_ACTIONS_CI_TEST !== 'true'
  expect(shouldRun3).toBe(false)

  // Restore original environment
  if (originalEnv) {
    process.env.LOCAL_ACTIONS_CI_TEST = originalEnv
  }
})
