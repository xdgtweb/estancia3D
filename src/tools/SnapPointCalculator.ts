import * as THREE from 'three'
import type { RoomDimensions, SnapPoint } from '../types'

/**
 * Calcula los puntos de ajuste automático (snap points) de una habitación
 * centrada en el origen y permite encontrar el más cercano en espacio de pantalla.
 */
export class SnapPointCalculator {
  /**
   * Calcula los 26 snap points de la habitación:
   * - 8 esquinas (corners): (±W/2, ±H/2, ±D/2)
   * - 12 centros de aristas (edge-centers): punto medio de cada arista del cuboide
   * - 6 centros de cara (face-centers): (±W/2, 0, 0), (0, ±H/2, 0), (0, 0, ±D/2)
   *
   * La habitación está centrada en el origen.
   */
  compute(dims: RoomDimensions): SnapPoint[] {
    const { width: W, height: H, depth: D } = dims
    const hw = W / 2
    const hh = H / 2
    const hd = D / 2

    const snapPoints: SnapPoint[] = []

    // ── 8 esquinas ────────────────────────────────────────────────────────────
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          snapPoints.push({
            position: new THREE.Vector3(sx * hw, sy * hh, sz * hd),
            type: 'corner',
          })
        }
      }
    }

    // ── 12 centros de aristas ─────────────────────────────────────────────────
    // Las 12 aristas de un cuboide se agrupan en 3 conjuntos de 4 aristas paralelas:
    //
    // Aristas paralelas al eje X (y fija, z fija) — 4 aristas
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        snapPoints.push({
          position: new THREE.Vector3(0, sy * hh, sz * hd),
          type: 'edge-center',
        })
      }
    }

    // Aristas paralelas al eje Y (x fija, z fija) — 4 aristas
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        snapPoints.push({
          position: new THREE.Vector3(sx * hw, 0, sz * hd),
          type: 'edge-center',
        })
      }
    }

    // Aristas paralelas al eje Z (x fija, y fija) — 4 aristas
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        snapPoints.push({
          position: new THREE.Vector3(sx * hw, sy * hh, 0),
          type: 'edge-center',
        })
      }
    }

    // ── 6 centros de cara ─────────────────────────────────────────────────────
    snapPoints.push({ position: new THREE.Vector3(hw, 0, 0), type: 'face-center' })
    snapPoints.push({ position: new THREE.Vector3(-hw, 0, 0), type: 'face-center' })
    snapPoints.push({ position: new THREE.Vector3(0, hh, 0), type: 'face-center' })
    snapPoints.push({ position: new THREE.Vector3(0, -hh, 0), type: 'face-center' })
    snapPoints.push({ position: new THREE.Vector3(0, 0, hd), type: 'face-center' })
    snapPoints.push({ position: new THREE.Vector3(0, 0, -hd), type: 'face-center' })

    return snapPoints
  }

  /**
   * Dado un punto 3D candidato y la cámara actual, proyecta cada snap point
   * a espacio de pantalla y devuelve el más cercano si está a < thresholdPx píxeles,
   * o null si ninguno cumple el umbral.
   *
   * @param candidate   - Posición 3D del cursor en el mundo
   * @param camera      - Cámara activa de la escena
   * @param renderer    - Renderer WebGL (para obtener las dimensiones del canvas)
   * @param snapPoints  - Lista de snap points a evaluar
   * @param thresholdPx - Umbral en píxeles (exclusivo); se activa si distancia < thresholdPx
   */
  findNearest(
    candidate: THREE.Vector3,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    snapPoints: SnapPoint[],
    thresholdPx: number,
  ): SnapPoint | null {
    const canvasWidth = renderer.domElement.width
    const canvasHeight = renderer.domElement.height

    // Proyectar el candidato a espacio de pantalla
    const candidateNdc = candidate.clone().project(camera)
    const candidateScreenX = (candidateNdc.x * 0.5 + 0.5) * canvasWidth
    const candidateScreenY = (-candidateNdc.y * 0.5 + 0.5) * canvasHeight

    let nearestSnap: SnapPoint | null = null
    let nearestDist = Infinity

    for (const snap of snapPoints) {
      // Proyectar snap point a NDC y luego a píxeles de pantalla
      const ndc = snap.position.clone().project(camera)
      const screenX = (ndc.x * 0.5 + 0.5) * canvasWidth
      const screenY = (-ndc.y * 0.5 + 0.5) * canvasHeight

      // Distancia en píxeles al candidato proyectado
      const dx = screenX - candidateScreenX
      const dy = screenY - candidateScreenY
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < thresholdPx && dist < nearestDist) {
        nearestDist = dist
        nearestSnap = snap
      }
    }

    return nearestSnap
  }
}
