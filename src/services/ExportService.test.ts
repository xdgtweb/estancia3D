import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import { ExportService } from './ExportService'
import type { MeasurementLine, RoomDimensions } from '../types'

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Crea un MeasurementLine mock con objetos { x, y, z } en lugar de THREE.Vector3.
 * ExportService sólo accede a .position.x / .y / .z, por lo que el mock es suficiente.
 */
function makeLine(
  id: string,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  distance: number,
): MeasurementLine {
  return {
    id,
    anchorA: {
      id: `${id}_a`,
      position: { x: ax, y: ay, z: az } as any,
      mesh: {} as any,
    },
    anchorB: {
      id: `${id}_b`,
      position: { x: bx, y: by, z: bz } as any,
      mesh: {} as any,
    },
    distance,
    lineMesh: {} as any,
    label: {} as any,
  }
}

const defaultDims: RoomDimensions = { width: 5, height: 3, depth: 2.5 }

// ─── Arbitrarios fast-check ──────────────────────────────────────────────────

/** Floats seguros para JSON round-trip (sin NaN, Infinity ni -0). */
const safeFloat = fc.double({
  noNaN: true,
  noDefaultInfinity: true,
  next: true,
}).filter((v) => !Object.is(v, -0))

const safePositiveFloat = fc.double({
  min: 0,
  noNaN: true,
  noDefaultInfinity: true,
  next: true,
}).filter((v) => !Object.is(v, -0))

/**
 * Genera un MeasurementLine arbitrario.
 * Los IDs se restringen a caracteres alfanuméricos y guiones bajos
 * (igual que los IDs reales: m_1, m_2, …) para que no contengan comas
 * y el CSV sea parseable sin necesidad de quoting.
 */
const measurementLineArbitrary = fc.record({
  id: fc.stringMatching(/^[a-zA-Z0-9_]{1,20}$/),
  ax: safeFloat, ay: safeFloat, az: safeFloat,
  bx: safeFloat, by: safeFloat, bz: safeFloat,
  distance: safePositiveFloat,
}).map(({ id, ax, ay, az, bx, by, bz, distance }) =>
  makeLine(id, ax, ay, az, bx, by, bz, distance),
)

/** Genera RoomDimensions arbitrarias válidas. */
const roomDimsArbitrary = fc.record<RoomDimensions>({
  width: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
  height: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
  depth: fc.float({ min: Math.fround(0.01), max: Math.fround(100), noNaN: true }),
})

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('ExportService', () => {
  describe('toJSON()', () => {
    it('genera JSON parseable con las coordenadas y distancia correctas', () => {
      const line = makeLine('m_1', 0, 0, 0, 5, 0, 0, 5)
      const json = ExportService.toJSON([line], defaultDims)
      const parsed = JSON.parse(json)

      expect(parsed.measurements).toHaveLength(1)
      const m = parsed.measurements[0]
      expect(m.id).toBe('m_1')
      expect(m.pointA).toEqual({ x: 0, y: 0, z: 0 })
      expect(m.pointB).toEqual({ x: 5, y: 0, z: 0 })
      expect(m.distance).toBe(5)
    })

    it('incluye exportedAt como ISO timestamp válido', () => {
      const line = makeLine('m_1', 0, 0, 0, 1, 0, 0, 1)
      const json = ExportService.toJSON([line], defaultDims)
      const parsed = JSON.parse(json)
      expect(() => new Date(parsed.exportedAt)).not.toThrow()
      expect(new Date(parsed.exportedAt).toISOString()).toBe(parsed.exportedAt)
    })

    it('incluye roomDimensions en el JSON', () => {
      const line = makeLine('m_1', 0, 0, 0, 1, 0, 0, 1)
      const json = ExportService.toJSON([line], defaultDims)
      const parsed = JSON.parse(json)
      expect(parsed.roomDimensions).toEqual(defaultDims)
    })
  })

  describe('toCSV()', () => {
    it('genera N+1 líneas para N mediciones', () => {
      const lines = [
        makeLine('m_1', 0, 0, 0, 5, 0, 0, 5),
        makeLine('m_2', 0, 0, 0, 0, 2.5, 0, 2.5),
      ]
      const csv = ExportService.toCSV(lines)
      const rows = csv.split('\n')
      expect(rows).toHaveLength(3) // 1 cabecera + 2 filas
    })

    it('la primera línea es la cabecera correcta', () => {
      const line = makeLine('m_1', 0, 0, 0, 5, 0, 0, 5)
      const csv = ExportService.toCSV([line])
      const [header] = csv.split('\n')
      expect(header).toBe('id,x1,y1,z1,x2,y2,z2,distance_m')
    })

    it('cada fila contiene id, seis coordenadas y distancia', () => {
      const line = makeLine('m_1', 1, 2, 3, 4, 5, 6, 7.07)
      const csv = ExportService.toCSV([line])
      const [, row] = csv.split('\n')
      expect(row).toBe('m_1,1,2,3,4,5,6,7.07')
    })
  })

  describe('Exportación con lista vacía (Req. 5.3)', () => {
    it('toJSON([]) devuelve cadena vacía', () => {
      expect(ExportService.toJSON([], defaultDims)).toBe('')
    })

    it('toCSV([]) devuelve cadena vacía', () => {
      expect(ExportService.toCSV([])).toBe('')
    })
  })

  describe('download()', () => {
    let createObjectURLSpy: ReturnType<typeof vi.fn>
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>
    let appendChildSpy: ReturnType<typeof vi.fn>
    let removeChildSpy: ReturnType<typeof vi.fn>
    let clickSpy: ReturnType<typeof vi.fn>

    beforeEach(() => {
      createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url')
      revokeObjectURLSpy = vi.fn()
      clickSpy = vi.fn()

      Object.defineProperty(URL, 'createObjectURL', { value: createObjectURLSpy, writable: true })
      Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURLSpy, writable: true })

      appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
        // Simular el click automáticamente
        if (node instanceof HTMLAnchorElement) {
          clickSpy()
        }
        return node
      })
      removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node)
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('crea un Blob y dispara la descarga', () => {
      ExportService.download('contenido', 'test.json', 'application/json')

      expect(createObjectURLSpy).toHaveBeenCalledOnce()
      expect(appendChildSpy).toHaveBeenCalledOnce()
      expect(clickSpy).toHaveBeenCalledOnce()
      expect(removeChildSpy).toHaveBeenCalledOnce()
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
    })
  })
})

// ─── Property-based tests ────────────────────────────────────────────────────

/**
 * Property 8: Round-trip de exportación JSON
 * Validates: Requirements 5.1
 */
describe('Property 8: Round-trip de exportación JSON', () => {
  it('el JSON es parseable y conserva coordenadas y distancias', () => {
    fc.assert(
      fc.property(
        fc.array(measurementLineArbitrary, { minLength: 1 }),
        roomDimsArbitrary,
        (lines, dims) => {
          const json = ExportService.toJSON(lines, dims)

          // Debe ser JSON válido
          const parsed = JSON.parse(json)

          // Debe tener el mismo número de mediciones
          expect(parsed.measurements).toHaveLength(lines.length)

          // Cada medición debe conservar sus valores
          for (let i = 0; i < lines.length; i++) {
            const original = lines[i]
            const exported = parsed.measurements[i]

            expect(exported.id).toBe(original.id)
            expect(exported.pointA.x).toBe(original.anchorA.position.x)
            expect(exported.pointA.y).toBe(original.anchorA.position.y)
            expect(exported.pointA.z).toBe(original.anchorA.position.z)
            expect(exported.pointB.x).toBe(original.anchorB.position.x)
            expect(exported.pointB.y).toBe(original.anchorB.position.y)
            expect(exported.pointB.z).toBe(original.anchorB.position.z)
            expect(exported.distance).toBe(original.distance)
          }

          // roomDimensions debe coincidir
          expect(parsed.roomDimensions.width).toBe(dims.width)
          expect(parsed.roomDimensions.height).toBe(dims.height)
          expect(parsed.roomDimensions.depth).toBe(dims.depth)
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * Property 9: Round-trip de exportación CSV
 * Validates: Requirements 5.2
 */
describe('Property 9: Round-trip de exportación CSV', () => {
  it('el CSV tiene exactamente N+1 líneas para N mediciones', () => {
    fc.assert(
      fc.property(
        fc.array(measurementLineArbitrary, { minLength: 1 }),
        (lines) => {
          const csv = ExportService.toCSV(lines)
          const rows = csv.split('\n')

          // N+1 líneas: 1 cabecera + N filas de datos
          expect(rows).toHaveLength(lines.length + 1)

          // La cabecera es correcta
          expect(rows[0]).toBe('id,x1,y1,z1,x2,y2,z2,distance_m')

          // Cada fila de datos contiene 8 campos separados por coma
          for (let i = 0; i < lines.length; i++) {
            const fields = rows[i + 1].split(',')
            expect(fields).toHaveLength(8)

            const original = lines[i]
            expect(fields[0]).toBe(original.id)
            expect(Number(fields[1])).toBe(original.anchorA.position.x)
            expect(Number(fields[2])).toBe(original.anchorA.position.y)
            expect(Number(fields[3])).toBe(original.anchorA.position.z)
            expect(Number(fields[4])).toBe(original.anchorB.position.x)
            expect(Number(fields[5])).toBe(original.anchorB.position.y)
            expect(Number(fields[6])).toBe(original.anchorB.position.z)
            expect(Number(fields[7])).toBe(original.distance)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})
