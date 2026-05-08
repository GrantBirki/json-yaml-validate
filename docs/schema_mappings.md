# Schema Mappings

Use `schema_mappings` when one workflow step needs to validate different file
groups against different schemas.

```yaml
- name: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@v5
  with:
    schema_mappings: |
      - type: json
        schema: ./schemas/index-schema.json
        files:
          - ./data/index_*.json
      - type: json
        schema: ./schemas/topic-schema.json
        files:
          - ./data/topic_*.json
      - type: yaml
        schema: ./schemas/config-schema.yaml
        files:
          - ./config/*.yaml
          - ./config/*.yml
```

Each entry must include:

- `type`: `json` or `yaml`
- `schema`: the schema file for that entry
- `files`: one file pattern or a list of file patterns

JSON entries may also include `json_schema_version`. If omitted, the entry uses
the top-level `json_schema_version` input.

When `schema_mappings` is set, mapped files are authoritative. The action does
not fall back to `base_dir` discovery and does not use top-level `files`,
`json_schema`, or `yaml_schema`. Existing global exclude options, AJV settings,
`yaml_as_json`, and `allow_multiple_documents` still apply where relevant.
When a mapped YAML file contains multiple documents, each document is validated
against that mapping's schema unless `allow_multiple_documents` is explicitly
set to `"false"`.

YAML schema mappings cannot be used with `yaml_as_json: "true"` because YAML
schemas are intentionally ignored in that mode. Use `type: json` mappings when
YAML files should be validated through JSON Schema.
