import {strict as assert} from 'node:assert'
import {createRequire} from 'node:module'
import {isDeepStrictEqual} from 'node:util'
import {
  afterEach as nodeAfterEach,
  beforeEach as nodeBeforeEach,
  test as nodeTest
} from 'node:test'

interface MockState {
  calls: unknown[][]
  implementation?: (...args: unknown[]) => unknown
  once: ((...args: unknown[]) => unknown)[]
  original?: unknown
  owner?: Record<string, unknown>
  property?: string
}

interface MockFunction {
  (...args: unknown[]): unknown
  mock: MockState
  mockClear(): MockFunction
  mockImplementation(implementation: (...args: unknown[]) => unknown): MockFunction
  mockImplementationOnce(
    implementation: (...args: unknown[]) => unknown
  ): MockFunction
  mockResolvedValue(value: unknown): MockFunction
  mockResolvedValueOnce(value: unknown): MockFunction
  mockRestore(): void
  mockReturnValue(value: unknown): MockFunction
  mockReturnValueOnce(value: unknown): MockFunction
}

interface AsymmetricMatcher {
  asymmetricMatch(actual: unknown): boolean
}

const mocks = new Set<MockFunction>()
let expectedAssertions: number | undefined
let actualAssertions = 0

function countAssertion(): void {
  actualAssertions++
}

function isAsymmetricMatcher(value: unknown): value is AsymmetricMatcher {
  return (
    typeof value === 'object' &&
    value !== null &&
    'asymmetricMatch' in value &&
    typeof (value as AsymmetricMatcher).asymmetricMatch === 'function'
  )
}

function matches(actual: unknown, expected: unknown): boolean {
  if (isAsymmetricMatcher(expected)) {
    return expected.asymmetricMatch(actual)
  }

  return isDeepStrictEqual(actual, expected)
}

function isMockFunction(value: unknown): value is MockFunction {
  return (
    typeof value === 'function' &&
    'mock' in value &&
    typeof (value as MockFunction).mockClear === 'function'
  )
}

function createMockFunction(
  implementation?: (...args: unknown[]) => unknown
): MockFunction {
  const state: MockState = {
    calls: [],
    implementation,
    once: []
  }

  const mockFunction = function (this: unknown, ...args: unknown[]) {
    state.calls.push(args)
    const nextImplementation = state.once.shift() ?? state.implementation
    if (nextImplementation) {
      return nextImplementation.apply(this, args)
    }

    return undefined
  } as MockFunction

  mockFunction.mock = state
  mockFunction.mockClear = () => {
    state.calls = []
    return mockFunction
  }
  mockFunction.mockImplementation = nextImplementation => {
    state.implementation = nextImplementation
    return mockFunction
  }
  mockFunction.mockImplementationOnce = nextImplementation => {
    state.once.push(nextImplementation)
    return mockFunction
  }
  mockFunction.mockResolvedValue = value => {
    state.implementation = () => Promise.resolve(value)
    return mockFunction
  }
  mockFunction.mockResolvedValueOnce = value => {
    state.once.push(() => Promise.resolve(value))
    return mockFunction
  }
  mockFunction.mockReturnValue = value => {
    state.implementation = () => value
    return mockFunction
  }
  mockFunction.mockReturnValueOnce = value => {
    state.once.push(() => value)
    return mockFunction
  }
  mockFunction.mockRestore = () => {
    if (state.owner && state.property) {
      state.owner[state.property] = state.original
    }
    mocks.delete(mockFunction)
  }

  mocks.add(mockFunction)
  return mockFunction
}

function expectValue(received: unknown, negate = false) {
  function check(pass: boolean, message: string): void {
    countAssertion()
    assert.equal(negate ? !pass : pass, true, message)
  }

  const matchers = {
    get not() {
      return expectValue(received, !negate)
    },

    get rejects() {
      return {
        async toThrow(expected?: string | RegExp) {
          countAssertion()
          let thrown: unknown

          try {
            await received
          } catch (error) {
            thrown = error
          }

          const didThrow = thrown !== undefined
          if (!didThrow) {
            assert.equal(
              negate ? !didThrow : didThrow,
              true,
              'Expected promise to reject'
            )
            return
          }

          if (expected === undefined) {
            assert.equal(negate ? !didThrow : didThrow, true)
            return
          }

          const message =
            thrown instanceof Error ? thrown.message : String(thrown)
          const matched =
            typeof expected === 'string'
              ? message.includes(expected)
              : expected.test(message)
          assert.equal(negate ? !matched : matched, true)
        }
      }
    },

    toBe(expected: unknown) {
      check(
        Object.is(received, expected),
        `Expected ${String(received)} to be ${String(expected)}`
      )
    },

    toBeDefined() {
      check(received !== undefined, 'Expected value to be defined')
    },

    toBeGreaterThan(expected: number) {
      check(
        typeof received === 'number' && received > expected,
        `Expected ${String(received)} to be greater than ${expected}`
      )
    },

    toContain(expected: unknown) {
      const pass =
        typeof received === 'string'
          ? received.includes(String(expected))
          : Array.isArray(received) && received.includes(expected)
      check(pass, `Expected ${String(received)} to contain ${String(expected)}`)
    },

    toEqual(expected: unknown) {
      check(matches(received, expected), 'Expected values to be equal')
    },

    toHaveBeenCalled() {
      assert.ok(isMockFunction(received), 'Expected a mock function')
      check(received.mock.calls.length > 0, 'Expected mock to have been called')
    },

    toHaveBeenCalledWith(...expectedArgs: unknown[]) {
      assert.ok(isMockFunction(received), 'Expected a mock function')
      const pass = received.mock.calls.some(call => {
        if (call.length !== expectedArgs.length) {
          return false
        }

        return expectedArgs.every((expectedArg, index) =>
          matches(call[index], expectedArg)
        )
      })

      check(
        pass,
        `Expected mock to have been called with ${JSON.stringify(expectedArgs)}`
      )
    },

    toStrictEqual(expected: unknown) {
      check(
        isDeepStrictEqual(received, expected),
        'Expected values to be strictly equal'
      )
    },

    toThrow(expected?: string | RegExp) {
      assert.equal(typeof received, 'function', true, 'Expected a function')
      countAssertion()
      let thrown: unknown

      try {
        ;(received as () => unknown)()
      } catch (error) {
        thrown = error
      }

      const didThrow = thrown !== undefined
      if (!didThrow || expected === undefined) {
        assert.equal(negate ? !didThrow : didThrow, true)
        return
      }

      const message = thrown instanceof Error ? thrown.message : String(thrown)
      const matched =
        typeof expected === 'string'
          ? message.includes(expected)
          : expected.test(message)
      assert.equal(negate ? !matched : matched, true)
    }
  }

  return matchers
}

expectValue.assertions = (count: number) => {
  expectedAssertions = count
}

expectValue.objectContaining = (
  expected: Record<string, unknown>
): AsymmetricMatcher => ({
  asymmetricMatch(actual: unknown): boolean {
    if (typeof actual !== 'object' || actual === null) {
      return false
    }

    return Object.entries(expected).every(([key, value]) =>
      matches((actual as Record<string, unknown>)[key], value)
    )
  }
})

expectValue.stringMatching = (expected: string | RegExp): AsymmetricMatcher => {
  const regex = typeof expected === 'string' ? new RegExp(expected) : expected
  return {
    asymmetricMatch(actual: unknown): boolean {
      return typeof actual === 'string' && regex.test(actual)
    }
  }
}

expectValue.stringContaining = (expected: string): AsymmetricMatcher => ({
  asymmetricMatch(actual: unknown): boolean {
    return typeof actual === 'string' && actual.includes(expected)
  }
})

function wrappedTest(
  name: string,
  callback: Parameters<typeof nodeTest>[1]
): ReturnType<typeof nodeTest> {
  return nodeTest(name, async t => {
    expectedAssertions = undefined
    actualAssertions = 0
    await callback(t)

    if (expectedAssertions !== undefined) {
      assert.equal(
        actualAssertions,
        expectedAssertions,
        `Expected ${expectedAssertions} assertion(s), but ran ${actualAssertions}`
      )
    }
  })
}

globalThis.test = wrappedTest as typeof nodeTest
globalThis.beforeEach = nodeBeforeEach
globalThis.afterEach = nodeAfterEach
globalThis.expect = expectValue
globalThis.require = createRequire(import.meta.url)
globalThis.jest = {
  clearAllMocks() {
    for (const mock of mocks) {
      mock.mockClear()
    }
  },

  fn: createMockFunction,

  spyOn(owner: Record<string, unknown>, property: string) {
    const current = owner[property]

    if (isMockFunction(current)) {
      return current
    }

    const mock = createMockFunction(
      typeof current === 'function'
        ? (...args: unknown[]) => current.apply(owner, args)
        : undefined
    )
    mock.mock.original = current
    mock.mock.owner = owner
    mock.mock.property = property
    owner[property] = mock
    return mock
  }
}
