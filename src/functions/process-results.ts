import {readFileSync} from 'node:fs'
import {core} from '../actions-core.js'
import type {PullRequestContext, ValidationResult} from '../types.js'

const SUCCESS_OUTPUT_VALUE = 'true'
const FAILURE_OUTPUT_VALUE = 'false'
const MODE_FAIL = 'fail'
const MODE_WARN = 'warn'
const DEFAULT_GITHUB_API_URL = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'
const COMMENT_MARKER = '<!-- json-yaml-validate-comment -->'
const COMMENT_HEADER = '## JSON and YAML Validation Results'

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
  let body = [COMMENT_MARKER, COMMENT_HEADER].join('\n')

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
    COMMENT_MARKER,
    COMMENT_HEADER,
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
  const lines = [
    '',
    `### ${type} Validation Results`,
    '',
    `- ✅ File(s) Passed: ${results.passed}`,
    `- ❌ File(s) Failed: ${results.failed}`,
    `- ⏭️ File(s) Skipped: ${results.skipped}`,
    ''
  ]

  return lines.join('\n')
  /* node:coverage ignore next 2 */
}

interface PullRequestComment {
  body?: string | null
  id: number
}

function commentsUrl(pullRequestContext: PullRequestContext): string {
  return `${process.env.GITHUB_API_URL || DEFAULT_GITHUB_API_URL}/repos/${
    pullRequestContext.owner
  }/${pullRequestContext.repo}/issues/${
    pullRequestContext.issueNumber
  }/comments`
}

function commentUrl(
  pullRequestContext: PullRequestContext,
  commentId: number
): string {
  return `${process.env.GITHUB_API_URL || DEFAULT_GITHUB_API_URL}/repos/${
    pullRequestContext.owner
  }/${pullRequestContext.repo}/issues/comments/${commentId}`
}

function headers(token: string): Record<string, string> {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'json-yaml-validate-action',
    'x-github-api-version': GITHUB_API_VERSION
  }
}

function isValidationComment(comment: PullRequestComment): boolean {
  return (
    comment.body?.includes(COMMENT_MARKER) === true ||
    comment.body?.startsWith(COMMENT_HEADER) === true
  )
}

async function assertGitHubResponse(
  response: Response,
  action: string
): Promise<void> {
  if (!response.ok) {
    throw new Error(
      `failed to ${action}: ${response.status} ${response.statusText}`
    )
  }
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
  const response = await fetch(commentsUrl(pullRequestContext), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({body})
  })

  await assertGitHubResponse(response, 'create PR comment')
}

async function findPullRequestComment(
  token: string,
  pullRequestContext: PullRequestContext
): Promise<number | null> {
  let page = 1
  let matchingCommentId: number | null = null

  while (true) {
    const response = await fetch(
      `${commentsUrl(pullRequestContext)}?per_page=100&page=${page}`,
      {
        method: 'GET',
        headers: headers(token)
      }
    )
    await assertGitHubResponse(response, 'list PR comments')

    const comments = (await response.json()) as PullRequestComment[]
    for (const comment of comments) {
      if (isValidationComment(comment)) {
        matchingCommentId = comment.id
      }
    }

    if (comments.length < 100) {
      return matchingCommentId
    }

    page++
  }
}

async function updatePullRequestComment(
  token: string,
  pullRequestContext: PullRequestContext,
  commentId: number,
  body: string
): Promise<void> {
  const response = await fetch(commentUrl(pullRequestContext, commentId), {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({body})
  })

  await assertGitHubResponse(response, 'update PR comment')
}

async function writePullRequestComment(
  token: string,
  pullRequestContext: PullRequestContext,
  body: string,
  updateComment: boolean
): Promise<'created' | 'updated'> {
  if (updateComment) {
    const commentId = await findPullRequestComment(token, pullRequestContext)
    if (commentId !== null) {
      await updatePullRequestComment(token, pullRequestContext, commentId, body)
      return 'updated'
    }
  }

  await createPullRequestComment(token, pullRequestContext, body)
  return 'created'
}

async function commentOnPullRequest(body: string): Promise<boolean> {
  const pullRequestContext = getPullRequestContext()
  if (pullRequestContext === null) {
    return false
  }

  const token = core.getInput('github_token', {required: true})
  const action = await writePullRequestComment(
    token,
    pullRequestContext,
    body,
    core.getBooleanInput('update_comment')
  )
  core.info(`📝 ${action} comment on PR #${pullRequestContext.issueNumber}`)
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
