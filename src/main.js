// import * as core from '@actions/core'
// import * as github from '@actions/github'
// import {context} from '@actions/github'
// import dedent from 'dedent-js'
import {jsonValidator} from './functions/json-validator'

export async function run() {
  await jsonValidator()
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
