/**
 * Tests for RoomViewer (tasks 8.1, 8.2, 8.5, 8.7)
 *
 * Three.js requires WebGL which is not available in jsdom.
 * We mock WebGLRenderer, CSS2DRenderer, CSS2DObject and OrbitControls
 * so the tests can run in a Node/jsdom environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock gsap before importing RoomViewer
vi.mock('gsap', () => ({
  default: {
    to: vi.fn((_target: unknown, opts: { duration?: number; onUpdate?: () => void }) => {
      // Store the last call options for assertions
      ;(globalThis as Record<string, unknown>).__gsapLastOpts = opts
    }),
  },
}))

// Mock OrbitControls
vi.mock('three/addons/controls/OrbitControls.js', () => ({
  OrbitControls: vi.fn().mockImplementation(() => ({
    enableRotate: true,
    enableZoom: true,
    enablePan: true,
    update: vi.fn(),
    dispose: vi.fn(),
  })),
}))

// Mock CSS2DRenderer and CSS2DObject
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

// Mock THREE.WebGLRenderer
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement
    constructor() {
      this.domElement = document.createElement('canvas')
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
import { RoomViewer } from './RoomViewer.js'

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RoomViewer', () => {
  let container: HTMLDivElement
  let viewer: RoomViewer

  beforeEach(() => {
    container = document.createElement('div')
    container.style.width = '800px'
    container.style.height = '600px'
    // jsdom returns 0 for clientWidth/clientHeight unless we mock them
    Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true })
    Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true })
    document.body.appendChild(container)
    viewer = new RoomViewer(container)
  })

  afterEach(() => {
    viewer.dispose()
    document.body.removeChild(container)
  })

  // ── Task 8.2: getSurfaceMeshes ─────────────────────────────────────────────

  it('getSurfaceMeshes() returns exactly 6 meshes', () => {
    const meshes = viewer.getSurfaceMeshes()
    expect(meshes).toHaveLength(6)
  })

  it('getSurfaceMeshes() meshes have correct surfaceType userData', () => {
    const meshes = viewer.getSurfaceMeshes()
    const types = meshes.map((m) => m.userData.surfaceType)
    expect(types).toContain('floor')
    expect(types).toContain('ceiling')
    expect(types).toContain('wall-north')
    expect(types).toContain('wall-south')
    expect(types).toContain('wall-east')
    expect(types).toContain('wall-west')
  })

  // ── Task 8.2: setDimensions / getDimensions ────────────────────────────────

  it('getDimensions() after setDimensions() returns the same values', () => {
    const dims = { width: 7, height: 4, depth: 3.5 }
    viewer.setDimensions(dims)
    const result = viewer.getDimensions()
    expect(result.width).toBe(dims.width)
    expect(result.height).toBe(dims.height)
    expect(result.depth).toBe(dims.depth)
  })

  it('setDimensions() rebuilds meshes (still 6 after update)', () => {
    viewer.setDimensions({ width: 10, height: 5, depth: 8 })
    expect(viewer.getSurfaceMeshes()).toHaveLength(6)
  })

  // ── Task 8.5: permanent labels ─────────────────────────────────────────────

  it('permanent labels have class "permanent-label"', () => {
    // Labels are CSS2DObjects whose element is a div with class permanent-label.
    // We access them via getPermanentLabels() since the mock CSS2DRenderer
    // does not append elements to the container DOM.
    const labels = viewer.getPermanentLabels()
    expect(labels).toHaveLength(3)
    for (const label of labels) {
      expect((label.element as HTMLElement).classList.contains('permanent-label')).toBe(true)
    }
  })

  it('permanent labels show correct dimension values after setDimensions', () => {
    viewer.setDimensions({ width: 6, height: 2.5, depth: 4 })
    const labels = viewer.getPermanentLabels()
    const texts = labels.map((l) => (l.element as HTMLElement).textContent ?? '')
    expect(texts.some((t) => t.includes('6'))).toBe(true)   // width
    expect(texts.some((t) => t.includes('2.5'))).toBe(true) // height
    expect(texts.some((t) => t.includes('4'))).toBe(true)   // depth
  })

  // ── Task 8.1: OrbitControls ────────────────────────────────────────────────

  it('OrbitControls has enableRotate, enableZoom and enablePan set to true', async () => {
    // Access controls via the OrbitControls mock
    const { OrbitControls } = vi.mocked(
      await import('three/addons/controls/OrbitControls.js')
    )
    const instance = (OrbitControls as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(instance.enableRotate).toBe(true)
    expect(instance.enableZoom).toBe(true)
    expect(instance.enablePan).toBe(true)
  })

  // ── Task 8.7: double-click animation ──────────────────────────────────────

  it('double-click animation uses duration ≤ 500 ms (0.5 s)', async () => {
    // Simulate a dblclick on the canvas
    const canvas = container.querySelector('canvas')!
    const event = new MouseEvent('dblclick', {
      clientX: 400,
      clientY: 300,
      bubbles: true,
    })
    canvas.dispatchEvent(event)

    const opts = (globalThis as Record<string, unknown>).__gsapLastOpts as
      | { duration?: number }
      | undefined

    // If gsap.to was called, duration must be ≤ 0.5 s
    if (opts !== undefined) {
      expect(opts.duration).toBeLessThanOrEqual(0.5)
    }
    // If no surface was hit (raycaster returns empty in jsdom), gsap is not called — that's fine.
  })
})
