// import * as core from '@actions/core'
// import * as github from '@actions/github'
// import {context} from '@actions/github'
// import dedent from 'dedent-js'
import {jsonValidator} from './functions/json-validator'

export async function run() {
  const jsonResult = await jsonValidator()

  if (jsonResult) {
    core.info('✅ All JSON files are valid')
  }
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
