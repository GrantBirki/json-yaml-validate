import {Ajv, type ErrorObject, type ValidateFunction} from 'ajv'
import * as AjvDraft04Module from 'ajv-draft-04'
import * as addFormatsModule from 'ajv-formats'
import {Ajv2019} from 'ajv/dist/2019.js'
import {Ajv2020} from 'ajv/dist/2020.js'
import {globSync, readFileSync} from 'node:fs'
import {parse, parseAllDocuments} from 'yaml'
import {core} from '../actions-core.js'
import type {
  AjvConstructor,
  AjvLike,
  Excluder,
  ValidationError,
  ValidationResult,
  YamlDocument
} from '../types.js'
import {discoverFilesByExtension} from './file-discovery.js'

const DRAFT_07 = 'draft-07'
const DRAFT_04 = 'draft-04'
const DRAFT_2019_09 = 'draft-2019-09'
const DRAFT_2020_12 = 'draft-2020-12'
const INVALID_JSON_MESSAGE = 'Invalid JSON'
const CUSTOM_FORMAT_REGEX = /^[\w-]+=.+$/

const AjvDraft04 = (AjvDraft04Module.default ??
  AjvDraft04Module) as unknown as AjvConstructor
const addFormats = (addFormatsModule.default ??
  addFormatsModule) as unknown as (ajv: AjvLike) => void

function discoverExplicitFiles(patterns: string[]): string[] {
  const files: string[] = []

  for (const pattern of patterns) {
    files.push(...globSync(pattern))
  }

  return files
}

async function schema(jsonSchema: string): Promise<ValidateFunction> {
  const jsonSchemaVersion = core.getInput('json_schema_version')
  const strict = core.getBooleanInput('ajv_strict_mode')

  core.debug(`json_schema_version: ${jsonSchemaVersion}`)
  core.debug(`strict: ${strict}`)

  let ajv: AjvLike
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

  if (core.getBooleanInput('use_ajv_formats')) {
    core.debug('using ajv-formats with json-validator')
    addFormats(ajv)
  } else {
    core.debug('ajv-formats will not be used with the json-validator')
  }

  core
    .getMultilineInput('ajv_custom_regexp_formats')
    .filter(Boolean)
    .forEach(customFormat => {
      if (!CUSTOM_FORMAT_REGEX.test(customFormat.trim())) {
        throw new Error(
          `Invalid ajv_custom_regexp_formats format: "${customFormat}" is not in expected format "key=regex"`
        )
      }

      const keyValuePair = customFormat.trim().split(/=(.*)/s)

      let regex: RegExp
      try {
        regex = new RegExp(keyValuePair[1])
      } catch (syntaxError) {
        throw new Error(
          `Invalid regular expression: ${(syntaxError as Error).message}`,
          {
            cause: syntaxError
          }
        )
      }

      ajv.addFormat(keyValuePair[0], regex)
    })

  const schemaValue =
    jsonSchema && jsonSchema !== ''
      ? JSON.parse(readFileSync(jsonSchema, 'utf8'))
      : true

  return ajv.compile(schemaValue)
}

function toValidationError(
  error: ErrorObject,
  document?: number
): ValidationError {
  const errorValue: ValidationError = {
    path: error.instancePath || null,
    message: error.message ?? 'validation failed'
  }

  if (document !== undefined) {
    errorValue.document = document
  }

  return errorValue
}

function toYamlDocuments(data: YamlDocument[]): unknown[] {
  return data.map(doc => doc.toJS())
}

export async function jsonValidator(
  exclude: Excluder
): Promise<ValidationResult> {
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
  const patterns = core.getMultilineInput('files').filter(Boolean)

  core.debug(`yaml_as_json: ${yamlAsJson}`)

  let files = discoverExplicitFiles(patterns)
  const baseDirSanitized = baseDir.replace(/\/$/, '')
  const skipRegex = jsonExcludeRegex ? new RegExp(jsonExcludeRegex) : null
  const validate = await schema(jsonSchema)

  const result: ValidationResult = {
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

  const globOptions = [
    `**/*${jsonExtension}`,
    `**/*{${jsonExtension},${yamlGlob}}`
  ]
  const glob = globOptions[Number(yamlAsJson)]

  core.debug(`json - using baseDir: ${baseDirSanitized}`)
  core.debug(`json - using glob: ${glob}`)
  const useExplicitFiles = files.length > 0
  /* node:coverage disable */
  const discoveryMessages = [
    [`using baseDir: ${baseDirSanitized}`, `using glob: ${glob}`],
    [`using files: ${files.join(', ')}`]
  ][Number(useExplicitFiles)]
  /* node:coverage enable */

  for (const message of discoveryMessages) {
    core.debug(message)
  }

  const extensions = yamlAsJson
    ? [jsonExtension, yamlExtension, yamlExtensionShort]
    : [jsonExtension]
  files = useExplicitFiles
    ? files
    : discoverFilesByExtension(baseDirSanitized, extensions, useDotMatch)

  const processedFiles = new Set<string>()

  for (const fullPath of files) {
    core.debug(`found file: ${fullPath}`)

    if (jsonSchema !== '' && fullPath.includes(jsonSchema)) {
      core.debug(`skipping json schema file: ${fullPath}`)
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

    const isYamlFile =
      fullPath.endsWith(yamlExtension) || fullPath.endsWith(yamlExtensionShort)
    if (yamlAsJson === false && isYamlFile) {
      core.debug(
        `the json-validator found a yaml file so it will be skipped here: '${fullPath}'`
      )
      continue
    }

    if (processedFiles.has(fullPath)) {
      core.debug(`skipping duplicate file: ${fullPath}`)
      continue
    }

    let data: unknown
    try {
      if (yamlAsJson === true && isYamlFile) {
        core.debug(`attempting to process yaml file: '${fullPath}' as json`)
        data =
          allowMultipleDocuments === true
            ? parseAllDocuments(readFileSync(fullPath, 'utf8'))
            : parse(readFileSync(fullPath, 'utf8'))
      } else {
        data = JSON.parse(readFileSync(fullPath, 'utf8'))
      }
    } catch {
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

    const documents =
      yamlAsJson === true && allowMultipleDocuments === true
        ? toYamlDocuments(data as YamlDocument[])
        : [data]

    core.debug(`${documents.length} object(s) found in file: ${fullPath}`)

    let allValid = true
    const allErrors: ValidationError[] = []

    documents.forEach((doc, index) => {
      const valid = validate(doc)
      if (valid) {
        return
      }

      allValid = false
      allErrors.push(
        ...(validate.errors ?? []).map(error =>
          toValidationError(
            error,
            allowMultipleDocuments && yamlAsJson === true ? index : undefined
          )
        )
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

    processedFiles.add(fullPath)

    result.passed++
    core.info(`${fullPath} is valid`)
  }

  return result
}
