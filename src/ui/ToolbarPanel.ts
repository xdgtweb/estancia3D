import type { AppController } from '../AppController.js'

// ─── ToolbarPanel ─────────────────────────────────────────────────────────────

/**
 * Panel con botón de activación/desactivación de la herramienta de medición
 * y botón de restablecimiento de sesión.
 *
 * Task 12.2 — Requirements: 3.1, 6.3
 */
export class ToolbarPanel {
  private container: HTMLElement
  private controller: AppController

  private measureBtn!: HTMLButtonElement
  private isMeasurementActive = false

  constructor(controller: AppController, container: HTMLElement) {
    this.controller = controller
    this.container = container
    this._build()
  }

  // ── Private: build DOM ─────────────────────────────────────────────────────

  private _build(): void {
    const section = document.createElement('section')
    section.innerHTML = `
      <h3 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;opacity:0.6;margin-bottom:0.5rem;">
        Herramientas
      </h3>
    `

    // ── Measurement toggle button ──────────────────────────────────────────
    this.measureBtn = document.createElement('button')
    this.measureBtn.className = 'btn-primary'
    this.measureBtn.textContent = 'Activar medición'
    this.measureBtn.style.cssText = 'width:100%;margin-bottom:0.5rem;'
    this.measureBtn.addEventListener('click', () => this._toggleMeasurement())
    section.appendChild(this.measureBtn)

    // ── Reset session button ───────────────────────────────────────────────
    const resetBtn = document.createElement('button')
    resetBtn.className = 'btn-danger'
    resetBtn.textContent = 'Restablecer sesión'
    resetBtn.style.cssText = 'width:100%;'
    resetBtn.addEventListener('click', () => this._handleReset())
    section.appendChild(resetBtn)

    this.container.appendChild(section)
  }

  // ── Private: handlers ──────────────────────────────────────────────────────

  private _toggleMeasurement(): void {
    this.isMeasurementActive = !this.isMeasurementActive

    if (this.isMeasurementActive) {
      this.measureBtn.className = 'btn-primary active'
      this.measureBtn.textContent = 'Desactivar medición'
      this.controller.activateMeasurementTool()
    } else {
      this.measureBtn.className = 'btn-primary'
      this.measureBtn.textContent = 'Activar medición'
      this.controller.deactivateMeasurementTool()
    }
  }

  private _handleReset(): void {
    const confirmed = confirm(
      '¿Desea restablecer la sesión?\n' +
      'Se eliminarán todas las mediciones y se cargará la configuración por defecto (5 × 3 × 2,5 m).',
    )
    if (!confirmed) return

    this.controller.resetSession()

    // Reset measurement button state
    this.isMeasurementActive = false
    this.measureBtn.className = 'btn-primary'
    this.measureBtn.textContent = 'Activar medición'
  }
}
