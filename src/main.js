import {jsonValidator} from './functions/json-validator'
import {yamlValidator} from './functions/yaml-validator'
import {processResults} from './functions/process-results'

export async function run() {
  const jsonResults = await jsonValidator()
  const yamlResults = await yamlValidator()
  await processResults(jsonResults, yamlResults)
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
