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

const yamlViolations = [
  {
    file: './__tests__/fixtures/yaml/invalid/yaml1.yaml',
    errors: [
      {
        path: null,
        message: 'Invalid YAML'
      }
    ]
  },
  {
    file: './__tests__/fixtures/yaml/invalid/yaml2.yaml',
    errors: [
      {
        path: 'person.age',
        message: 'person.age must be of type String.'
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
  expect(infoMock).toHaveBeenCalledWith('✅ all 12 detected JSON files are valid')
  expect(infoMock).toHaveBeenCalledWith('✅ all 5 detected YAML files are valid')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
})

test('fails the action due to json errors, but yaml is fine', async () => {
  expect(
    await processResults(
      {success: false, failed: 2, passed: 8, violations: jsonViolations},
      {success: true, failed: 0, passed: 3, violations: []}
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    `JSON Validation Results:\n  - Passed: 8\n  - Failed: 2\n  - Violations: ${JSON.stringify(
      jsonViolations,
      null,
      2
    )}`
  )
  expect(infoMock).toHaveBeenCalledWith('✅ all 3 detected YAML files are valid')
  expect(errorMock).toHaveBeenCalledWith('❌ 2 JSON files failed validation')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'false')
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ JSON or YAML files failed validation'
  )
})

test('fails the action due to yaml errors, but json is fine', async () => {
  expect(
    await processResults(
      {success: true, failed: 0, passed: 10, violations: []},
      {success: false, failed: 2, passed: 3, violations: yamlViolations}
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith('✅ all 10 detected JSON files are valid')
  expect(infoMock).toHaveBeenCalledWith(
    `YAML Validation Results:\n  - Passed: 3\n  - Failed: 2\n  - Violations: ${JSON.stringify(
      yamlViolations,
      null,
      2
    )}`
  )
  expect(errorMock).toHaveBeenCalledWith('❌ 2 YAML files failed validation')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'false')
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ JSON or YAML files failed validation'
  )
})

test('fails the action due to yaml AND json errors', async () => {
  expect(
    await processResults(
      {success: false, failed: 2, passed: 114, violations: jsonViolations},
      {success: false, failed: 2, passed: 3, violations: yamlViolations}
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    `JSON Validation Results:\n  - Passed: 114\n  - Failed: 2\n  - Violations: ${JSON.stringify(
      jsonViolations,
      null,
      2
    )}`
  )
  expect(infoMock).toHaveBeenCalledWith(
    `YAML Validation Results:\n  - Passed: 3\n  - Failed: 2\n  - Violations: ${JSON.stringify(
      yamlViolations,
      null,
      2
    )}`
  )
  expect(errorMock).toHaveBeenCalledWith('❌ 2 YAML files failed validation')
  expect(errorMock).toHaveBeenCalledWith('❌ 2 JSON files failed validation')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'false')
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ JSON or YAML files failed validation'
  )
})
