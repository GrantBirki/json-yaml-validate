import * as core from '@actions/core'
import Ajv from 'ajv'
import Ajv2019 from 'ajv/dist/2019'
import Ajv2020 from 'ajv/dist/2020'
import AjvDraft04 from 'ajv-draft-04'
import addFormats from 'ajv-formats'
import {readFileSync} from 'fs'
import {fdir} from 'fdir'
import {parse, parseAllDocuments} from 'yaml'
import {globSync} from 'glob'

// Constants
const DRAFT_07 = 'draft-07'
const DRAFT_04 = 'draft-04'
const DRAFT_2019_09 = 'draft-2019-09'
const DRAFT_2020_12 = 'draft-2020-12'
const INVALID_JSON_MESSAGE = 'Invalid JSON'
const CUSTOM_FORMAT_REGEX = /^[\w-]+=.+$/

// Helper function to setup the schema
// :param jsonSchema: path to the jsonSchema file
// :returns: the compiled schema
async function schema(jsonSchema) {
  const jsonSchemaVersion = core.getInput('json_schema_version')
  const strict = core.getBooleanInput('ajv_strict_mode')

  core.debug(`json_schema_version: ${jsonSchemaVersion}`)
  core.debug(`strict: ${strict}`)

  let ajv
  if (jsonSchemaVersion === DRAFT_07) {
    ajv = new Ajv({allErrors: true, strict: strict})
  } else if (jsonSchemaVersion === DRAFT_04) {
    ajv = new AjvDraft04({allErrors: true, strict: strict})
  } else if (jsonSchemaVersion === DRAFT_2019_09) {
    ajv = new Ajv2019({allErrors: true, strict: strict})
  } else if (jsonSchemaVersion === DRAFT_2020_12) {
    ajv = new Ajv2020({allErrors: true, strict: strict})
  } else {
    core.warning(
      `json_schema_version '${jsonSchemaVersion}' is not supported. Defaulting to '${DRAFT_07}'`
    )
    ajv = new Ajv({allErrors: true, strict: strict})
  }

  // use ajv-formats if enabled
  if (core.getBooleanInput('use_ajv_formats')) {
    core.debug('using ajv-formats with json-validator')
    addFormats(ajv)
  } else {
    core.debug('ajv-formats will not be used with the json-validator')
  }

  // add custom regexp format if provided
  core
    .getMultilineInput('ajv_custom_regexp_formats')
    .filter(Boolean) // Filter out any empty lines
    .forEach(customFormat => {
      // Check format using a regex
      if (!CUSTOM_FORMAT_REGEX.test(customFormat.trim())) {
        throw new Error(
          `Invalid ajv_custom_regexp_formats format: "${customFormat}" is not in expected format "key=regex"`
        )
      }

      // Split into key-value pair
      const keyValuePair = customFormat.trim().split(/=(.*)/s)

      // Validate and compile the regular expression
      let regex
      try {
        regex = new RegExp(keyValuePair[1])
      } catch (syntaxError) {
        throw new Error(`Invalid regular expression: ${syntaxError.message}`)
      }

      // Add format if the regex is successfully compiled
      ajv.addFormat(keyValuePair[0], regex)
    })

  // if a jsonSchema is provided, validate the json against it
  let schema
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
  const allowMultipleDocuments = core.getBooleanInput(
    'allow_multiple_documents'
  )
  let patterns = core.getMultilineInput('files').filter(Boolean)

  core.debug(`yaml_as_json: ${yamlAsJson}`)

  // construct a list of file paths to validate and use glob if necessary
  let files = []
  patterns.forEach(pattern => {
    files.push(...globSync(pattern))
  })

  // remove trailing slash from baseDir
  const baseDirSanitized = baseDir.replace(/\/$/, '')

  // check if regex is enabled
  let skipRegex = null
  if (jsonExcludeRegex && jsonExcludeRegex !== '') {
    skipRegex = new RegExp(jsonExcludeRegex)
  }

  // setup the schema (if provided)
  const validate = await schema(jsonSchema)

  // loop through all json files in the baseDir and validate them
  const result = {
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

  // Create a Set to track processed files
  const processedFiles = new Set()

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
    const isYamlFile =
      fullPath.endsWith(yamlExtension) || fullPath.endsWith(yamlExtensionShort)
    /* istanbul ignore next */
    if (yamlAsJson === false && isYamlFile) {
      core.debug(
        `the json-validator found a yaml file so it will be skipped here: '${fullPath}'`
      )
      continue
    }

    // Check if the file has already been processed
    if (processedFiles.has(fullPath)) {
      core.debug(`skipping duplicate file: ${fullPath}`)
      continue
    }

    let data
    try {
      // if the file is a yaml file but being treated as json and yamlAsJson is true
      if (yamlAsJson === true && isYamlFile) {
        core.debug(`attempting to process yaml file: '${fullPath}' as json`)
        if (allowMultipleDocuments === true) {
          data = parseAllDocuments(readFileSync(fullPath, 'utf8'))
        } else {
          data = parse(readFileSync(fullPath, 'utf8'))
        }
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
            message: INVALID_JSON_MESSAGE
          }
        ]
      })
      continue
    }

    // ensure data is always an array; in case of single-document-mode it'll
    // have just one element.
    // this is required to support multi-doc files when yamlAsJson is true
    if (yamlAsJson === true && allowMultipleDocuments === true) {
      const newData = []
      data.forEach(doc => {
        newData.push(doc.toJS())
      })
      data = newData
    } else {
      // For JSON files or single YAML documents, wrap in array
      data = [data]
    }

    if (Array.isArray(data)) {
      core.debug(`${data.length} object(s) found in file: ${fullPath}`)
    }

    let allValid = true
    const allErrors = []

    // perform the validation for each document
    data.forEach((doc, index) => {
      const valid = validate(doc)
      if (valid) {
        return
      }

      // validation failed, record the error
      allValid = false
      allErrors.push(
        ...validate.errors.map(error => {
          const errorValue = {
            path: error.instancePath || null,
            message: error.message
          }
          // when we have multiple documents, we need to add the document index
          if (allowMultipleDocuments && yamlAsJson === true) {
            errorValue.document = index
          }
          return errorValue
        })
      )
    })

    if (!allValid) {
      core.error(
        `❌ failed to parse JSON file: ${fullPath}\n${JSON.stringify(allErrors)}`
      )
      result.success = false
      result.failed++
      result.violations.push({
        file: `${fullPath}`,
        errors: allErrors
      })
      continue
    }

    // Add the file to the processedFiles Set
    processedFiles.add(fullPath)

    result.passed++
    core.info(`${fullPath} is valid`)
  }

  // return the result object
  return result
}
