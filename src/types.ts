import type * as THREE from 'three'
import type { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

// ─── Room dimensions ────────────────────────────────────────────────────────

/** Dimensiones de la habitación expresadas en metros. Rango válido: (0, 100]. */
export interface RoomDimensions {
  width: number
  height: number
  depth: number
}

// ─── Anchor & measurement ────────────────────────────────────────────────────

/** Punto de anclaje colocado por el usuario sobre una superficie 3D. */
export interface AnchorPoint {
  id: string
  position: THREE.Vector3
  mesh: THREE.Mesh
}

/** Línea de medición entre dos AnchorPoints con su etiqueta visual. */
export interface MeasurementLine {
  id: string
  anchorA: AnchorPoint
  anchorB: AnchorPoint
  /** Distancia euclidiana en metros, redondeada a 2 decimales. */
  distance: number
  lineMesh: THREE.Line
  label: CSS2DObject
}

// ─── Serialization ───────────────────────────────────────────────────────────

/** Representación serializable de una MeasurementLine para persistencia. */
export interface SerializedMeasurementLine {
  id: string
  ax: number
  ay: number
  az: number
  bx: number
  by: number
  bz: number
  distance: number
}

/** Datos completos de una sesión guardada en localStorage. */
export interface SessionData {
  roomDimensions: RoomDimensions
  measurements: SerializedMeasurementLine[]
}

// ─── Snap points ─────────────────────────────────────────────────────────────

/** Punto de ajuste automático (snap) calculado a partir de la geometría de la habitación. */
export interface SnapPoint {
  position: THREE.Vector3
  type: 'corner' | 'edge-center' | 'face-center'
}

// ─── Export ──────────────────────────────────────────────────────────────────

/** Fila de datos para exportación (JSON / CSV). */
export interface ExportRecord {
  id: string
  x1: number
  y1: number
  z1: number
  x2: number
  y2: number
  z2: number
  distance: number
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Resultado de validar una dimensión individual.
 * - `{ valid: true }` → valor en el rango (0, 100]
 * - `{ valid: false, error: 'non-positive' }` → valor ≤ 0 o NaN
 * - `{ valid: false, error: 'out-of-range' }` → valor > 100
 */
export type DimensionValidationResult =
  | { valid: true }
  | { valid: false; error: 'non-positive' | 'out-of-range' }
