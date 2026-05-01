import { describe, it, expect } from 'vitest'
import { validateDimension } from './validation'

describe('validateDimension', () => {
  // Valores no positivos → 'non-positive'
  it('devuelve non-positive para 0', () => {
    const result = validateDimension(0)
    expect(result).toEqual({ valid: false, error: 'non-positive' })
  })

  it('devuelve non-positive para valores negativos', () => {
    expect(validateDimension(-1)).toEqual({ valid: false, error: 'non-positive' })
    expect(validateDimension(-100)).toEqual({ valid: false, error: 'non-positive' })
  })

  it('devuelve non-positive para NaN', () => {
    expect(validateDimension(NaN)).toEqual({ valid: false, error: 'non-positive' })
  })

  // Valores fuera de rango → 'out-of-range'
  it('devuelve out-of-range para valores > 100', () => {
    expect(validateDimension(100.01)).toEqual({ valid: false, error: 'out-of-range' })
    expect(validateDimension(200)).toEqual({ valid: false, error: 'out-of-range' })
  })

  // Valores válidos → { valid: true }
  it('devuelve valid: true para el límite inferior (0.001)', () => {
    expect(validateDimension(0.001)).toEqual({ valid: true })
  })

  it('devuelve valid: true para el límite superior (100)', () => {
    expect(validateDimension(100)).toEqual({ valid: true })
  })

  it('devuelve valid: true para valores en el rango (0, 100]', () => {
    expect(validateDimension(1)).toEqual({ valid: true })
    expect(validateDimension(5)).toEqual({ valid: true })
    expect(validateDimension(50)).toEqual({ valid: true })
  })
})
