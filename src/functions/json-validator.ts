import {Ajv, type ValidateFunction} from 'ajv'
import * as AjvDraft04Module from 'ajv-draft-04'
import * as addFormatsModule from 'ajv-formats'
import {Ajv2019} from 'ajv/dist/2019.js'
import {Ajv2020} from 'ajv/dist/2020.js'
import {readFileSync} from 'node:fs'
import {parse, parseAllDocuments} from 'yaml'
import {core} from '../actions-core.js'
import type {
  AjvConstructor,
  AjvLike,
  Excluder,
  JsonFileValidationContext,
  ValidationError,
  ValidationResult,
  YamlDocument
} from '../types.js'
import {
  discoverExplicitFiles,
  discoverFilesByExtension
} from './file-discovery.js'
import {
  builtInMetaSchema,
  builtInMetaSchemaById
} from './json-meta-schema.js'
import {
  type InlineSchemaReference,
  jsonInlineSchemaReference,
  yamlInlineSchemaReference
} from './inline-schema.js'
import {
  isSameFile,
  resolveValidationFile,
  resolveWorkspaceDirectory,
  safeLogPath
} from './path-utils.js'
import {loadSchemaMappings} from './schema-mappings.js'

const DRAFT_07 = 'draft-07'
const DRAFT_04 = 'draft-04'
const DRAFT_2019_09 = 'draft-2019-09'
const DRAFT_2020_12 = 'draft-2020-12'
const BUILT_IN_SCHEMA_VERSIONS = new Map([
  ['http://json-schema.org/draft-04/schema', DRAFT_04],
  ['http://json-schema.org/draft-07/schema', DRAFT_07],
  ['https://json-schema.org/draft/2019-09/schema', DRAFT_2019_09],
  ['https://json-schema.org/draft/2020-12/schema', DRAFT_2020_12],
  /* node:coverage ignore next */
])
const INVALID_JSON_MESSAGE = 'Invalid JSON'
const CUSTOM_FORMAT_REGEX = /^[\w-]+=.+$/
const AjvDraft04 = (AjvDraft04Module.default ??
  AjvDraft04Module) as unknown as AjvConstructor
const addFormats = (addFormatsModule.default ??
  addFormatsModule) as unknown as (ajv: AjvLike) => void

function ajv(jsonSchemaVersion = core.getInput('json_schema_version')): AjvLike {
  const strict = core.getBooleanInput('ajv_strict_mode')

  core.debug(`json_schema_version: ${jsonSchemaVersion}`)
  core.debug(`strict: ${strict}`)

  let validator: AjvLike
  if (jsonSchemaVersion === DRAFT_07) {
    validator = new Ajv({allErrors: true, strict: strict})
  } else if (jsonSchemaVersion === DRAFT_04) {
    validator = new AjvDraft04({allErrors: true, strict: strict})
  } else if (jsonSchemaVersion === DRAFT_2019_09) {
    validator = new Ajv2019({allErrors: true, strict: strict})
  } else if (jsonSchemaVersion === DRAFT_2020_12) {
    validator = new Ajv2020({allErrors: true, strict: strict})
  } else {
    core.warning(
      `json_schema_version '${jsonSchemaVersion}' is not supported. Defaulting to '${DRAFT_07}'`
    )
    validator = new Ajv({allErrors: true, strict: strict})
  }

  if (core.getBooleanInput('use_ajv_formats')) {
    core.debug('using ajv-formats with json-validator')
    addFormats(validator)
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

      validator.addFormat(keyValuePair[0], regex)
    })

  return validator
}

function isJsonSchemaFile(fullPath: string, jsonSchema: string): boolean {
  return jsonSchema !== '' && isSameFile(fullPath, jsonSchema)
}

async function compileSchemaValue(schemaValue: unknown, jsonSchemaVersion: string): Promise<ValidateFunction> {
  const validator = ajv(jsonSchemaVersion)
  return (
    builtInMetaSchema(validator, schemaValue) ?? validator.compile(schemaValue)
  )
}

async function schema(
  jsonSchema: string,
  jsonSchemaVersion = core.getInput('json_schema_version')
): Promise<ValidateFunction> {
  const schemaValue =
    jsonSchema && jsonSchema !== ''
      ? JSON.parse(readFileSync(jsonSchema, 'utf8'))
      : true

  return compileSchemaValue(schemaValue, jsonSchemaVersion)
}

async function builtInSchema(
  schemaId: string,
  jsonSchemaVersion = core.getInput('json_schema_version')
): Promise<ValidateFunction> {
  const validate = builtInMetaSchemaById(
    ajv(jsonSchemaVersionForBuiltInSchema(schemaId) ?? jsonSchemaVersion),
    schemaId
  )
  if (validate === null) {
    throw new Error(`Unsupported built-in inline schema: ${schemaId}`)
  }

  return validate
}

function jsonSchemaVersionForBuiltInSchema(schemaId: string): string | null {
  return BUILT_IN_SCHEMA_VERSIONS.get(schemaId.replace(/#$/, '')) ?? null
}

function failInlineSchema(
  result: ValidationResult,
  fullPath: string,
  message: string
): void {
  core.error(`❌ failed to load inline schema for JSON file: ${fullPath}`)
  result.success = false
  result.failed++
  result.violations.push({
    file: fullPath,
    errors: [
      {
        path: null,
        message
      }
    ]
  })
}

function failPathValidation(
  result: ValidationResult,
  displayPath: string,
  message: string
): void {
  core.error(`❌ invalid validation path: ${displayPath}`)
  result.success = false
  result.failed++
  result.violations.push({
    file: displayPath,
    errors: [
      {
        path: null,
        message
      }
    ]
  })
}

function inlineSchemaReference(
  fullPath: string,
  source: string,
  data: unknown,
  isYamlFile: boolean
): InlineSchemaReference {
  return isYamlFile
    ? yamlInlineSchemaReference(source, fullPath)
    : jsonInlineSchemaReference(data, fullPath)
}

async function validateJsonFiles(
  files: string[],
  context: JsonFileValidationContext,
  processedFiles = new Set<string>()
): Promise<void> {
  for (const fullPath of files) {
    core.debug(`found file: ${fullPath}`)

    const resolved = resolveValidationFile(fullPath)
    if (!resolved.ok) {
      failPathValidation(
        context.result,
        resolved.displayPath,
        resolved.message
      )
      continue
    }
    const file = resolved.value

    if (isJsonSchemaFile(file.fullPath, context.jsonSchema)) {
      core.debug(`skipping json schema file: ${file.displayPath}`)
      continue
    }

    const isYamlFile =
      file.relativePath.endsWith(context.yamlExtension) ||
      file.relativePath.endsWith(context.yamlExtensionShort)
    if (context.yamlAsJson === false && isYamlFile) {
      core.debug(
        `the json-validator found a yaml file so it will be skipped here: '${file.displayPath}'`
      )
      continue
    }

    if (processedFiles.has(file.fullPath)) {
      core.debug(`skipping duplicate file: ${file.displayPath}`)
      continue
    }
    processedFiles.add(file.fullPath)

    if (
      context.skipRegex !== null &&
      context.skipRegex.test(file.relativePath)
    ) {
      core.info(
        `skipping due to exclude match: ${safeLogPath(file.displayPath)}`
      )
      context.result.skipped++
      continue
    }

    if (context.exclude.isExcluded(file.relativePath)) {
      core.info(
        `skipping due to exclude match: ${safeLogPath(file.displayPath)}`
      )
      context.result.skipped++
      continue
    }

    const source = readFileSync(file.fullPath, 'utf8')
    let data: unknown
    try {
      if (context.yamlAsJson === true && isYamlFile) {
        core.debug(
          `attempting to process yaml file: '${file.displayPath}' as json`
        )
        if (context.allowMultipleDocuments === true) {
          data = parseAllDocuments(source)
          for (const document of data as YamlDocument[]) {
            if (document.errors.length > 0) {
              throw document.errors[0]
            }
          }
        } else {
          data = parse(source)
        }
      } else {
        data = JSON.parse(source)
      }
    } catch {
      core.error(`❌ failed to parse JSON file: ${file.displayPath}`)
      context.result.success = false
      context.result.failed++
      context.result.violations.push({
        file: file.displayPath,
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
      context.yamlAsJson === true &&
      isYamlFile &&
      context.allowMultipleDocuments === true
        ? (data as YamlDocument[]).map(doc => doc.toJS())
        : [data]
    const includeDocumentIndexes =
      context.yamlAsJson && isYamlFile && documents.length > 1

    core.debug(
      `${documents.length} object(s) found in file: ${file.displayPath}`
    )

    let validate = context.validate
    if (context.inlineSchemaValidator !== undefined) {
      const inlineValidation = await context.inlineSchemaValidator(
        file.fullPath,
        source,
        data,
        isYamlFile
      )

      if (inlineValidation !== null && 'error' in inlineValidation) {
        failInlineSchema(
          context.result,
          file.displayPath,
          inlineValidation.error
        )
        continue
      }

      validate = inlineValidation?.validate ?? validate
    }

    let allValid = true
    const allErrors: ValidationError[] = []

    documents.forEach((doc, index) => {
      const valid = validate(doc)
      if (valid) {
        return
      }

      allValid = false
      allErrors.push(
        ...(validate.errors ?? []).map(error => ({
          path: error.instancePath || null,
          message: error.message ?? 'validation failed',
          ...(includeDocumentIndexes ? {document: index} : {})
        }))
      )
    })

    if (!allValid) {
      core.error(
        `❌ failed to parse JSON file: ${file.displayPath}\n${JSON.stringify(
          allErrors
        )}`
      )
      context.result.success = false
      context.result.failed++
      context.result.violations.push({
        file: file.displayPath,
        errors: allErrors
      })
      continue
    }

    context.result.passed++
    core.info(`${safeLogPath(file.displayPath)} is valid`)
  }
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
  const useInlineSchema = core.getBooleanInput('use_inline_schema')
  const allowMultipleDocuments = core.getBooleanInput(
    'allow_multiple_documents'
  )
  const patterns = core.getMultilineInput('files').filter(Boolean)

  core.debug(`yaml_as_json: ${yamlAsJson}`)

  const skipRegex = jsonExcludeRegex ? new RegExp(jsonExcludeRegex) : null
  const result: ValidationResult = {
    success: true,
    passed: 0,
    failed: 0,
    skipped: 0,
    violations: []
  }
  const schemaMappings = loadSchemaMappings(core.getInput('schema_mappings'), {
    yamlAsJson
  })

  if (schemaMappings.length > 0) {
    core.debug('using schema_mappings for json validation')
    for (const mapping of schemaMappings.filter(item => item.type === 'json')) {
      core.debug(`using files: ${mapping.files.join(', ')}`)
      await validateJsonFiles(mapping.files, {
        allowMultipleDocuments,
        exclude,
        jsonSchema: mapping.schema,
        result,
        skipRegex,
        validate: await schema(mapping.schema, mapping.jsonSchemaVersion),
        yamlAsJson,
        yamlExtension,
        yamlExtensionShort
      })
    }

    return result
  }

  let files = discoverExplicitFiles(patterns)
  const baseDirSanitized = baseDir.replace(/\/$/, '')
  const inlineSchemaValidators = new Map<string, ValidateFunction>()
  const inlineSchemaValidator =
    useInlineSchema && jsonSchema === ''
      ? async (
          fullPath: string,
          source: string,
          data: unknown,
          isYamlFile: boolean
        ) => {
          const reference = inlineSchemaReference(
            fullPath,
            source,
            data,
            isYamlFile
          )
          if (reference.kind === 'none') {
            return null
          }

          if (reference.kind === 'error') {
            return {error: reference.message}
          }

          const cacheKey =
            reference.kind === 'built-in'
              ? `built-in:${reference.schemaId}`
              : `local:${reference.schemaPath}`
          const cached = inlineSchemaValidators.get(cacheKey)
          if (cached !== undefined) {
            return {validate: cached}
          }

          try {
            const inlineValidate =
              reference.kind === 'built-in'
                ? await builtInSchema(reference.schemaId)
                : await schema(reference.schemaPath)
            inlineSchemaValidators.set(cacheKey, inlineValidate)
            return {validate: inlineValidate}
          } catch (error) {
            return {
              error: `Invalid inline schema: ${
                error instanceof Error ? error.message : String(error)
              }`
            }
          }
        }
      : undefined

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
  if (!useExplicitFiles) {
    const baseDirectory = resolveWorkspaceDirectory(baseDirSanitized)
    if (!baseDirectory.ok) {
      failPathValidation(
        result,
        baseDirectory.displayPath,
        baseDirectory.message
      )
      return result
    }

    files = discoverFilesByExtension(
      baseDirectory.value,
      extensions,
      useDotMatch
    )
  }

  const validate = await schema(jsonSchema)
  await validateJsonFiles(files, {
    allowMultipleDocuments,
    exclude,
    inlineSchemaValidator,
    jsonSchema,
    result,
    skipRegex,
    validate,
    yamlAsJson,
    yamlExtension,
    yamlExtensionShort
  })

  return result
}
