import {core} from '../../src/actions-core.js'
import {processResults} from '../../src/functions/process-results.js'

const fs = require('fs')
const os = require('os')
const path = require('path')

const infoMock = jest.spyOn(core, 'info').mockImplementation(() => {})
const warningMock = jest.spyOn(core, 'warning').mockImplementation(() => {})
const errorMock = jest.spyOn(core, 'error').mockImplementation(() => {})
const setFailedMock = jest.spyOn(core, 'setFailed').mockImplementation(() => {})
const setOutputMock = jest.spyOn(core, 'setOutput').mockImplementation(() => {})
const originalFetch = global.fetch
let eventDir

function writeEvent(payload) {
  if (eventDir) {
    fs.rmSync(eventDir, {recursive: true, force: true})
  }

  eventDir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-yaml-event-'))
  const eventPath = path.join(eventDir, 'event.json')
  fs.writeFileSync(eventPath, JSON.stringify(payload))
  process.env.GITHUB_EVENT_PATH = eventPath
}

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
  process.env.INPUT_MODE = 'fail'
  process.env.INPUT_GITHUB_TOKEN = 'faketoken'
  process.env.INPUT_COMMENT = 'false'
  process.env.INPUT_COMMENT_ON_SUCCESS = 'false'
  process.env.GITHUB_REPOSITORY = 'corp/test'
  process.env.GITHUB_API_URL = 'https://api.github.com'
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 201,
    statusText: 'Created'
  })

  writeEvent({
    pull_request: {
      number: 123
    },
    repository: {
      full_name: 'corp/test'
    }
  })
})

afterEach(() => {
  delete process.env.GITHUB_EVENT_PATH
  delete process.env.GITHUB_API_URL
  if (eventDir) {
    fs.rmSync(eventDir, {recursive: true, force: true})
  }
  eventDir = undefined
  global.fetch = originalFetch
})

test('successfully processes the results with no JSON or YAML failures', async () => {
  expect(
    await processResults(
      {
        success: true,
        failed: 0,
        passed: 12,
        skipped: 0,
        violations: jsonViolations
      },
      {success: true, failed: 0, passed: 5, skipped: 0, violations: []}
    )
  ).toBe(true)
  expect(infoMock).toHaveBeenCalledWith(
    '✅ all 12 detected JSON files are valid'
  )
  expect(infoMock).toHaveBeenCalledWith(
    '✅ all 5 detected YAML files are valid'
  )
  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
  expect(global.fetch).not.toHaveBeenCalled()
})

test('successfully processes the results with no JSON or YAML detected files', async () => {
  expect(
    await processResults(
      {success: true, failed: 0, passed: 0, skipped: 0, violations: []},
      {success: true, failed: 0, passed: 0, skipped: 0, violations: []}
    )
  ).toBe(true)
  expect(infoMock).toHaveBeenCalledWith('🔎 no JSON files were detected')
  expect(infoMock).toHaveBeenCalledWith('🔎 no YAML files were detected')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
})

test('comments on pull requests when all validations pass and comment_on_success is enabled', async () => {
  process.env.INPUT_COMMENT_ON_SUCCESS = 'true'

  expect(
    await processResults(
      {success: true, failed: 0, passed: 12, skipped: 2, violations: []},
      {success: true, failed: 0, passed: 5, skipped: 1, violations: []}
    )
  ).toBe(true)

  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
  expect(infoMock).toHaveBeenCalledWith('📝 adding comment to PR #123')
  expect(global.fetch).toHaveBeenCalledWith(
    'https://api.github.com/repos/corp/test/issues/123/comments',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        authorization: 'Bearer faketoken',
        'content-type': 'application/json',
        'user-agent': 'json-yaml-validate-action'
      })
    })
  )

  const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body)
  const commentBody = requestBody.body
  expect(commentBody).toContain('✅ All detected JSON and YAML files are valid.')
  expect(commentBody).toContain('### JSON Validation Results')
  expect(commentBody).toContain('- ✅ File(s) Passed: 12')
  expect(commentBody).toContain('- ❌ File(s) Failed: 0')
  expect(commentBody).toContain('- ⏭️ File(s) Skipped: 2')
  expect(commentBody).toContain('### YAML Validation Results')
  expect(commentBody).toContain('- ✅ File(s) Passed: 5')
  expect(commentBody).toContain('- ⏭️ File(s) Skipped: 1')
  expect(commentBody).not.toContain('**Violations**:')
  expect(setFailedMock).not.toHaveBeenCalled()
})

test('does not comment on success outside a pull request', async () => {
  process.env.INPUT_COMMENT_ON_SUCCESS = 'true'
  writeEvent({
    push: {
      ref: 'refs/heads/main'
    },
    repository: {
      full_name: 'corp/test'
    }
  })

  expect(
    await processResults(
      {success: true, failed: 0, passed: 2, skipped: 0, violations: []},
      {success: true, failed: 0, passed: 1, skipped: 0, violations: []}
    )
  ).toBe(true)

  expect(global.fetch).not.toHaveBeenCalled()
  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
})

test('keeps successful validations passing when the success PR comment fails', async () => {
  process.env.INPUT_COMMENT_ON_SUCCESS = 'true'
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 403,
    statusText: 'Forbidden'
  })

  expect(
    await processResults(
      {success: true, failed: 0, passed: 2, skipped: 0, violations: []},
      {success: true, failed: 0, passed: 1, skipped: 0, violations: []}
    )
  ).toBe(true)

  expect(setOutputMock).toHaveBeenCalledWith('success', 'true')
  expect(warningMock).toHaveBeenCalledWith(
    'failed to create success PR comment: failed to create PR comment: 403 Forbidden'
  )
  expect(setFailedMock).not.toHaveBeenCalled()
})

test('fails the action due to json errors, but yaml is fine - warn mode', async () => {
  process.env.INPUT_MODE = 'warn'
  expect(
    await processResults(
      {
        success: false,
        failed: 2,
        passed: 8,
        skipped: 0,
        violations: jsonViolations
      },
      {success: true, failed: 0, passed: 3, skipped: 0, violations: []}
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    `JSON Validation Results:\n  - Passed: 8\n  - Failed: 2\n  - Skipped: 0\n  - Violations: ${JSON.stringify(
      jsonViolations,
      null,
      2
    )}`
  )
  expect(infoMock).toHaveBeenCalledWith(
    '✅ all 3 detected YAML files are valid'
  )
  expect(errorMock).toHaveBeenCalledWith('❌ 2 JSON files failed validation')
  expect(setOutputMock).toHaveBeenCalledWith('success', 'false')
  expect(errorMock).toHaveBeenCalledWith(
    '❌ JSON or YAML files failed validation'
  )
  expect(warningMock).toHaveBeenCalledWith(
    'mode is set to "warn" - this action will not fail'
  )
  expect(setFailedMock).not.toHaveBeenCalled()
})

test('fails the action due to yaml errors, but json is fine - unrecognized mode', async () => {
  process.env.INPUT_MODE = 'oh no'
  expect(
    await processResults(
      {success: true, failed: 0, passed: 10, skipped: 0, violations: []},
      {
        success: false,
        failed: 2,
        passed: 3,
        skipped: 0,
        violations: yamlViolations
      }
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    '✅ all 10 detected JSON files are valid'
  )
  expect(infoMock).toHaveBeenCalledWith(
    `YAML Validation Results:\n  - Passed: 3\n  - Failed: 2\n  - Skipped: 0\n  - Violations: ${JSON.stringify(
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
  expect(warningMock).toHaveBeenCalledWith('unrecognized mode: oh no')
})

test('fails the action due to yaml AND json errors', async () => {
  expect(
    await processResults(
      {
        success: false,
        failed: 2,
        passed: 114,
        skipped: 0,
        violations: jsonViolations
      },
      {
        success: false,
        failed: 2,
        passed: 3,
        skipped: 0,
        violations: yamlViolations
      }
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    `JSON Validation Results:\n  - Passed: 114\n  - Failed: 2\n  - Skipped: 0\n  - Violations: ${JSON.stringify(
      jsonViolations,
      null,
      2
    )}`
  )
  expect(infoMock).toHaveBeenCalledWith(
    `YAML Validation Results:\n  - Passed: 3\n  - Failed: 2\n  - Skipped: 0\n  - Violations: ${JSON.stringify(
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

test('fails the action due to yaml AND json errors - comment mode enabled', async () => {
  process.env.INPUT_COMMENT = 'true'
  expect(
    await processResults(
      {
        success: false,
        failed: 2,
        passed: 114,
        skipped: 0,
        violations: jsonViolations
      },
      {
        success: false,
        failed: 2,
        passed: 3,
        skipped: 0,
        violations: yamlViolations
      }
    )
  ).toBe(false)
  expect(infoMock).toHaveBeenCalledWith(
    `JSON Validation Results:\n  - Passed: 114\n  - Failed: 2\n  - Skipped: 0\n  - Violations: ${JSON.stringify(
      jsonViolations,
      null,
      2
    )}`
  )
  expect(infoMock).toHaveBeenCalledWith(
    `YAML Validation Results:\n  - Passed: 3\n  - Failed: 2\n  - Skipped: 0\n  - Violations: ${JSON.stringify(
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
test('tests constructBody function with JSON failures only (covers lines 50-67)', async () => {
  process.env.INPUT_COMMENT = 'true'
  expect(
    await processResults(
      {
        success: false,
        failed: 1,
        passed: 0,
        skipped: 0,
        violations: jsonViolations
      },
      {success: true, failed: 0, passed: 3, skipped: 0, violations: []}
    )
  ).toBe(false)

  // The constructBody function should have been called and created a comment
  expect(infoMock).toHaveBeenCalledWith(
    expect.stringMatching('📝 adding comment to PR')
  )
})

test('does not comment when comment mode is enabled outside a pull request', async () => {
  process.env.INPUT_COMMENT = 'true'
  writeEvent({
    push: {
      ref: 'refs/heads/main'
    },
    repository: {
      full_name: 'corp/test'
    }
  })

  expect(
    await processResults(
      {
        success: false,
        failed: 1,
        passed: 0,
        skipped: 0,
        violations: jsonViolations
      },
      {success: true, failed: 0, passed: 1, skipped: 0, violations: []}
    )
  ).toBe(false)

  expect(global.fetch).not.toHaveBeenCalled()
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ JSON or YAML files failed validation'
  )
})

test('does not comment when comment mode is enabled without an event path', async () => {
  process.env.INPUT_COMMENT = 'true'
  delete process.env.GITHUB_EVENT_PATH

  expect(
    await processResults(
      {
        success: false,
        failed: 1,
        passed: 0,
        skipped: 0,
        violations: jsonViolations
      },
      {success: true, failed: 0, passed: 1, skipped: 0, violations: []}
    )
  ).toBe(false)

  expect(global.fetch).not.toHaveBeenCalled()
  expect(setFailedMock).toHaveBeenCalledWith(
    '❌ JSON or YAML files failed validation'
  )
})

test('constructs a pull request comment body with both violation sections', async () => {
  process.env.INPUT_COMMENT = 'true'

  expect(
    await processResults(
      {
        success: false,
        failed: 2,
        passed: 1,
        skipped: 3,
        violations: jsonViolations
      },
      {
        success: false,
        failed: 1,
        passed: 4,
        skipped: 5,
        violations: yamlViolations
      }
    )
  ).toBe(false)

  expect(global.fetch).toHaveBeenCalledWith(
    'https://api.github.com/repos/corp/test/issues/123/comments',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        authorization: 'Bearer faketoken',
        'content-type': 'application/json',
        'user-agent': 'json-yaml-validate-action'
      })
    })
  )
  const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body)
  const commentBody = requestBody.body
  expect(commentBody).toContain('### JSON Validation Results')
  expect(commentBody).toContain('- ✅ File(s) Passed: 1')
  expect(commentBody).toContain('- ❌ File(s) Failed: 2')
  expect(commentBody).toContain('- ⏭️ File(s) Skipped: 3')
  expect(commentBody).toContain(JSON.stringify(jsonViolations, null, 2))
  expect(commentBody).toContain('### YAML Validation Results')
  expect(commentBody).toContain('- ✅ File(s) Passed: 4')
  expect(commentBody).toContain('- ❌ File(s) Failed: 1')
  expect(commentBody).toContain('- ⏭️ File(s) Skipped: 5')
  expect(commentBody).toContain(JSON.stringify(yamlViolations, null, 2))
})

test('fails when pull request comment creation fails', async () => {
  process.env.INPUT_COMMENT = 'true'
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    statusText: 'Server Error'
  })

  await expect(
    processResults(
      {
        success: false,
        failed: 1,
        passed: 0,
        skipped: 0,
        violations: jsonViolations
      },
      {success: true, failed: 0, passed: 1, skipped: 0, violations: []}
    )
  ).rejects.toThrow('failed to create PR comment: 500 Server Error')
})

test('tests constructBody function with YAML failures only (covers lines 69-86)', async () => {
  process.env.INPUT_COMMENT = 'true'
  expect(
    await processResults(
      {success: true, failed: 0, passed: 5, skipped: 0, violations: []},
      {
        success: false,
        failed: 1,
        passed: 0,
        skipped: 0,
        violations: yamlViolations
      }
    )
  ).toBe(false)

  // The constructBody function should have been called and created a comment
  expect(infoMock).toHaveBeenCalledWith(
    expect.stringMatching('📝 adding comment to PR')
  )
})
