import * as core from '@actions/core'
import Ajv from 'ajv'
import {readFileSync} from 'fs'
import {globSync} from 'glob'

const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

export async function jsonValidator() {
  const jsonSchema = core.getInput('json_schema')
  const baseDir = core.getInput('base_dir')
  const baseDirSanitized = baseDir.replace(/\/$/, '')

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

  // loop through all json files in the baseDir and validate them
  var success = true
  const files = globSync('**/*.json', {cwd: baseDirSanitized})
  for (const file of files) {
    var data
    try {
      data = JSON.parse(readFileSync(`${baseDirSanitized}/${file}`, 'utf8'))
    } catch {
      core.error(`failed to parse JSON file: ${baseDirSanitized}/${file}`)
      success = false
      continue
    }
    const valid = validate(data)
    if (!valid) {
      core.error(validate.errors)
      success = false
    }
  }
  return success
}
