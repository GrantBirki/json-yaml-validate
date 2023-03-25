import { run } from '../src/main'

test('successfully runs the action', async () => {
    expect(await run()).toBe(true)
})

