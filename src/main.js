import {jsonValidator} from './functions/json-validator'
import {yamlValidator} from './functions/yaml-validator'
import {processResults} from './functions/process-results'
import {Exclude} from './functions/exclude'

export async function run() {
  const jsonResults = await jsonValidator(new Exclude())
  const yamlResults = await yamlValidator(new Exclude())
  await processResults(jsonResults, yamlResults)
}

if (process.env.LOCAL_ACTIONS_CI_TEST !== 'true') {
  /* istanbul ignore next */
  run()
}
