import * as core from '@actions/core'
import * as github from '@actions/github'
import {context} from '@actions/github'
import dedent from 'dedent-js'

// :returns: 'success', 'success - noop', 'success - merge deploy mode', 'failure', 'safe-exit', or raises an error
export async function run() {
  core.info('test')
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
