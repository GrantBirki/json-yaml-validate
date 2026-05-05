import type {afterEach, beforeEach, test} from 'node:test'

declare global {
  var afterEach: typeof afterEach
  var beforeEach: typeof beforeEach
  var expect: any
  var jest: any
  var test: typeof test
}

export {}
