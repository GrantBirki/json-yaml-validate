import * as core from '@actions/core'
import {processResults} from '../../src/functions/process-results'

const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
const errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation(() => {})
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation(() => {})

const jsonViolations = [
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
  expect(
    await processResults(
      {success: true, failed: 0, passed: 12, violations: jsonViolations},
      {success: true, failed: 0, passed: 5, violations: []}
    )
  ).toBe(true)
  expect(infoMock).toHaveBeenCalledWith('✅ all JSON files are valid')
  expect(infoMock).toHaveBeenCalledWith('✅ all YAML files are valid')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
})

test('fails the action due to json errors, but yaml is fine', async () => {
  expect(
    await processResults(
      {success: false, failed: 3, passed: 8, violations: jsonViolations},
      {success: true, failed: 0, passed: 3, violations: []}
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    `JSON Validation Results:\n  - Passed: 8\n  - Failed: 3\n  - Violations: ${JSON.stringify(
      jsonViolations,
      null,
      2
    )}`
  )
  expect(infoMock).toHaveBeenCalledWith('✅ all YAML files are valid')
  expect(errorMock).toHaveBeenCalledWith('❌ 3 JSON files failed validation')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'false')
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ JSON or YAML files failed validation'
  )
})
