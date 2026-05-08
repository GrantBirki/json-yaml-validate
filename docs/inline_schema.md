# Inline Schemas

Set `use_inline_schema: "true"` to validate files with local schema references
declared inside the files themselves.

JSON files may use a top-level `$schema` value:

```json
{
  "$schema": "../schemas/person.schema.json",
  "name": "Ada Lovelace",
  "age": 36
}
```

YAML files may use the yaml-language-server directive when `yaml_as_json` is
also enabled:

```yaml
# yaml-language-server: $schema=../schemas/person.schema.json
name: Ada Lovelace
age: 36
```

Inline schemas use JSON Schema and AJV. YAML inline schemas are not interpreted
as this action's legacy `yaml_schema` dialect.

## Precedence

Inline schema discovery is ignored when `schema_mappings` is configured or when
the top-level `json_schema` input is set. Files without inline schema references
keep the existing syntax-only behavior when no explicit schema applies.

## Security

Inline schema references are local-only. Relative paths are resolved from the
file being validated. Absolute paths are allowed only when their real path stays
inside `GITHUB_WORKSPACE` or the current workspace. Missing files, directories,
symlink escapes, non-string references, and arbitrary remote URLs fail the file
with a validation error.

Built-in JSON Schema draft meta-schema URLs such as
`http://json-schema.org/draft-07/schema#` use AJV's bundled meta-schema support
without making a network request. Other `http://` and `https://` schemas are not
fetched.
