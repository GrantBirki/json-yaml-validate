import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {core} from '../src/actions-core.js'

const logMock = jest.spyOn(console, 'log').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.GITHUB_OUTPUT
  delete process.env.INPUT_BASIC
  delete process.env.INPUT_BOOLEAN
  delete process.env.INPUT_LINES
  process.exitCode = undefined
})

afterEach(() => {
  process.exitCode = undefined
})

test('reads string inputs with action-style normalization and trimming', () => {
  process.env.INPUT_BASIC = '  value  '
  process.env.INPUT_SPACED_NAME = '  spaced  '

  expect(core.getInput('basic')).toBe('value')
  expect(core.getInput('spaced name')).toBe('spaced')
  expect(core.getInput('basic', {trimWhitespace: false})).toBe('  value  ')
})

test('throws when a required input is missing', () => {
  expect(() => core.getInput('missing', {required: true})).toThrow(
    'Input required and not supplied: missing'
  )
})

test('reads boolean inputs using the GitHub Actions boolean forms', () => {
  process.env.INPUT_BOOLEAN = 'TRUE'
  expect(core.getBooleanInput('boolean')).toBe(true)

  process.env.INPUT_BOOLEAN = 'false'
  expect(core.getBooleanInput('boolean')).toBe(false)

  process.env.INPUT_BOOLEAN = ''
  expect(core.getBooleanInput('boolean')).toBe(false)
})

test('rejects invalid boolean input values', () => {
  process.env.INPUT_BOOLEAN = 'sometimes'

  expect(() => core.getBooleanInput('boolean')).toThrow(
    'Input does not meet YAML 1.2 boolean format: boolean=sometimes'
  )
})

test('reads multiline inputs and filters blank lines', () => {
  process.env.INPUT_LINES = ' one \n\n two \n'

  expect(core.getMultilineInput('lines')).toStrictEqual(['one', 'two'])
  expect(core.getMultilineInput('missing')).toStrictEqual([])
})

test('emits GitHub command output for logs and legacy outputs', () => {
  core.debug('a%b\nc')
  core.error(new Error('bad'))
  core.warning('heads:tails,comma')
  core.setOutput('result', 'ok')

  expect(logMock).toHaveBeenCalledWith('::debug::a%25b%0Ac')
  expect(logMock).toHaveBeenCalledWith('::error::bad')
  expect(logMock).toHaveBeenCalledWith('::warning::heads:tails,comma')
  expect(logMock).toHaveBeenCalledWith('::set-output name=result::ok')
})

test('writes outputs to GITHUB_OUTPUT when available', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'actions-core-'))
  const outputPath = path.join(tempDir, 'output')
  process.env.GITHUB_OUTPUT = outputPath

  core.setOutput('answer', '42')

  const contents = fs.readFileSync(outputPath, 'utf8')
  expect(contents).toContain('answer<<ghadelimiter_')
  expect(contents).toContain('\n42\n')
  fs.rmSync(tempDir, {recursive: true, force: true})
})

test('marks the process as failed and logs the failure', () => {
  core.setFailed('nope')

  expect(process.exitCode).toBe(1)
  expect(logMock).toHaveBeenCalledWith('::error::nope')
})
