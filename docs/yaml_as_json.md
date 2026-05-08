# YAML as JSON

By setting the the `yaml_as_json` input option to `"true"`, you can treat YAML files as JSON so that they can be validated with the same schema as JSON files. This is useful when you need full JSON Schema behavior instead of the action's smaller legacy YAML schema dialect. This means any matching YAML files will be validated with the configured `json_schema` rather than the `yaml_schema`.

When `use_inline_schema` is also `"true"`, YAML files may use a leading
`# yaml-language-server: $schema=...` comment to select a local JSON Schema for
that file. Inline YAML schemas are still JSON Schema and are not interpreted as
the legacy `yaml_schema` dialect.

Here is an example of how to use this feature:

```yaml
- name: json-yaml-validate
  id: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@v4
  with:
    yaml_as_json: "true" # enable yaml as json mode
```
