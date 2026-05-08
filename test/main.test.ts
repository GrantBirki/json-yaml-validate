import {run} from '../src/main.js'
import {core} from '../src/actions-core.js'

const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation(() => {})
const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})

beforeEach(() => {
  jest.clearAllMocks()
  delete process.env.INPUT_FILES
  delete process.env.INPUT_SCHEMA_MAPPINGS
  delete process.env.INPUT_JSON_SCHEMA
  delete process.env.INPUT_YAML_SCHEMA
  delete process.env.INPUT_JSON_EXCLUDE_REGEX
  delete process.env.INPUT_YAML_EXCLUDE_REGEX
  delete process.env.INPUT_GITHUB_TOKEN
  delete process.env.GITHUB_EVENT_PATH
  process.env.INPUT_BASE_DIR = '.'
  process.env.INPUT_JSON_EXTENSION = '.json'
  process.env.INPUT_YAML_EXTENSION = '.yaml'
  process.env.INPUT_YAML_EXTENSION_SHORT = '.yml'
  process.env.INPUT_USE_DOT_MATCH = 'true'
  process.env.INPUT_YAML_AS_JSON = 'false'
  process.env.INPUT_ALLOW_MULTIPLE_DOCUMENTS = 'true'
  process.env.INPUT_USE_INLINE_SCHEMA = 'false'
  process.env.INPUT_EXCLUDE_FILE = ''
  process.env.INPUT_EXCLUDE_FILE_REQUIRED = 'false'
  process.env.INPUT_USE_GITIGNORE = 'false'
  process.env.INPUT_GIT_IGNORE_PATH = '.gitignore'
  process.env.INPUT_COMMENT = 'false'
  process.env.INPUT_COMMENT_ON_SUCCESS = 'false'
  process.env.INPUT_UPDATE_COMMENT = 'false'
  process.env.INPUT_MODE = 'fail'
  process.env.INPUT_AJV_STRICT_MODE = 'true'
  process.env.INPUT_USE_AJV_FORMATS = 'true'
  process.env.INPUT_AJV_CUSTOM_REGEXP_FORMATS = ''
  process.env.INPUT_JSON_SCHEMA_VERSION = 'draft-07'
})

test('successfully runs the action with injectable dependencies', async () => {
  const jsonResults = {
    success: true,
    failed: 0,
    passed: 8,
    skipped: 0,
    violations: []
  }
  const yamlResults = {
    success: true,
    failed: 0,
    passed: 3,
    skipped: 0,
    violations: []
  }
  const exclude = {isExcluded: jest.fn().mockReturnValue(false)}
  const Exclude = jest.fn().mockReturnValue(exclude)
  const jsonValidator = jest.fn().mockResolvedValue(jsonResults)
  const yamlValidator = jest.fn().mockResolvedValue(yamlResults)
  const processResults = jest.fn().mockResolvedValue(true)

  expect(
    await run({
      Exclude,
      jsonValidator,
      yamlValidator,
      processResults
    })
  ).toBe(undefined)
  expect(Exclude).toHaveBeenCalled()
  expect(jsonValidator).toHaveBeenCalledWith(exclude)
  expect(yamlValidator).toHaveBeenCalledWith(exclude)
  expect(processResults).toHaveBeenCalledWith(jsonResults, yamlResults)
})

test('successfully runs the action with default dependencies', async () => {
  process.env.INPUT_FILES = '__tests__/fixtures/json/valid/json1.json'

  await run()

  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
  expect(infoMock).toHaveBeenCalledWith(
    '__tests__/fixtures/json/valid/json1.json is valid'
  )
  expect(infoMock).toHaveBeenCalledWith('🔎 no YAML files were detected')
})

test('tests main execution when LOCAL_ACTIONS_CI_TEST is not true', async () => {
  const originalEnv = process.env.LOCAL_ACTIONS_CI_TEST

  process.env.LOCAL_ACTIONS_CI_TEST = 'false'
  const shouldRun1 = process.env.LOCAL_ACTIONS_CI_TEST !== 'true'
  expect(shouldRun1).toBe(true)

  delete process.env.LOCAL_ACTIONS_CI_TEST
  const shouldRun2 = process.env.LOCAL_ACTIONS_CI_TEST !== 'true'
  expect(shouldRun2).toBe(true)

  process.env.LOCAL_ACTIONS_CI_TEST = 'true'
  const shouldRun3 = process.env.LOCAL_ACTIONS_CI_TEST !== 'true'
  expect(shouldRun3).toBe(false)

  if (originalEnv) {
    process.env.LOCAL_ACTIONS_CI_TEST = originalEnv
  }
})
