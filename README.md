# JSON and YAML - Validator ✅

[![CodeQL](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml) [![test](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml) [![package-check](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml) [![lint](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml) [![coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action to quickly validate JSON and YAML files in a repository

## About 💡

This action comes pre-packaged with two different common JSON and YAML validators:

- JSON validation with [ajv](https://github.com/ajv-validator/ajv) - The fastest NodeJS JSON validator
- YAML validation with [yaml-schema-validator](https://github.com/ketanSaxena/schema-validator)

If you have a repository containing JSON or YAML files and want to validate them extremely quickly, this action is for you!

You can provide schemas to check against, or just validate the syntax of the files. This comes very handy when you want to ensure that your JSON and YAML files are valid before committing them to your repository, especially from pull requests.

## Installation 📦

Here is a quick example of how to install this action in any workflow:

```yaml
# checkout the repository
- uses: actions/checkout@v3.5.0

# validate JSON and YAML files
- name: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@vX.X.X # <--- replace with the latest version
```

## Inputs 📥

| Input | Required? | Default | Description |
| ----- | --------- | ------- | ----------- |
| `mode` | `false` | `"fail"` | The mode to run the action in `"warn"` or `"fail"` |
| `comment` | `false` | `"false"` | Whether or not to comment on a PR with the validation results - `"true"` or `"false"` |
| `base_dir` | `false` | `"."` | The base directory to search for JSON and YAML files (e.g. ./src) - Default is `"."` which searches the entire repository |
| `json_schema` | `false` | `""` | The full path to the JSON schema file (e.g. ./schemas/schema.json) - Default is `""` which doesn't enforce a strict schema |
| `json_extension` | `false` | `".json"` | The file extension for JSON files (e.g. .json) |
| `json_exclude_regex` | `false` | `""` | A regex to exclude files from validation (e.g. `".*\.schema\.json$"` to exclude all files ending with `.schema.json`) - Default is `""` which doesn't exclude any files |
| `yaml_schema` | `false` | `""` | The full path to the YAML schema file (e.g. ./schemas/schema.yaml) - Default is `""` which doesn't enforce a strict schema |
| `yaml_extension` | `false` | `".yaml"` | The file extension for YAML files (e.g. .yaml) |
| `yaml_extension_short` | `false` | `".yml"` | The "short" file extension for YAML files (e.g. .yml) |
| `yaml_exclude_regex` | `false` | `""` | A regex to exclude files from validation (e.g. `".*\.schema\.yaml$"` to exclude all files ending with `.schema.yaml`) - Default is `""` which doesn't exclude any files |
| `github_token` | `false` | `${{ github.token }}` | The GitHub token used to create an authenticated client - Provided for you by default! |

## Outputs 📤

| Output | Description |
| ------ | ----------- |
| `success` | Whether or not the validation was successful for all files - `"true"` or `"false"` |

## Usage 🚀

Here are some basic usage examples for this Action

### Basic

```yaml
name: json-yaml-validate 
on:
  push:
    branches:
      - main
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  json-yaml-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3.5.0

      - name: json-yaml-validate
        id: json-yaml-validate
        uses: GrantBirki/json-yaml-validate@vX.X.X # replace with the latest version
```

### Pull Request Comment

Here is a usage example in the context of a pull request with comment mode enabled:

```yaml
name: json-yaml-validate 
on:
  push:
    branches:
      - main
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write # enable write permissions for pull requests

jobs:
  json-yaml-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3.5.0

      - name: json-yaml-validate
        id: json-yaml-validate
        uses: GrantBirki/json-yaml-validate@vX.X.X # replace with the latest version
        with:
          comment: "true" # enable comment mode
```

The resulting comment will look like this:

![comment-example](docs/assets/comment-example.png)

### Schema Validation

This Action also supports schema validation for both JSON and YAML files.

References docs for both JSON and YAML schema validation can be found at the links below:

- [JSON Schema Validation Docs](https://ajv.js.org/json-schema.html#json-schema)
- [YAML Schema Validation Docs](https://github.com/ketanSaxena/schema-validator#yaml-schema) - Additional docs [here](https://www.npmjs.com/package/validate)

Assuming the following repository structure:

```text
/
├── schemas/
│   ├── schema.yml
│   └── schema.json
├── data/
│   ├── test.json
│   └── test.yml
└── ...
```

Here is an example of how to use this feature:

```yaml
# checkout the repository
- uses: actions/checkout@v3.5.0

- name: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@vX.X.X # replace with the latest version
  with:
    yaml_schema: schemas/schema.yml # validate YAML files against the schema
    json_schema: schemas/schema.json # validate JSON files against the schema
```

When this Action workflow runs, it will validate all JSON and YAML files in the repository against the schema files in the `schemas/` directory.

> If you want to only validate files in the `data/` directory, you could set the `base_dir` input to `data/`

## Violations Structure Explained

Below is a very simple example of a violation warning that you might see in this Action in your Action's logs or as a comment on a pull request:

```json
[
  {
    "file": "./test/test2.json",
    "errors": [
      {
        "path": null,
        "message": "Invalid JSON"
      }
    ]
  },
  {
    "file": "./test/test3.yaml",
    "errors": [
      {
        "path": "person.age",
        "message": "person.age must be of type String."
      }
    ]
  }
]
```

The example above contains two violations - one for a JSON file and one for a YAML file. Here is what each of the fields mean:

- `file` - The full path to file that the violation occurred in
- `errors` - An array of errors that occurred in the file
  - `path` - The path to the error in the file (if applicable) - Note: This is **not** the file path but rather the path place within the file that the error occurred
  - `message` - The error message

In the example above, the `path` for the JSON file is `null` and the message says `Invalid JSON`. This means that the entire file could not be parsed as JSON. Likewise, if you see `null` for the `path` and the message says `Invalid YAML`, this means that the entire file could not be parsed as YAML.
