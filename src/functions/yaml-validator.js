import * as core from '@actions/core'
import validateSchema from 'yaml-schema-validator'
import {readFileSync} from 'fs'
import {globSync} from 'glob'
import {parse} from 'yaml'

// Helper function to validate all yaml files in the baseDir
export async function yamlValidator() {
  const baseDir = core.getInput('base_dir')
  const yamlExtension = core.getInput('yaml_extension')
  const yamlExtensionShort = core.getInput('yaml_extension_short')
  const yamlSchema = core.getInput('yaml_schema')

  // remove trailing slash from baseDir
  const baseDirSanitized = baseDir.replace(/\/$/, '')

  // loop through all yaml files in the baseDir and validate them
  var result = {
    success: true,
    passed: 0,
    failed: 0,
    violations: []
  }
  const files = globSync(
    `**/*.{${yamlExtension.replace('.', '')},${yamlExtensionShort.replace(
      '.',
      ''
    )}}`,
    {cwd: baseDirSanitized}
  )
  for (const file of files) {
    try {
      // try to parse the yaml file
      parse(readFileSync(`${baseDirSanitized}/${file}`, 'utf8'))
    } catch {
      // if the yaml file is invalid, log an error and set success to false
      core.error(`❌ failed to parse YAML file: ${baseDirSanitized}/${file}`)
      result.success = false
      result.failed++
      result.violations.push({
        file: `${baseDirSanitized}/${file}`,
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
    if (!yamlSchema || yamlSchema.trim() === '' || yamlSchema === null || yamlSchema === undefined) {
      result.passed++
      core.info(`✅ ${baseDirSanitized}/${file} is valid`)
      continue
    }

    const schemaErrors = validateSchema(`${baseDirSanitized}/${file}`, {
      schema: yamlSchema
    })

    console.log(`============= ${JSON.stringify(schemaErrors)} =============`)

    if (schemaErrors && schemaErrors.length > 0) {
      // if the yaml file is invalid against the schema, log an error and set success to false
      core.error(
        `❌ failed to parse YAML file: ${baseDirSanitized}/${file}\n${JSON.stringify(
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
        file: `${baseDirSanitized}/${file}`,
        errors: errors
      })
      continue
    }

    result.passed++
    core.info(`✅ ${baseDirSanitized}/${file} is valid`)
  }

  // return the result object
  return result
}
