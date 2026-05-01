import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import gsap from 'gsap'
import type { RoomDimensions } from '../types.js'
import { BathroomFixtures, type FixtureId } from './BathroomFixtures.js'

// ─── RoomViewer ──────────────────────────────────────────────────────────────

/**
 * Renders a 3D room with six surfaces, permanent dimension labels,
 * orbit controls, and double-click camera animation.
 *
 * Tasks: 8.1 (scene setup), 8.2 (surfaces/dimensions), 8.5 (labels), 8.7 (dblclick)
 */
export class RoomViewer {
  // ── Three.js core ──────────────────────────────────────────────────────────
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private cssRenderer: CSS2DRenderer
  private controls: OrbitControls

  // ── Room state ─────────────────────────────────────────────────────────────
  private dims: RoomDimensions = { width: 5, height: 3, depth: 2.5 }
  private surfaceMeshes: THREE.Mesh[] = []

  // ── Bathroom fixtures ──────────────────────────────────────────────────────
  private fixtures: BathroomFixtures

  // ── Permanent labels ───────────────────────────────────────────────────────
  private labelWidth!: CSS2DObject
  private labelHeight!: CSS2DObject
  private labelDepth!: CSS2DObject

  // ── Animation loop ─────────────────────────────────────────────────────────
  private animFrameId: number | null = null
  private resizeHandler: () => void

  // ── Container ──────────────────────────────────────────────────────────────
  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container

    // ── Scene ────────────────────────────────────────────────────────────────
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1a2e)

    // ── Camera ───────────────────────────────────────────────────────────────
    const { width: W, height: H, depth: D } = this.dims
    this.camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.01,
      1000
    )
    this.camera.position.set(W * 0.8, H * 0.8, D * 1.5)
    this.camera.lookAt(0, 0, 0)

    // ── WebGL renderer ───────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    container.appendChild(this.renderer.domElement)

    // ── CSS2D renderer ───────────────────────────────────────────────────────
    this.cssRenderer = new CSS2DRenderer()
    this.cssRenderer.setSize(container.clientWidth, container.clientHeight)
    this.cssRenderer.domElement.style.position = 'absolute'
    this.cssRenderer.domElement.style.top = '0'
    this.cssRenderer.domElement.style.pointerEvents = 'none'
    container.appendChild(this.cssRenderer.domElement)

    // ── OrbitControls ────────────────────────────────────────────────────────
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableRotate = true
    this.controls.enableZoom = true
    this.controls.enablePan = true
    this.controls.update()

    // ── Lights ───────────────────────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    this.scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(5, 10, 7.5)
    this.scene.add(dirLight)

    // ── Permanent labels ─────────────────────────────────────────────────────
    this.createPermanentLabels()

    // ── Bathroom fixtures ─────────────────────────────────────────────────────
    this.fixtures = new BathroomFixtures(this.scene)

    // ── Build initial room geometry ──────────────────────────────────────────
    this.buildRoom()

    // ── Double-click listener ────────────────────────────────────────────────
    this.renderer.domElement.addEventListener('dblclick', this.onDblClick)

    // ── Resize handler ───────────────────────────────────────────────────────
    this.resizeHandler = () => this.onResize()
    window.addEventListener('resize', this.resizeHandler)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Starts the render loop. */
  start(): void {
    const loop = () => {
      this.animFrameId = requestAnimationFrame(loop)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      this.cssRenderer.render(this.scene, this.camera)
    }
    loop()
  }

  /** Stops the render loop and releases resources. */
  dispose(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId)
      this.animFrameId = null
    }
    window.removeEventListener('resize', this.resizeHandler)
    this.renderer.domElement.removeEventListener('dblclick', this.onDblClick)
    this.controls.dispose()
    this.fixtures.dispose()
    this.renderer.dispose()
    // Remove DOM elements
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    }
    if (this.cssRenderer.domElement.parentElement) {
      this.cssRenderer.domElement.parentElement.removeChild(this.cssRenderer.domElement)
    }
  }

  /**
   * Rebuilds the room geometry with the given dimensions and updates labels.
   * Task 8.2
   */
  setDimensions(dims: RoomDimensions): void {
    this.dims = { ...dims }
    this.buildRoom()
    this.updatePermanentLabels()
  }

  /** Show or hide a bathroom fixture. */
  setFixtureVisible(id: FixtureId, visible: boolean): void {
    this.fixtures.setVisible(id, visible)
  }

  /** Returns whether a fixture is currently visible. */
  isFixtureVisible(id: FixtureId): boolean {
    return this.fixtures.isVisible(id)
  }

  /** Returns all fixture ids. */
  getFixtureIds(): FixtureId[] {
    return this.fixtures.getFixtureIds()
  }

  // ── Label visibility state ─────────────────────────────────────────────────
  private _pipeLabelsVisible = true
  private _measurementLabelsVisible = true

  /** Show or hide the pipe label texts (etiquetas de tuberías). */
  setPipeLabelsVisible(visible: boolean): void {
    this._pipeLabelsVisible = visible
    this._applyLabelVisibility()
  }

  /** Show or hide dimension labels (W/H/D) and measurement labels (orange). */
  setMeasurementLabelsVisible(visible: boolean): void {
    this._measurementLabelsVisible = visible
    this._applyLabelVisibility()
  }

  /** Show or hide ALL floating text labels in the scene. */
  setAllLabelsVisible(visible: boolean): void {
    this._pipeLabelsVisible = visible
    this._measurementLabelsVisible = visible
    this._applyLabelVisibility()
  }

  /** Apply current visibility state to all CSS2DObjects in the scene. */
  private _applyLabelVisibility(): void {
    // Permanent dimension labels — controlled directly via Three.js visible property
    this.labelWidth.visible = this._measurementLabelsVisible
    this.labelHeight.visible = this._measurementLabelsVisible
    this.labelDepth.visible = this._measurementLabelsVisible

    // Traverse scene and control CSS2DObjects by their element class
    this.scene.traverse((obj) => {
      // CSS2DObject has an 'element' property that is an HTMLElement
      const maybeCSS = obj as any
      if (maybeCSS.element instanceof HTMLElement) {
        const el = maybeCSS.element as HTMLElement
        if (el.classList.contains('pipe-label')) {
          // pipe-label = medidas de tuberías (60cm, desagüe, 70cm raíl...)
          maybeCSS.visible = this._measurementLabelsVisible
        } else if (el.classList.contains('measurement-label') || el.classList.contains('permanent-label')) {
          // permanent-label = W/H/D azules de la habitación
          // measurement-label = líneas de medición naranjas
          maybeCSS.visible = this._pipeLabelsVisible
        }
      }
    })
  }

  getDimensions(): RoomDimensions {
    return { ...this.dims }
  }

  /** Returns the six surface meshes for raycasting. Task 8.2 */
  getSurfaceMeshes(): THREE.Mesh[] {
    return [...this.surfaceMeshes]
  }

  /** Returns the Three.js Scene. Used by AppController to pass to MeasurementTool. */
  getScene(): THREE.Scene {
    return this.scene
  }

  /** Returns the PerspectiveCamera. Used by AppController to pass to MeasurementTool. */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera
  }

  /** Returns the WebGLRenderer. Used by AppController to pass to MeasurementTool. */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer
  }

  /**
   * Returns the three permanent CSS2DObject labels (width, height, depth).
   * Exposed for testing purposes.
   */
  getPermanentLabels(): CSS2DObject[] {
    return [this.labelWidth, this.labelHeight, this.labelDepth]
  }

  /**
   * Updates the text of the three permanent dimension labels.
   * Task 8.5
   */
  updatePermanentLabels(): void {
    const { width: W, height: H, depth: D } = this.dims

    // Update text content
    ;(this.labelWidth.element as HTMLElement).textContent = `W: ${W}m`
    ;(this.labelHeight.element as HTMLElement).textContent = `H: ${H}m`
    ;(this.labelDepth.element as HTMLElement).textContent = `D: ${D}m`

    // Update positions
    this.labelWidth.position.set(0, -H / 2 - 0.1, D / 2 + 0.1)
    this.labelHeight.position.set(W / 2 + 0.1, 0, 0)
    this.labelDepth.position.set(0, -H / 2 - 0.1, 0)
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Creates the three permanent CSS2DObject labels and adds them to the scene.
   * Task 8.5
   */
  private createPermanentLabels(): void {
    this.labelWidth = this.makePermanentLabel('W: ?m')
    this.labelHeight = this.makePermanentLabel('H: ?m')
    this.labelDepth = this.makePermanentLabel('D: ?m')

    this.scene.add(this.labelWidth)
    this.scene.add(this.labelHeight)
    this.scene.add(this.labelDepth)
  }

  private makePermanentLabel(text: string): CSS2DObject {
    const div = document.createElement('div')
    div.className = 'permanent-label'
    div.textContent = text
    return new CSS2DObject(div)
  }

  /**
   * Builds (or rebuilds) the six room surface meshes.
   * Task 8.2
   */
  private buildRoom(): void {
    // Remove old meshes from scene
    for (const mesh of this.surfaceMeshes) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
    }
    this.surfaceMeshes = []

    const { width: W, height: H, depth: D } = this.dims

    // Helper to create a surface mesh
    const makeSurface = (
      w: number,
      h: number,
      color: number,
      surfaceType: string,
      rx: number,
      ry: number,
      rz: number,
      px: number,
      py: number,
      pz: number
    ): THREE.Mesh => {
      const geo = new THREE.PlaneGeometry(w, h)
      const mat = new THREE.MeshStandardMaterial({
        color,
        side: THREE.FrontSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.set(rx, ry, rz)
      mesh.position.set(px, py, pz)
      mesh.userData.surfaceType = surfaceType
      return mesh
    }

    // Floor: rotated -90° on X, at y = -H/2
    const floor = makeSurface(W, D, 0x8b7355, 'floor', -Math.PI / 2, 0, 0, 0, -H / 2, 0)

    // Ceiling: rotated +90° on X, at y = +H/2
    const ceiling = makeSurface(W, D, 0xf5f5f5, 'ceiling', Math.PI / 2, 0, 0, 0, H / 2, 0)

    // Wall north: z = -D/2, facing +Z (no rotation needed for front face)
    const wallNorth = makeSurface(W, H, 0xd4c5b0, 'wall-north', 0, 0, 0, 0, 0, -D / 2)

    // Wall south: z = +D/2, facing -Z (rotated 180° on Y)
    const wallSouth = makeSurface(W, H, 0xc8b9a4, 'wall-south', 0, Math.PI, 0, 0, 0, D / 2)

    // Wall east: x = +W/2, facing -X (rotated -90° on Y)
    const wallEast = makeSurface(D, H, 0xbfb0a0, 'wall-east', 0, -Math.PI / 2, 0, W / 2, 0, 0)

    // Wall west: x = -W/2, facing +X (rotated +90° on Y)
    const wallWest = makeSurface(D, H, 0xb5a696, 'wall-west', 0, Math.PI / 2, 0, -W / 2, 0, 0)

    this.surfaceMeshes = [floor, ceiling, wallNorth, wallSouth, wallEast, wallWest]
    for (const mesh of this.surfaceMeshes) {
      this.scene.add(mesh)
    }

    // Rebuild bathroom fixtures for new dimensions
    this.fixtures.build(this.dims)

    // Update label positions after rebuilding
    this.updatePermanentLabels()
  }

  /** Handles window resize. Task 8.1 */
  private onResize(): void {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
    this.cssRenderer.setSize(w, h)
  }

  /**
   * Double-click handler: raycasts to find the clicked surface and animates
   * the camera to a frontal view of that surface in ≤ 500 ms.
   * Task 8.7
   */
  private onDblClick = (event: MouseEvent): void => {
    const canvas = this.renderer.domElement
    const rect = canvas.getBoundingClientRect()

    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, this.camera)

    const hits = raycaster.intersectObjects(this.surfaceMeshes)
    if (hits.length === 0) return

    const hit = hits[0]
    const mesh = hit.object as THREE.Mesh
    const surfaceType = mesh.userData.surfaceType as string

    const targetPos = this.getFrontalCameraPosition(surfaceType)

    // Animate camera with gsap in ≤ 500 ms (using 400 ms)
    gsap.to(this.camera.position, {
      duration: 0.4,
      x: targetPos.x,
      y: targetPos.y,
      z: targetPos.z,
      onUpdate: () => this.controls.update(),
    })
  }

  /**
   * Returns the camera position for a frontal view of the given surface.
   */
  private getFrontalCameraPosition(surfaceType: string): THREE.Vector3 {
    const { width: W, height: H, depth: D } = this.dims
    const dist = Math.max(W, H, D) * 1.5

    switch (surfaceType) {
      case 'floor':
        return new THREE.Vector3(0, H / 2 + dist, 0)
      case 'ceiling':
        return new THREE.Vector3(0, -(H / 2 + dist), 0)
      case 'wall-north':
        return new THREE.Vector3(0, 0, D / 2 + dist)
      case 'wall-south':
        return new THREE.Vector3(0, 0, -(D / 2 + dist))
      case 'wall-east':
        return new THREE.Vector3(-(W / 2 + dist), 0, 0)
      case 'wall-west':
        return new THREE.Vector3(W / 2 + dist, 0, 0)
      default:
        return new THREE.Vector3(W * 0.8, H * 0.8, D * 1.5)
    }
  }
}
