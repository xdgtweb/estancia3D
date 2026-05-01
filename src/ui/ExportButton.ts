import type { AppController } from '../AppController.js'

// ─── ExportButton ─────────────────────────────────────────────────────────────

/**
 * Dos botones de exportación (JSON y CSV) que delegan en AppController.
 * Muestra un mensaje informativo temporal cuando no hay mediciones activas.
 *
 * Task 12.3 — Requirements: 5.1, 5.2, 5.3
 */
export class ExportButton {
  private container: HTMLElement
  private controller: AppController

  private infoMessage!: HTMLElement

  constructor(controller: AppController, container: HTMLElement) {
    this.controller = controller
    this.container = container
    this._build()
    this._bindControllerEvents()
  }

  // ── Private: build DOM ─────────────────────────────────────────────────────

  private _build(): void {
    const section = document.createElement('section')
    section.innerHTML = `
      <h3 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;opacity:0.6;margin-bottom:0.5rem;">
        Exportar mediciones
      </h3>
    `

    // ── Info message (hidden by default) ──────────────────────────────────
    this.infoMessage = document.createElement('div')
    this.infoMessage.style.cssText =
      'display:none;background:rgba(0,120,255,0.12);border:1px solid rgba(0,120,255,0.3);' +
      'border-radius:4px;padding:0.4rem 0.6rem;font-size:0.75rem;color:#60a0ff;margin-bottom:0.5rem;'
    this.infoMessage.textContent = 'No hay medidas disponibles para exportar.'
    section.appendChild(this.infoMessage)

    // ── Export JSON button ─────────────────────────────────────────────────
    const jsonBtn = document.createElement('button')
    jsonBtn.className = 'btn-secondary'
    jsonBtn.textContent = 'Exportar JSON'
    jsonBtn.style.cssText = 'width:100%;margin-bottom:0.4rem;'
    jsonBtn.addEventListener('click', () => this.controller.exportJSON())
    section.appendChild(jsonBtn)

    // ── Export CSV button ──────────────────────────────────────────────────
    const csvBtn = document.createElement('button')
    csvBtn.className = 'btn-secondary'
    csvBtn.textContent = 'Exportar CSV'
    csvBtn.style.cssText = 'width:100%;'
    csvBtn.addEventListener('click', () => this.controller.exportCSV())
    section.appendChild(csvBtn)

    this.container.appendChild(section)
  }

  // ── Private: listen to controller events ──────────────────────────────────

  private _bindControllerEvents(): void {
    // Req. 5.3 — show informative message when no measurements are available
    window.addEventListener('export:no-measurements', () => {
      this._showInfo()
    })
  }

  private _showInfo(): void {
    this.infoMessage.style.display = 'block'
    setTimeout(() => {
      this.infoMessage.style.display = 'none'
    }, 3000)
  }
}
