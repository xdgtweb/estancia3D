import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as fc from 'fast-check'
import { SessionStore } from './SessionStore'
import type { SessionData, SerializedMeasurementLine } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSessionData(
  width = 5,
  height = 3,
  depth = 2.5,
  measurements: SerializedMeasurementLine[] = [],
): SessionData {
  return {
    roomDimensions: { width, height, depth },
    measurements,
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear()
})

// ─── Unit tests ─────────────────────────────────────────────────────────────

describe('SessionStore', () => {
  describe('save / load round-trip', () => {
    it('load() returns the same data that was saved', () => {
      const data = makeSessionData(5, 3, 2.5, [
        { id: 'm1', ax: 0, ay: 0, az: 0, bx: 5, by: 0, bz: 0, distance: 5 },
      ])
      SessionStore.save(data)
      expect(SessionStore.load()).toEqual(data)
    })

    it('load() returns null when nothing has been saved', () => {
      expect(SessionStore.load()).toBeNull()
    })
  })

  describe('clear()', () => {
    it('makes load() return null after a save', () => {
      SessionStore.save(makeSessionData())
      SessionStore.clear()
      expect(SessionStore.load()).toBeNull()
    })
  })

  describe('load() with corrupt data', () => {
    it('returns null when localStorage contains invalid JSON', () => {
      localStorage.setItem('room3d_session', '{ not valid json :::')
      expect(SessionStore.load()).toBeNull()
    })

    it('returns null when roomDimensions is missing', () => {
      localStorage.setItem('room3d_session', JSON.stringify({ measurements: [] }))
      expect(SessionStore.load()).toBeNull()
    })

    it('returns null when roomDimensions has non-numeric fields', () => {
      localStorage.setItem(
        'room3d_session',
        JSON.stringify({
          roomDimensions: { width: '5', height: 3, depth: 2.5 },
          measurements: [],
        }),
      )
      expect(SessionStore.load()).toBeNull()
    })

    it('returns null when measurements is not an array', () => {
      localStorage.setItem(
        'room3d_session',
        JSON.stringify({
          roomDimensions: { width: 5, height: 3, depth: 2.5 },
          measurements: 'not-an-array',
        }),
      )
      expect(SessionStore.load()).toBeNull()
    })

    it('returns null when stored value is a primitive', () => {
      localStorage.setItem('room3d_session', JSON.stringify(42))
      expect(SessionStore.load()).toBeNull()
    })
  })

  describe('save() error handling', () => {
    it('emits session:save-failed event when localStorage.setItem throws', () => {
      const spy = vi.fn()
      window.addEventListener('session:save-failed', spy)

      vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new DOMException('QuotaExceededError')
      })

      SessionStore.save(makeSessionData())

      expect(spy).toHaveBeenCalledOnce()
      window.removeEventListener('session:save-failed', spy)
    })
  })
})

// ─── Property-based test (Property 10) ──────────────────────────────────────

/**
 * Property 10: Round-trip de persistencia en localStorage
 * Validates: Requirements 6.1, 6.2
 */
describe('Property 10: Round-trip de persistencia en localStorage', () => {
  // Only finite, non-negative-zero floats: JSON.stringify converts -0 to "0"
  // and Infinity/-Infinity/NaN to null, breaking the round-trip.
  // We use fc.double with constraints that exclude those edge cases.
  const safeFloat = fc.double({
    noNaN: true,
    noDefaultInfinity: true,
    next: true,
  }).filter((v) => !Object.is(v, -0))

  const serializedLineArbitrary = fc.record<SerializedMeasurementLine>({
    id: fc.string({ minLength: 1 }),
    ax: safeFloat,
    ay: safeFloat,
    az: safeFloat,
    bx: safeFloat,
    by: safeFloat,
    bz: safeFloat,
    distance: fc.double({ min: 0, noNaN: true, noDefaultInfinity: true, next: true }).filter((v) => !Object.is(v, -0)),
  })

  const sessionDataArbitrary = fc.record<SessionData>({
    roomDimensions: fc.record({
      width: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
      height: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
      depth: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
    }),
    measurements: fc.array(serializedLineArbitrary),
  })

  it('save(data) followed by load() returns the same values', () => {
    fc.assert(
      fc.property(sessionDataArbitrary, (data) => {
        localStorage.clear()
        SessionStore.save(data)
        const loaded = SessionStore.load()
        expect(loaded).toEqual(data)
      }),
      { numRuns: 100 },
    )
  })
})
