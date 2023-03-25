import * as core from '@actions/core'

// Helper function to check the results of json and yaml validation
// :param results: the results of the validation
// :param type: the type of validation (json or yaml)
// :returns: true if the results are valid, false if they are not
async function checkResults(results, type) {
  if (results.success === true) {
    core.info(`✅ all ${type} files are valid`)
  } else {
    core.info(
      `${type} Validation Results:\n  - Passed: ${
        results.passed
      }\n  - Failed: ${results.failed}\n  - Violations: ${JSON.stringify(
        results.violations,
        null,
        2
      )}`
    )
    core.error(`❌ ${results.failed} ${type} files failed validation`)
    return false
  }
  return true
}

// Helper function to process the results of json and yaml validation
export async function processResults(jsonResults, yamlResults) {
  var success = true

  // check the json results
  const jsonResult = await checkResults(jsonResults, 'JSON')
  const yamlResult = await checkResults(yamlResults, 'YAML')

  if (jsonResult === false || yamlResult === false) {
    success = false
    core.setFailed('❌ JSON or YAML files failed validation')
  }

  core.setOutput('success', `${success}`)
  return success
}
