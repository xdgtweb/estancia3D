import { describe, it, expect } from 'vitest'
import type {
  RoomDimensions,
  AnchorPoint,
  MeasurementLine,
  SerializedMeasurementLine,
  SessionData,
  SnapPoint,
  ExportRecord,
  DimensionValidationResult,
} from './types'

// Smoke tests — verifican que los tipos se pueden instanciar correctamente
describe('types', () => {
  it('RoomDimensions tiene las propiedades correctas', () => {
    const dims: RoomDimensions = { width: 5, height: 3, depth: 2.5 }
    expect(dims.width).toBe(5)
    expect(dims.height).toBe(3)
    expect(dims.depth).toBe(2.5)
  })

  it('SerializedMeasurementLine tiene las propiedades correctas', () => {
    const line: SerializedMeasurementLine = {
      id: 'm_1',
      ax: 0, ay: 0, az: 0,
      bx: 5, by: 0, bz: 0,
      distance: 5.00,
    }
    expect(line.id).toBe('m_1')
    expect(line.distance).toBe(5)
  })

  it('SessionData contiene roomDimensions y measurements', () => {
    const session: SessionData = {
      roomDimensions: { width: 5, height: 3, depth: 2.5 },
      measurements: [],
    }
    expect(session.roomDimensions.width).toBe(5)
    expect(session.measurements).toHaveLength(0)
  })

  it('SnapPoint tiene position y type', () => {
    // Solo verificamos la forma del tipo en tiempo de compilación
    const snapType: SnapPoint['type'] = 'corner'
    expect(['corner', 'edge-center', 'face-center']).toContain(snapType)
  })

  it('ExportRecord tiene todas las coordenadas', () => {
    const record: ExportRecord = {
      id: 'e_1',
      x1: 0, y1: 0, z1: 0,
      x2: 1, y2: 2, z2: 3,
      distance: 3.74,
    }
    expect(record.distance).toBe(3.74)
  })

  it('DimensionValidationResult puede ser valid:true', () => {
    const result: DimensionValidationResult = { valid: true }
    expect(result.valid).toBe(true)
  })

  it('DimensionValidationResult puede ser valid:false con error non-positive', () => {
    const result: DimensionValidationResult = { valid: false, error: 'non-positive' }
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBe('non-positive')
    }
  })

  it('DimensionValidationResult puede ser valid:false con error out-of-range', () => {
    const result: DimensionValidationResult = { valid: false, error: 'out-of-range' }
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toBe('out-of-range')
    }
  })
})
