import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as THREE from 'three'
import { SnapPointCalculator } from './SnapPointCalculator'
import type { RoomDimensions, SnapPoint } from '../types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Crea un mock de THREE.Camera (no necesita matrices reales porque
 * interceptamos Vector3.prototype.project en los tests de findNearest).
 */
function makeFakeCamera(): THREE.Camera {
  return {} as unknown as THREE.Camera
}

/**
 * Crea un mock de THREE.WebGLRenderer con un canvas de las dimensiones dadas.
 */
function makeMockRenderer(width: number, height: number): THREE.WebGLRenderer {
  return {
    domElement: { width, height } as HTMLCanvasElement,
  } as unknown as THREE.WebGLRenderer
}

// ─── Tests de compute() ───────────────────────────────────────────────────────

describe('SnapPointCalculator.compute()', () => {
  const calc = new SnapPointCalculator()

  const validDims: RoomDimensions[] = [
    { width: 5, height: 3, depth: 2.5 },
    { width: 1, height: 1, depth: 1 },
    { width: 10, height: 4, depth: 8 },
    { width: 0.5, height: 0.5, depth: 0.5 },
    { width: 100, height: 100, depth: 100 },
  ]

  it('devuelve exactamente 26 snap points para dimensiones estándar', () => {
    const result = calc.compute({ width: 5, height: 3, depth: 2.5 })
    expect(result).toHaveLength(26)
  })

  it.each(validDims)(
    'devuelve exactamente 26 snap points para dims %o',
    (dims) => {
      const result = calc.compute(dims)
      expect(result).toHaveLength(26)
    },
  )

  it('devuelve exactamente 8 corners', () => {
    const result = calc.compute({ width: 5, height: 3, depth: 2.5 })
    const corners = result.filter((p) => p.type === 'corner')
    expect(corners).toHaveLength(8)
  })

  it('devuelve exactamente 12 edge-centers', () => {
    const result = calc.compute({ width: 5, height: 3, depth: 2.5 })
    const edgeCenters = result.filter((p) => p.type === 'edge-center')
    expect(edgeCenters).toHaveLength(12)
  })

  it('devuelve exactamente 6 face-centers', () => {
    const result = calc.compute({ width: 5, height: 3, depth: 2.5 })
    const faceCenters = result.filter((p) => p.type === 'face-center')
    expect(faceCenters).toHaveLength(6)
  })

  it('las 8 esquinas tienen coordenadas ±W/2, ±H/2, ±D/2', () => {
    const dims = { width: 6, height: 4, depth: 2 }
    const result = calc.compute(dims)
    const corners = result.filter((p) => p.type === 'corner')

    const hw = dims.width / 2
    const hh = dims.height / 2
    const hd = dims.depth / 2

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const expected = new THREE.Vector3(sx * hw, sy * hh, sz * hd)
          const found = corners.find(
            (c) =>
              Math.abs(c.position.x - expected.x) < 1e-9 &&
              Math.abs(c.position.y - expected.y) < 1e-9 &&
              Math.abs(c.position.z - expected.z) < 1e-9,
          )
          expect(
            found,
            `Esquina esperada en (${expected.x}, ${expected.y}, ${expected.z})`,
          ).toBeDefined()
        }
      }
    }
  })

  it('los 6 centros de cara están en los ejes principales', () => {
    const dims = { width: 6, height: 4, depth: 2 }
    const result = calc.compute(dims)
    const faceCenters = result.filter((p) => p.type === 'face-center')

    const hw = dims.width / 2
    const hh = dims.height / 2
    const hd = dims.depth / 2

    const expectedFaceCenters = [
      new THREE.Vector3(hw, 0, 0),
      new THREE.Vector3(-hw, 0, 0),
      new THREE.Vector3(0, hh, 0),
      new THREE.Vector3(0, -hh, 0),
      new THREE.Vector3(0, 0, hd),
      new THREE.Vector3(0, 0, -hd),
    ]

    for (const expected of expectedFaceCenters) {
      const found = faceCenters.find(
        (c) =>
          Math.abs(c.position.x - expected.x) < 1e-9 &&
          Math.abs(c.position.y - expected.y) < 1e-9 &&
          Math.abs(c.position.z - expected.z) < 1e-9,
      )
      expect(
        found,
        `Centro de cara esperado en (${expected.x}, ${expected.y}, ${expected.z})`,
      ).toBeDefined()
    }
  })

  it('los 12 centros de aristas tienen exactamente una coordenada en 0', () => {
    const dims = { width: 6, height: 4, depth: 2 }
    const result = calc.compute(dims)
    const edgeCenters = result.filter((p) => p.type === 'edge-center')

    for (const ec of edgeCenters) {
      const zeroCount = [ec.position.x, ec.position.y, ec.position.z].filter(
        (v) => Math.abs(v) < 1e-9,
      ).length
      expect(
        zeroCount,
        `Edge-center en (${ec.position.x}, ${ec.position.y}, ${ec.position.z}) debe tener exactamente 1 coordenada en 0`,
      ).toBe(1)
    }
  })
})

// ─── Tests de findNearest() ───────────────────────────────────────────────────
//
// THREE.Vector3.project(camera) internamente llama a applyMatrix4 con la
// matriz de proyección de la cámara. Para evitar necesitar una cámara real con
// WebGL, interceptamos Vector3.prototype.project con vi.spyOn y controlamos
// directamente qué NDC devuelve cada llamada.
//
// Estrategia: mantenemos un mapa posición-3D → NDC y en el spy buscamos la
// posición del vector antes de mutarlo.

describe('SnapPointCalculator.findNearest()', () => {
  const calc = new SnapPointCalculator()
  const camera = makeFakeCamera()
  const renderer = makeMockRenderer(800, 600)

  // Restaurar el spy después de cada test
  let projectSpy: ReturnType<typeof vi.spyOn> | null = null
  afterEach(() => {
    projectSpy?.mockRestore()
    projectSpy = null
  })

  /**
   * Instala un spy en Vector3.prototype.project que, en lugar de usar la
   * cámara real, aplica el mapa posición → NDC proporcionado.
   * La clave del mapa es "x,y,z" con 4 decimales.
   */
  function installProjectSpy(ndcMap: Map<string, { x: number; y: number }>) {
    projectSpy = vi.spyOn(THREE.Vector3.prototype, 'project').mockImplementation(
      function (this: THREE.Vector3) {
        const key = `${this.x.toFixed(4)},${this.y.toFixed(4)},${this.z.toFixed(4)}`
        const ndc = ndcMap.get(key)
        if (ndc !== undefined) {
          this.set(ndc.x, ndc.y, 0)
        } else {
          // Punto no registrado → proyectar muy lejos
          this.set(999, 999, 0)
        }
        return this
      },
    )
  }

  it('devuelve null cuando no hay snap points', () => {
    const ndcMap = new Map<string, { x: number; y: number }>()
    ndcMap.set('0.0000,0.0000,0.0000', { x: 0, y: 0 })
    installProjectSpy(ndcMap)

    const candidate = new THREE.Vector3(0, 0, 0)
    const result = calc.findNearest(candidate, camera, renderer, [], 10)
    expect(result).toBeNull()
  })

  it('devuelve null cuando todos los snap points están a ≥ thresholdPx', () => {
    // Candidato → NDC (0, 0) → pantalla (400, 300)
    // Snap     → NDC (1, 0) → pantalla (800, 300) → distancia = 400 px ≥ 10 px
    const ndcMap = new Map<string, { x: number; y: number }>()
    ndcMap.set('0.0000,0.0000,0.0000', { x: 0, y: 0 })   // candidato
    ndcMap.set('1.0000,0.0000,0.0000', { x: 1, y: 0 })   // snap

    installProjectSpy(ndcMap)

    const candidate = new THREE.Vector3(0, 0, 0)
    const snapPoints: SnapPoint[] = [
      { position: new THREE.Vector3(1, 0, 0), type: 'corner' },
    ]

    const result = calc.findNearest(candidate, camera, renderer, snapPoints, 10)
    expect(result).toBeNull()
  })

  it('devuelve el snap point más cercano cuando está a < thresholdPx', () => {
    // Candidato → NDC (0, 0)    → pantalla (400, 300)
    // Snap      → NDC (0.01, 0) → pantalla (404, 300) → distancia = 4 px < 10 px
    const ndcMap = new Map<string, { x: number; y: number }>()
    ndcMap.set('0.0000,0.0000,0.0000', { x: 0, y: 0 })
    ndcMap.set('1.0000,0.0000,0.0000', { x: 0.01, y: 0 })

    installProjectSpy(ndcMap)

    const candidate = new THREE.Vector3(0, 0, 0)
    const snapPoints: SnapPoint[] = [
      { position: new THREE.Vector3(1, 0, 0), type: 'corner' },
    ]

    const result = calc.findNearest(candidate, camera, renderer, snapPoints, 10)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('corner')
  })

  it('devuelve el snap point más cercano cuando hay varios candidatos', () => {
    // Candidato → NDC (0, 0)     → pantalla (400, 300)
    // Snap A    → NDC (0.005, 0) → pantalla (402, 300) → distancia = 2 px  ✓
    // Snap B    → NDC (0.008, 0) → pantalla (403.2, 300) → distancia = 3.2 px ✓
    // Snap C    → NDC (0.1, 0)   → pantalla (440, 300) → distancia = 40 px  ✗
    const ndcMap = new Map<string, { x: number; y: number }>()
    ndcMap.set('0.0000,0.0000,0.0000', { x: 0, y: 0 })
    ndcMap.set('1.0000,0.0000,0.0000', { x: 0.005, y: 0 })  // snap A
    ndcMap.set('2.0000,0.0000,0.0000', { x: 0.008, y: 0 })  // snap B
    ndcMap.set('3.0000,0.0000,0.0000', { x: 0.1, y: 0 })    // snap C

    installProjectSpy(ndcMap)

    const candidate = new THREE.Vector3(0, 0, 0)
    const snapA: SnapPoint = { position: new THREE.Vector3(1, 0, 0), type: 'corner' }
    const snapB: SnapPoint = { position: new THREE.Vector3(2, 0, 0), type: 'edge-center' }
    const snapC: SnapPoint = { position: new THREE.Vector3(3, 0, 0), type: 'face-center' }

    const result = calc.findNearest(candidate, camera, renderer, [snapA, snapB, snapC], 10)

    // Snap A está más cerca (2 px < 3.2 px), ambos dentro del umbral de 10 px
    expect(result).not.toBeNull()
    expect(result!.type).toBe('corner')
  })

  it('devuelve null cuando el snap point está en el umbral o por encima (no estrictamente menor)', () => {
    // Verificamos que la condición es estrictamente < thresholdPx:
    // Candidato → NDC (0, 0)   → pantalla (400, 300)
    // Snap      → NDC (0.05, 0) → pantalla (420, 300) → distancia = 20 px
    // Umbral = 10 px → 20 >= 10 → debe devolver null
    const ndcMap = new Map<string, { x: number; y: number }>()
    ndcMap.set('0.0000,0.0000,0.0000', { x: 0, y: 0 })
    ndcMap.set('1.0000,0.0000,0.0000', { x: 0.05, y: 0 })

    installProjectSpy(ndcMap)

    const candidate = new THREE.Vector3(0, 0, 0)
    const snapPoints: SnapPoint[] = [
      { position: new THREE.Vector3(1, 0, 0), type: 'corner' },
    ]

    // Distancia = 20 px > thresholdPx = 10 → debe devolver null
    const result = calc.findNearest(candidate, camera, renderer, snapPoints, 10)
    expect(result).toBeNull()
  })

  it('devuelve snap point cuando está justo por debajo del umbral', () => {
    // Candidato → NDC (0, 0)    → pantalla (400, 300)
    // Snap      → NDC (0.02, 0) → pantalla (408, 300) → distancia = 8 px < 10 px
    const ndcMap = new Map<string, { x: number; y: number }>()
    ndcMap.set('0.0000,0.0000,0.0000', { x: 0, y: 0 })
    ndcMap.set('1.0000,0.0000,0.0000', { x: 0.02, y: 0 })

    installProjectSpy(ndcMap)

    const candidate = new THREE.Vector3(0, 0, 0)
    const snapPoints: SnapPoint[] = [
      { position: new THREE.Vector3(1, 0, 0), type: 'face-center' },
    ]

    // Distancia = 8 px < thresholdPx = 10 → debe devolver el snap
    const result = calc.findNearest(candidate, camera, renderer, snapPoints, 10)
    expect(result).not.toBeNull()
    expect(result!.type).toBe('face-center')
  })
})
