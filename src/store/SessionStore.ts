import type { SessionData } from '../types'

const STORAGE_KEY = 'room3d_session'

/**
 * Abstrae el acceso a localStorage para persistir la sesión.
 * Clave de almacenamiento: `room3d_session`
 */
export const SessionStore = {
  /**
   * Serializa `data` a JSON y lo escribe en localStorage.
   * Si la operación falla (cuota excedida, modo privado, etc.),
   * captura la excepción y emite el evento `session:save-failed` en window.
   */
  save(data: SessionData): void {
    try {
      const json = JSON.stringify(data)
      localStorage.setItem(STORAGE_KEY, json)
    } catch (err) {
      window.dispatchEvent(new CustomEvent('session:save-failed', { detail: err }))
    }
  },

  /**
   * Lee y parsea el JSON almacenado bajo la clave `room3d_session`.
   * Devuelve `null` si:
   * - La clave no existe
   * - El JSON es inválido
   * - Los datos no cumplen el esquema mínimo:
   *   `roomDimensions` con `width`, `height`, `depth` numéricos
   *   y `measurements` como array
   */
  load(): SessionData | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw === null) return null

      const parsed = JSON.parse(raw) as unknown

      if (!isValidSessionData(parsed)) return null

      return parsed
    } catch {
      return null
    }
  },

  /**
   * Elimina la clave `room3d_session` de localStorage.
   */
  clear(): void {
    localStorage.removeItem(STORAGE_KEY)
  },
}

/** Comprueba que el valor cumple el esquema mínimo de SessionData. */
function isValidSessionData(value: unknown): value is SessionData {
  if (typeof value !== 'object' || value === null) return false

  const obj = value as Record<string, unknown>

  // Validar roomDimensions
  const dims = obj['roomDimensions']
  if (typeof dims !== 'object' || dims === null) return false

  const d = dims as Record<string, unknown>
  if (
    typeof d['width'] !== 'number' ||
    typeof d['height'] !== 'number' ||
    typeof d['depth'] !== 'number'
  ) {
    return false
  }

  // Validar measurements como array
  if (!Array.isArray(obj['measurements'])) return false

  return true
}
