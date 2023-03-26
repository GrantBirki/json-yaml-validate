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
  const jsonExcludeRegex = core.getInput('json_exclude_regex').trim()

  // remove trailing slash from baseDir
  const baseDirSanitized = baseDir.replace(/\/$/, '')

  // check if regex is enabled
  var skipRegex = null
  if (jsonExcludeRegex && jsonExcludeRegex !== '') {
    skipRegex = new RegExp(jsonExcludeRegex)
  }

  // setup the schema (if provided)
  const validate = await schema()

  // loop through all json files in the baseDir and validate them
  var result = {
    success: true,
    passed: 0,
    failed: 0,
    skipped: 0,
    violations: []
  }
  const files = globSync(`**/*${jsonExtension}`, {cwd: baseDirSanitized})
  for (const file of files) {
    // construct the full path to the file
    const fullPath = `${baseDirSanitized}/${file}`

    // If an exclude regex is provided, skip json files that match
    if (skipRegex !== null) {
      if (skipRegex.test(fullPath)) {
        core.info(`skipping due to exclude match: ${fullPath}`)
        result.skipped++
        continue
      }
    }

    var data

    try {
      // try to parse the json file
      data = JSON.parse(readFileSync(fullPath, 'utf8'))
    } catch {
      // if the json file is invalid, log an error and set success to false
      core.error(`❌ failed to parse JSON file: ${fullPath}`)
      result.success = false
      result.failed++
      result.violations.push({
        file: fullPath,
        errors: [
          {
            path: null,
            message: 'Invalid JSON'
          }
        ]
      })
      continue
    }

    // if a jsonSchema is provided, validate the json against it
    const valid = validate(data)
    if (!valid) {
      // if the json file is invalid against the schema, log an error and set success to false
      core.error(
        `❌ failed to parse JSON file: ${fullPath}\n${JSON.stringify(
          validate.errors
        )}`
      )
      result.success = false
      result.failed++

      // add the errors to the result object (path and message)
      // where path is the path to the property that failed validation
      var errors = []
      for (const error of validate.errors) {
        errors.push({
          path: error.instancePath || null,
          message: error.message
        })
      }

      // add the file and errors to the result object
      result.violations.push({
        file: `${fullPath}`,
        errors: errors
      })
      continue
    }

    result.passed++
    core.info(`${fullPath} is valid`)
  }

  // return the result object
  return result
}
