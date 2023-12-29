import * as core from '@actions/core'
import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019'
import Ajv2020 from 'ajv/dist/2020'
import addFormats from 'ajv-formats'
import {readFileSync} from 'fs'
import {fdir} from 'fdir'
import {parse} from 'yaml'
import {globSync} from 'glob'

// Helper function to setup the schema
// :param jsonSchema: path to the jsonSchema file
// :returns: the compiled schema
async function schema(jsonSchema) {
  const jsonSchemaVersion = core.getInput('json_schema_version')

  var ajv
  if (jsonSchemaVersion === 'draft-07') {
    ajv = new Ajv({allErrors: true})
  } else if (jsonSchemaVersion === 'draft-2019-09') {
    ajv = new Ajv2019({allErrors: true})
  } else if (jsonSchemaVersion === 'draft-2020-12') {
    ajv = new Ajv2020({allErrors: true})
  } else {
    core.warning(
      `json_schema_version '${jsonSchemaVersion}' is not supported. Defaulting to 'draft-07'`
    )
    ajv = new Ajv({allErrors: true})
  }

  // use ajv-formats if enabled
  if (core.getBooleanInput('use_ajv_formats')) {
    core.debug('using ajv-formats with json-validator')
    addFormats(ajv)
  } else {
    core.debug('ajv-formats will not be used with the json-validator')
  }

  // if a jsonSchema is provided, validate the json against it
  var schema
  if (jsonSchema && jsonSchema !== '') {
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
export async function jsonValidator(exclude) {
  const baseDir = core.getInput('base_dir')
  const jsonExtension = core.getInput('json_extension')
  const jsonExcludeRegex = core.getInput('json_exclude_regex')
  const jsonSchema = core.getInput('json_schema')
  const yamlAsJson = core.getBooleanInput('yaml_as_json')
  const yamlExtension = core.getInput('yaml_extension')
  const yamlExtensionShort = core.getInput('yaml_extension_short')
  const useDotMatch = core.getBooleanInput('use_dot_match')
  let patterns = core.getMultilineInput('files').filter(Boolean)

  core.debug(`yaml_as_json: ${yamlAsJson}`)

  // construct a list of file paths to validate and use glob if necessary
  let files = []
  patterns.forEach(pattern => {
    files = [...files, ...globSync(pattern)]
  })

  // remove trailing slash from baseDir
  const baseDirSanitized = baseDir.replace(/\/$/, '')

  // check if regex is enabled
  var skipRegex = null
  if (jsonExcludeRegex && jsonExcludeRegex !== '') {
    skipRegex = new RegExp(jsonExcludeRegex)
  }

  // setup the schema (if provided)
  const validate = await schema(jsonSchema)

  // loop through all json files in the baseDir and validate them
  var result = {
    success: true,
    passed: 0,
    failed: 0,
    skipped: 0,
    violations: []
  }

  const yamlGlob = `${yamlExtension.replace(
    '.',
    ''
  )},${yamlExtensionShort.replace('.', '')}`

  const glob = yamlAsJson
    ? `**/*{${jsonExtension},${yamlGlob}}`
    : `**/*${jsonExtension}`

  core.debug(`json - using baseDir: ${baseDirSanitized}`)
  core.debug(`json - using glob: ${glob}`)
  if (files.length > 0) core.debug(`using files: ${files.join(', ')}`)
  else {
    core.debug(`using baseDir: ${baseDirSanitized}`)
    core.debug(`using glob: ${glob}`)

    files = await new fdir()
      .withBasePath()
      .globWithOptions([glob], {cwd: baseDirSanitized, dot: useDotMatch})
      .crawl(baseDirSanitized)
      .withPromise()
  }

  for (const fullPath of files) {
    core.debug(`found file: ${fullPath}`)

    if (jsonSchema !== '' && fullPath.includes(jsonSchema)) {
      // skip the jsonSchema file and don't count it as a skipped file
      core.debug(`skipping json schema file: ${fullPath}`)
      continue
    }

    // If an exclude regex is provided, skip json files that match
    if (skipRegex !== null) {
      if (skipRegex.test(fullPath)) {
        core.info(`skipping due to exclude match: ${fullPath}`)
        result.skipped++
        continue
      }
    }

    if (exclude.isExcluded(fullPath)) {
      core.info(`skipping due to exclude match: ${fullPath}`)
      result.skipped++
      continue
    }

    // if the file is a yaml file but it should not be treated as json
    // skipped++ does not need to be called here as the file should be validated later...
    // ...on as yaml with the yaml-validator
    /* istanbul ignore next */
    if (
      yamlAsJson === false &&
      (fullPath.endsWith(yamlExtension) ||
        fullPath.endsWith(yamlExtensionShort))
    ) {
      core.debug(
        `the json-validator found a yaml file so it will be skipped here: '${fullPath}'`
      )
      continue
    }

    var data
    try {
      // if the file is a yaml file but being treated as json and yamlAsJson is true
      if (
        yamlAsJson === true &&
        (fullPath.endsWith(yamlExtension) ||
          fullPath.endsWith(yamlExtensionShort))
      ) {
        core.debug(`attempting to process yaml file: '${fullPath}' as json`)
        data = parse(readFileSync(fullPath, 'utf8'))

        // if the file is a json file
      } else {
        data = JSON.parse(readFileSync(fullPath, 'utf8'))
      }
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
