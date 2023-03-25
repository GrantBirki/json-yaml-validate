import * as core from '@actions/core'
// import * as github from '@actions/github'
// import {context} from '@actions/github'
// import dedent from 'dedent-js'
import Ajv from 'ajv'

export async function run() {
  const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

  const schema = {
    type: 'object',
    properties: {
      foo: {type: 'integer'},
      bar: {type: 'string'}
    },
    required: ['foo'],
    additionalProperties: false
  }

  const data = {
    foo: 1,
    bar: 'abc'
  }

  const validate = ajv.compile(schema)
  const valid = validate(data)
  if (!valid) {
    core.error(validate.errors)
  }

  return true
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
