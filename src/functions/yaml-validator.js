import * as core from '@actions/core'
import validateSchema from 'yaml-schema-validator'
import {readFileSync} from 'fs'
import {fdir} from 'fdir'
import {parse, parseAllDocuments} from 'yaml'
import {globSync} from 'glob'

// Constants
const INVALID_YAML_MESSAGE = 'Invalid YAML'

// Helper function to validate all yaml files in the baseDir
export async function yamlValidator(exclude) {
  const baseDir = core.getInput('base_dir')
  const jsonExtension = core.getInput('json_extension')
  const yamlExtension = core.getInput('yaml_extension')
  const yamlExtensionShort = core.getInput('yaml_extension_short')
  const yamlSchema = core.getInput('yaml_schema')
  const yamlExcludeRegex = core.getInput('yaml_exclude_regex')
  const yamlAsJson = core.getBooleanInput('yaml_as_json')
  const useDotMatch = core.getBooleanInput('use_dot_match')
  const allowMultipleDocuments = core.getBooleanInput(
    'allow_multiple_documents'
  )
  let patterns = core.getMultilineInput('files').filter(Boolean)

  // construct a list of file paths to validate and use glob if necessary
  let files = []
  patterns.forEach(pattern => {
    files.push(...globSync(pattern))
  })

  // remove trailing slash from baseDir
  const baseDirSanitized = baseDir.replace(/\/$/, '')

  // check if regex is enabled
  let skipRegex = null
  if (yamlExcludeRegex && yamlExcludeRegex !== '') {
    skipRegex = new RegExp(yamlExcludeRegex)
  }

  // loop through all yaml files in the baseDir and validate them
  const result = {
    success: true,
    passed: 0,
    failed: 0,
    skipped: 0,
    violations: []
  }

  const glob = `**/*.{${yamlExtension.replace(
    '.',
    ''
  )},${yamlExtensionShort.replace('.', '')}}`

  core.debug(`yaml - using baseDir: ${baseDirSanitized}`)
  core.debug(`yaml - using glob: ${glob}`)
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

    if (yamlSchema !== '' && fullPath === yamlSchema) {
      core.debug(`skipping yaml schema file: ${fullPath}`)
      continue
    }

    // if the file is a json file but it should not be treated as yaml
    // skipped++ does not need to be called here as the file should be validated later...
    // ...on as json with the json-validator
    const isJsonFile = jsonExtension && fullPath.endsWith(jsonExtension)
    if (yamlAsJson === false && isJsonFile) {
      core.debug(
        `the yaml-validator found a json file so it will be skipped here: '${fullPath}'`
      )
      continue
    }

    if (yamlAsJson) {
      core.debug(
        `skipping yaml since it should be treated as json: ${fullPath}`
      )
      result.skipped++
      continue
    }

    // If an exclude regex is provided, skip yaml files that match
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

    // Check if the file has already been processed
    if (processedFiles.has(fullPath)) {
      core.debug(`skipping duplicate file: ${fullPath}`)
      continue
    }

    let multipleDocuments = false

    try {
      // try to parse the yaml file
      if (allowMultipleDocuments) {
        let documents = parseAllDocuments(readFileSync(fullPath, 'utf8'))
        for (let doc of documents) {
          if (doc.errors.length > 0) {
            // format and show the first error
            throw doc.errors[0]
          }
          parse(doc.toString()) // doc.toString() will throw an error if the document is invalid
        }
        core.info(`multiple documents found in file: ${fullPath}`)
        multipleDocuments = true
      } else {
        parse(readFileSync(fullPath, 'utf8'))
      }
    } catch (err) {
      // if the yaml file is invalid, log an error and set success to false
      core.error(`❌ failed to parse YAML file: ${fullPath}`)
      result.success = false
      result.failed++
      result.violations.push({
        file: fullPath,
        errors: [
          {
            path: null,
            message: INVALID_YAML_MESSAGE,
            // format error message
            error: err.toString().split(':').slice(0, 2).join('')
          }
        ]
      })
      continue
    }

    // if no yamlSchema is provided, skip validation against the schema
    const hasNoSchema =
      !yamlSchema ||
      yamlSchema === '' ||
      yamlSchema === null ||
      yamlSchema === undefined
    if (hasNoSchema || multipleDocuments) {
      result.passed++
      core.info(`${fullPath} is valid`)
      continue
    }

    const schemaErrors = validateSchema(`${fullPath}`, {
      schema: yamlSchema,
      logLevel: 'none'
    })

    if (schemaErrors && schemaErrors.length > 0) {
      // if the yaml file is invalid against the schema, log an error and set success to false
      core.error(
        `❌ failed to parse YAML file: ${fullPath}\n${JSON.stringify(
          schemaErrors
        )}`
      )
      result.success = false
      result.failed++

      // add the errors to the result object (path and message)
      // where path is the path to the property that failed validation
      const errors = []
      for (const error of schemaErrors) {
        errors.push({
          path: error.path || null,
          message: error.message
        })
      }

      // add the file and errors to the result object
      result.violations.push({
        file: fullPath,
        errors: errors
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
