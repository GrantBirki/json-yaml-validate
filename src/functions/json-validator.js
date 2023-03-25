import * as core from '@actions/core'
import Ajv from 'ajv'
import {readFileSync} from 'fs'
import {globSync} from 'glob'

// setup the ajv instance
const ajv = new Ajv() // options can be passed, e.g. {allErrors: true}

// Helper function to setup the schema
async function schema() {
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

  // compile the schema
  const validate = ajv.compile(schema)
  return validate
}

// Helper function to validate all json files in the baseDir
export async function jsonValidator() {
  const baseDir = core.getInput('base_dir')
  const jsonExtension = core.getInput('json_extension')

  // remove trailing slash from baseDir
  const baseDirSanitized = baseDir.replace(/\/$/, '')

  // setup the schema (if provided)
  const validate = await schema()

  // loop through all json files in the baseDir and validate them
  var success = true
  const files = globSync(`**/*${jsonExtension}`, {cwd: baseDirSanitized})
  for (const file of files) {
    var data

    try {
      // try to parse the json file
      data = JSON.parse(readFileSync(`${baseDirSanitized}/${file}`, 'utf8'))
    } catch {
      // if the json file is invalid, log an error and set success to false
      core.error(`failed to parse JSON file: ${baseDirSanitized}/${file}`)
      success = false
      continue
    }

    // if a jsonSchema is provided, validate the json against it
    const valid = validate(data)
    if (!valid) {
      // if the json file is invalid against the schema, log an error and set success to false
      core.error(validate.errors)
      success = false
    }
  }

  // return the overall success status of the validation for all files
  return success
}
