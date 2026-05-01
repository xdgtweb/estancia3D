import './styles.css'
import { AppController } from './AppController.js'
import { DimensionForm } from './ui/DimensionForm.js'
import { ToolbarPanel } from './ui/ToolbarPanel.js'
import { ExportButton } from './ui/ExportButton.js'
import { ProjectLoader } from './ui/ProjectLoader.js'
import { FixturePanel } from './ui/FixturePanel.js'

// ─── Bootstrap ────────────────────────────────────────────────────────────────

const canvasContainer = document.querySelector<HTMLDivElement>('#canvas-container')!
const controller = new AppController(canvasContainer)
const controlsPanel = document.querySelector<HTMLDivElement>('#controls-panel')!

// Mount UI components
new ProjectLoader(controller, controlsPanel)
new FixturePanel(controller, controlsPanel)
new DimensionForm(controller, controlsPanel)
new ToolbarPanel(controller, controlsPanel)
new ExportButton(controller, controlsPanel)

// ─── Mobile panel toggle ──────────────────────────────────────────────────────
const panelToggle = document.querySelector<HTMLButtonElement>('#panel-toggle')!
let panelOpen = false

panelToggle.addEventListener('click', () => {
  panelOpen = !panelOpen
  controlsPanel.classList.toggle('open', panelOpen)
  panelToggle.textContent = panelOpen ? '✕' : '⚙️'
  panelToggle.setAttribute('aria-label', panelOpen ? 'Cerrar panel' : 'Abrir panel de controles')
})

// Close panel when tapping outside on mobile
document.addEventListener('pointerdown', (e) => {
  if (panelOpen && !controlsPanel.contains(e.target as Node) && e.target !== panelToggle) {
    panelOpen = false
    controlsPanel.classList.remove('open')
    panelToggle.textContent = '⚙️'
  }
})

// ─── Canvas pointer listeners ─────────────────────────────────────────────────
const measurementTool = controller.getMeasurementTool()

const canvas = canvasContainer.querySelector('canvas')
if (canvas) {
  canvas.addEventListener('pointerdown', (event: PointerEvent) => {
    measurementTool.updateSelectedLine(event)
    measurementTool.handlePointerDown(event)
  })
  canvas.addEventListener('pointermove', (event: PointerEvent) => {
    measurementTool.handlePointerMove(event)
  })
} else {
  const observer = new MutationObserver(() => {
    const c = canvasContainer.querySelector('canvas')
    if (c) {
      observer.disconnect()
      c.addEventListener('pointerdown', (event: PointerEvent) => {
        measurementTool.updateSelectedLine(event)
        measurementTool.handlePointerDown(event)
      })
      c.addEventListener('pointermove', (event: PointerEvent) => {
        measurementTool.handlePointerMove(event)
      })
    }
  })
  observer.observe(canvasContainer, { childList: true, subtree: true })
}
