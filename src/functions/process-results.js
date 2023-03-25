import * as core from '@actions/core'

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

// Helper function to process the results of json and yaml validation
// :param jsonResults: the results of the json validation
// :param yamlResults: the results of the yaml validation
// :returns: true if the results are valid, false if they are not
export async function processResults(jsonResults, yamlResults) {
  var success = true

  // check the json results
  const jsonResult = await checkResults(jsonResults, 'JSON')
  const yamlResult = await checkResults(yamlResults, 'YAML')

  if (jsonResult === false || yamlResult === false) {
    success = false
    if (core.getInput('mode') === 'fail') {
      core.setFailed('❌ JSON or YAML files failed validation')
    } else if (core.getInput('mode') === 'warn') {
      core.warning('mode is set to "warn" - this action will not fail')
      core.error('❌ JSON or YAML files failed validation')
    } else {
      core.warning(`unrecognized mode: ${core.getInput('mode')}`)
      core.setFailed('❌ JSON or YAML files failed validation')
    }
  }

  core.setOutput('success', `${success}`)
  return success
}
