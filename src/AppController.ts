import { RoomViewer } from './viewer/RoomViewer.js'
import { MeasurementTool } from './tools/MeasurementTool.js'
import { SnapPointCalculator } from './tools/SnapPointCalculator.js'
import { SessionStore } from './store/SessionStore.js'
import { ExportService } from './services/ExportService.js'
import { validateDimension } from './domain/validation.js'
import type { RoomDimensions, SerializedMeasurementLine } from './types.js'
import type { FixtureId } from './viewer/BathroomFixtures.js'

export class AppController {
  private viewer: RoomViewer
  private measurementTool: MeasurementTool
  private snapCalculator: SnapPointCalculator
  private currentDims: RoomDimensions = { width: 5, height: 3, depth: 2.5 }

  private static readonly DEFAULT_DIMS: RoomDimensions = { width: 2.5, height: 2.4, depth: 1.6 }

  // Sin medidas por defecto — las medidas del croquis se muestran como pipe markers en los fixtures
  private static readonly DEFAULT_MEASUREMENTS: SerializedMeasurementLine[] = []

  constructor(container: HTMLElement) {
    this.viewer = new RoomViewer(container)
    this.viewer.start()

    this.snapCalculator = new SnapPointCalculator()
    const snapPoints = this.snapCalculator.compute(this.currentDims)

    this.measurementTool = new MeasurementTool(
      this.viewer.getScene(),
      this.viewer.getCamera(),
      this.viewer.getRenderer(),
      () => this.viewer.getSurfaceMeshes(),
      this.snapCalculator,
      snapPoints,
    )

    const OLD_IDS = new Set(['ducha_rail_altura','ducha_ancho','mampara_altura','bidet_altura_suelo','bidet_profundidad','inodoro_altura_suelo','paso_minimo'])

    const session = SessionStore.load()
    if (session !== null) {
      this.currentDims = session.roomDimensions
      this.viewer.setDimensions(this.currentDims)
      this._updateSnapPoints()
      // Filter out old croquis measurements — they are now shown as pipe markers
      const cleanMeasurements = session.measurements.filter((m) => !OLD_IDS.has(m.id))
      if (cleanMeasurements.length > 0) {
        this.measurementTool.restoreLines(cleanMeasurements)
      }
      // Re-save without old measurements
      SessionStore.save({ roomDimensions: this.currentDims, measurements: cleanMeasurements })
    } else {
      this._applyDefaultDimensions()
    }
  }

  setRoomDimensions(dims: RoomDimensions): void {
    const results = [
      validateDimension(dims.width),
      validateDimension(dims.height),
      validateDimension(dims.depth),
    ]

    const hasNonPositive = results.some((r) => !r.valid && r.error === 'non-positive')
    if (hasNonPositive) {
      window.dispatchEvent(new CustomEvent('room:dimension-error', { detail: { error: 'non-positive', dims } }))
      return
    }

    const hasOutOfRange = results.some((r) => !r.valid && r.error === 'out-of-range')
    if (hasOutOfRange) {
      window.dispatchEvent(new CustomEvent('room:dimension-warning', { detail: { error: 'out-of-range', dims } }))
      return
    }

    this.currentDims = { ...dims }
    this.viewer.setDimensions(this.currentDims)
    this._updateSnapPoints()
    this._saveSession()
  }

  activateMeasurementTool(): void {
    this.measurementTool.setActive(true)
  }

  deactivateMeasurementTool(): void {
    this.measurementTool.setActive(false)
  }

  exportJSON(): void {
    const lines = this.measurementTool.getLines()
    if (lines.length === 0) {
      window.dispatchEvent(new CustomEvent('export:no-measurements'))
      return
    }
    const content = ExportService.toJSON(lines, this.currentDims)
    ExportService.download(content, 'measurements.json', 'application/json')
  }

  exportCSV(): void {
    const lines = this.measurementTool.getLines()
    if (lines.length === 0) {
      window.dispatchEvent(new CustomEvent('export:no-measurements'))
      return
    }
    const content = ExportService.toCSV(lines)
    ExportService.download(content, 'measurements.csv', 'text/csv')
  }

  resetSession(): void {
    SessionStore.clear()
    const lines = this.measurementTool.getLines()
    for (const line of lines) {
      this.measurementTool.deleteLine(line.id)
    }
    this._applyDefaultDimensions()
  }

  /** Show or hide a bathroom fixture (ducha, inodoro, bidé, lavabo, puerta). */
  setFixtureVisible(id: FixtureId, visible: boolean): void {
    this.viewer.setFixtureVisible(id, visible)
  }

  getViewer(): RoomViewer {
    return this.viewer
  }

  getMeasurementTool(): MeasurementTool {
    return this.measurementTool
  }

  loadProject(data: { roomDimensions: RoomDimensions; measurements: SerializedMeasurementLine[] }): void {
    const existing = this.measurementTool.getLines()
    for (const line of existing) {
      this.measurementTool.deleteLine(line.id)
    }
    this.currentDims = { ...data.roomDimensions }
    this.viewer.setDimensions(this.currentDims)
    this._updateSnapPoints()
    if (data.measurements.length > 0) {
      this.measurementTool.restoreLines(data.measurements)
    }
    SessionStore.save({ roomDimensions: this.currentDims, measurements: data.measurements })
  }

  dispose(): void {
    this.viewer.dispose()
    this.measurementTool.dispose()
  }

  private _updateSnapPoints(): void {
    const newSnapPoints = this.snapCalculator.compute(this.currentDims)
    ;(this.measurementTool as unknown as { snapPoints: ReturnType<SnapPointCalculator['compute']> }).snapPoints = newSnapPoints
  }

  private _saveSession(): void {
    const lines = this.measurementTool.getLines()
    const measurements: SerializedMeasurementLine[] = lines.map((line) => ({
      id: line.id,
      ax: line.anchorA.position.x,
      ay: line.anchorA.position.y,
      az: line.anchorA.position.z,
      bx: line.anchorB.position.x,
      by: line.anchorB.position.y,
      bz: line.anchorB.position.z,
      distance: line.distance,
    }))
    SessionStore.save({ roomDimensions: this.currentDims, measurements })
  }

  private _applyDefaultDimensions(): void {
    this.currentDims = { ...AppController.DEFAULT_DIMS }
    this.viewer.setDimensions(this.currentDims)
    this._updateSnapPoints()
    this.measurementTool.restoreLines(AppController.DEFAULT_MEASUREMENTS)
  }
}
