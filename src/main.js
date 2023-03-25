// import * as github from '@actions/github'
// import {context} from '@actions/github'
// import dedent from 'dedent-js'
import {jsonValidator} from './functions/json-validator'
import { processResults } from './functions/process-results'

export async function run() {
  const jsonResults = await jsonValidator()
  await processResults(jsonResults, null)
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
