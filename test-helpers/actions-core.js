function inputName(name) {
  return `INPUT_${name.replace(/ /g, '_').toUpperCase()}`
}

export function getInput(name, options = {}) {
  const value = process.env[inputName(name)] || ''

  if (options.required && value === '') {
    throw new Error(`Input required and not supplied: ${name}`)
  }

  if (options.trimWhitespace === false) {
    return value
  }

  return value.trim()
}

export function getBooleanInput(name, options = {}) {
  const value = getInput(name, options)

  if (['true', 'True', 'TRUE'].includes(value)) {
    return true
  }

  if (['false', 'False', 'FALSE'].includes(value) || value === '') {
    return false
  }

  throw new TypeError(
    `Input does not meet YAML 1.2 "Core Schema" specification: ${name}`
  )
}

export function getMultilineInput(name, options = {}) {
  const value = getInput(name, options)

  if (value === '') {
    return []
  }

  return value
    .split('\n')
    .map(line => (options.trimWhitespace === false ? line : line.trim()))
    .filter(line => line !== '')
}

export function info() {}

export function warning() {}

export function error() {}

export function debug() {}

export function setFailed() {}

export function setOutput() {}
