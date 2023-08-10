import * as core from '@actions/core'
import validateSchema from 'yaml-schema-validator'
import {readFileSync} from 'fs'
import {fdir} from 'fdir'
import {parse} from 'yaml'

// Helper function to validate all yaml files in the baseDir
export async function yamlValidator(exclude) {
  const baseDir = core.getInput('base_dir')
  const yamlExtension = core.getInput('yaml_extension')
  const yamlExtensionShort = core.getInput('yaml_extension_short')
  const yamlSchema = core.getInput('yaml_schema')
  const yamlExcludeRegex = core.getInput('yaml_exclude_regex')
  const yamlAsJson = core.getBooleanInput('yaml_as_json')
  const useDotMatch = core.getBooleanInput('use_dot_match')
  let files = core.getInput('files').split('\n').filter(Boolean)

  // remove trailing slash from baseDir
  const baseDirSanitized = baseDir.replace(/\/$/, '')

  // check if regex is enabled
  var skipRegex = null
  if (yamlExcludeRegex && yamlExcludeRegex !== '') {
    skipRegex = new RegExp(yamlExcludeRegex)
  }

  // loop through all yaml files in the baseDir and validate them
  var result = {
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

    if (yamlSchema !== '' && fullPath.includes(yamlSchema)) {
      core.debug(`skipping yaml schema file: ${fullPath}`)
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

    try {
      // try to parse the yaml file
      parse(readFileSync(fullPath, 'utf8'))
    } catch {
      // if the yaml file is invalid, log an error and set success to false
      core.error(`❌ failed to parse YAML file: ${fullPath}`)
      result.success = false
      result.failed++
      result.violations.push({
        file: fullPath,
        errors: [
          {
            path: null,
            message: 'Invalid YAML'
          }
        ]
      })
      continue
    }

    // if no yamlSchema is provided, skip validation against the schema
    if (
      !yamlSchema ||
      yamlSchema === '' ||
      yamlSchema === null ||
      yamlSchema === undefined
    ) {
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
      var errors = []
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

    result.passed++
    core.info(`${fullPath} is valid`)
  }

  // return the result object
  return result
}
