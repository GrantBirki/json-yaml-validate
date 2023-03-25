import * as core from '@actions/core'
import {run} from '../src/main'
import * as jsonValidator from '../src/functions/json-validator'

const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(jsonValidator, 'jsonValidator').mockImplementation(() => {
    return {success: true}
  })
})

test('successfully runs the action', async () => {
  expect(await run()).toBe(true)
  expect(infoMock).toHaveBeenCalledWith('✅ all JSON files are valid')
})

test('fails the action due to json errors', async () => {
  jest.spyOn(jsonValidator, 'jsonValidator').mockImplementation(() => {
    return {success: false, failed: 3, passed: 8}
  })
  expect(await run()).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    'JSON Validation Results:\n  - Passed: 8\n  - Failed: 3'
  )
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ 3 JSON files failed validation'
  )
})
