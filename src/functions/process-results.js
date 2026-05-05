import * as core from '@actions/core'
import {readFileSync} from 'fs'

// Constants
const SUCCESS_OUTPUT_VALUE = 'true'
const FAILURE_OUTPUT_VALUE = 'false'
const MODE_FAIL = 'fail'
const MODE_WARN = 'warn'
const DEFAULT_GITHUB_API_URL = 'https://api.github.com'
const GITHUB_API_VERSION = '2022-11-28'

// Helper function to check the results of json and yaml validation
// :param results: the results of the validation
// :param type: the type of validation (json or yaml)
// :returns: true if the results are valid, false if they are not
async function checkResults(results, type) {
  // check if there were any scanned files
  if (results.passed === 0 && results.failed === 0) {
    core.info(`🔎 no ${type} files were detected`)
    return true
  }

  // print a nice success message if there were no errors
  if (results.success === true) {
    core.info(`✅ all ${results.passed} detected ${type} files are valid`)
    return true
  }

  // print the results of the validation if there were errors
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

// Helper function to construct the body of the PR comment
// :param jsonResults: the results of the json validation
// :param yamlResults: the results of the yaml validation
// :returns: the body of the PR comment
async function constructBody(jsonResults, yamlResults) {
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

function validationSection(type, results) {
  return [
    '',
    `### ${type} Validation Results`,
    '',
    `- ✅ File(s) Passed: ${results.passed}`,
    `- ❌ File(s) Failed: ${results.failed}`,
    `- ⏭️ File(s) Skipped: ${results.skipped}`,
    '',
    '**Violations**:',
    '',
    ''
  ].join('\n')
}

function getPullRequestContext() {
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

async function createPullRequestComment(token, pullRequestContext, body) {
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

// Helper function to process the results of json and yaml validation
// :param jsonResults: the results of the json validation
// :param yamlResults: the results of the yaml validation
// :returns: true if the results are valid, false if they are not
export async function processResults(jsonResults, yamlResults) {
  // check the json results
  const jsonResult = await checkResults(jsonResults, 'JSON')
  const yamlResult = await checkResults(yamlResults, 'YAML')

  // exit here if both JSON and YAML results are valid
  if (jsonResult === true && yamlResult === true) {
    core.setOutput('success', SUCCESS_OUTPUT_VALUE)
    return true
  }

  // If we get here, the action failed
  core.setOutput('success', FAILURE_OUTPUT_VALUE)

  // check if the context is a pull request and if we should comment
  if (core.getBooleanInput('comment')) {
    const pullRequestContext = getPullRequestContext()
    if (pullRequestContext === null) {
      return applyMode()
    }

    // build the body of the comment
    const body = await constructBody(jsonResults, yamlResults)

    // add a comment to the pull request
    core.info(`📝 adding comment to PR #${pullRequestContext.issueNumber}`)
    await createPullRequestComment(
      core.getInput('github_token', {required: true}),
      pullRequestContext,
      body
    )
  }

  return applyMode()
}

function applyMode() {
  // add final log messages and exit status of the action
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
