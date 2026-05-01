/**
 * Tests for MeasurementTool (tasks 10.1, 10.2)
 *
 * Three.js requires WebGL which is not available in jsdom.
 * We mock WebGLRenderer, CSS2DRenderer and CSS2DObject the same way
 * as in RoomViewer.test.ts so the tests can run in a Node/jsdom environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

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
      // Give the canvas a size so getBoundingClientRect works
      Object.defineProperty(this.domElement, 'width', { value: 800, configurable: true })
      Object.defineProperty(this.domElement, 'height', { value: 600, configurable: true })
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
import * as THREE from 'three'
import { MeasurementTool } from './MeasurementTool.js'
import { SnapPointCalculator } from './SnapPointCalculator.js'
import type { SerializedMeasurementLine } from '../types.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeScene(): THREE.Scene {
  return new THREE.Scene()
}

function makeCamera(): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(60, 800 / 600, 0.01, 1000)
  cam.position.set(0, 5, 10)
  cam.lookAt(0, 0, 0)
  return cam
}

function makeRenderer(): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer()
  // Ensure getBoundingClientRect returns a usable rect
  r.domElement.getBoundingClientRect = () => ({
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
  return r
}

function makeSerializedLine(id: string): SerializedMeasurementLine {
  return { id, ax: 0, ay: 0, az: 0, bx: 1, by: 0, bz: 0, distance: 1.0 }
}

function makeTool(): MeasurementTool {
  const scene = makeScene()
  const camera = makeCamera()
  const renderer = makeRenderer()
  const snapCalc = new SnapPointCalculator()
  const snapPoints = snapCalc.compute({ width: 5, height: 3, depth: 2.5 })
  return new MeasurementTool(
    scene,
    camera,
    renderer,
    () => [],
    snapCalc,
    snapPoints,
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MeasurementTool', () => {
  let tool: MeasurementTool

  beforeEach(() => {
    tool = makeTool()
  })

  afterEach(() => {
    tool.dispose()
  })

  // ── getLines ───────────────────────────────────────────────────────────────

  it('getLines() returns an empty array initially', () => {
    expect(tool.getLines()).toEqual([])
  })

  it('getLines() returns a copy, not the internal array', () => {
    const a = tool.getLines()
    const b = tool.getLines()
    expect(a).not.toBe(b)
  })

  // ── restoreLines ───────────────────────────────────────────────────────────

  it('getLines().length === N after restoreLines with N items', () => {
    const data: SerializedMeasurementLine[] = [
      makeSerializedLine('line_1'),
      makeSerializedLine('line_2'),
      makeSerializedLine('line_3'),
    ]
    tool.restoreLines(data)
    expect(tool.getLines()).toHaveLength(3)
  })

  it('restoreLines creates lines with correct ids', () => {
    const data: SerializedMeasurementLine[] = [
      makeSerializedLine('m_abc'),
      makeSerializedLine('m_xyz'),
    ]
    tool.restoreLines(data)
    const ids = tool.getLines().map((l) => l.id)
    expect(ids).toContain('m_abc')
    expect(ids).toContain('m_xyz')
  })

  it('restoreLines creates lines with correct distance', () => {
    const data: SerializedMeasurementLine[] = [
      { id: 'l1', ax: 0, ay: 0, az: 0, bx: 3, by: 4, bz: 0, distance: 5.0 },
    ]
    tool.restoreLines(data)
    expect(tool.getLines()[0].distance).toBe(5.0)
  })

  it('restoreLines labels have class "measurement-label"', () => {
    tool.restoreLines([makeSerializedLine('l1')])
    const line = tool.getLines()[0]
    // label.element is the div we created
    const el = (line.label as unknown as { element: HTMLElement }).element
    expect(el.classList.contains('measurement-label')).toBe(true)
  })

  it('restoreLines labels do NOT have class "permanent-label"', () => {
    tool.restoreLines([makeSerializedLine('l1')])
    const line = tool.getLines()[0]
    const el = (line.label as unknown as { element: HTMLElement }).element
    expect(el.classList.contains('permanent-label')).toBe(false)
  })

  // ── deleteLine ─────────────────────────────────────────────────────────────

  it('deleteLine(id) removes the correct line and reduces length by 1', () => {
    const data: SerializedMeasurementLine[] = [
      makeSerializedLine('line_A'),
      makeSerializedLine('line_B'),
      makeSerializedLine('line_C'),
    ]
    tool.restoreLines(data)
    expect(tool.getLines()).toHaveLength(3)

    tool.deleteLine('line_B')

    const remaining = tool.getLines()
    expect(remaining).toHaveLength(2)
    expect(remaining.map((l) => l.id)).not.toContain('line_B')
  })

  it('deleteLine(id) keeps the other lines intact', () => {
    tool.restoreLines([makeSerializedLine('l1'), makeSerializedLine('l2')])
    tool.deleteLine('l1')
    const remaining = tool.getLines()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('l2')
  })

  it('deleteLine with unknown id does nothing', () => {
    tool.restoreLines([makeSerializedLine('l1')])
    tool.deleteLine('nonexistent')
    expect(tool.getLines()).toHaveLength(1)
  })

  // ── setActive / handlePointerDown ──────────────────────────────────────────

  it('setActive(false) makes handlePointerDown ignore events (no anchors placed)', () => {
    tool.setActive(false)

    // Even if we call handlePointerDown, the tool is inactive so nothing happens.
    // We verify by checking that no pending anchor is created and getLines stays empty.
    // jsdom does not have PointerEvent, so we cast a plain object.
    const event = { clientX: 400, clientY: 300 } as PointerEvent
    tool.handlePointerDown(event)

    // getLines() should still be empty (no line was completed)
    expect(tool.getLines()).toHaveLength(0)
  })

  it('setActive(true) then setActive(false) resets active state', () => {
    tool.setActive(true)
    tool.setActive(false)

    const event = { clientX: 400, clientY: 300 } as PointerEvent
    tool.handlePointerDown(event)

    expect(tool.getLines()).toHaveLength(0)
  })

  // ── handlePointerMove ──────────────────────────────────────────────────────

  it('handlePointerMove does nothing when tool is inactive', () => {
    tool.setActive(false)
    // Should not throw
    const event = { clientX: 400, clientY: 300 } as PointerEvent
    expect(() => tool.handlePointerMove(event)).not.toThrow()
  })

  it('handlePointerMove does not throw when tool is active', () => {
    tool.setActive(true)
    const event = { clientX: 400, clientY: 300 } as PointerEvent
    expect(() => tool.handlePointerMove(event)).not.toThrow()
  })

  // ── keydown Delete ─────────────────────────────────────────────────────────

  it('pressing Delete removes the selected line', () => {
    tool.restoreLines([makeSerializedLine('l1'), makeSerializedLine('l2')])

    // Manually set selectedLineId via the internal mechanism
    // We expose it indirectly: select l1 by simulating a keydown after setting selection
    // Since updateSelectedLine requires raycasting (not available in jsdom), we test
    // the keydown path by directly accessing the private field via type assertion.
    ;(tool as unknown as { selectedLineId: string | null }).selectedLineId = 'l1'

    const keyEvent = new KeyboardEvent('keydown', { key: 'Delete' })
    window.dispatchEvent(keyEvent)

    expect(tool.getLines()).toHaveLength(1)
    expect(tool.getLines()[0].id).toBe('l2')
  })

  it('pressing Supr removes the selected line', () => {
    tool.restoreLines([makeSerializedLine('l1')])
    ;(tool as unknown as { selectedLineId: string | null }).selectedLineId = 'l1'

    const keyEvent = new KeyboardEvent('keydown', { key: 'Supr' })
    window.dispatchEvent(keyEvent)

    expect(tool.getLines()).toHaveLength(0)
  })

  it('pressing Delete when no line is selected does nothing', () => {
    tool.restoreLines([makeSerializedLine('l1')])
    ;(tool as unknown as { selectedLineId: string | null }).selectedLineId = null

    const keyEvent = new KeyboardEvent('keydown', { key: 'Delete' })
    window.dispatchEvent(keyEvent)

    expect(tool.getLines()).toHaveLength(1)
  })
})
