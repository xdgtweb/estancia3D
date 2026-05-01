import type { DimensionValidationResult } from '../types'

/**
 * Valida una dimensión individual expresada en metros.
 *
 * - Devuelve `{ valid: false, error: 'non-positive' }` para valores ≤ 0 o NaN
 * - Devuelve `{ valid: false, error: 'out-of-range' }` para valores > 100
 * - Devuelve `{ valid: true }` para valores en el rango (0, 100]
 */
export function validateDimension(value: number): DimensionValidationResult {
  if (isNaN(value) || value <= 0) {
    return { valid: false, error: 'non-positive' }
  }
  if (value > 100) {
    return { valid: false, error: 'out-of-range' }
  }
  return { valid: true }
}
