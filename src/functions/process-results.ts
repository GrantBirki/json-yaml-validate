import {readFileSync} from 'node:fs'
import {core} from '../actions-core.js'
import type {PullRequestContext, ValidationResult} from '../types.js'

const SUCCESS_OUTPUT_VALUE = 'true'
const FAILURE_OUTPUT_VALUE = 'false'
const MODE_FAIL = 'fail'
const MODE_WARN = 'warn'
const DEFAULT_GITHUB_API_URL = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'

async function checkResults(
  results: ValidationResult,
  type: 'JSON' | 'YAML'
): Promise<boolean> {
  if (results.passed === 0 && results.failed === 0) {
    core.info(`🔎 no ${type} files were detected`)
    return true
  }

  if (results.success === true) {
    core.info(`✅ all ${results.passed} detected ${type} files are valid`)
    return true
  }

  core.info(
    `${type} Validation Results:\n  - Passed: ${results.passed}\n  - Failed: ${
      results.failed
    }\n  - Skipped: ${results.skipped}\n  - Violations: ${JSON.stringify(
      results.violations,
      null,
      2
    )}`
  )
  core.error(`❌ ${results.failed} ${type} files failed validation`)
  return false
}

async function constructBody(
  jsonResults: ValidationResult,
  yamlResults: ValidationResult
): Promise<string> {
  let body = '## JSON and YAML Validation Results'

  if (jsonResults.success === false) {
    body += validationSection('JSON', jsonResults)
    body += `\`\`\`json\n${JSON.stringify(
      jsonResults.violations,
      null,
      2
    )}\n\`\`\``
  }

  if (yamlResults.success === false) {
    body += validationSection('YAML', yamlResults)
    body += `\`\`\`json\n${JSON.stringify(
      yamlResults.violations,
      null,
      2
    )}\n\`\`\``
  }

  return body
}

function constructSuccessBody(
  jsonResults: ValidationResult,
  yamlResults: ValidationResult
): string {
  return [
    '## JSON and YAML Validation Results',
    '',
    '✅ All detected JSON and YAML files are valid.',
    resultSection('JSON', jsonResults),
    resultSection('YAML', yamlResults)
  ].join('\n')
}

function validationSection(type: 'JSON' | 'YAML', results: ValidationResult) {
  return [
    resultSection(type, results),
    '**Violations**:',
    '',
    ''
  ].join('\n')
  /* node:coverage ignore next 2 */
}

function resultSection(type: 'JSON' | 'YAML', results: ValidationResult) {
  return [
    '',
    `### ${type} Validation Results`,
    '',
    `- ✅ File(s) Passed: ${results.passed}`,
    `- ❌ File(s) Failed: ${results.failed}`,
    `- ⏭️ File(s) Skipped: ${results.skipped}`,
    ''
  ].join('\n')
  /* node:coverage ignore next 2 */
}

function getPullRequestContext(): PullRequestContext | null {
  if (!process.env.GITHUB_EVENT_PATH) {
    return null
  }

  const payload = JSON.parse(
    readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')
  )
  if (!payload?.pull_request) {
    return null
  }

  const [owner, repo] = (
    process.env.GITHUB_REPOSITORY || payload.repository.full_name
  ).split('/')

  return {
    owner,
    repo,
    issueNumber: payload.pull_request.number
  }
}

async function createPullRequestComment(
  token: string,
  pullRequestContext: PullRequestContext,
  body: string
): Promise<void> {
  const response = await fetch(
    `${process.env.GITHUB_API_URL || DEFAULT_GITHUB_API_URL}/repos/${
      pullRequestContext.owner
    }/${pullRequestContext.repo}/issues/${
      pullRequestContext.issueNumber
    }/comments`,
    {
      method: 'POST',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'user-agent': 'json-yaml-validate-action',
        'x-github-api-version': GITHUB_API_VERSION
      },
      body: JSON.stringify({body})
    }
  )

  if (!response.ok) {
    throw new Error(
      `failed to create PR comment: ${response.status} ${response.statusText}`
    )
  }
}

async function commentOnPullRequest(body: string): Promise<boolean> {
  const pullRequestContext = getPullRequestContext()
  if (pullRequestContext === null) {
    return false
  }

  core.info(`📝 adding comment to PR #${pullRequestContext.issueNumber}`)
  await createPullRequestComment(
    core.getInput('github_token', {required: true}),
    pullRequestContext,
    body
  )
  return true
}

function warnSuccessCommentError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error)
  core.warning(`failed to create success PR comment: ${message}`)
}

export async function processResults(
  jsonResults: ValidationResult,
  yamlResults: ValidationResult
): Promise<boolean> {
  const jsonResult = await checkResults(jsonResults, 'JSON')
  const yamlResult = await checkResults(yamlResults, 'YAML')

  if (jsonResult === true && yamlResult === true) {
    core.setOutput('success', SUCCESS_OUTPUT_VALUE)
    if (core.getBooleanInput('comment_on_success')) {
      try {
        await commentOnPullRequest(
          constructSuccessBody(jsonResults, yamlResults)
        )
      } catch (error) {
        warnSuccessCommentError(error)
      }
    }
    return true
  }

  core.setOutput('success', FAILURE_OUTPUT_VALUE)

  if (core.getBooleanInput('comment')) {
    const body = await constructBody(jsonResults, yamlResults)
    await commentOnPullRequest(body)
  }

  return applyMode()
}

function applyMode(): boolean {
  if (core.getInput('mode') === MODE_FAIL) {
    core.setFailed('❌ JSON or YAML files failed validation')
  } else if (core.getInput('mode') === MODE_WARN) {
    core.warning('mode is set to "warn" - this action will not fail')
    core.error('❌ JSON or YAML files failed validation')
  } else {
    core.warning(`unrecognized mode: ${core.getInput('mode')}`)
    core.setFailed('❌ JSON or YAML files failed validation')
  }

  return false
}
