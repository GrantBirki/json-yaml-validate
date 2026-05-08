import type {ValidateFunction} from 'ajv'

export interface AjvLike {
  addFormat(name: string, format: RegExp): unknown
  compile(schema: unknown): ValidateFunction
  getSchema(keyRef: string): ValidateFunction | undefined
}

export type AjvConstructor = new (options: {
  allErrors: boolean
  strict: boolean
}) => AjvLike

export interface ValidationError {
  path: string | null
  message: string
  error?: string
  document?: number
}

export interface FileViolation {
  file: string
  errors: ValidationError[]
}

export interface ValidationResult {
  success: boolean
  passed: number
  failed: number
  skipped: number
  violations: FileViolation[]
}

export interface Excluder {
  isExcluded(file: string): boolean
}

export interface YamlDocument {
  errors: unknown[]
  toJS(): unknown
}

export interface PullRequestContext {
  owner: string
  repo: string
  issueNumber: number
}

export interface JsonFileValidationContext {
  allowMultipleDocuments: boolean
  exclude: Excluder
  jsonSchema: string
  result: ValidationResult
  skipRegex: RegExp | null
  validate: ValidateFunction
  inlineSchemaValidator?: (
    filePath: string,
    source: string,
    data: unknown,
    isYamlFile: boolean
  ) => Promise<
    | {
        validate: ValidateFunction
      }
    | {
        error: string
      }
    | null
  >
  yamlAsJson: boolean
  yamlExtension: string
  yamlExtensionShort: string
}
