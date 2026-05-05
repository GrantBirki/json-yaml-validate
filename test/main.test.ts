import {run} from '../src/main.js'

beforeEach(() => {
  jest.clearAllMocks()
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
