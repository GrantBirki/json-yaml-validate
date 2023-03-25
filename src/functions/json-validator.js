import * as core from '@actions/core'
import Ajv from 'ajv'
import {readFileSync} from 'fs'

const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

export async function jsonValidator() {
  const jsonSchema = core.getInput('json_schema')

  // if a jsonSchema is provided, validate the json against it
  var schema
  if (jsonSchema) {
    // parse the jsonSchema from the file path
    schema = JSON.parse(readFileSync(jsonSchema, 'utf8'))
  } else {
    // if no jsonSchema is provided, use the default schema
    schema = true
  }

  const validate = ajv.compile(schema)

  const data = JSON.parse(
    readFileSync('./__tests__/fixtures/json/json1.json', 'utf8')
  )

  const valid = validate(data)
  if (!valid) console.log(validate.errors)
}
