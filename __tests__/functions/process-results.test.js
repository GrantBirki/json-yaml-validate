import * as core from '@actions/core'
import {processResults} from '../../src/functions/process-results'

const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation(() => {})
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation(() => {})

const violations = [
  {
    file: './__tests__/fixtures/json/invalid/json1.json',
    errors: [
      {
        path: null,
        message: 'Invalid JSON'
      }
    ]
  },
  {
    file: './__tests__/fixtures/json/invalid/json2.json',
    errors: [
      {
        path: '/foo',
        message: 'must be string'
      }
    ]
  }
]

beforeEach(() => {
  jest.clearAllMocks()
})

test('successfully runs the action', async () => {
  expect(await processResults({success: true, failed: 0, passed: 12, violations}, null)).toBe(true)
  expect(infoMock).toHaveBeenCalledWith('✅ all JSON files are valid')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
})

test('fails the action due to json errors', async () => {
  expect(await processResults({success: false, failed: 3, passed: 8, violations}, null)).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    `JSON Validation Results:\n  - Passed: 8\n  - Failed: 3\n  - Violations: ${JSON.stringify(
      violations,
      null,
      2
    )}`
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ 3 JSON files failed validation'
  )
  expect(setOutputMock).toHaveBeenCalledWith('success', 'false')
})
