import * as core from '@actions/core'
import {readFileSync} from 'fs'
import ignore from 'ignore'

export class Exclude {
  constructor() {
    this.path = core.getInput('exclude_file')
    this.gitTrackedOnly = core.getBooleanInput('use_gitignore')

    // initialize the exclude array
    this.ignore = ignore()

    // read the exclude file if it was used
    if (this.path && this.path !== '') {
      core.debug(`loading exclude_file: ${this.path}`)
      this.ignore.add(readFileSync(this.path, 'utf8').toString())
      core.debug(`loaded custom exclude patterns`)
    }

    // if gitTrackOnly is true, add the git exclude patterns from the .gitignore file if it exists
    if (this.gitTrackedOnly) {
      core.debug(
        `use_gitignore: ${this.gitTrackedOnly}`
      )

      const gitIgnorePath = core.getInput('git_ignore_path')
      core.debug(`loading .gitignore file from path: ${gitIgnorePath}`)

      try {
        this.ignore.add(readFileSync(gitIgnorePath).toString())
      } catch (error) {
        core.warning(`error reading .gitignore file: ${error}`)
      }
    }
  }

  isExcluded(file) {
    // use .gitignore style matching
    // https://git-scm.com/docs/gitignore
    // https://github.com/kaelzhang/node-ignore
    return this.ignore.ignores(file)
  }
}
