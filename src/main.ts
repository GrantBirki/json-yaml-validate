import {Exclude} from './functions/exclude.js'
import {jsonValidator} from './functions/json-validator.js'
import {processResults} from './functions/process-results.js'
import {yamlValidator} from './functions/yaml-validator.js'
import type {Excluder, ValidationResult} from './types.js'

interface RunDependencies {
  Exclude: new () => Excluder
  jsonValidator(exclude: Excluder): Promise<ValidationResult>
  processResults(
    jsonResults: ValidationResult,
    yamlResults: ValidationResult
  ): Promise<boolean>
  yamlValidator(exclude: Excluder): Promise<ValidationResult>
}

const defaultDependencies: RunDependencies = {
  Exclude,
  jsonValidator,
  processResults,
  yamlValidator
}

export async function run(
  dependencies: RunDependencies = defaultDependencies
): Promise<void> {
  const jsonResults = await dependencies.jsonValidator(
    new dependencies.Exclude()
  )
  const yamlResults = await dependencies.yamlValidator(
    new dependencies.Exclude()
  )
  await dependencies.processResults(jsonResults, yamlResults)
}

/* node:coverage ignore next 3 */
if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  await run()
}
