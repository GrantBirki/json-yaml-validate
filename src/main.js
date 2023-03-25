import * as core from '@actions/core'
// import * as github from '@actions/github'
// import {context} from '@actions/github'
// import dedent from 'dedent-js'
import {jsonValidator} from './functions/json-validator'

export async function run() {
  const jsonResult = await jsonValidator()

  if (jsonResult.success === true) {
    core.info('✅ all JSON files are valid')
    return true
  } else {
    core.info(
      `JSON Validation Results:\n  - Passed: ${jsonResult.passed}\n  - Failed: ${jsonResult.failed}`
    )
    core.setFailed(`❌ ${jsonResult.failed} JSON files failed validation`)
    return false
  }
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
