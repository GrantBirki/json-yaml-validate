import * as core from '@actions/core'
import {readFileSync} from 'fs'

export class Exclude {
  constructor() {
    this.path = core.getInput('exclude_file').trim()
    this.gitTrackedOnly =
      core.getInput('git_tracked_files_only').trim() === 'true'

    // initialize the exclude array
    this.exclude = []

    // read the exclude file if it was used
    if (this.path && this.path !== '') {
      this.exclude = readFileSync(this.path, 'utf8')
      // split the exclude file into an array of strings and trim each string
      this.exclude = this.exclude.split('\n').map(item => item.trim())
      // remove any empty strings
      this.exclude = this.exclude.filter(item => item !== '')
      // remove any comments
      this.exclude = this.exclude.filter(item => !item.startsWith('#'))
    }

    // if gitTrackOnly is true, add the git exclude patterns from the .gitignore file if it exists
    if (this.gitTrackedOnly) {
      const gitIgnorePath = core.getInput('git_ignore_path').trim()
      var gitIgnoreExclude = []
      try {
        const gitIgnore = readFileSync(gitIgnorePath, 'utf8')
        // split the git ignore file into an array of strings and trim each string
        const gitIgnorePatterns = gitIgnore.split('\n').map(item => item.trim())
        // remove any empty strings
        gitIgnoreExclude = gitIgnorePatterns.filter(item => item !== '')
        // remove any comments
        gitIgnoreExclude = gitIgnoreExclude.filter(
          item => !item.startsWith('#')
        )

        // add the git ignore patterns to the exclude patterns
        this.exclude = this.exclude.concat(gitIgnoreExclude)
      } catch (error) {
        core.warning(`error reading .gitignore file: ${error}`)
      }
    }
  }

  isExcluded(file) {
    // use .gitignore style matching
    // https://git-scm.com/docs/gitignore

    if (this.exclude.length === 0) {
      return false
    }

    // remove the leading ./ if it exists
    if (file.startsWith('./')) {
      file = file.replace('./', '')
    }

    // loop through each exclude pattern
    for (const pattern of this.exclude) {
      // if the file exactly matches the pattern, return true
      if (file === pattern) {
        core.debug(`file exactly matches exclude pattern: ${pattern}`)
        return true
      }

      // if the pattern is a negation, check if the file matches the negation
      if (pattern.startsWith('!')) {
        const regex = new RegExp(pattern.replace(/^!/, ''))
        if (file.match(regex)) {
          core.debug(`file matches exclude negation pattern: ${pattern}`)
          return false
        }
      }

      // if the pattern is a directory, check if the file is in that directory
      if (pattern.endsWith('/')) {
        if (file.startsWith(pattern)) {
          core.debug(`file is in exclude directory: ${pattern}`)
          return true
        }
      }

      // if the pattern is a glob, check if the file matches the glob
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'))
        if (file.match(regex)) {
          core.debug(`file matches exclude glob pattern: ${pattern}`)
          return true
        }
      }

      // if the pattern is a regex, check if the file matches the regex
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        const regex = new RegExp(pattern.replace(/\//g, ''))
        if (file.match(regex)) {
          core.debug(`file matches exclude regex pattern: ${pattern}`)
          return true
        }
      }
    }

    // if the file did not match any exclude patterns, return false
    core.debug(`file '${file}' did not match any exclude patterns`)
    return false
  }
}
