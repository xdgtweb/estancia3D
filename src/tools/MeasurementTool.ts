import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { euclideanDistance } from '../domain/geometry.js'
import type { AnchorPoint, MeasurementLine, SerializedMeasurementLine, SnapPoint } from '../types.js'
import type { SnapPointCalculator } from './SnapPointCalculator.js'

// ─── MeasurementTool ─────────────────────────────────────────────────────────

/**
 * Manages anchor point placement, distance calculation, and the lifecycle
 * of MeasurementLines in the 3D scene.
 *
 * Tasks: 10.1 (setActive, handlePointerDown, handlePointerMove)
 *        10.2 (deleteLine, getLines, restoreLines, keydown listener)
 */
export class MeasurementTool {
  // ── Dependencies ───────────────────────────────────────────────────────────
  private scene: THREE.Scene
  private camera: THREE.Camera
  private renderer: THREE.WebGLRenderer
  private getSurfaceMeshes: () => THREE.Mesh[]
  private snapCalculator: SnapPointCalculator
  private snapPoints: SnapPoint[]

  // ── State ──────────────────────────────────────────────────────────────────
  private active = false
  private pendingAnchor: AnchorPoint | null = null
  private lines: MeasurementLine[] = []
  private selectedLineId: string | null = null

  // ── Snap preview mesh ──────────────────────────────────────────────────────
  private snapPreviewMesh: THREE.Mesh

  // ── Bound event handlers (for cleanup) ────────────────────────────────────
  private boundKeyDown: (e: KeyboardEvent) => void

  constructor(
    scene: THREE.Scene,
    camera: THREE.Camera,
    renderer: THREE.WebGLRenderer,
    getSurfaceMeshes: () => THREE.Mesh[],
    snapCalculator: SnapPointCalculator,
    snapPoints: SnapPoint[],
  ) {
    this.scene = scene
    this.camera = camera
    this.renderer = renderer
    this.getSurfaceMeshes = getSurfaceMeshes
    this.snapCalculator = snapCalculator
    this.snapPoints = snapPoints

    // Create a small sphere used to highlight the nearest snap point
    const previewGeo = new THREE.SphereGeometry(0.04, 8, 8)
    const previewMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, visible: false })
    this.snapPreviewMesh = new THREE.Mesh(previewGeo, previewMat)
    this.scene.add(this.snapPreviewMesh)

    // Keyboard listener for Delete / Supr
    this.boundKeyDown = this.handleKeyDown.bind(this)
    window.addEventListener('keydown', this.boundKeyDown)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Activates or deactivates the measurement tool.
   * When deactivated, pointer events are ignored.
   * Task 10.1
   */
  setActive(active: boolean): void {
    this.active = active
    if (!active) {
      // Hide snap preview when tool is deactivated
      ;(this.snapPreviewMesh.material as THREE.MeshBasicMaterial).visible = false
    }
  }

  /**
   * Handles a pointer-down event:
   * 1. Ignores if not active.
   * 2. Normalises mouse coordinates.
   * 3. Raycasts against surface meshes.
   * 4. Applies snap if the nearest snap point is < 10 px away.
   * 5. Creates an AnchorPoint (red sphere).
   * 6. On the first click: stores the pending anchor.
   *    On the second click: calculates distance, creates MeasurementLine + label.
   * Task 10.1
   */
  handlePointerDown(event: PointerEvent): void {
    if (!this.active) return

    // Normalised device coordinates
    const ndc = this.getNDC(event)

    // Raycast against surface meshes
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    const hits = raycaster.intersectObjects(this.getSurfaceMeshes())
    if (hits.length === 0) return

    let position = hits[0].point.clone()

    // Apply snap if a snap point is within 10 px
    const snapped = this.snapCalculator.findNearest(
      position,
      this.camera,
      this.renderer,
      this.snapPoints,
      10,
    )
    if (snapped) {
      position = snapped.position.clone()
    }

    // Create anchor sphere (red)
    const anchorGeo = new THREE.SphereGeometry(0.05, 12, 12)
    const anchorMat = new THREE.MeshBasicMaterial({ color: 0xff0000 })
    const anchorMesh = new THREE.Mesh(anchorGeo, anchorMat)
    anchorMesh.position.copy(position)
    this.scene.add(anchorMesh)

    const anchor: AnchorPoint = {
      id: `anchor_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      position,
      mesh: anchorMesh,
    }

    if (this.pendingAnchor === null) {
      // First anchor — store as pending
      this.pendingAnchor = anchor
    } else {
      // Second anchor — complete the measurement
      const anchorA = this.pendingAnchor
      const anchorB = anchor
      this.pendingAnchor = null

      const distance = euclideanDistance(anchorA.position, anchorB.position)

      // Create line geometry
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        anchorA.position,
        anchorB.position,
      ])
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00 })
      const lineMesh = new THREE.Line(lineGeo, lineMat)
      this.scene.add(lineMesh)

      // Create CSS2D label
      const div = document.createElement('div')
      div.className = 'measurement-label'
      div.textContent = `${distance}m`
      const label = new CSS2DObject(div)
      const midpoint = new THREE.Vector3()
        .addVectors(anchorA.position, anchorB.position)
        .multiplyScalar(0.5)
      label.position.set(midpoint.x, midpoint.y, midpoint.z)
      this.scene.add(label)

      const line: MeasurementLine = {
        id: `line_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        anchorA,
        anchorB,
        distance,
        lineMesh,
        label,
      }

      this.lines.push(line)
    }
  }

  /**
   * Handles pointer-move events:
   * 1. Ignores if not active.
   * 2. Finds the nearest snap point in screen space.
   * 3. Highlights it by moving the snap preview mesh.
   * Task 10.1
   */
  handlePointerMove(event: PointerEvent): void {
    if (!this.active) return

    const ndc = this.getNDC(event)

    // Raycast to get a 3D candidate position
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.camera)
    const hits = raycaster.intersectObjects(this.getSurfaceMeshes())

    const previewMat = this.snapPreviewMesh.material as THREE.MeshBasicMaterial

    if (hits.length === 0) {
      previewMat.visible = false
      return
    }

    const candidate = hits[0].point.clone()
    const snapped = this.snapCalculator.findNearest(
      candidate,
      this.camera,
      this.renderer,
      this.snapPoints,
      10,
    )

    if (snapped) {
      this.snapPreviewMesh.position.copy(snapped.position)
      previewMat.visible = true
    } else {
      previewMat.visible = false
    }
  }

  /**
   * Deletes the MeasurementLine with the given id, removing its anchors
   * and line mesh from the scene.
   * Task 10.2
   */
  deleteLine(id: string): void {
    const idx = this.lines.findIndex((l) => l.id === id)
    if (idx === -1) return

    const line = this.lines[idx]

    // Remove from scene
    this.scene.remove(line.anchorA.mesh)
    this.scene.remove(line.anchorB.mesh)
    this.scene.remove(line.lineMesh)
    this.scene.remove(line.label)

    // Dispose geometries and materials
    line.anchorA.mesh.geometry.dispose()
    ;(line.anchorA.mesh.material as THREE.Material).dispose()
    line.anchorB.mesh.geometry.dispose()
    ;(line.anchorB.mesh.material as THREE.Material).dispose()
    line.lineMesh.geometry.dispose()
    ;(line.lineMesh.material as THREE.Material).dispose()

    // Remove from array
    this.lines.splice(idx, 1)

    // Clear selection if the deleted line was selected
    if (this.selectedLineId === id) {
      this.selectedLineId = null
    }
  }

  /**
   * Returns a shallow copy of the active MeasurementLines array.
   * Task 10.2
   */
  getLines(): MeasurementLine[] {
    return [...this.lines]
  }

  /**
   * Reconstructs MeasurementLines from serialized data (e.g. from localStorage).
   * Creates all required 3D objects and adds them to the scene.
   * Task 10.2
   */
  restoreLines(data: SerializedMeasurementLine[]): void {
    for (const item of data) {
      const posA = new THREE.Vector3(item.ax, item.ay, item.az)
      const posB = new THREE.Vector3(item.bx, item.by, item.bz)

      // Anchor A
      const geoA = new THREE.SphereGeometry(0.05, 12, 12)
      const matA = new THREE.MeshBasicMaterial({ color: 0xff0000 })
      const meshA = new THREE.Mesh(geoA, matA)
      meshA.position.copy(posA)
      this.scene.add(meshA)

      // Anchor B
      const geoB = new THREE.SphereGeometry(0.05, 12, 12)
      const matB = new THREE.MeshBasicMaterial({ color: 0xff0000 })
      const meshB = new THREE.Mesh(geoB, matB)
      meshB.position.copy(posB)
      this.scene.add(meshB)

      const anchorA: AnchorPoint = {
        id: `anchor_${item.id}_a`,
        position: posA,
        mesh: meshA,
      }
      const anchorB: AnchorPoint = {
        id: `anchor_${item.id}_b`,
        position: posB,
        mesh: meshB,
      }

      // Line mesh
      const lineGeo = new THREE.BufferGeometry().setFromPoints([posA, posB])
      const lineMat = new THREE.LineBasicMaterial({ color: 0xffff00 })
      const lineMesh = new THREE.Line(lineGeo, lineMat)
      this.scene.add(lineMesh)

      // Label
      const div = document.createElement('div')
      div.className = 'measurement-label'
      div.textContent = `${item.distance}m`
      const label = new CSS2DObject(div)
      const midpoint = new THREE.Vector3()
        .addVectors(posA, posB)
        .multiplyScalar(0.5)
      label.position.set(midpoint.x, midpoint.y, midpoint.z)
      this.scene.add(label)

      const line: MeasurementLine = {
        id: item.id,
        anchorA,
        anchorB,
        distance: item.distance,
        lineMesh,
        label,
      }

      this.lines.push(line)
    }
  }

  /**
   * Removes all event listeners. Call when disposing the tool.
   */
  dispose(): void {
    window.removeEventListener('keydown', this.boundKeyDown)
    this.scene.remove(this.snapPreviewMesh)
    this.snapPreviewMesh.geometry.dispose()
    ;(this.snapPreviewMesh.material as THREE.Material).dispose()
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Converts a PointerEvent to normalised device coordinates (NDC) [-1, 1].
   */
  private getNDC(event: PointerEvent): THREE.Vector2 {
    const canvas = this.renderer.domElement
    const rect = canvas.getBoundingClientRect()
    return new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }

  /**
   * Handles keydown events: deletes the selected line on Delete/Supr.
   * Also updates selectedLineId by raycasting over line meshes on pointer events
   * (selection is updated in handlePointerDown via line mesh raycasting).
   * Task 10.2
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Delete' && event.key !== 'Supr') return
    if (this.selectedLineId !== null) {
      this.deleteLine(this.selectedLineId)
    }
  }

  /**
   * Updates the selected line by raycasting against line meshes.
   * Called internally when a pointer-down event hits a line mesh instead of a surface.
   */
  updateSelectedLine(event: PointerEvent): void {
    const ndc = this.getNDC(event)
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, this.camera)

    const lineMeshes = this.lines.map((l) => l.lineMesh)
    const hits = raycaster.intersectObjects(lineMeshes)

    if (hits.length > 0) {
      const hitMesh = hits[0].object
      const found = this.lines.find((l) => l.lineMesh === hitMesh)
      if (found) {
        this.selectedLineId = found.id
      }
    } else {
      this.selectedLineId = null
    }
  }
}
