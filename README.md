# JSON and YAML - Validator ✅

[![CodeQL](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/codeql-analysis.yml) [![test](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/test.yml) [![acceptance-test](https://github.com/GrantBirki/json-yaml-validate/actions/workflows/acceptance-test.yml/badge.svg)](https://github.com/GrantBirki/json-yaml-validate/actions/workflows/acceptance-test.yml) [![package-check](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/package-check.yml) [![lint](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml/badge.svg)](https://github.com/grantbirki/json-yaml-validate/actions/workflows/lint.yml) [![coverage](./badges/coverage.svg)](./badges/coverage.svg)

A GitHub Action to quickly validate JSON and YAML files in a repository

## About 💡

This action comes pre-packaged with two different common JSON and YAML validators:

- JSON validation with [ajv](https://github.com/ajv-validator/ajv) - The fastest NodeJS JSON validator
- YAML validation with [yaml-schema-validator](https://github.com/ketanSaxena/schema-validator)

If you have a repository containing JSON or YAML files and want to validate them extremely quickly, this action is for you!

You can provide schemas to check against, or just validate the syntax of the files. This comes very handy when you want to ensure that your JSON and YAML files are valid before committing them to your repository, especially from pull requests.

This Action is also extremely **fast** ⚡. It uses [`fdir`](https://github.com/thecodrr/fdir) under the hood for directory crawling and file globbing when looking for JSON and YAML files. This Action can crawl through a million files in under a second and validate those files in just a few more.

## Installation 📦

Here is a quick example of how to install this action in any workflow:

```yaml
# checkout the repository (required for this Action to work)
- uses: actions/checkout@v4

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
| `files` | `false` | `""` | List of file paths to validate. Each file path must be on a newline. |
| `use_dot_match` | `false` | `"true"` | Whether or not to use dot-matching when searching for files - `"true"` or `"false"` - If this is true, directories like `.github`, etc will be searched |
| `json_schema` | `false` | `""` | The full path to the JSON schema file (e.g. ./schemas/schema.json) - Default is `""` which doesn't enforce a strict schema |
| `json_schema_version` | `false` | `"draft-07"` | The version of the JSON schema to use - `"draft-07"`, `"draft-2019-09"`, `"draft-2020-12"` |
| `json_extension` | `false` | `".json"` | The file extension for JSON files (e.g. .json) |
| `json_exclude_regex` | `false` | `""` | A regex to exclude files from validation (e.g. `".*\.schema\.json$"` to exclude all files ending with `.schema.json`) - Default is `""` which doesn't exclude any files |
| `use_ajv_formats` | `false` | `"true"` | Whether or not to use the [AJV formats](https://github.com/ajv-validator/ajv-formats) with the JSON processor |
| `yaml_schema` | `false` | `""` | The full path to the YAML schema file (e.g. ./schemas/schema.yaml) - Default is `""` which doesn't enforce a strict schema |
| `yaml_extension` | `false` | `".yaml"` | The file extension for YAML files (e.g. .yaml) |
| `yaml_extension_short` | `false` | `".yml"` | The "short" file extension for YAML files (e.g. .yml) |
| `yaml_exclude_regex` | `false` | `""` | A regex to exclude files from validation (e.g. `".*\.schema\.yaml$"` to exclude all files ending with `.schema.yaml`) - Default is `""` which doesn't exclude any files |
| `yaml_as_json` | `false` | `"false"` | Whether or not to treat and validate YAML files as JSON files - `"true"` or `"false"` - Default is `"false"`. If this is true, the JSON schema will be used to validate YAML files. Any YAML schemas will be ignored. For this context, a YAML file is any file which matches the yaml_extension or yaml_extension_short inputs. See the [docs](docs/yaml_as_json.md) for more details |
| `exclude_file` | `false` | `""` | The full path to a file in the repository where this Action is running that contains a list of '.gitignore'-style patterns to exclude files from validation (e.g. ./exclude.txt) |
| `use_gitignore` | `true` | `"true"` | Whether or not to use the .gitignore file in the root of the repository to exclude files from validation - `"true"` or `"false"` - Default is `"true"` |
| `git_ignore_path` | `false` | `".gitignore"` | The full path to the .gitignore file to use if use_gitignore is set to "true" (e.g. ./src/.gitignore) - Default is ".gitignore" which uses the .gitignore file in the root of the repository |
| `allow_multiple_documents` | `false` | `"false"` | Whether or not to allow multiple documents in a single YAML file - `"true"` or `"false"` - Default is `"false"`. Useful for k8s documents. |
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
      - uses: actions/checkout@v4

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
  pull-requests: write # enable write permissions for pull request comments

jobs:
  json-yaml-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

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

> Note: JSON files and YAML files use two separate libraries for schema validation

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
- uses: actions/checkout@v4

- name: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@vX.X.X # replace with the latest version
  with:
    yaml_schema: schemas/schema.yml # validate YAML files against the schema
    json_schema: schemas/schema.json # validate JSON files against the schema
```

When this Action workflow runs, it will validate all JSON and YAML files in the repository against the schema files in the `schemas/` directory.

> If you want to only validate files in the `data/` directory, you could set the `base_dir` input to `data/`

### JSON Schema Docs

For validating a `.json` file with a `.json` schema

#### JSON Input Example

```json
{
  "foo": 1,
  "bar": "abc"
}

```

#### JSON Schema Example

```json
{
  "type": "object",
  "properties": {
    "foo": {
      "type": "integer"
    },
    "bar": {
      "type": "string"
    }
  },
  "required": [
    "foo"
  ],
  "additionalProperties": false
}
```

Details on the fields seen in the schema above:

- `type` - the type of the value, can be one of `string`, `number`, `integer`, `boolean`, `array`, `object`, `null`
- `required` - an array of strings, each of which is a property name that is required
- `additionalProperties` - a boolean value that determines if additional properties are allowed in the object

### YAML Schema Docs

For validating a `.yaml` file with a `.yaml` schema

> Note: can also be `.yml` files, both work

#### YAML Input Example

The following is a sample yaml file to input into the validator schema which will be seen below:

```yaml
---
person:
  name:
    first_name: monalisa
  age: 2000
  employed: true
  hobbies:
    - tennis
    - football

```

#### YAML Schema Example

The schema used to validate the input file from above:

```yaml
---
person:
  name:
    first_name:
      type: string
      length: # define min and max length (optional)
        min: 2
        max: 10
  age:
    type: number
    required: true # make this field required (optional)
  employed:
    type: boolean
  hobbies:
    - type: string
      enum: [football, basketball, tennis] # only accept these values (optional)
```

Details on the fields seen in the schema above:

- `type` - The type of the field (e.g. `string`, `number`, `boolean`, etc)
- `length` - The length of the field with `min` and `max` constraints
- `required` - Whether or not the field is required
- `enums` - An array of values that the field can be

## Excluding Files

There are three main ways you can go about excluding files from being validated with this Action:

- `json_exclude_regex` - A regex string that will be used to exclude **JSON** files from being validated
- `yaml_exclude_regex` - A regex string that will be used to exclude **YAML** files from being validated
- `exclude_file` - **best** way to exclude files - A file that contains a list of files to exclude from being validated in *gitignore* format

> It should be strongly noted that both `json_exclude_regex` and `yaml_exclude_regex` options get unwieldy very quickly and are not recommended. The `exclude_file` option is the best way to exclude files from being validated. Especially if you have a large repository with many files.

Example of an `exclude_file`'s contents:

```python
# exclude all files in the test/ directory
test/

# exclude a yaml file at an exact path
src/cool-path/example.yaml

# exclude all json files with some glob matching
*.test.json
```

If the file path to your `exclude_file` is `exclude.txt`, you would set the `exclude_file` input to `exclude.txt` like so:

```yaml
# checkout the repository
- uses: actions/checkout@v4

- name: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@vX.X.X # replace with the latest version
  with:
    exclude_file: exclude.txt # gitignore style file that contains a list of files to exclude
```

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

## Known Issues

This section documents known issues and workarounds / fixes

### .gitignore directory exclusion

If you plan on using your `.gitignore` file, you should always include a trailing slash when excluding a directory. For example, instead of `node_modules` use `node_modules/`. This will ensure the Action correctly detects the directory as a directory and not a file.
