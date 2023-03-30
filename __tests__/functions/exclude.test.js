import * as core from '@actions/core'
import {Exclude} from '../../src/functions/exclude'

const debugMock = jest.spyOn(core, 'debug').mockImplementation(() => {})

var exclude
beforeEach(() => {
  jest.clearAllMocks()
  process.env.INPUT_EXCLUDE_FILE = '__tests__/fixtures/exclude/exclude.txt'
  exclude = new Exclude()
})

test('successfully excludes a file', () => {
  expect(exclude.isExcluded('exclude-me.json')).toBe(true)
  expect(debugMock).toHaveBeenCalledWith(
    `file exactly matches exclude pattern: exclude-me.json`
  )
})

test('successfully excludes a with a glob match', () => {
  expect(exclude.isExcluded('src/dev/app/nope.exclude')).toBe(true)
  expect(debugMock).toHaveBeenCalledWith(
    `file matches exclude glob pattern: *.exclude`
  )
})

test('successfully does not exclude a negate pattern match', () => {
  expect(exclude.isExcluded('cat.txt')).toBe(false)
  expect(debugMock).toHaveBeenCalledWith(
    `file matches exclude negation pattern: !cat.txt`
  )
})

test('successfully excludes a file where the negate pattern matches after', () => {
  expect(exclude.isExcluded('dog.txt')).toBe(true)
  expect(debugMock).toHaveBeenCalledWith(
    `file exactly matches exclude pattern: dog.txt`
  )
})

test('successfully excludes with a regex pattern match', () => {
  expect(exclude.isExcluded('src/app/cars-and-a-bus.txt')).toBe(true)
  expect(debugMock).toHaveBeenCalledWith(
    `file matches exclude regex pattern: /^.*cars.*\\.txt$/`
  )
})

test('successfully excludes a file in a dir one level down', () => {
  expect(exclude.isExcluded('./evil-base-dir/exclude-me.json')).toBe(true)
  expect(debugMock).toHaveBeenCalledWith(
    `file is in exclude directory: evil-base-dir/`
  )
})

test('successfully excludes a file in a dir two levels down', () => {
  expect(exclude.isExcluded('./evil-base-dir/sub-dir/exclude-me.json')).toBe(
    true
  )
  expect(debugMock).toHaveBeenCalledWith(
    `file is in exclude directory: evil-base-dir/`
  )
})

test('successfully checks a file and finds that it is not excluded', () => {
  expect(exclude.isExcluded('exclude-me-nope.json')).toBe(false)
  expect(debugMock).toHaveBeenCalledWith(
    `file 'exclude-me-nope.json' did not match any exclude patterns`
  )
})

test('does not exclude any files when no exclude file is used', () => {
  process.env.INPUT_EXCLUDE_FILE = ''
  const exclude = new Exclude()
  expect(exclude.isExcluded('exclude-me.json')).toBe(false)
  expect(debugMock).not.toHaveBeenCalled()
})
