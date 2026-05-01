import type { AppController } from '../AppController.js'
import type { RoomDimensions } from '../types.js'

// ─── DimensionForm ────────────────────────────────────────────────────────────

/**
 * Formulario HTML con tres inputs numéricos (ancho, alto, profundidad) que
 * valida en tiempo real y delega en AppController.setRoomDimensions().
 *
 * Task 12.1 — Requirements: 1.2, 1.3, 1.4
 */
export class DimensionForm {
  private container: HTMLElement
  private controller: AppController

  // Input elements
  private widthInput!: HTMLInputElement
  private heightInput!: HTMLInputElement
  private depthInput!: HTMLInputElement

  // Error message elements
  private widthError!: HTMLElement
  private heightError!: HTMLElement
  private depthError!: HTMLElement

  // Warning banner element
  private warningBanner!: HTMLElement

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
        Dimensiones de la habitación
      </h3>
    `

    // Warning banner (hidden by default)
    this.warningBanner = document.createElement('div')
    this.warningBanner.style.cssText =
      'display:none;background:rgba(255,160,0,0.15);border:1px solid rgba(255,160,0,0.4);' +
      'border-radius:4px;padding:0.4rem 0.6rem;font-size:0.75rem;color:#ffa000;margin-bottom:0.5rem;'
    section.appendChild(this.warningBanner)

    // Build each field
    const fields: Array<{ key: keyof RoomDimensions; label: string; defaultValue: number }> = [
      { key: 'width',  label: 'Ancho (m)',       defaultValue: 5   },
      { key: 'height', label: 'Alto (m)',         defaultValue: 3   },
      { key: 'depth',  label: 'Profundidad (m)',  defaultValue: 2.5 },
    ]

    for (const field of fields) {
      const { inputEl, errorEl } = this._buildField(field.label, field.defaultValue)

      // Store references
      if (field.key === 'width')  { this.widthInput  = inputEl; this.widthError  = errorEl }
      if (field.key === 'height') { this.heightInput = inputEl; this.heightError = errorEl }
      if (field.key === 'depth')  { this.depthInput  = inputEl; this.depthError  = errorEl }

      // Attach change handler
      inputEl.addEventListener('change', () => this._handleChange())
      inputEl.addEventListener('input',  () => this._handleChange())

      const wrapper = document.createElement('div')
      wrapper.style.marginBottom = '0.5rem'
      const labelEl = document.createElement('label')
      labelEl.textContent = field.label
      labelEl.appendChild(inputEl)
      labelEl.appendChild(errorEl)
      wrapper.appendChild(labelEl)
      section.appendChild(wrapper)
    }

    this.container.appendChild(section)
  }

  private _buildField(
    _label: string,
    defaultValue: number,
  ): { inputEl: HTMLInputElement; errorEl: HTMLElement } {
    const inputEl = document.createElement('input')
    inputEl.type = 'number'
    inputEl.min = '0.01'
    inputEl.step = '0.01'
    inputEl.value = String(defaultValue)

    const errorEl = document.createElement('span')
    errorEl.className = 'error-message'
    errorEl.style.display = 'none'

    return { inputEl, errorEl }
  }

  // ── Private: handle input change ───────────────────────────────────────────

  private _handleChange(): void {
    const width  = parseFloat(this.widthInput.value)
    const height = parseFloat(this.heightInput.value)
    const depth  = parseFloat(this.depthInput.value)

    // Validate each field individually and show/hide error messages
    const widthOk  = this._validateField(width,  this.widthError)
    const heightOk = this._validateField(height, this.heightError)
    const depthOk  = this._validateField(depth,  this.depthError)

    if (!widthOk || !heightOk || !depthOk) return

    const dims: RoomDimensions = { width, height, depth }

    // Req. 1.4 — values > 100 require confirmation
    const anyOutOfRange = width > 100 || height > 100 || depth > 100
    if (anyOutOfRange) {
      const confirmed = confirm(
        `Una o más dimensiones superan los 100 m (ancho: ${width}, alto: ${height}, profundidad: ${depth}).\n` +
        '¿Desea aplicar estos valores de todas formas?',
      )
      if (!confirmed) return
    }

    this.controller.setRoomDimensions(dims)
  }

  /**
   * Validates a single numeric value.
   * Returns true if the value is valid (> 0 and not NaN).
   * Shows/hides the error element accordingly.
   * Note: values > 100 are handled separately with a confirm() dialog.
   */
  private _validateField(value: number, errorEl: HTMLElement): boolean {
    if (isNaN(value) || value <= 0) {
      errorEl.textContent = 'El valor debe ser un número positivo mayor que cero.'
      errorEl.style.display = 'block'
      return false
    }
    errorEl.style.display = 'none'
    errorEl.textContent = ''
    return true
  }

  // ── Private: listen to controller events ──────────────────────────────────

  private _bindControllerEvents(): void {
    // Req. 1.3 — dimension error event
    window.addEventListener('room:dimension-error', (e: Event) => {
      const detail = (e as CustomEvent).detail as { error: string }
      this._showWarning(`Error de dimensión: ${detail.error}. Las dimensiones deben ser valores positivos mayores que cero.`)
    })

    // Req. 1.4 — dimension warning event
    window.addEventListener('room:dimension-warning', (e: Event) => {
      const detail = (e as CustomEvent).detail as { error: string }
      this._showWarning(`Aviso: ${detail.error}. El valor está fuera del rango habitual (0–100 m).`)
    })
  }

  private _showWarning(message: string): void {
    this.warningBanner.textContent = message
    this.warningBanner.style.display = 'block'
    setTimeout(() => {
      this.warningBanner.style.display = 'none'
    }, 4000)
  }
}
