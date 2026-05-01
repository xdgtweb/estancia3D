import type { AppController } from '../AppController.js'

// ─── ProjectLoader ────────────────────────────────────────────────────────────

/**
 * Botón para cargar un archivo de proyecto JSON (.json) en la app.
 * Permite importar proyectos guardados como "Proyecto Baño".
 */
export class ProjectLoader {
  private container: HTMLElement
  private controller: AppController

  constructor(controller: AppController, container: HTMLElement) {
    this.controller = controller
    this.container = container
    this._build()
  }

  private _build(): void {
    const section = document.createElement('section')
    section.innerHTML = `
      <h3 style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.06em;opacity:0.6;margin-bottom:0.5rem;">
        Proyecto
      </h3>
    `

    // ── Info message ──────────────────────────────────────────────────────
    const info = document.createElement('div')
    info.style.cssText =
      'display:none;background:rgba(0,200,100,0.12);border:1px solid rgba(0,200,100,0.3);' +
      'border-radius:4px;padding:0.4rem 0.6rem;font-size:0.75rem;color:#00c864;margin-bottom:0.5rem;'
    section.appendChild(info)

    // ── Hidden file input ─────────────────────────────────────────────────
    const fileInput = document.createElement('input')
    fileInput.type = 'file'
    fileInput.accept = '.json'
    fileInput.style.display = 'none'
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)

          if (
            !data.roomDimensions ||
            typeof data.roomDimensions.width !== 'number' ||
            !Array.isArray(data.measurements)
          ) {
            throw new Error('Formato de proyecto no válido')
          }

          this.controller.loadProject(data)

          info.textContent = `✓ Proyecto "${data.nombre ?? file.name}" cargado`
          info.style.display = 'block'
          setTimeout(() => { info.style.display = 'none' }, 4000)
        } catch (err) {
          info.textContent = `✗ Error al cargar: ${(err as Error).message}`
          info.style.cssText = info.style.cssText.replace('rgba(0,200,100', 'rgba(255,80,80')
            .replace('#00c864', '#ff6b6b')
          info.style.display = 'block'
          setTimeout(() => { info.style.display = 'none' }, 4000)
        }
        // Reset input so the same file can be loaded again
        fileInput.value = ''
      }
      reader.readAsText(file)
    })
    section.appendChild(fileInput)

    // ── Load button ───────────────────────────────────────────────────────
    const loadBtn = document.createElement('button')
    loadBtn.className = 'btn-secondary'
    loadBtn.textContent = '📂 Cargar proyecto JSON'
    loadBtn.style.cssText = 'width:100%;'
    loadBtn.addEventListener('click', () => fileInput.click())
    section.appendChild(loadBtn)

    this.container.appendChild(section)
  }
}
