import * as core from '@actions/core'
import * as github from '@actions/github'
import {context} from '@actions/github'
import dedent from 'dedent-js'

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
    }\n  - Violations: ${JSON.stringify(results.violations, null, 2)}`
  )
  core.error(`❌ ${results.failed} ${type} files failed validation`)
  return false
}

// Helper function to construct the body of the PR comment
// :param jsonResults: the results of the json validation
// :param yamlResults: the results of the yaml validation
// :returns: the body of the PR comment
async function constructBody(jsonResults, yamlResults) {
  var body = '## JSON and YAML Validation Results'

  if (jsonResults.success === false) {
    body += dedent(`

    ### JSON Validation Results

    - ✅ File(s) Passed: ${jsonResults.passed}
    - ❌ File(s) Failed: ${jsonResults.failed}
    
    **Violations**: 

    `)
    body += `\`\`\`json\n${JSON.stringify(
      jsonResults.violations,
      null,
      2
    )}\n\`\`\``
  }

  if (yamlResults.success === false) {
    body += dedent(`

    ### YAML Validation Results

    - ✅ File(s) Passed: ${yamlResults.passed}
    - ❌ File(s) Failed: ${yamlResults.failed}
    
    **Violations**: 

    `)
    body += `\`\`\`json\n${JSON.stringify(
      yamlResults.violations,
      null,
      2
    )}\n\`\`\``
  }

  return body
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
    core.setOutput('success', `true`)
    return true
  }

  // If we get here, the action failed
  core.setOutput('success', 'false')

  // check if the context is a pull request and if we should comment
  // fetch the pr number from the context
  if (
    context?.payload?.pull_request !== undefined &&
    context?.payload?.pull_request !== null &&
    core.getInput('comment') === 'true'
  ) {
    const octokit = github.getOctokit(
      core.getInput('github_token', {required: true})
    )

    // build the body of the comment
    const body = await constructBody(jsonResults, yamlResults)

    // add a comment to the pull request
    await octokit.rest.issues.createComment({
      ...context.repo,
      issue_number: context.issue.number,
      body: body
    })
  }

  // add final log messages and exit status of the action
  if (core.getInput('mode') === 'fail') {
    core.setFailed('❌ JSON or YAML files failed validation')
  } else if (core.getInput('mode') === 'warn') {
    core.warning('mode is set to "warn" - this action will not fail')
    core.error('❌ JSON or YAML files failed validation')
  } else {
    core.warning(`unrecognized mode: ${core.getInput('mode')}`)
    core.setFailed('❌ JSON or YAML files failed validation')
  }

  return false
}
