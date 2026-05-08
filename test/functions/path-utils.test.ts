import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {
  isSameFile,
  normalizePath,
  resolveValidationFile,
  resolveWorkspaceDirectory,
  safeLogPath
} from '../../src/functions/path-utils.js'

let originalWorkspace: string | undefined
let tempDir: string

beforeEach(() => {
  originalWorkspace = process.env.GITHUB_WORKSPACE
  tempDir = mkdtempSync(join(tmpdir(), 'path-utils-'))
})

afterEach(() => {
  if (originalWorkspace === undefined) {
    delete process.env.GITHUB_WORKSPACE
  } else {
    process.env.GITHUB_WORKSPACE = originalWorkspace
  }
  rmSync(tempDir, {recursive: true, force: true})
})

test('normalizes paths and escapes unsafe raw log path values', () => {
  expect(normalizePath('one/two')).toBe('one/two')
  expect(safeLogPath('::warning::fake.json')).toBe('./::warning::fake.json')
  expect(safeLogPath('line\nbreak.json')).toBe('line\\nbreak.json')
  expect(safeLogPath('carriage\rbreak.json')).toBe('carriage\\rbreak.json')
})

test('resolves validation files to workspace-relative display paths', () => {
  const filePath = '__tests__/fixtures/json/valid/json1.json'
  const resolved = resolveValidationFile(filePath)

  expect(resolved).toStrictEqual({
    ok: true,
    value: {
      displayPath: filePath,
      fullPath: resolve(filePath),
      relativePath: filePath
    }
  })
  expect(isSameFile(filePath, resolve(filePath))).toBe(true)
  expect(isSameFile(filePath, 'does-not-exist.json')).toBe(false)
})

test('rejects missing, non-file, and workspace-escaping validation paths', () => {
  const workspace = join(tempDir, 'workspace')
  const outside = join(tempDir, 'outside')
  mkdirSync(workspace)
  mkdirSync(outside)
  mkdirSync(join(workspace, 'dir.json'))
  writeFileSync(join(outside, 'secret.json'), '{}')

  process.env.GITHUB_WORKSPACE = workspace

  expect(resolveValidationFile(join(workspace, 'missing.json'))).toStrictEqual({
    displayPath: 'missing.json',
    message: 'validation path does not exist: missing.json',
    ok: false
  })
  expect(resolveValidationFile(join(workspace, 'dir.json'))).toStrictEqual({
    displayPath: 'dir.json',
    message: 'validation path must be a regular file: dir.json',
    ok: false
  })
  expect(resolveValidationFile(join(outside, 'secret.json'))).toStrictEqual({
    displayPath: normalizePath(join(outside, 'secret.json')),
    message: `validation path must be inside the workspace: ${normalizePath(
      join(outside, 'secret.json')
    )}`,
    ok: false
  })
})

test('rejects symlinks that resolve outside the workspace', () => {
  const workspace = join(tempDir, 'workspace')
  const outside = join(tempDir, 'outside')
  mkdirSync(workspace)
  mkdirSync(outside)
  writeFileSync(join(outside, 'secret.json'), '{}')
  symlinkSync(join(outside, 'secret.json'), join(workspace, 'link.json'))

  process.env.GITHUB_WORKSPACE = workspace

  expect(resolveValidationFile(join(workspace, 'link.json'))).toStrictEqual({
    displayPath: 'link.json',
    message: 'validation path must be inside the workspace: link.json',
    ok: false
  })
})

test('resolves workspace directories and rejects files as base directories', () => {
  const workspace = join(tempDir, 'workspace')
  mkdirSync(workspace)
  writeFileSync(join(workspace, 'file.json'), '{}')
  process.env.GITHUB_WORKSPACE = workspace

  expect(resolveWorkspaceDirectory(workspace)).toStrictEqual({
    ok: true,
    value: realpathSync(workspace)
  })
  expect(resolveWorkspaceDirectory(join(workspace, 'file.json'))).toStrictEqual({
    displayPath: 'file.json',
    message: 'base_dir must be a directory: file.json',
    ok: false
  })
  expect(resolveWorkspaceDirectory(join(tempDir, 'outside'))).toStrictEqual({
    displayPath: normalizePath(join(tempDir, 'outside')),
    message: `validation path does not exist: ${normalizePath(
      join(tempDir, 'outside')
    )}`,
    ok: false
  })
})
