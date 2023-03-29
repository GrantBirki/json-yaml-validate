import * as core from '@actions/core'
import {readFileSync} from 'fs'

export class Exclude {
  constructor() {
    this.path = core.getInput('exclude_file').trim()

    // read the exclude file if it was used
    if (this.path && this.path !== '') {
      this.exclude = readFileSync(this.path, 'utf8')
      // split the exclude file into an array of strings and trim each string
      this.exclude = this.exclude.split('\n').map(item => item.trim())
    } else {
      this.exclude = []
    }
  }

  isExcluded(file) {
    // use .gitignore style matching
    // https://git-scm.com/docs/gitignore

    if (this.exclude.length === 0) {
      return false
    }

    // loop through each exclude pattern
    for (const pattern of this.exclude) {
      // if the pattern is a comment, skip it
      if (pattern.startsWith('#')) {
        core.debug(`skipping comment: ${pattern}`)
        continue
      }

      // if the pattern is empty, skip it
      if (pattern === '') {
        core.debug(`skipping empty pattern`)
        continue
      }

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
