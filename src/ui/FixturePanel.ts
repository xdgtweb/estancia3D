import type { AppController } from '../AppController.js'
import type { FixtureId } from '../viewer/BathroomFixtures.js'

export class FixturePanel {
  private container: HTMLElement
  private controller: AppController
  private buttons: Map<FixtureId, HTMLButtonElement> = new Map()

  constructor(controller: AppController, container: HTMLElement) {
    this.controller = controller
    this.container = container
    this._build()
  }

  private _build(): void {
    const section = document.createElement('section')
    section.innerHTML = `
      <h3 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;opacity:0.6;margin-bottom:0.5rem;">
        Elementos del baño
      </h3>
    `

    // ── Botones de elementos ──────────────────────────────────────────────────
    const fixtures: Array<{ id: FixtureId; label: string }> = [
      { id: 'shower', label: '🚿 Ducha' },
      { id: 'toilet', label: '🚽 Inodoro' },
      { id: 'bidet',  label: '🚿 Bidé' },
      { id: 'sink',   label: '🚰 Lavabo' },
      { id: 'door',   label: '🚪 Puerta' },
    ]

    const grid = document.createElement('div')
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;'

    for (const { id, label } of fixtures) {
      const btn = document.createElement('button')
      btn.className = 'btn-fixture active'
      btn.textContent = label
      btn.addEventListener('click', () => this._toggle(id, btn))
      this.buttons.set(id, btn)
      grid.appendChild(btn)
    }
    section.appendChild(grid)

    // ── Ocultar/mostrar todos los elementos ───────────────────────────────────
    const allRow = document.createElement('div')
    allRow.style.cssText = 'display:flex;gap:0.4rem;margin-top:0.5rem;'

    const hideAllBtn = document.createElement('button')
    hideAllBtn.className = 'btn-secondary'
    hideAllBtn.textContent = 'Ocultar todo'
    hideAllBtn.style.flex = '1'
    hideAllBtn.addEventListener('click', () => this._setAll(false))

    const showAllBtn = document.createElement('button')
    showAllBtn.className = 'btn-secondary'
    showAllBtn.textContent = 'Mostrar todo'
    showAllBtn.style.flex = '1'
    showAllBtn.addEventListener('click', () => this._setAll(true))

    allRow.appendChild(hideAllBtn)
    allRow.appendChild(showAllBtn)
    section.appendChild(allRow)

    // ── Separador ─────────────────────────────────────────────────────────────
    const sep = document.createElement('div')
    sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.1);margin-top:0.75rem;padding-top:0.5rem;'
    sep.innerHTML = '<span style="font-size:0.75rem;opacity:0.5;text-transform:uppercase;letter-spacing:0.05em;">Visibilidad de textos</span>'
    section.appendChild(sep)

    // ── Botón: ocultar textos (W/H/D azules + líneas de medición naranjas) ────
    const namesBtn = document.createElement('button')
    namesBtn.className = 'btn-secondary'
    namesBtn.textContent = '🏷️ Ocultar textos (W/H/D)'
    namesBtn.style.cssText = 'width:100%;margin-top:0.4rem;'
    let namesVisible = true
    namesBtn.addEventListener('click', () => {
      namesVisible = !namesVisible
      this.controller.getViewer().setPipeLabelsVisible(namesVisible)
      namesBtn.textContent = namesVisible ? '🏷️ Ocultar textos (W/H/D)' : '🏷️ Mostrar textos (W/H/D)'
    })
    section.appendChild(namesBtn)

    // ── Botón: ocultar medidas (60cm, 70cm raíl, desagüe...) ─────────────────
    const measBtn = document.createElement('button')
    measBtn.className = 'btn-secondary'
    measBtn.textContent = '📐 Ocultar medidas (cm)'
    measBtn.style.cssText = 'width:100%;margin-top:0.4rem;'
    let measVisible = true
    measBtn.addEventListener('click', () => {
      measVisible = !measVisible
      this.controller.getViewer().setMeasurementLabelsVisible(measVisible)
      measBtn.textContent = measVisible ? '📐 Ocultar medidas (cm)' : '📐 Mostrar medidas (cm)'
    })
    section.appendChild(measBtn)

    this.container.appendChild(section)
  }

  private _toggle(id: FixtureId, btn: HTMLButtonElement): void {
    const viewer = this.controller.getViewer()
    const isVisible = viewer.isFixtureVisible(id)
    viewer.setFixtureVisible(id, !isVisible)
    btn.classList.toggle('active', !isVisible)
  }

  private _setAll(visible: boolean): void {
    const viewer = this.controller.getViewer()
    for (const [id, btn] of this.buttons) {
      viewer.setFixtureVisible(id, visible)
      btn.classList.toggle('active', visible)
    }
  }
}
