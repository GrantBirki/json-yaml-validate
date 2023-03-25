import * as core from '@actions/core'

// Helper function to process the results of json and yaml validation
export async function processResults(jsonResults, yamlResults) {
  var success = true

  if (jsonResults.success === true) {
    core.info('✅ all JSON files are valid')
  } else {
    core.info(
      `JSON Validation Results:\n  - Passed: ${
        jsonResults.passed
      }\n  - Failed: ${jsonResults.failed}\n  - Violations: ${JSON.stringify(
        jsonResults.violations,
        null,
        2
      )}`
    )
    core.setFailed(`❌ ${jsonResults.failed} JSON files failed validation`)
    success = false
  }

  core.setOutput('success', `${success}`)
  return success
}
