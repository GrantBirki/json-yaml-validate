import * as core from '@actions/core'

// Helper function to process the results of json and yaml validation
export async function processResults(jsonResults, yamlResults) {
  if (jsonResults.success === true) {
    core.info('✅ all JSON files are valid')
    core.setOutput('success', 'true')
    return true
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
    core.setOutput('success', 'false')
    core.setFailed(`❌ ${jsonResults.failed} JSON files failed validation`)
    return false
  }
}
