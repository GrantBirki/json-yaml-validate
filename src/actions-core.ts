import {appendFileSync} from 'node:fs'
import {randomUUID} from 'node:crypto'

export interface InputOptions {
  required?: boolean
  trimWhitespace?: boolean
}

export interface ActionsCore {
  debug(message: string): void
  error(message: string | Error): void
  getBooleanInput(name: string, options?: InputOptions): boolean
  getInput(name: string, options?: InputOptions): string
  getMultilineInput(name: string, options?: InputOptions): string[]
  info(message: string): void
  setFailed(message: string | Error): void
  setOutput(name: string, value: string): void
  warning(message: string | Error): void
}

const TRUE_VALUES = new Set(['true', 'True', 'TRUE'])
const FALSE_VALUES = new Set(['false', 'False', 'FALSE'])

function getInputName(name: string): string {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`
}

function stringify(message: string | Error): string {
  return message instanceof Error ? message.message : message
}

function escapeCommandValue(value: string): string {
  return value.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')
}

function escapeCommandProperty(value: string): string {
  return escapeCommandValue(value).replace(/:/g, '%3A').replace(/,/g, '%2C')
}

function issueCommand(
  command: string,
  properties: Record<string, string>,
  message: string
): void {
  const propertyText = Object.entries(properties)
    .map(([key, value]) => `${key}=${escapeCommandProperty(value)}`)
    .join(',')
  const separator = propertyText ? ` ${propertyText}` : ''
  console.log(`::${command}${separator}::${escapeCommandValue(message)}`)
}

function getInput(name: string, options: InputOptions = {}): string {
  const rawValue = process.env[getInputName(name)] ?? ''
  const value =
    options.trimWhitespace === false ? rawValue : rawValue.trim()

  if (options.required === true && value.length === 0) {
    throw new Error(`Input required and not supplied: ${name}`)
  }

  return value
}

function getBooleanInput(name: string, options: InputOptions = {}): boolean {
  const value = getInput(name, options)

  if (value.length === 0) {
    return false
  }

  if (TRUE_VALUES.has(value)) {
    return true
  }

  /* node:coverage ignore next 3 */
  if (FALSE_VALUES.has(value)) {
    return false
  }

  throw new TypeError(
    `Input does not meet YAML 1.2 boolean format: ${name}=${value}`
  )
}

function getMultilineInput(name: string, options: InputOptions = {}): string[] {
  const value = getInput(name, options)

  if (value.length === 0) {
    return []
  }

  return value
    .split('\n')
    .map(line => (options.trimWhitespace === false ? line : line.trim()))
    .filter(Boolean)
}

const nativeCore: ActionsCore = {
  debug(message) {
    issueCommand('debug', {}, message)
  },

  error(message) {
    issueCommand('error', {}, stringify(message))
  },

  getBooleanInput,
  getInput,
  getMultilineInput,

  info(message) {
    console.log(message)
  },

  setFailed(message) {
    process.exitCode = 1
    nativeCore.error(message)
  },

  setOutput(name, value) {
    const outputPath = process.env.GITHUB_OUTPUT

    if (outputPath) {
      const delimiter = `ghadelimiter_${randomUUID()}`
      appendFileSync(
        outputPath,
        `${name}<<${delimiter}\n${value}\n${delimiter}\n`
      )
      return
    }

    issueCommand('set-output', {name}, value)
  },

  warning(message) {
    issueCommand('warning', {}, stringify(message))
  }
}

export const core = nativeCore
