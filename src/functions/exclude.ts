import {readFileSync} from 'node:fs'
import ignore, {type Ignore} from 'ignore'
import {core} from '../actions-core.js'

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export class Exclude {
  private readonly gitTrackedOnly: boolean
  private readonly ignore: Ignore
  private readonly path: string
  private readonly required: boolean

  constructor() {
    this.path = core.getInput('exclude_file')
    this.required = core.getBooleanInput('exclude_file_required')
    this.gitTrackedOnly = core.getBooleanInput('use_gitignore')
    this.ignore = ignore()

    if (this.path && this.path !== '') {
      core.debug(`loading exclude_file: ${this.path}`)
      try {
        this.ignore.add(readFileSync(this.path, 'utf8').toString())
        core.debug(`loaded custom exclude patterns`)
      } catch (error) {
        if (this.required === true) {
          core.setFailed(`error reading exclude_file: ${this.path}`)
          throw new Error(toError(error).toString(), {cause: error})
        }

        core.info(`exclude_file was not found, but it is not required - OK`)
      }
    } else {
      core.debug(`exclude_file was not provided - OK`)
    }

    if (this.gitTrackedOnly) {
      core.debug(`use_gitignore: ${this.gitTrackedOnly}`)

      const gitIgnorePath = core.getInput('git_ignore_path')
      core.debug(`loading .gitignore file from path: ${gitIgnorePath}`)

      try {
        this.ignore.add(readFileSync(gitIgnorePath).toString())
      } catch (error) {
        core.warning(`error reading .gitignore file: ${error}`)
      }
    }
  }

  isExcluded(file: string): boolean {
    return this.ignore.ignores(file)
  }
}
