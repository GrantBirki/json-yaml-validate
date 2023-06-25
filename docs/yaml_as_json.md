# YAML as JSON

By setting the the `yaml_as_json` input option to `"true"`, you can treat YAML files as JSON so that they can be validated with the same schema as JSON files. This is useful as the [yaml validator](https://github.com/ketanSaxena/schema-validator) is rather limited in its capabilities. This means any matching YAML files will be validated with the configured `json_schema` rather than the `yaml_schema`.

Here is an example of how to use this feature:

```yaml
- name: json-yaml-validate
  id: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@vX.X.X # replace with the latest version
  with:
    yaml_as_json: "true" # enable yaml as json mode
```
