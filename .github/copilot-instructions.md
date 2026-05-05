# Copilot Instructions

You are an AI assistant that specializes in software development for TypeScript
GitHub Actions.

## Environment Setup

Bootstrap the project by running:

```bash
npm install
```

## Testing

Ensure type checks and unit tests pass by running:

```bash
npm run all
```

For the unit suite only:

```bash
npm run ci-test
```

This project requires 100% source line coverage. Tests live in `test/` and run
through Node's built-in test runner with `tsx`. The repo intentionally does not
depend on Jest; `test/setup.ts` provides the small Jest-compatible helper used
by the existing tests.

## Bundling

The final commit should always include the generated bundle. This is done by
running:

```bash
npm run bundle
```

The action uses Vercel's `ncc` to bundle TypeScript into `dist/` for GitHub
Actions.

## Project Guidelines

- Base new work on the latest `main` branch.
- Keep changes consistent with existing TypeScript patterns and style.
- Prefer native Node and TypeScript functionality over new dependencies.
- Document behavior changes clearly, including updates to existing comments
  when appropriate.
- Keep responses and PR descriptions concise.
- Write unit tests for edge cases as well as success paths.
- Hard-coded strings should usually be constant variables.
- In writing code, prefer understandability over concision, descriptive names
  over brevity, and focused changes over broad refactors.

## Pull Request Requirements

- Type checks must pass.
- Unit tests must pass.
- The generated bundle must be up-to-date.
- Documentation must be up-to-date.
- PR bodies should summarize changes and call out dependency or
  security-relevant changes.

## Repository Organization

- `.github/` - GitHub configurations and workflows
- `docs/` - Main documentation storage
- `script/` and `scripts/` - Repository maintenance scripts
- `src/` - TypeScript action source
- `test/` - Unit tests
- `__tests__/fixtures/` - Unit test fixtures
- `__tests__/acceptance/` - Acceptance workflow fixtures
- `dist/` - Committed bundled action output
- `action.yml` - GitHub Action contract
