# Migrating from v4 to v5

v5 is a major release because it includes a runtime rewrite, dependency
reduction, stronger path safety, and a few behavior changes that can affect
existing workflows. Most users can upgrade by changing the action ref from
`@v4` to `@v5`, but review the checklist below before moving protected CI jobs.

```yaml
- name: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@v5
```

## Recommended Upgrade Checklist

1. Update workflow references from `GrantBirki/json-yaml-validate@v4` to
   `GrantBirki/json-yaml-validate@v5`.
2. If you use self-hosted runners, make sure they support JavaScript actions
   that run on `node24`.
3. If your workflow relied on multi-document YAML files failing by default, set
   `allow_multiple_documents: "false"`.
4. If you pass explicit files, schemas, `base_dir`, or schema mappings, make
   sure they resolve to regular files or directories inside the checked-out
   workspace.
5. If you parse validation comments or logs, update expectations for
   workspace-relative file paths.
6. If you use PR comments, keep `pull-requests: write` only on workflows where
   `comment`, `comment_on_success`, or `update_comment` is enabled.

## Breaking Or Behavior-Affecting Changes

### Runtime is now `node24`

The action now runs as a `node24` JavaScript action. GitHub-hosted runners
should handle this transparently. Self-hosted runner environments may need a
runner update before they can execute the action.

### Multi-document YAML is allowed by default

In v4, `allow_multiple_documents` defaulted to `"false"`. In v5, it defaults to
`"true"` because Kubernetes-style multi-document YAML is common and valid YAML.

To preserve v4 behavior:

```yaml
- name: json-yaml-validate
  uses: GrantBirki/json-yaml-validate@v5
  with:
    allow_multiple_documents: "false"
```

When `yaml_schema` is set and multiple documents are allowed, each YAML document
is validated against the configured schema.

### Validation targets must stay inside the workspace

Files discovered from `base_dir`, `files`, or `schema_mappings` are resolved
through real paths before they are read. v5 fails validation targets that are:

- missing
- directories or other non-file matches
- symlinks that resolve outside the workspace
- paths outside `GITHUB_WORKSPACE` or the current workspace

For `base_dir`, the directory itself must resolve inside the workspace.

This is intentional security hardening. If a v4 workflow validated files outside
the checkout, move those files into the workspace before running the action.

### File paths in results are workspace-relative

Validation violations and informational logs now prefer workspace-relative file
paths. This keeps logs stable and avoids leaking absolute runner paths. The
`success` output is unchanged, but scripts that parse PR comments or raw logs
may need updated path expectations.

### JSON schema file skipping is exact

v4 skipped JSON files whose path contained the configured `json_schema` string.
v5 skips only the exact configured schema file after realpath normalization.

If a workflow relied on the broader substring skip behavior, replace it with an
explicit exclude rule:

```yaml
with:
  json_exclude_regex: '(^|/)schemas/generated/'
```

or use an `exclude_file` with gitignore-style patterns.

### PR comment updates only update bot-authored validation comments

The `update_comment` input updates existing validation comments only when the
matching comment was authored by `github-actions[bot]`. If a user-authored
comment contains the validation marker or heading, v5 leaves it alone and
creates a new bot-authored comment instead.

## New Capabilities In v5

### Space-separated `files` input

`files` still accepts newline-delimited patterns. It also accepts a single-line,
space-separated list, which works well with tools that emit changed files in one
line.

```yaml
with:
  files: "config/app.json config/service.yaml"
```

Commas are intentionally not treated as separators because commas can be valid
inside glob syntax.

### Multiple schema mappings

Use `schema_mappings` when different file groups need different schemas in a
single action step.

```yaml
with:
  schema_mappings: |
    - type: json
      schema: ./schemas/index-schema.json
      files:
        - ./data/index_*.json
    - type: yaml
      schema: ./schemas/config-schema.yaml
      files:
        - ./config/*.yaml
```

When `schema_mappings` is set, mapped files are authoritative. The action does
not fall back to `base_dir`, `files`, `json_schema`, or `yaml_schema` for mapped
validation. See [schema mappings](schema_mappings.md) for details.

### Local-only inline schemas

Set `use_inline_schema: "true"` to use local schema references declared inside
validated files. JSON files can use top-level `$schema`; YAML files can use a
leading yaml-language-server schema comment when `yaml_as_json` is also
enabled.

```yaml
with:
  use_inline_schema: "true"
  yaml_as_json: "true"
```

Inline schemas are local-only. Remote `http://` and `https://` schemas are not
fetched. Built-in JSON Schema draft meta-schema URLs use AJV's bundled support
without network access. See [inline schemas](inline_schema.md) for details.

### Success comments and safer comment updates

v5 adds `comment_on_success` for successful validation comments and
`update_comment` for updating the latest bot-authored validation comment instead
of creating a new one.

```yaml
permissions:
  contents: read
  pull-requests: write

steps:
  - uses: actions/checkout@v6

  - name: json-yaml-validate
    uses: GrantBirki/json-yaml-validate@v5
    with:
      comment: "true"
      update_comment: "true"
```

## Dependency And Tooling Changes

v5 rewrites the action internals from JavaScript to TypeScript and removes a
large set of runtime dependencies. The action now uses native implementations
for action input/log/output handling, PR comments, file discovery, coverage
badge generation, and legacy YAML schema validation.

The public action output remains:

```yaml
success: "true" # or "false"
```

Repository maintainers contributing to this action should use the v5 scripts:

```bash
npm run typecheck
npm run ci-test
npm run all
```

`dist/` remains committed and must be regenerated for source or dependency
changes.

## Troubleshooting

### My multi-document YAML workflow now passes

Set `allow_multiple_documents: "false"` to preserve the v4 default.

### A path that worked in v4 now fails

Check whether the path resolves outside the workspace, points at a directory,
or follows a symlink outside the workspace. v5 intentionally rejects those
targets.

### A schema file is now being validated as data

v5 only skips the exact configured schema file. Add an explicit exclude pattern
for generated schemas or schema directories that should not be validated as
normal data.

### My PR comments are no longer overwritten

`update_comment` only updates validation comments authored by
`github-actions[bot]`. Delete or ignore older user-authored comments; the next
run will create or update the bot-authored validation comment.
