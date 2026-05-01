import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import type { RoomDimensions } from '../types.js'

export type FixtureId = 'shower' | 'toilet' | 'bidet' | 'sink' | 'door'

export interface Fixture {
  id: FixtureId
  label: string
  group: THREE.Group
  visible: boolean
  pipeMarkers: THREE.Group
}

// ─── BathroomFixtures ─────────────────────────────────────────────────────────
//
// LAYOUT (habitación centrada en el origen, W=2.5m ancho, D=1.6m profundidad):
//
//   Pared norte  z = -D/2  ← pared del fondo (larga)
//   Pared sur    z = +D/2  ← pared de la puerta (larga)
//   Pared este   x = +W/2  ← pared derecha (corta)
//   Pared oeste  x = -W/2  ← pared izquierda (corta) ← PUERTA aquí
//
//   Al entrar por la puerta (pared oeste) mirando hacia el interior (+X):
//   En la pared norte de izquierda a derecha: Lavabo | Bidé | Inodoro | Ducha
//
// MEDIDAS DEL CROQUIS:
//   - Ducha: raíl a 70cm del suelo, tomas a 16cm y 60cm
//   - Bidé: toma a 60cm del suelo, desagüe a 20cm
//   - Inodoro: toma a 60cm del suelo
//   - Lavabo: toma a 60cm del suelo
//   - Paso mínimo: ≥80cm

export class BathroomFixtures {
  private scene: THREE.Scene
  private fixtures: Map<FixtureId, Fixture> = new Map()

  constructor(scene: THREE.Scene) {
    this.scene = scene
  }

  build(dims: RoomDimensions): void {
    this.dispose()
    const { width: W, height: H, depth: D } = dims
    this._addDoor(W, H, D)
    this._addSink(W, H, D)
    this._addBidet(W, H, D)
    this._addToilet(W, H, D)
    this._addShower(W, H, D)
  }

  setVisible(id: FixtureId, visible: boolean): void {
    const f = this.fixtures.get(id)
    if (!f) return
    f.visible = visible
    f.group.visible = visible
    f.pipeMarkers.visible = true
  }

  setPipeMarkersVisible(id: FixtureId, visible: boolean): void {
    const f = this.fixtures.get(id)
    if (!f) return
    f.pipeMarkers.visible = visible
  }

  setPipeLabelsVisible(visible: boolean): void {
    for (const f of this.fixtures.values()) {
      f.pipeMarkers.traverse((obj) => {
        const css = obj as any
        if (css.element instanceof HTMLElement) {
          css.element.style.visibility = visible ? 'visible' : 'hidden'
        }
      })
    }
  }

  getFixtureIds(): FixtureId[] {
    return Array.from(this.fixtures.keys())
  }

  isVisible(id: FixtureId): boolean {
    return this.fixtures.get(id)?.visible ?? false
  }

  dispose(): void {
    for (const f of this.fixtures.values()) {
      // Remove CSS2DObject DOM elements before removing from scene
      this._removeCSSLabels(f.group)
      this._removeCSSLabels(f.pipeMarkers)
      this.scene.remove(f.group)
      this.scene.remove(f.pipeMarkers)
      this._disposeGroup(f.group)
      this._disposeGroup(f.pipeMarkers)
    }
    this.fixtures.clear()
  }

  // ── PUERTA ──────────────────────────────────────────────────────────────────
  // Pared oeste (x=-W/2), centrada en z=0, abre hacia el exterior (z positivo)
  private _addDoor(W: number, H: number, D: number): void {
    const group = new THREE.Group()
    const pipeMarkers = new THREE.Group()

    const floorY = -H / 2
    const doorW = 0.80
    const doorH = 2.00
    const doorThick = 0.04
    const frameThick = 0.06
    const doorCenterZ = 0

    const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 })

    // Marco superior
    const topGeo = new THREE.BoxGeometry(frameThick, frameThick, doorW + frameThick * 2)
    const topFrame = new THREE.Mesh(topGeo, frameMat)
    topFrame.position.set(-W / 2, floorY + doorH + frameThick / 2, doorCenterZ)
    group.add(topFrame)

    // Marco norte
    const sideGeo = new THREE.BoxGeometry(frameThick, doorH + frameThick, frameThick)
    const northFrame = new THREE.Mesh(sideGeo, frameMat)
    northFrame.position.set(-W / 2, floorY + doorH / 2, doorCenterZ - doorW / 2 - frameThick / 2)
    group.add(northFrame)

    // Marco sur
    const southFrame = new THREE.Mesh(sideGeo, frameMat)
    southFrame.position.set(-W / 2, floorY + doorH / 2, doorCenterZ + doorW / 2 + frameThick / 2)
    group.add(southFrame)

    // Hoja blanca — pivota en extremo sur, abre hacia exterior
    const doorGeo = new THREE.BoxGeometry(doorThick, doorH, doorW)
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    const doorLeaf = new THREE.Mesh(doorGeo, doorMat)

    const pivot = new THREE.Group()
    pivot.position.set(-W / 2, floorY + doorH / 2, doorCenterZ + doorW / 2)
    doorLeaf.position.set(doorThick / 2, 0, -doorW / 2)
    pivot.rotation.y = -Math.PI / 2.4  // ~75° hacia exterior
    pivot.add(doorLeaf)
    group.add(pivot)

    // Mango negro — en la cara interior de la hoja, a 1m de altura, a 10cm del borde libre
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 })

    // La hoja tiene: ancho=doorThick (X), alto=doorH (Y), largo=doorW (Z)
    // Centro de la hoja en coordenadas locales = (0,0,0)
    // Cara interior = x negativo (hacia el interior del baño)
    // Borde libre = z negativo (extremo norte, lejos del pivot)
    // Altura del mango = 1.0m desde el suelo → en local Y = 1.0 - doorH/2 = 0.0

    // Barra horizontal del mango
    const handleGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8)
    const handle = new THREE.Mesh(handleGeo, handleMat)
    handle.rotation.x = Math.PI / 2
    handle.position.set(-doorThick / 2 - 0.035, 0.0, -(doorW / 2 - 0.12))
    doorLeaf.add(handle)

    // Roseta
    const rosetteGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 12)
    const rosette = new THREE.Mesh(rosetteGeo, handleMat)
    rosette.rotation.x = Math.PI / 2
    rosette.position.set(-doorThick / 2 - 0.008, 0.0, -(doorW / 2 - 0.12))
    doorLeaf.add(rosette)

    this._register('door', '🚪 Puerta', group, pipeMarkers)
  }

  // ── LAVABO ──────────────────────────────────────────────────────────────────
  // Pared norte, primer elemento desde el oeste
  // Croquis: toma a 60cm del suelo
  private _addSink(W: number, H: number, D: number): void {
    const group = new THREE.Group()
    const pipeMarkers = new THREE.Group()

    const floorY = -H / 2
    const sinkW = 0.55
    const sinkDepth = 0.42
    const sinkH = 0.85
    const basinH = 0.15

    const sx = -W / 2 + sinkW / 2 + 0.05
    const sz = -D / 2 + sinkDepth / 2

    // Pedestal
    const pedestalGeo = new THREE.CylinderGeometry(0.07, 0.09, sinkH - basinH, 12)
    const sinkMat = new THREE.MeshStandardMaterial({ color: 0xf0ede8 })
    const pedestal = new THREE.Mesh(pedestalGeo, sinkMat)
    pedestal.position.set(sx, floorY + (sinkH - basinH) / 2, sz)
    group.add(pedestal)

    // Cuba
    const basinGeo = new THREE.BoxGeometry(sinkW, basinH, sinkDepth)
    const basin = new THREE.Mesh(basinGeo, sinkMat)
    basin.position.set(sx, floorY + sinkH - basinH / 2, sz)
    group.add(basin)

    // Grifo
    const tapGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8)
    const tapMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 })
    const tap = new THREE.Mesh(tapGeo, tapMat)
    tap.position.set(sx, floorY + sinkH + 0.07, sz + sinkDepth / 2 - 0.06)
    group.add(tap)

    // Espejo
    const mirrorGeo = new THREE.BoxGeometry(sinkW * 0.9, 0.55, 0.02)
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xaaccee, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.6 })
    const mirror = new THREE.Mesh(mirrorGeo, mirrorMat)
    mirror.position.set(sx, floorY + sinkH + 0.40, -D / 2 + 0.01)
    group.add(mirror)

    // Pipe markers — croquis: "60 del suelo"
    const pipeY = floorY + 0.60
    this._addPipeMarker(pipeMarkers, '60cm',  0x2288ff,
      new THREE.Vector3(sx - 0.06, floorY, -D / 2 + 0.01),
      new THREE.Vector3(sx - 0.06, pipeY, -D / 2 + 0.01))
    this._addPipeMarker(pipeMarkers, '60cm', 0xff4422,
      new THREE.Vector3(sx + 0.06, floorY, -D / 2 + 0.01),
      new THREE.Vector3(sx + 0.06, pipeY, -D / 2 + 0.01))
    this._addPipeMarker(pipeMarkers, 'desagüe', 0x22aa44,
      new THREE.Vector3(sx, floorY + 0.01, sz),
      new THREE.Vector3(sx, floorY + 0.10, sz))

    this._register('sink', '🚰 Lavabo', group, pipeMarkers)
  }

  // ── BIDÉ ────────────────────────────────────────────────────────────────────
  // Pared norte, segundo elemento
  // Croquis: toma a 60cm del suelo, desagüe a 20cm
  private _addBidet(W: number, H: number, D: number): void {
    const group = new THREE.Group()
    const pipeMarkers = new THREE.Group()

    const floorY = -H / 2
    const bidetW = 0.36
    const bidetDepth = 0.55
    const bidetH = 0.40

    const bx = -W / 2 + 0.55 + 0.36 / 2 + 0.10
    const bz = -D / 2 + bidetDepth / 2

    // Cuerpo
    const bodyGeo = new THREE.BoxGeometry(bidetW, bidetH, bidetDepth)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0ede8 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.set(bx, floorY + bidetH / 2, bz)
    group.add(body)

    // Grifo
    const tapGeo = new THREE.CylinderGeometry(0.013, 0.013, 0.10, 8)
    const tapMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 })
    const tap = new THREE.Mesh(tapGeo, tapMat)
    tap.position.set(bx, floorY + bidetH + 0.05, bz + bidetDepth / 2 - 0.06)
    group.add(tap)

    // Pipe markers — croquis: "Bidé del suelo 60cm" y "del suelo 20cm"
    const pipeY = floorY + 0.60
    this._addPipeMarker(pipeMarkers, '60cm', 0x2288ff,
      new THREE.Vector3(bx - 0.05, floorY, -D / 2 + 0.01),
      new THREE.Vector3(bx - 0.05, pipeY, -D / 2 + 0.01))
    this._addPipeMarker(pipeMarkers, '60cm', 0xff4422,
      new THREE.Vector3(bx + 0.05, floorY, -D / 2 + 0.01),
      new THREE.Vector3(bx + 0.05, pipeY, -D / 2 + 0.01))
    // Desagüe a 20cm del suelo (croquis: "del suelo 20cm")
    this._addPipeMarker(pipeMarkers, '20cm', 0x22aa44,
      new THREE.Vector3(bx, floorY, bz),
      new THREE.Vector3(bx, floorY + 0.20, bz))

    this._register('bidet', '🚿 Bidé', group, pipeMarkers)
  }

  // ── INODORO ─────────────────────────────────────────────────────────────────
  // Pared norte, tercer elemento
  // Croquis: toma a 60cm del suelo
  private _addToilet(W: number, H: number, D: number): void {
    const group = new THREE.Group()
    const pipeMarkers = new THREE.Group()

    const floorY = -H / 2
    const toiletW = 0.36
    const toiletDepth = 0.65
    const toiletH = 0.40
    const cisternH = 0.35
    const cisternDepth = 0.15

    const tx = -W / 2 + 0.55 + 0.36 + 0.36 / 2 + 0.20
    const tz = -D / 2 + toiletDepth / 2

    // Cuerpo
    const bodyGeo = new THREE.BoxGeometry(toiletW, toiletH, toiletDepth)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf0ede8 })
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.set(tx, floorY + toiletH / 2, tz)
    group.add(body)

    // Cisterna
    const cisternGeo = new THREE.BoxGeometry(toiletW, cisternH, cisternDepth)
    const cistern = new THREE.Mesh(cisternGeo, bodyMat)
    cistern.position.set(tx, floorY + toiletH + cisternH / 2, -D / 2 + cisternDepth / 2)
    group.add(cistern)

    // Tapa
    const lidGeo = new THREE.BoxGeometry(toiletW * 0.9, 0.03, toiletDepth * 0.85)
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xe8e5e0 })
    const lid = new THREE.Mesh(lidGeo, lidMat)
    lid.position.set(tx, floorY + toiletH + 0.015, tz + 0.02)
    group.add(lid)

    // Pipe markers — croquis: "60 del suelo"
    const pipeY = floorY + 0.60
    this._addPipeMarker(pipeMarkers, '60cm', 0x2288ff,
      new THREE.Vector3(tx, floorY, -D / 2 + 0.01),
      new THREE.Vector3(tx, pipeY, -D / 2 + 0.01))
    this._addPipeMarker(pipeMarkers, 'desagüe', 0x22aa44,
      new THREE.Vector3(tx, floorY + 0.01, tz),
      new THREE.Vector3(tx, floorY + 0.10, tz))

    this._register('toilet', '🚽 Inodoro', group, pipeMarkers)
  }

  // ── DUCHA ───────────────────────────────────────────────────────────────────
  // Rincón NE: pared norte (z=-D/2) + pared este (x=+W/2)
  // Plato 80×120cm (80cm ancho en X, 120cm profundidad en Z)
  // Croquis: raíl a 70cm del suelo, tomas a 16cm y 60cm
  private _addShower(W: number, H: number, D: number): void {
    const group = new THREE.Group()
    const pipeMarkers = new THREE.Group()

    const floorY = -H / 2
    const plateX = 0.80
    const plateZ = 1.20
    const plateThick = 0.05
    const glassH = 1.90

    const px = W / 2 - plateX / 2
    const pz = -D / 2 + plateZ / 2

    // Plato de ducha
    const plateGeo = new THREE.BoxGeometry(plateX, plateThick, plateZ)
    const plateMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0 })
    const plate = new THREE.Mesh(plateGeo, plateMat)
    plate.position.set(px, floorY + plateThick / 2, pz)
    group.add(plate)

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.30, side: THREE.DoubleSide,
    })

    // Mampara frontal (cierra el lado sur del plato)
    const frontGeo = new THREE.BoxGeometry(plateX, glassH, 0.012)
    const frontGlass = new THREE.Mesh(frontGeo, glassMat)
    frontGlass.position.set(px, floorY + plateThick + glassH / 2, -D / 2 + plateZ)
    group.add(frontGlass)

    // Mampara lateral (cierra el lado oeste del plato)
    const sideGeo = new THREE.BoxGeometry(0.012, glassH, plateZ)
    const sideGlass = new THREE.Mesh(sideGeo, glassMat)
    sideGlass.position.set(W / 2 - plateX, floorY + plateThick + glassH / 2, pz)
    group.add(sideGlass)

    // Tubo vertical de la alcachofa (en pared norte)
    const showerPipeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.50, 8)
    const metalMat = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.85, roughness: 0.15 })
    const showerPipe = new THREE.Mesh(showerPipeGeo, metalMat)
    showerPipe.position.set(px, floorY + 0.70 + 0.75, -D / 2 + 0.05)
    group.add(showerPipe)

    // Alcachofa (cabezal)
    const headGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.025, 16)
    const head = new THREE.Mesh(headGeo, metalMat)
    head.position.set(px, floorY + 2.15, -D / 2 + 0.05)
    group.add(head)

    // Brazo horizontal de la alcachofa
    const armGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.20, 8)
    const arm = new THREE.Mesh(armGeo, metalMat)
    arm.rotation.x = Math.PI / 2
    arm.position.set(px, floorY + 2.10, -D / 2 + 0.15)
    group.add(arm)

    // Pipe markers — croquis: raíl 70cm, tomas 16cm y 60cm del suelo
    // Toma de agua fría a 16cm del suelo
    this._addPipeMarker(pipeMarkers, '16cm', 0x2288ff,
      new THREE.Vector3(px - 0.06, floorY, -D / 2 + 0.01),
      new THREE.Vector3(px - 0.06, floorY + 0.16, -D / 2 + 0.01))
    // Toma de agua caliente a 60cm del suelo
    this._addPipeMarker(pipeMarkers, '60cm', 0xff4422,
      new THREE.Vector3(px + 0.06, floorY, -D / 2 + 0.01),
      new THREE.Vector3(px + 0.06, floorY + 0.60, -D / 2 + 0.01))
    // Raíl de ducha a 70cm del suelo
    this._addPipeMarker(pipeMarkers, '70cm raíl', 0xaaaaaa,
      new THREE.Vector3(px, floorY, -D / 2 + 0.01),
      new THREE.Vector3(px, floorY + 0.70, -D / 2 + 0.01))
    // Desagüe
    this._addPipeMarker(pipeMarkers, 'desagüe', 0x22aa44,
      new THREE.Vector3(px, floorY + 0.01, pz),
      new THREE.Vector3(px, floorY + 0.08, pz))

    this._register('shower', '🚿 Ducha', group, pipeMarkers)
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private _addPipeMarker(
    group: THREE.Group,
    label: string,
    color: number,
    from: THREE.Vector3,
    to: THREE.Vector3
  ): void {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    if (len < 0.001) return
    const mid = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5)

    const geo = new THREE.CylinderGeometry(0.014, 0.014, len, 8)
    const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
    const pipe = new THREE.Mesh(geo, mat)
    pipe.position.copy(mid)
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
    group.add(pipe)

    const div = document.createElement('div')
    div.className = 'pipe-label'
    div.textContent = label
    const labelObj = new CSS2DObject(div)
    labelObj.position.copy(to)
    group.add(labelObj)
  }

  private _register(id: FixtureId, label: string, group: THREE.Group, pipeMarkers: THREE.Group): void {
    this.scene.add(group)
    this.scene.add(pipeMarkers)
    this.fixtures.set(id, { id, label, group, visible: true, pipeMarkers })
  }

  private _disposeGroup(group: THREE.Group): void {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose())
        } else {
          obj.material.dispose()
        }
      }
    })
  }

  /** Remove CSS2DObject DOM elements from the document to prevent ghost labels. */
  private _removeCSSLabels(group: THREE.Group): void {
    group.traverse((obj) => {
      const css = obj as any
      if (css.element instanceof HTMLElement && css.element.parentElement) {
        css.element.parentElement.removeChild(css.element)
      }
    })
  }
}
