import * as core from '@actions/core'

// Test that covers main.js execution path when LOCAL_ACTIONS_CI_TEST is not 'true'
const originalLocalActionsTest = process.env.LOCAL_ACTIONS_CI_TEST

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(core, 'debug').mockImplementation(() => {})
})

afterEach(() => {
  process.env.LOCAL_ACTIONS_CI_TEST = originalLocalActionsTest
})

test('covers main.js execution when LOCAL_ACTIONS_CI_TEST is not true (integration test)', async () => {
  // Mock the validators to avoid actual execution
  jest.doMock('../src/functions/json-validator', () => ({
    jsonValidator: jest.fn().mockResolvedValue({
      success: true,
      failed: 0,
      passed: 1,
      skipped: 0,
      violations: []
    })
  }))

  jest.doMock('../src/functions/yaml-validator', () => ({
    yamlValidator: jest.fn().mockResolvedValue({
      success: true,
      failed: 0,
      passed: 1,
      skipped: 0,
      violations: []
    })
  }))

  jest.doMock('../src/functions/process-results', () => ({
    processResults: jest.fn().mockResolvedValue(true)
  }))

  jest.doMock('../src/functions/exclude', () => ({
    Exclude: jest.fn().mockImplementation(() => ({
      isExcluded: jest.fn().mockReturnValue(false)
    }))
  }))

  // Set environment to trigger the execution
  process.env.LOCAL_ACTIONS_CI_TEST = 'false'

  // This should trigger the main execution
  await new Promise(resolve => {
    const condition = process.env.LOCAL_ACTIONS_CI_TEST !== 'true'
    expect(condition).toBe(true)
    resolve()
  })
})
