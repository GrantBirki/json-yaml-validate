import {readFileSync} from 'node:fs'
import {parseAllDocuments} from 'yaml'
import {core} from '../actions-core.js'
import type {Excluder, ValidationError, ValidationResult} from '../types.js'
import {
  discoverExplicitFiles,
  discoverFilesByExtension
} from './file-discovery.js'
import {loadSchemaMappings} from './schema-mappings.js'
import {validateYamlSchemaData} from './yaml-schema-validator.js'

const INVALID_YAML_MESSAGE = 'Invalid YAML'
const MULTIPLE_DOCUMENTS_MESSAGE =
  'Multiple YAML documents found; set allow_multiple_documents: "true" to validate Kubernetes-style multi-document YAML files.'

class MultipleYamlDocumentsError extends Error {
  constructor() {
    super(MULTIPLE_DOCUMENTS_MESSAGE)
  }
}

function formatYamlParseError(error: unknown): string {
  if (error instanceof MultipleYamlDocumentsError) {
    return error.message
  }

  return String(error).split(':').slice(0, 2).join('')
}

interface ParsedYamlDocument {
  data: unknown
  document?: number
}

function parseYamlDocuments(
  fullPath: string,
  allowMultipleDocuments: boolean
): ParsedYamlDocument[] {
  const documents = parseAllDocuments(readFileSync(fullPath, 'utf8'))

  for (const document of documents) {
    if (document.errors.length > 0) {
      throw document.errors[0]
    }
  }

  if (!allowMultipleDocuments && documents.length > 1) {
    throw new MultipleYamlDocumentsError()
  }

  return documents.map((document, index) => ({
    data: document.toJS(),
    ...(documents.length > 1 ? {document: index} : {})
  }))
}

interface YamlFileValidationContext {
  allowMultipleDocuments: boolean
  exclude: Excluder
  jsonExtension: string
  result: ValidationResult
  skipRegex: RegExp | null
  yamlAsJson: boolean
  yamlSchema: string
}

function validateYamlFiles(
  files: string[],
  context: YamlFileValidationContext
): void {
  const processedFiles = new Set<string>()

  for (const fullPath of files) {
    core.debug(`found file: ${fullPath}`)

    if (context.yamlSchema !== '' && fullPath === context.yamlSchema) {
      core.debug(`skipping yaml schema file: ${fullPath}`)
      continue
    }

    const isJsonFile =
      context.jsonExtension && fullPath.endsWith(context.jsonExtension)
    if (context.yamlAsJson === false && isJsonFile) {
      core.debug(
        `the yaml-validator found a json file so it will be skipped here: '${fullPath}'`
      )
      continue
    }

    if (processedFiles.has(fullPath)) {
      core.debug(`skipping duplicate file: ${fullPath}`)
      continue
    }
    processedFiles.add(fullPath)

    if (context.yamlAsJson) {
      core.debug(
        `skipping yaml since it should be treated as json: ${fullPath}`
      )
      context.result.skipped++
      continue
    }

    if (context.skipRegex !== null && context.skipRegex.test(fullPath)) {
      core.info(`skipping due to exclude match: ${fullPath}`)
      context.result.skipped++
      continue
    }

    if (context.exclude.isExcluded(fullPath)) {
      core.info(`skipping due to exclude match: ${fullPath}`)
      context.result.skipped++
      continue
    }

    let documents: ParsedYamlDocument[]

    try {
      documents = parseYamlDocuments(fullPath, context.allowMultipleDocuments)
      if (documents.length > 1) {
        core.info(`multiple documents found in file: ${fullPath}`)
      }
    } catch (error) {
      core.error(`❌ failed to parse YAML file: ${fullPath}`)
      context.result.success = false
      context.result.failed++
      context.result.violations.push({
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

    if (!context.yamlSchema) {
      context.result.passed++
      core.info(`${fullPath} is valid`)
      continue
    }

    const schemaErrors: ValidationError[] = []
    for (const document of documents) {
      for (const error of validateYamlSchemaData(
        document.data,
        context.yamlSchema
      )) {
        schemaErrors.push({
          path: error.path || null,
          message: error.message,
          ...(document.document !== undefined
            ? {document: document.document}
            : {})
        })
      }
    }

    if (schemaErrors && schemaErrors.length > 0) {
      core.error(
        `❌ failed to parse YAML file: ${fullPath}\n${JSON.stringify(
          schemaErrors
        )}`
      )
      context.result.success = false
      context.result.failed++

      context.result.violations.push({
        file: fullPath,
        errors: schemaErrors
      })
      continue
    }

    context.result.passed++
    core.info(`${fullPath} is valid`)
  }
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

  const skipRegex = yamlExcludeRegex ? new RegExp(yamlExcludeRegex) : null
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
    core.debug('using schema_mappings for yaml validation')
    for (const mapping of schemaMappings.filter(item => item.type === 'yaml')) {
      core.debug(`using files: ${mapping.files.join(', ')}`)
      validateYamlFiles(mapping.files, {
        allowMultipleDocuments,
        exclude,
        jsonExtension,
        result,
        skipRegex,
        yamlAsJson,
        yamlSchema: mapping.schema
      })
    }

    return result
  }

  let files = discoverExplicitFiles(patterns)
  const baseDirSanitized = baseDir.replace(/\/$/, '')

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
  validateYamlFiles(files, {
    allowMultipleDocuments,
    exclude,
    jsonExtension,
    result,
    skipRegex,
    yamlAsJson,
    yamlSchema
  })

  return result
}
