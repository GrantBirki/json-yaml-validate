import {mkdtempSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {validateYamlSchemaFile} from '../../src/functions/yaml-schema-validator.js'

function withTempFiles<T>(
  files: Record<string, string>,
  callback: (paths: Record<string, string>) => T
): T {
  const directory = mkdtempSync(join(tmpdir(), 'yaml-schema-validator-'))
  const paths: Record<string, string> = {}

  for (const [name, content] of Object.entries(files)) {
    const path = join(directory, name)
    writeFileSync(path, content)
    paths[name] = path
  }

  try {
    return callback(paths)
  } finally {
    rmSync(directory, {recursive: true, force: true})
  }
}

test('validates a nested YAML file against the legacy YAML schema dialect', () => {
  expect(
    validateYamlSchemaFile(
      '__tests__/fixtures/yaml/valid/yaml1.yaml',
      '__tests__/fixtures/schemas/schema1.yaml'
    )
  ).toStrictEqual([])
})

test('reports type and enum violations with legacy-compatible messages', () => {
  expect(
    validateYamlSchemaFile(
      '__tests__/fixtures/yaml/mixture/yaml1.yaml',
      '__tests__/fixtures/schemas/schema2.yml'
    )
  ).toStrictEqual([
    {
      path: 'person.age',
      message: 'person.age must be of type String.'
    },
    {
      path: 'person.hobbies.1',
      message: 'person.hobbies.1 must be either football, basketball or tennis.'
    }
  ])
})

test('loads JSON schema files as well as YAML schema files', () => {
  withTempFiles(
    {
      'target.yaml': 'name: Mona\n',
      'schema.json': JSON.stringify({
        name: {
          type: 'string',
          required: true
        }
      })
    },
    paths => {
      expect(
        validateYamlSchemaFile(paths['target.yaml'], paths['schema.json'])
      ).toStrictEqual([])
    }
  )
})

test('reports required, array, length, and single-value enum errors', () => {
  withTempFiles(
    {
      'target.yaml': [
        'name: A',
        'alias: ab',
        'tag: long',
        'code: toolong',
        'color: blue',
        'letters:',
        '  - 1',
        '  - ok',
        'not_array: nope'
      ].join('\n'),
      'schema.yaml': [
        'name:',
        '  type: string',
        '  length:',
        '    min: 2',
        '    max: 4',
        'alias:',
        '  type: string',
        '  length:',
        '    min: 3',
        'tag:',
        '  type: string',
        '  length:',
        '    max: 3',
        'code:',
        '  type: string',
        '  length: 4',
        'color:',
        '  enum: [red]',
        'age:',
        '  required: true',
        'letters:',
        '  - type: string',
        'not_array:',
        '  - type: string'
      ].join('\n')
    },
    paths => {
      expect(
        validateYamlSchemaFile(paths['target.yaml'], paths['schema.yaml'])
      ).toStrictEqual([
        {
          path: 'name',
          message: 'name must have a length between 2 and 4.'
        },
        {
          path: 'alias',
          message: 'alias must have a minimum length of 3.'
        },
        {
          path: 'tag',
          message: 'tag must have a maximum length of 3.'
        },
        {
          path: 'code',
          message: 'code must have a length of 4.'
        },
        {
          path: 'color',
          message: 'color must be either red.'
        },
        {
          path: 'age',
          message: 'age is required.'
        },
        {
          path: 'letters.0',
          message: 'letters.0 must be of type String.'
        },
        {
          path: 'not_array',
          message: 'not_array must be of type Array.'
        },
        {
          path: 'color',
          message: 'color is not present in schema'
        },
        {
          path: 'not_array',
          message: 'not_array is not present in schema'
        }
      ])
    }
  )
})

test('reports extra fields after schema validation errors', () => {
  withTempFiles(
    {
      'target.yaml': [
        'known: ok',
        'unexpected: true',
        'section:',
        '  name: Mona',
        '  extra: value',
        'list:',
        '  - name: first',
        '    extra: value',
        '  - rogue',
        'loose: value'
      ].join('\n'),
      'schema.yaml': [
        'known:',
        '  type: string',
        'section:',
        '  name:',
        '    type: string',
        'list:',
        '  - name:',
        '      type: string',
        'loose:',
        '  type: integer'
      ].join('\n')
    },
    paths => {
      expect(
        validateYamlSchemaFile(paths['target.yaml'], paths['schema.yaml'])
      ).toStrictEqual([
        {
          path: 'unexpected',
          message: 'unexpected is not present in schema'
        },
        {
          path: 'section.extra',
          message: 'section.extra is not present in schema'
        },
        {
          path: 'list.0.extra',
          message: 'list.0.extra is not present in schema'
        },
        {
          path: 'list.1',
          message: 'list.1 is not present in schema'
        },
        {
          path: 'loose',
          message: 'loose is not present in schema'
        }
      ])
    }
  )
})

test('keeps legacy behavior for scalar values where nested objects were expected', () => {
  withTempFiles(
    {
      'target.yaml': 'person: invalid\n',
      'schema.yaml': [
        'person:',
        '  name:',
        '    type: string',
        '    required: true'
      ].join('\n')
    },
    paths => {
      expect(
        validateYamlSchemaFile(paths['target.yaml'], paths['schema.yaml'])
      ).toStrictEqual([
        {
          path: 'person',
          message: 'person is not present in schema'
        }
      ])
    }
  )
})

test('handles null targets and non-object schemas without throwing', () => {
  withTempFiles(
    {
      'null.yaml': 'null\n',
      'bool-schema.yaml': 'true\n',
      'object.yaml': 'name: Mona\n',
      'empty-schema.yaml': '{}\n'
    },
    paths => {
      expect(
        validateYamlSchemaFile(paths['null.yaml'], paths['empty-schema.yaml'])
      ).toStrictEqual([])
      expect(
        validateYamlSchemaFile(paths['object.yaml'], paths['bool-schema.yaml'])
      ).toStrictEqual([
        {
          path: 'name',
          message: 'name is not present in schema'
        }
      ])
    }
  )
})
