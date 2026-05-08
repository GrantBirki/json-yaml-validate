import {readFileSync} from 'node:fs'
import {extname} from 'node:path'
import {parse} from 'yaml'

export interface YamlSchemaValidationError {
  path: string | null
  message: string
}

type SchemaMap = Record<string, unknown>
type ValidationType = 'boolean' | 'number' | 'string'

const TYPE_DISPLAY_NAMES: Record<ValidationType, string> = {
  boolean: 'Boolean',
  number: 'Number',
  string: 'String'
}

function isRecord(value: unknown): value is SchemaMap {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadStructuredFile(filePath: string): unknown {
  const content = readFileSync(filePath, 'utf8')
  return extname(filePath).toLowerCase() === '.json'
    ? JSON.parse(content)
    : parse(content)
}

function normalizeType(value: unknown): ValidationType | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.toLowerCase()
  if (
    normalized === 'boolean' ||
    normalized === 'number' ||
    normalized === 'string'
  ) {
    return normalized
  }

  return null
}

function valueMatchesType(value: unknown, type: ValidationType): boolean {
  return typeof value === type
}

function joinPath(parent: string, child: string | number): string {
  return parent ? `${parent}.${child}` : String(child)
}

function isRuleNode(schemaNode: unknown): schemaNode is SchemaMap {
  if (!isRecord(schemaNode)) {
    return false
  }

  return (
    normalizeType(schemaNode.type) !== null ||
    typeof schemaNode.required === 'boolean' ||
    isLengthRule(schemaNode.length) ||
    Array.isArray(schemaNode.enum)
  )
}

function isLeafRule(schemaNode: unknown): boolean {
  return isRuleNode(schemaNode) && (normalizeType(schemaNode.type) !== null || typeof schemaNode.required === 'boolean')
}

function isLengthRule(value: unknown): boolean {
  if (typeof value === 'number') {
    return true
  }

  if (!isRecord(value)) {
    return false
  }

  return typeof value.min === 'number' || typeof value.max === 'number'
}

function formatEnum(values: unknown[]): string {
  if (values.length <= 1) {
    return String(values[0])
  }

  const prefix = values.slice(0, -1).map(value => String(value))
  return `${prefix.join(', ')} or ${String(values[values.length - 1])}`
}

function validateLength(
  value: unknown,
  rule: SchemaMap,
  path: string,
  errors: YamlSchemaValidationError[]
): void {
  if (typeof value !== 'string') {
    return
  }

  const length = rule.length
  if (typeof length === 'number' && value.length !== length) {
    errors.push({
      path,
      message: `${path} must have a length of ${length}.`
    })
    return
  }

  if (!isRecord(length)) {
    return
  }

  const minimum = typeof length.min === 'number' ? length.min : null
  const maximum = typeof length.max === 'number' ? length.max : null

  if (
    minimum !== null &&
    maximum !== null &&
    (value.length < minimum || value.length > maximum)
  ) {
    errors.push({
      path,
      message: `${path} must have a length between ${minimum} and ${maximum}.`
    })
    return
  }

  if (minimum !== null && value.length < minimum) {
    errors.push({
      path,
      message: `${path} must have a minimum length of ${minimum}.`
    })
    return
  }

  if (maximum !== null && value.length > maximum) {
    errors.push({
      path,
      message: `${path} must have a maximum length of ${maximum}.`
    })
  }
}

function validateRule(
  value: unknown,
  rule: SchemaMap,
  path: string,
  errors: YamlSchemaValidationError[]
): void {
  if (rule.required === true && (value === undefined || value === null)) {
    errors.push({
      path,
      message: `${path} is required.`
    })
    return
  }

  if (value === undefined || value === null) {
    return
  }

  const type = normalizeType(rule.type)
  if (type !== null && !valueMatchesType(value, type)) {
    errors.push({
      path,
      message: `${path} must be of type ${TYPE_DISPLAY_NAMES[type]}.`
    })
    return
  }

  validateLength(value, rule, path, errors)

  if (Array.isArray(rule.enum) && !rule.enum.includes(value)) {
    errors.push({
      path,
      message: `${path} must be either ${formatEnum(rule.enum)}.`
    })
  }
}

function validateSchemaNode(
  value: unknown,
  schemaNode: unknown,
  path: string,
  errors: YamlSchemaValidationError[]
): void {
  if (Array.isArray(schemaNode)) {
    if (value === undefined || value === null) {
      return
    }

    if (!Array.isArray(value)) {
      errors.push({
        path,
        message: `${path} must be of type Array.`
      })
      return
    }

    for (const [index, item] of value.entries()) {
      validateSchemaNode(item, schemaNode[0], joinPath(path, index), errors)
    }
    return
  }

  if (!isRecord(schemaNode)) {
    return
  }

  if (isRuleNode(schemaNode)) {
    validateRule(value, schemaNode, path, errors)
    return
  }

  if (value !== undefined && !isRecord(value) && !Array.isArray(value)) {
    return
  }

  for (const [key, childSchema] of Object.entries(schemaNode)) {
    const childValue = isRecord(value)
      ? value[key]
      : Array.isArray(value)
        ? value[Number(key)]
        : undefined
    validateSchemaNode(childValue, childSchema, joinPath(path, key), errors)
  }
}

function validateExtraFields(
  targetNode: unknown,
  schemaNode: unknown,
  path: string,
  errors: YamlSchemaValidationError[]
): void {
  if (
    targetNode === null ||
    (!isRecord(targetNode) && !Array.isArray(targetNode))
  ) {
    return
  }

  for (const key of Object.keys(targetNode)) {
    const value = Array.isArray(targetNode)
      ? targetNode[Number(key)]
      : targetNode[key]
    const childSchema = Array.isArray(targetNode)
      ? Array.isArray(schemaNode)
        ? schemaNode[0]
        : undefined
      : isRecord(schemaNode)
        ? schemaNode[key]
        : undefined
    const childPath = joinPath(path, key)

    if (
      childSchema === undefined ||
      (typeof value !== 'object' && !isLeafRule(childSchema))
    ) {
      errors.push({
        path: childPath,
        message: `${childPath} is not present in schema`
      })
      continue
    }

    validateExtraFields(value, childSchema, childPath, errors)
  }
}

export function validateYamlSchemaFile(
  targetPath: string,
  schemaPath: string
): YamlSchemaValidationError[] {
  const schema = loadStructuredFile(schemaPath)
  const target = loadStructuredFile(targetPath)
  const validationErrors: YamlSchemaValidationError[] = []
  const extraFieldErrors: YamlSchemaValidationError[] = []

  validateSchemaNode(target, schema, '', validationErrors)
  validateExtraFields(target, schema, '', extraFieldErrors)

  return validationErrors.concat(extraFieldErrors)
}
