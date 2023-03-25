# JSON and YAML - Validate ✅

[![CodeQL](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml) [![test](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml) [![package-check](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml) [![lint](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml) [![coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action to quickly validate JSON and YAML files in a repository

## Inputs 📥

| Input | Required? | Default | Description |
| ----- | --------- | ------- | ----------- |
| `github_token` | `true` | `${{ github.token }}` | The GitHub token used to create an authenticated client - Provided for you by default! |

## Outputs 📤

| Output | Description |
| ------ | ----------- |
| `todo` | todo |
