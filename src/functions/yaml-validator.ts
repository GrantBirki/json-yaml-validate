import validateSchema from 'yaml-schema-validator'
import {globSync, readFileSync} from 'node:fs'
import {parse, parseAllDocuments} from 'yaml'
import {core} from '../actions-core.js'
import type {Excluder, ValidationError, ValidationResult} from '../types.js'
import {discoverFilesByExtension} from './file-discovery.js'

const INVALID_YAML_MESSAGE = 'Invalid YAML'

function discoverExplicitFiles(patterns: string[]): string[] {
  const files: string[] = []

  for (const pattern of patterns) {
    files.push(...globSync(pattern))
  }

  return files
}

function formatYamlParseError(error: unknown): string {
  return String(error).split(':').slice(0, 2).join('')
}

export async function yamlValidator(
  exclude: Excluder
): Promise<ValidationResult> {
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
  const patterns = core.getMultilineInput('files').filter(Boolean)

  let files = discoverExplicitFiles(patterns)
  const baseDirSanitized = baseDir.replace(/\/$/, '')
  const skipRegex = yamlExcludeRegex ? new RegExp(yamlExcludeRegex) : null

  const result: ValidationResult = {
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
  if (files.length > 0) {
    core.debug(`using files: ${files.join(', ')}`)
  } else {
    core.debug(`using baseDir: ${baseDirSanitized}`)
    core.debug(`using glob: ${glob}`)

    files = discoverFilesByExtension(
      baseDirSanitized,
      [yamlExtension, yamlExtensionShort],
      useDotMatch
    )
  }

  const processedFiles = new Set<string>()

  for (const fullPath of files) {
    core.debug(`found file: ${fullPath}`)

    if (yamlSchema !== '' && fullPath === yamlSchema) {
      core.debug(`skipping yaml schema file: ${fullPath}`)
      continue
    }

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

    if (skipRegex !== null && skipRegex.test(fullPath)) {
      core.info(`skipping due to exclude match: ${fullPath}`)
      result.skipped++
      continue
    }

    if (exclude.isExcluded(fullPath)) {
      core.info(`skipping due to exclude match: ${fullPath}`)
      result.skipped++
      continue
    }

    if (processedFiles.has(fullPath)) {
      core.debug(`skipping duplicate file: ${fullPath}`)
      continue
    }

    let multipleDocuments = false

    try {
      if (allowMultipleDocuments) {
        const documents = parseAllDocuments(readFileSync(fullPath, 'utf8'))
        for (const doc of documents) {
          if (doc.errors.length > 0) {
            throw doc.errors[0]
          }
          parse(doc.toString())
        }
        core.info(`multiple documents found in file: ${fullPath}`)
        multipleDocuments = true
      } else {
        parse(readFileSync(fullPath, 'utf8'))
      }
    } catch (error) {
      core.error(`❌ failed to parse YAML file: ${fullPath}`)
      result.success = false
      result.failed++
      result.violations.push({
        file: fullPath,
        errors: [
          {
            path: null,
            message: INVALID_YAML_MESSAGE,
            error: formatYamlParseError(error)
          }
        ]
      })
      continue
    }

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
      core.error(
        `❌ failed to parse YAML file: ${fullPath}\n${JSON.stringify(
          schemaErrors
        )}`
      )
      result.success = false
      result.failed++

      const errors: ValidationError[] = []
      for (const error of schemaErrors) {
        errors.push({
          path: error.path || null,
          message: error.message
        })
      }

      result.violations.push({
        file: fullPath,
        errors: errors
      })
      continue
    }

    processedFiles.add(fullPath)

    result.passed++
    core.info(`${fullPath} is valid`)
  }

  return result
}
