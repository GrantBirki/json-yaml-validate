import {jsonValidator} from '../src/functions/json-validator'
import {yamlValidator} from '../src/functions/yaml-validator'
import {Exclude} from '../src/functions/exclude'

const originalEnv = process.env

beforeEach(() => {
  jest.clearAllMocks()
  process.env = {...originalEnv}
  
  // Set default environment variables
  process.env.INPUT_BASE_DIR = '.'
  process.env.INPUT_JSON_EXTENSION = '.json'
  process.env.INPUT_JSON_EXCLUDE_REGEX = ''
  process.env.INPUT_JSON_SCHEMA = ''
  process.env.INPUT_YAML_EXTENSION = '.yaml'
  process.env.INPUT_YAML_EXTENSION_SHORT = '.yml'
  process.env.INPUT_YAML_EXCLUDE_REGEX = ''
  process.env.INPUT_YAML_SCHEMA = ''
  process.env.INPUT_YAML_AS_JSON = 'false'
  process.env.INPUT_USE_DOT_MATCH = 'true'
  process.env.INPUT_ALLOW_MULTIPLE_DOCUMENTS = 'false'
  process.env.INPUT_USE_GITIGNORE = 'false'
  process.env.INPUT_EXCLUDE_FILE = ''
  process.env.INPUT_EXCLUDE_FILE_REQUIRED = 'false'
  process.env.INPUT_GIT_IGNORE_PATH = '.gitignore'
  process.env.INPUT_AJV_STRICT_MODE = 'true'
  process.env.INPUT_JSON_SCHEMA_VERSION = 'draft-07'
  process.env.INPUT_USE_AJV_FORMATS = 'false'
})

afterEach(() => {
  process.env = originalEnv
})

describe('file duplication and extension issue reproduction', () => {
  test('reproduces the issue from bug report #70', async () => {
    // Setup the scenario from the issue using test fixtures
    process.env.INPUT_FILES = '__tests__/fixtures/json/valid/json1.json\n__tests__/fixtures/yaml/valid/yaml1.yaml'
    
    const excludeMock = new Exclude()
    
    // Run both validators like in main.js
    const jsonResults = await jsonValidator(excludeMock)
    const yamlResults = await yamlValidator(excludeMock)
    
    // Expectations based on the correct behavior
    // JSON validator should process only the .json file
    expect(jsonResults.passed).toBe(1)
    expect(jsonResults.failed).toBe(0)
    expect(jsonResults.skipped).toBe(0)
    
    // YAML validator should process only the .yaml file  
    expect(yamlResults.passed).toBe(1)
    expect(yamlResults.failed).toBe(0)
    expect(yamlResults.skipped).toBe(0)
    
    console.log('JSON Results:', jsonResults)
    console.log('YAML Results:', yamlResults)
  })
})