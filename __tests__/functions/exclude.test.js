import * as core from '@actions/core'
import {Exclude} from '../../src/functions/exclude'

const debugMock = jest.spyOn(core, 'debug').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_EXCLUDE_FILE = '__tests__/fixtures/exclude/exclude.txt'
})

test('successfully excludes a file', () => {
  const exclude = new Exclude()
  expect(exclude.isExcluded('exclude-me.json')).toBe(true)
  expect(debugMock).toHaveBeenCalledWith(`file exactly matches exclude pattern: exclude-me.json`)
})

test('successfully checks a file and finds that it is not excluded', () => {
  const exclude = new Exclude()
  expect(exclude.isExcluded('exclude-me-nope.json')).toBe(false)
  expect(debugMock).toHaveBeenCalledWith(`file 'exclude-me-nope.json' did not match any exclude patterns`)
})
