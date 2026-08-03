import { describe, expect, it, vi } from 'vitest'
import { listenerRouteChange, removeRouteListener, setRouteEmitter } from './route-listener'

describe('route listener', () => {
  it('broadcasts route changes and immediately replays the latest route', () => {
    const first = vi.fn()
    const route = { path: '/dashboard' } as any
    listenerRouteChange(first, false)
    setRouteEmitter(route)
    expect(first).toHaveBeenCalledWith(route)

    const late = vi.fn()
    listenerRouteChange(late)
    expect(late).toHaveBeenCalledWith(route)
  })

  it('removes all registered listeners', () => {
    const listener = vi.fn()
    listenerRouteChange(listener, false)
    removeRouteListener()
    setRouteEmitter({ path: '/after-clear' } as any)
    expect(listener).not.toHaveBeenCalled()
  })
})
