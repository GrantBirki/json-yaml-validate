# JSON and YAML - Validator ✅

[![CodeQL](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml) [![test](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml) [![package-check](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml) [![lint](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml) [![coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action to quickly validate JSON and YAML files in a repository

## About 💡

- JSON validation with [ajv](https://github.com/ajv-validator/ajv) - The fastest nodejs JSON validator
- YAML - TODO

## Inputs 📥

| Input | Required? | Default | Description |
| ----- | --------- | ------- | ----------- |
| `mode` | `false` | `"fail"` | The mode to run the action in `"warn"` or `"fail"` - Default is `"fail"` |
| `base_dir` | `false` | `"."` | The base directory to search for JSON and YAML files (e.g. ./src) - Default is `"."` which searches the entire repository |
| `json_schema` | `false` | `""` | The full path to the JSON schema file (e.g. ./schemas/schema.json) - Default is `""` which doesn't enforce a strict schema |
| `json_extension` | `false` | `".json"` | The file extension for JSON files (e.g. .json) - Default is `".json"` |
| `yaml_extension` | `false` | `".yaml"` | The file extension for YAML files (e.g. .yaml) - Default is `".yaml"` |
| `yaml_extension_short` | `false` | `".yml"` | The "short" file extension for YAML files (e.g. .yml) - Default is `".yml"` |
| `github_token` | `false` | `${{ github.token }}` | The GitHub token used to create an authenticated client - Provided for you by default! |

## Outputs 📤

| Output | Description |
| ------ | ----------- |
| `success` | Whether or not the validation was successful for all files - `"true"` or `"false"` |
