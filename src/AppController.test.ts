/**
 * Tests for AppController (task 11)
 *
 * Three.js requires WebGL which is not available in jsdom.
 * We reuse the same mocks as in RoomViewer.test.ts and MeasurementTool.test.ts.
 *
 * Requirements: 1.2, 6.1, 6.2, 6.3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('gsap', () => ({
  default: {
    to: vi.fn(),
  },
}))

vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(() => ({
    enableRotate: true,
    enableZoom: true,
    enablePan: true,
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}))

vi.mock('three/addons/renderers/CSS2DRenderer.js', () => {
  class CSS2DObject {
    element: HTMLElement
    position = { set: vi.fn() }
    constructor(el: HTMLElement) {
      this.element = el
    }
  }

  class CSS2DRenderer {
    domElement: HTMLElement
    constructor() {
      this.domElement = document.createElement('div')
      this.domElement.style.position = 'absolute'
    }
    setSize = vi.fn()
    render = vi.fn()
  }

  return { CSS2DObject, CSS2DRenderer }
})

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement
    constructor() {
      this.domElement = document.createElement('canvas')
      Object.defineProperty(this.domElement, 'width', { value: 800, configurable: true })
      Object.defineProperty(this.domElement, 'height', { value: 600, configurable: true })
      this.domElement.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
        right: 800,
        bottom: 600,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })
    }
    setPixelRatio = vi.fn()
    setSize = vi.fn()
    render = vi.fn()
    dispose = vi.fn()
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  }
})

// ─── Import after mocks ───────────────────────────────────────────────────────
import { AppController } from './AppController.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeContainer(): HTMLDivElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
  Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
  document.body.appendChild(container)
  return container
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AppController', () => {
  let container: HTMLDivElement
  let controller: AppController

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    container = makeContainer()
    controller = new AppController(container)
  })

  afterEach(() => {
    controller.dispose()
    document.body.removeChild(container)
    localStorage.clear()
  })

  // ── Initialisation ─────────────────────────────────────────────────────────

  it('loads default dimensions (2.5 × 2.4 × 1.6) — Proyecto Baño — when no session exists', () => {
    const dims = controller.getViewer().getDimensions()
    expect(dims.width).toBe(2.5)
    expect(dims.height).toBe(2.4)
    expect(dims.depth).toBe(1.6)
  })

  it('getViewer() returns a RoomViewer instance', () => {
    const viewer = controller.getViewer()
    expect(viewer).toBeDefined()
    expect(typeof viewer.setDimensions).toBe('function')
  })

  it('getMeasurementTool() returns a MeasurementTool instance', () => {
    const tool = controller.getMeasurementTool()
    expect(tool).toBeDefined()
    expect(typeof tool.setActive).toBe('function')
  })

  // ── setRoomDimensions ──────────────────────────────────────────────────────

  it('setRoomDimensions() with valid dims updates the viewer', () => {
    controller.setRoomDimensions({ width: 8, height: 4, depth: 6 })
    const dims = controller.getViewer().getDimensions()
    expect(dims.width).toBe(8)
    expect(dims.height).toBe(4)
    expect(dims.depth).toBe(6)
  })

  it('setRoomDimensions() with valid dims saves the session', () => {
    controller.setRoomDimensions({ width: 7, height: 3, depth: 5 })
    const raw = localStorage.getItem('room3d_session')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw!)
    expect(parsed.roomDimensions.width).toBe(7)
    expect(parsed.roomDimensions.height).toBe(3)
    expect(parsed.roomDimensions.depth).toBe(5)
  })

  it('setRoomDimensions() with non-positive value emits room:dimension-error', () => {
    const events: CustomEvent[] = []
    window.addEventListener('room:dimension-error', (e) => events.push(e as CustomEvent))

    controller.setRoomDimensions({ width: -1, height: 3, depth: 2.5 })

    expect(events).toHaveLength(1)
    expect(events[0].detail.error).toBe('non-positive')
    window.removeEventListener('room:dimension-error', (e) => events.push(e as CustomEvent))
  })

  it('setRoomDimensions() with non-positive value does NOT update viewer', () => {
    const dimsBefore = controller.getViewer().getDimensions()
    controller.setRoomDimensions({ width: 0, height: 3, depth: 2.5 })
    const dimsAfter = controller.getViewer().getDimensions()
    expect(dimsAfter.width).toBe(dimsBefore.width)
  })

  it('setRoomDimensions() with out-of-range value emits room:dimension-warning', () => {
    const events: CustomEvent[] = []
    const handler = (e: Event) => events.push(e as CustomEvent)
    window.addEventListener('room:dimension-warning', handler)

    controller.setRoomDimensions({ width: 200, height: 3, depth: 2.5 })

    expect(events).toHaveLength(1)
    expect(events[0].detail.error).toBe('out-of-range')
    window.removeEventListener('room:dimension-warning', handler)
  })

  it('setRoomDimensions() with out-of-range value does NOT update viewer', () => {
    const dimsBefore = controller.getViewer().getDimensions()
    controller.setRoomDimensions({ width: 150, height: 3, depth: 2.5 })
    const dimsAfter = controller.getViewer().getDimensions()
    expect(dimsAfter.width).toBe(dimsBefore.width)
  })

  it('setRoomDimensions() with NaN emits room:dimension-error (non-positive)', () => {
    const events: CustomEvent[] = []
    const handler = (e: Event) => events.push(e as CustomEvent)
    window.addEventListener('room:dimension-error', handler)

    controller.setRoomDimensions({ width: NaN, height: 3, depth: 2.5 })

    expect(events).toHaveLength(1)
    expect(events[0].detail.error).toBe('non-positive')
    window.removeEventListener('room:dimension-error', handler)
  })

  // ── activateMeasurementTool / deactivateMeasurementTool ───────────────────

  it('activateMeasurementTool() activates the tool (pointer events are processed)', () => {
    controller.activateMeasurementTool()
    const tool = controller.getMeasurementTool()
    // When active, handlePointerDown should not throw
    const event = { clientX: 400, clientY: 300 } as PointerEvent
    expect(() => tool.handlePointerDown(event)).not.toThrow()
  })

  it('deactivateMeasurementTool() deactivates the tool', () => {
    controller.activateMeasurementTool()
    controller.deactivateMeasurementTool()
    const tool = controller.getMeasurementTool()
    const linesBefore = tool.getLines().length
    // When inactive, handlePointerDown should not place any new anchor
    const event = { clientX: 400, clientY: 300 } as PointerEvent
    tool.handlePointerDown(event)
    // No new lines should have been added (tool is inactive)
    expect(tool.getLines()).toHaveLength(linesBefore)
  })

  // ── exportJSON / exportCSV ─────────────────────────────────────────────────

  it('exportJSON() emits export:no-measurements when no lines exist', () => {
    // Clear all default lines first
    const tool = controller.getMeasurementTool()
    for (const line of tool.getLines()) {
      tool.deleteLine(line.id)
    }

    const events: CustomEvent[] = []
    const handler = (e: Event) => events.push(e as CustomEvent)
    window.addEventListener('export:no-measurements', handler)

    controller.exportJSON()

    expect(events).toHaveLength(1)
    window.removeEventListener('export:no-measurements', handler)
  })

  it('exportCSV() emits export:no-measurements when no lines exist', () => {
    // Clear all default lines first
    const tool = controller.getMeasurementTool()
    for (const line of tool.getLines()) {
      tool.deleteLine(line.id)
    }

    const events: CustomEvent[] = []
    const handler = (e: Event) => events.push(e as CustomEvent)
    window.addEventListener('export:no-measurements', handler)

    controller.exportCSV()

    expect(events).toHaveLength(1)
    window.removeEventListener('export:no-measurements', handler)
  })

  // ── resetSession ───────────────────────────────────────────────────────────

  it('resetSession() clears localStorage', () => {
    // First save something
    controller.setRoomDimensions({ width: 8, height: 4, depth: 6 })
    expect(localStorage.getItem('room3d_session')).not.toBeNull()

    controller.resetSession()

    expect(localStorage.getItem('room3d_session')).toBeNull()
  })

  it('resetSession() restores Proyecto Baño defaults (2.5 × 2.4 × 1.6)', () => {
    controller.setRoomDimensions({ width: 8, height: 4, depth: 6 })
    controller.resetSession()

    const dims = controller.getViewer().getDimensions()
    expect(dims.width).toBe(2.5)
    expect(dims.height).toBe(2.4)
    expect(dims.depth).toBe(1.6)
  })

  it('resetSession() removes all active measurement lines and reloads Proyecto Baño defaults', () => {
    // Add extra lines on top of the default ones
    const tool = controller.getMeasurementTool()
    tool.restoreLines([
      { id: 'l1', ax: 0, ay: 0, az: 0, bx: 1, by: 0, bz: 0, distance: 1.0 },
      { id: 'l2', ax: 0, ay: 0, az: 0, bx: 0, by: 1, bz: 0, distance: 1.0 },
    ])
    // After reset, only the 7 default Proyecto Baño lines should remain
    controller.resetSession()
    expect(tool.getLines()).toHaveLength(7)
  })

  // ── Session restore ────────────────────────────────────────────────────────

  it('restores dimensions from a saved session on construction', () => {
    // Save a session manually
    localStorage.setItem(
      'room3d_session',
      JSON.stringify({
        roomDimensions: { width: 10, height: 5, depth: 8 },
        measurements: [],
      }),
    )

    // Create a new controller — it should restore the session
    const container2 = makeContainer()
    const controller2 = new AppController(container2)

    const dims = controller2.getViewer().getDimensions()
    expect(dims.width).toBe(10)
    expect(dims.height).toBe(5)
    expect(dims.depth).toBe(8)

    controller2.dispose()
    document.body.removeChild(container2)
  })

  it('restores measurement lines from a saved session on construction', () => {
    localStorage.setItem(
      'room3d_session',
      JSON.stringify({
        roomDimensions: { width: 5, height: 3, depth: 2.5 },
        measurements: [
          { id: 'm1', ax: 0, ay: 0, az: 0, bx: 1, by: 0, bz: 0, distance: 1.0 },
          { id: 'm2', ax: 0, ay: 0, az: 0, bx: 0, by: 1, bz: 0, distance: 1.0 },
        ],
      }),
    )

    const container2 = makeContainer()
    const controller2 = new AppController(container2)

    const lines = controller2.getMeasurementTool().getLines()
    expect(lines).toHaveLength(2)
    expect(lines.map((l) => l.id)).toContain('m1')
    expect(lines.map((l) => l.id)).toContain('m2')

    controller2.dispose()
    document.body.removeChild(container2)
  })

  // ── dispose ────────────────────────────────────────────────────────────────

  it('dispose() does not throw', () => {
    expect(() => controller.dispose()).not.toThrow()
    // Re-create to allow afterEach to call dispose again safely
    controller = new AppController(container)
  })
})
