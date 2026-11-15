import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { PropEditor as PropertyEditor } from 'ui-common'
import NumValue from '../../comp-misc/NumValue.jsx'
import ConfigAll from '../data/ConfigAll'
import { Menu, RefreshIcon, SegmentedControl } from '../localReactCompMisc'
import MapBlockPropEditorPopup from './MapBlockPropEditorPopup.jsx'
import { chooseAnchoredPopupPos, rectFromViewportSize } from '../utils/popupPlacement'
import {
  createPrefectureSelectorStore,
  type EditMultiSelectIncludeMode,
  type GridDisplayRangeKey,
  type MapObjDataFormat,
  type EditDragType,
  type EditSelectionMode,
  type PrefectureSelectorEventData,
  type PrefectureSelectorEventType,
  type PrefectureSelectorMode,
  type PrefectureSelectorStore,
  type RectEdge,
  type SelectionOperation,
} from './storePrefectureSelector'
import type {
  GridBoxRange,
  GridCell,
  GridRectRange,
  TileGridMapComponent,
  TileGridMapData,
  TileGridMapGroupComponent,
} from './PrefectureSelectorConfig'
import './PrefectureSelectorEl.css'

type EditDragState = {
  isDragging: boolean
  dragType: EditDragType | null
  resize: {
    componentId: string | null
    edge: RectEdge | null
    gridLine: number | null
    isDropValid: boolean
  }
  move: {
    componentId: string | null
    pointerGridRow: number | null
    pointerGridCol: number | null
    pointerOffsetRow: number | null
    pointerOffsetCol: number | null
    originalRange: GridRectRange | null
    candidateRange: GridRectRange | null
    isDropValid: boolean
  }
}

type EditMultiSelectionState = {
  selectedComponentIds: Set<string>
  rectDrag: {
    isDragging: boolean
    candidateBox: GridBoxRange | null
    includeMode: EditMultiSelectIncludeMode | null
  }
  move: {
    isDragging: boolean
    candidateBoundingRange: GridRectRange | null
    isDropValid: boolean
  }
}

type PendingSelectGesture = {
  pointerId: number
  componentId: string | null
  isSelectedComponent: boolean
  operation: SelectionOperation
  startClientX: number
  startClientY: number
  startGridPoint: { pointerGridRow: number; pointerGridCol: number }
  dragType: 'rect' | 'move' | null
  isActive: boolean
}

type PendingEditMultiSelectGesture = {
  pointerId: number
  operation: SelectionOperation
  startClientX: number
  startClientY: number
  startGridPoint: { pointerGridRow: number; pointerGridCol: number }
  isActive: boolean
}

type PrefectureSelectorRenderConfig = {
  mode: PrefectureSelectorMode
  selectedBlockIds: Set<string>
  selectedGroupIds: Set<string>
  selectedBlockIdsFinal: Set<string>
  disabledComponentIds?: Set<string>
  cellAspectRatio?: {
    width: number
    height: number
  }
  backgroundColor?: string
  mapWidthMax?: number
  renderComponentLabel?: (component: TileGridMapComponent) => ReactNode
  selectRectDrag: EditMultiSelectionState['rectDrag']
  selectMove?: EditMultiSelectionState['move']
  isSelectMoveEnabled?: boolean
  editSelectionMode: EditSelectionMode
  editSelectedComponentId: string | null
  editDrag: EditDragState
  editMultiSelection: EditMultiSelectionState
}

type PrefectureSelectorRenderProps = {
  data: TileGridMapData
  config: PrefectureSelectorRenderConfig
  onEvent: (eventType: PrefectureSelectorEventType, eventData: PrefectureSelectorEventData) => unknown
  onComponentContextMenu: (component: TileGridMapComponent, event: ReactMouseEvent<HTMLButtonElement>) => void
  onComponentDoubleClick: (component: TileGridMapComponent, event: ReactMouseEvent<HTMLButtonElement>) => void
}

type PrefectureSelectorHeaderData = {
  modeOptions: typeof modeOptions
}

type PrefectureSelectorHeaderConfig = {
  mode: PrefectureSelectorMode
}

type PrefectureSelectorHeaderProps = {
  data: PrefectureSelectorHeaderData
  config: PrefectureSelectorHeaderConfig
  onEvent: (eventType: PrefectureSelectorEventType, eventData: PrefectureSelectorEventData) => unknown
  eyebrow?: string
  title?: string
  onJsonOpen: () => void
}

const groupColorByIndex = ['teal', 'yellow', 'coral', 'pink', 'violet', 'indigo'] as const
const modeOptions = [
  { value: 'display', label: 'Display' },
  { value: 'select', label: 'Select' },
  { value: 'edit', label: 'Edit' },
]
const mapObjDataFormatOptions = [
  { value: 'tight', label: 'Tight' },
  { value: 'pretty', label: 'Pretty' },
]
const selectGestureDragThresholdPx = 4
const selectMoveEmpty = {
  isDragging: false,
  candidateBoundingRange: null,
  isDropValid: true,
}
const MapBlockPropEditorPopupTyped = MapBlockPropEditorPopup as ComponentType<{ store: PrefectureSelectorStore }>

function isRectRange(range: GridRectRange | readonly GridCell[]): range is GridRectRange {
  return !Array.isArray(range)
}

function getComponentRect(component: TileGridMapComponent) {
  if (component.type === 'rect' && isRectRange(component.range)) return component.range

  const cells = component.range as readonly GridCell[]
  const rows = cells.map((cell) => cell.row)
  const cols = cells.map((cell) => cell.col)

  return {
    rowStart: Math.min(...rows),
    rowEnd: Math.max(...rows),
    colStart: Math.min(...cols),
    colEnd: Math.max(...cols),
  }
}

function buildGroupIdByBlockId(groups: readonly TileGridMapGroupComponent[]) {
  const groupIdByBlockId = new Map<string, string>()
  for (const group of groups) {
    for (const childId of group.children) {
      groupIdByBlockId.set(childId, group.id)
    }
  }
  return groupIdByBlockId
}

function buildColorClassByGroupId(groups: readonly TileGridMapGroupComponent[]) {
  const colorClassByGroupId = new Map<string, string>()
  groups.forEach((group, index) => {
    colorClassByGroupId.set(group.id, `prefecture-selector-color-${groupColorByIndex[index % groupColorByIndex.length]}`)
  })
  return colorClassByGroupId
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

const GridSelectionRectangle = ({ style, includeMode }: { style: CSSProperties; includeMode: EditMultiSelectIncludeMode | null }) => (
  <div className={`prefecture-selector-selection-rectangle ${includeMode === 'full' ? 'is-full-include' : 'is-partial-include'}`} style={style} aria-hidden />
)

const PrefectureSelectorHeader = observer(({ data, config, onEvent, eyebrow, title, onJsonOpen }: PrefectureSelectorHeaderProps) => (
  <header className="prefecture-selector-header">
    <div className="prefecture-selector-header-main">
      <div className="prefecture-selector-header-title">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        {title ? <h2>{title}</h2> : null}
      </div>
      <div className="prefecture-selector-mode-control">
        <SegmentedControl
          data={{ valueSelected: config.mode, options: data.modeOptions }}
          config={{ color: '#2d579e', widthMode: 'equal' }}
          onEvent={(_eventName: string, eventData: { valueSelected?: PrefectureSelectorMode }) => {
            if (eventData.valueSelected) onEvent('setMode', { mode: eventData.valueSelected })
          }}
        />
      </div>
    </div>
    <div className="prefecture-selector-header-controls">
      {config.mode === 'edit' ? (
        <>
          <button type="button" className="prefecture-selector-header-button" onClick={() => onEvent('decreaseGridDensity', {})}>
            Density /2
          </button>
          <button type="button" className="prefecture-selector-header-button" onClick={() => onEvent('increaseGridDensity', {})}>
            Density x2
          </button>
          <button type="button" className="prefecture-selector-header-button" onClick={onJsonOpen}>
            JSON
          </button>
        </>
      ) : null}
    </div>
  </header>
))

function getSelectionOperationFromEvent(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): SelectionOperation {
  if (event.ctrlKey || event.metaKey) return 'toggle'
  if (event.shiftKey) return 'add'
  return 'replace'
}

export const PrefectureSelectorRender = observer(({ data, config, onEvent, onComponentContextMenu, onComponentDoubleClick }: PrefectureSelectorRenderProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const suppressNextMapClickRef = useRef(false)
  const suppressMapClickUntilRef = useRef(0)
  const suppressNextComponentClickRef = useRef(false)
  const suppressComponentClickUntilRef = useRef(0)
  const pendingSelectGestureRef = useRef<PendingSelectGesture | null>(null)
  const pendingEditMultiSelectGestureRef = useRef<PendingEditMultiSelectGesture | null>(null)
  const groups = data.components.filter((component) => component.compType === 'group')
  const selectedEditComp = config.editSelectedComponentId
    ? data.components.find((component) => component.id === config.editSelectedComponentId) ?? null
    : null
  const groupIdByBlockId = useMemo(() => buildGroupIdByBlockId(groups), [groups])
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const colorClassByGroupId = useMemo(() => buildColorClassByGroupId(groups), [groups])
  const rowCount = data.metadata.rowEnd - data.metadata.rowStart + 1
  const colCount = data.metadata.colEnd - data.metadata.colStart + 1
  const aspectWidth = config.cellAspectRatio?.width || data.metadata.cellAspectRatio.width
  const aspectHeight = config.cellAspectRatio?.height || data.metadata.cellAspectRatio.height
  const mapAspectRatio = `${colCount * aspectWidth} / ${rowCount * aspectHeight}`
  const mapWidthMax = Math.max(300, Number(config.mapWidthMax) || 980)
  const isEditMode = config.mode === 'edit'
  const isSelectMode = config.mode === 'select'
  const selectMove = config.selectMove ?? selectMoveEmpty
  const isSelectMoveEnabled = config.isSelectMoveEnabled !== false

  const getRectPosition = useCallback((range: GridRectRange) => {
    const top = ((range.rowStart - data.metadata.rowStart) / rowCount) * 100
    const left = ((range.colStart - data.metadata.colStart) / colCount) * 100
    const width = ((range.colEnd - range.colStart + 1) / colCount) * 100
    const height = ((range.rowEnd - range.rowStart + 1) / rowCount) * 100
    return { top, left, width, height }
  }, [colCount, data.metadata.colStart, data.metadata.rowStart, rowCount])

  const getBoxPosition = useCallback((box: GridBoxRange) => {
    const top = ((box.rowStart - data.metadata.rowStart) / rowCount) * 100
    const left = ((box.colStart - data.metadata.colStart) / colCount) * 100
    const width = ((box.colEnd - box.colStart) / colCount) * 100
    const height = ((box.rowEnd - box.rowStart) / rowCount) * 100
    return { top, left, width, height }
  }, [colCount, data.metadata.colStart, data.metadata.rowStart, rowCount])

  const getGridLineFromPointer = useCallback((edge: RectEdge, event: PointerEvent) => {
    const mapElement = mapRef.current
    if (!mapElement) return null
    const rect = mapElement.getBoundingClientRect()

    if (edge === 'left' || edge === 'right') {
      const pointerRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
      return clamp(Math.round(pointerRatio * colCount) + data.metadata.colStart, data.metadata.colStart, data.metadata.colEnd + 1)
    }

    const pointerRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    return clamp(Math.round(pointerRatio * rowCount) + data.metadata.rowStart, data.metadata.rowStart, data.metadata.rowEnd + 1)
  }, [colCount, data.metadata.colEnd, data.metadata.colStart, data.metadata.rowEnd, data.metadata.rowStart, rowCount])

  const getGridPointFromPointer = useCallback((event: PointerEvent | ReactPointerEvent) => {
    const mapElement = mapRef.current
    if (!mapElement) return null
    const rect = mapElement.getBoundingClientRect()
    const colRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const rowRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    return {
      pointerGridRow: data.metadata.rowStart + rowRatio * rowCount,
      pointerGridCol: data.metadata.colStart + colRatio * colCount,
    }
  }, [colCount, data.metadata.colStart, data.metadata.rowStart, rowCount])

  const suppressNextComponentClick = useCallback(() => {
    suppressNextComponentClickRef.current = true
    suppressComponentClickUntilRef.current = window.performance.now() + 350
    window.setTimeout(() => {
      if (window.performance.now() >= suppressComponentClickUntilRef.current) {
        suppressNextComponentClickRef.current = false
      }
    }, 360)
  }, [])

  const suppressNextMapClick = useCallback(() => {
    suppressNextMapClickRef.current = true
    suppressMapClickUntilRef.current = window.performance.now() + 350
    window.setTimeout(() => {
      if (window.performance.now() >= suppressMapClickUntilRef.current) {
        suppressNextMapClickRef.current = false
      }
    }, 360)
  }, [])

  const beginSelectPointerGesture = useCallback((event: ReactPointerEvent, component: TileGridMapComponent | null) => {
    if (!isSelectMode || event.button !== 0) return
    const startGridPoint = getGridPointFromPointer(event)
    if (!startGridPoint) return

    event.stopPropagation()
    const isSelectedComponent = isSelectMoveEnabled && (component?.compType === 'block'
      ? config.selectedBlockIdsFinal.has(component.id)
      : component?.compType === 'group' && config.selectedGroupIds.has(component.id))
    const gesture: PendingSelectGesture = {
      pointerId: event.pointerId,
      componentId: component?.id ?? null,
      isSelectedComponent,
      operation: getSelectionOperationFromEvent(event),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startGridPoint,
      dragType: null,
      isActive: false,
    }
    pendingSelectGestureRef.current = gesture

    const cleanup = () => {
      if (pendingSelectGestureRef.current === gesture) pendingSelectGestureRef.current = null
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }

    const startDragIfNeeded = (pointerEvent: PointerEvent) => {
      if (gesture.isActive) return true
      const distanceX = pointerEvent.clientX - gesture.startClientX
      const distanceY = pointerEvent.clientY - gesture.startClientY
      if (Math.hypot(distanceX, distanceY) < selectGestureDragThresholdPx) return false

      const pointerGridPoint = getGridPointFromPointer(pointerEvent)
      if (!pointerGridPoint) return false
      gesture.isActive = true
      gesture.dragType = gesture.isSelectedComponent && gesture.componentId ? 'move' : 'rect'

      if (gesture.dragType === 'move' && gesture.componentId) {
        onEvent('beginSelectMoveDrag', { componentId: gesture.componentId, ...gesture.startGridPoint })
        onEvent('updateSelectMoveDrag', pointerGridPoint)
      } else {
        onEvent('beginSelectRectDrag', { ...gesture.startGridPoint, operation: gesture.operation })
        onEvent('updateSelectRectDrag', pointerGridPoint)
      }
      return true
    }

    function handlePointerMove(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== gesture.pointerId) return
      if (!startDragIfNeeded(pointerEvent)) return
      pointerEvent.preventDefault()
      const pointerGridPoint = getGridPointFromPointer(pointerEvent)
      if (!pointerGridPoint) return
      onEvent(gesture.dragType === 'move' ? 'updateSelectMoveDrag' : 'updateSelectRectDrag', pointerGridPoint)
    }

    function handlePointerUp(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== gesture.pointerId) return
      if (gesture.isActive) {
        pointerEvent.preventDefault()
        suppressNextComponentClick()
        suppressNextMapClick()
        onEvent(gesture.dragType === 'move' ? 'commitSelectMoveDrag' : 'commitSelectRectDrag', {})
      }
      cleanup()
    }

    function handlePointerCancel(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== gesture.pointerId) return
      if (gesture.isActive) onEvent(gesture.dragType === 'move' ? 'cancelSelectMoveDrag' : 'cancelSelectRectDrag', {})
      cleanup()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
  }, [config.selectedBlockIdsFinal, config.selectedGroupIds, getGridPointFromPointer, isSelectMode, isSelectMoveEnabled, onEvent, suppressNextComponentClick, suppressNextMapClick])

  const beginEditMultiSelectPointerGesture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isEditMode || event.button !== 0) return
    const startGridPoint = getGridPointFromPointer(event)
    if (!startGridPoint) return

    event.stopPropagation()
    const gesture: PendingEditMultiSelectGesture = {
      pointerId: event.pointerId,
      operation: getSelectionOperationFromEvent(event),
      startClientX: event.clientX,
      startClientY: event.clientY,
      startGridPoint,
      isActive: false,
    }
    pendingEditMultiSelectGestureRef.current = gesture

    const cleanup = () => {
      if (pendingEditMultiSelectGestureRef.current === gesture) pendingEditMultiSelectGestureRef.current = null
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }

    const startDragIfNeeded = (pointerEvent: PointerEvent) => {
      if (gesture.isActive) return true
      const distanceX = pointerEvent.clientX - gesture.startClientX
      const distanceY = pointerEvent.clientY - gesture.startClientY
      if (Math.hypot(distanceX, distanceY) < selectGestureDragThresholdPx) return false

      const pointerGridPoint = getGridPointFromPointer(pointerEvent)
      if (!pointerGridPoint) return false
      gesture.isActive = true
      onEvent('beginEditMultiSelectRectDrag', { ...gesture.startGridPoint, operation: gesture.operation })
      onEvent('updateEditMultiSelectRectDrag', pointerGridPoint)
      return true
    }

    function handlePointerMove(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== gesture.pointerId) return
      if (!startDragIfNeeded(pointerEvent)) return
      pointerEvent.preventDefault()
      const pointerGridPoint = getGridPointFromPointer(pointerEvent)
      if (pointerGridPoint) onEvent('updateEditMultiSelectRectDrag', pointerGridPoint)
    }

    function handlePointerUp(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== gesture.pointerId) return
      if (gesture.isActive) {
        pointerEvent.preventDefault()
        suppressNextMapClick()
        onEvent('commitEditMultiSelectRectDrag', {})
      }
      cleanup()
    }

    function handlePointerCancel(pointerEvent: PointerEvent) {
      if (pointerEvent.pointerId !== gesture.pointerId) return
      if (gesture.isActive) onEvent('cancelEditMultiSelectRectDrag', {})
      cleanup()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)
  }, [getGridPointFromPointer, isEditMode, onEvent, suppressNextMapClick])

  useEffect(() => {
    const isOwnedSelectGestureActive = pendingSelectGestureRef.current?.isActive === true
    const isOwnedEditMultiSelectGestureActive = pendingEditMultiSelectGestureRef.current?.isActive === true
    const isSelectRectDragging = isSelectMode && config.selectRectDrag.isDragging && !isOwnedSelectGestureActive
    const isSelectMoveDragging = isSelectMode && selectMove.isDragging && !isOwnedSelectGestureActive
    const isMultiRectDragging = config.editMultiSelection.rectDrag.isDragging && !isOwnedEditMultiSelectGestureActive
    const isMultiMoveDragging = config.editMultiSelection.move.isDragging
    const isSingleDragging = config.editDrag.isDragging && config.editDrag.dragType
    if (!isSelectRectDragging && !isSelectMoveDragging && !isSingleDragging && !isMultiRectDragging && !isMultiMoveDragging) return undefined

    const handlePointerMove = (event: PointerEvent) => {
      if (isSelectRectDragging) {
        const pointerGridPoint = getGridPointFromPointer(event)
        if (pointerGridPoint) onEvent('updateSelectRectDrag', pointerGridPoint)
        return
      }

      if (isMultiRectDragging) {
        const pointerGridPoint = getGridPointFromPointer(event)
        if (pointerGridPoint) onEvent('updateEditMultiSelectRectDrag', pointerGridPoint)
        return
      }

      if (isSelectMoveDragging) {
        const pointerGridPoint = getGridPointFromPointer(event)
        if (pointerGridPoint) onEvent('updateSelectMoveDrag', pointerGridPoint)
        return
      }

      if (isMultiMoveDragging) {
        const pointerGridPoint = getGridPointFromPointer(event)
        if (pointerGridPoint) onEvent('updateEditMultiMoveDrag', pointerGridPoint)
        return
      }

      if (config.editDrag.dragType === 'resize' && config.editDrag.resize.edge) {
        const gridLine = getGridLineFromPointer(config.editDrag.resize.edge, event)
        if (gridLine !== null) onEvent('updateRectEdgeDrag', { gridLine })
        return
      }

      if (config.editDrag.dragType === 'move') {
        const pointerGridPoint = getGridPointFromPointer(event)
        if (pointerGridPoint) onEvent('updateMoveDrag', pointerGridPoint)
      }
    }

    const handlePointerUp = () => {
      if (isSelectRectDragging) {
        suppressNextMapClick()
        onEvent('commitSelectRectDrag', {})
        return
      }

      if (isMultiRectDragging) {
        onEvent('commitEditMultiSelectRectDrag', {})
        return
      }

      if (isSelectMoveDragging) {
        suppressNextComponentClick()
        suppressNextMapClick()
        onEvent('commitSelectMoveDrag', {})
        return
      }

      if (isMultiMoveDragging) {
        suppressNextComponentClick()
        suppressNextMapClick()
        onEvent('commitEditMultiMoveDrag', {})
        return
      }

      suppressNextComponentClick()
      suppressNextMapClick()
      onEvent(config.editDrag.dragType === 'move' ? 'commitMoveDrag' : 'commitRectEdgeDrag', {})
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', handlePointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [config.editDrag.dragType, config.editDrag.isDragging, config.editDrag.resize.edge, config.editMultiSelection.move.isDragging, config.editMultiSelection.rectDrag.isDragging, selectMove.isDragging, config.selectRectDrag.isDragging, getGridLineFromPointer, getGridPointFromPointer, isSelectMode, onEvent, suppressNextComponentClick, suppressNextMapClick])

  const handleComponentClick = (component: TileGridMapComponent, event: ReactMouseEvent<HTMLButtonElement>) => {
    const now = window.performance.now()
    if (suppressNextComponentClickRef.current && now >= suppressComponentClickUntilRef.current) {
      suppressNextComponentClickRef.current = false
    }
    if (suppressNextComponentClickRef.current || now < suppressComponentClickUntilRef.current) {
      suppressNextComponentClickRef.current = false
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (isEditMode) {
      onEvent('selectEditComponent', { componentId: component.id, operation: getSelectionOperationFromEvent(event) })
      return
    }
    if (!isSelectMode) return
    onEvent(component.compType === 'group' ? 'toggleGroupSelection' : 'toggleBlockSelection', {
      componentId: component.id,
      operation: getSelectionOperationFromEvent(event),
    })
  }

  const handleMapClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const now = window.performance.now()
    if (suppressNextMapClickRef.current && now >= suppressMapClickUntilRef.current) {
      suppressNextMapClickRef.current = false
    }
    if (suppressNextMapClickRef.current || now < suppressMapClickUntilRef.current) {
      suppressNextMapClickRef.current = false
      return
    }
    if (event.target !== event.currentTarget) return
    if (isSelectMode) {
      onEvent('clearSelection', {})
      return
    }
    if (isEditMode) onEvent('clearEditSelection', {})
  }

  const handleMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return
    if (isSelectMode) {
      beginSelectPointerGesture(event, null)
      return
    }
    if (!isEditMode) return
    beginEditMultiSelectPointerGesture(event)
  }

  const beginEdgeDrag = (component: TileGridMapComponent, edge: RectEdge, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (component.type !== 'rect' || !isRectRange(component.range)) return
    const initialLine = edge === 'left'
      ? component.range.colStart
      : edge === 'right'
        ? component.range.colEnd + 1
        : edge === 'top'
          ? component.range.rowStart
          : component.range.rowEnd + 1
    onEvent('beginRectEdgeDrag', { componentId: component.id, edge, gridLine: initialLine })
  }

  const beginMoveDrag = (component: TileGridMapComponent, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isSelectMode) {
      beginSelectPointerGesture(event, component)
      return
    }
    if (!isEditMode) return
    if (event.button !== 0) return
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      event.preventDefault()
      event.stopPropagation()
      suppressNextComponentClick()
      onEvent('selectEditComponent', { componentId: component.id, operation: getSelectionOperationFromEvent(event) })
      return
    }
    event.preventDefault()
    const pointerGridPoint = getGridPointFromPointer(event)
    if (!pointerGridPoint) return
    const isMultiSelectedComponent = config.editSelectionMode === 'multi' && config.editMultiSelection.selectedComponentIds.has(component.id)
    if (isMultiSelectedComponent && config.editMultiSelection.selectedComponentIds.size > 1) {
      suppressNextComponentClick()
      onEvent('beginEditMultiMoveDrag', { componentId: component.id, ...pointerGridPoint })
      return
    }
    if (component.type !== 'rect' || !isRectRange(component.range)) return
    onEvent('beginMoveDrag', { componentId: component.id, ...pointerGridPoint })
  }

  const updateGridDisplayRange = (key: GridDisplayRangeKey, delta: number) => {
    onEvent('updateGridDisplayRange', { key, delta })
  }

  const renderRangeValueControl = (key: GridDisplayRangeKey, value: number, label: string, axis: 'horizontal' | 'vertical' = 'horizontal') => (
    <NumValue
      value={value}
      axis={axis}
      label={label}
      isInteger
      onValueChange={(valueNext: number) => updateGridDisplayRange(key, valueNext - value)}
    />
  )

  const renderGridDisplayRangeControls = () => {
    if (!isEditMode) return null

    return (
      <div className="prefecture-selector-range-controls" aria-label="Grid display range controls">
        <div className="prefecture-selector-range-axis prefecture-selector-range-axis-horizontal">
          {renderRangeValueControl('colStart', data.metadata.colStart, 'Left display grid index')}
          <div className="prefecture-selector-range-symbol prefecture-selector-range-symbol-horizontal" aria-hidden />
          {renderRangeValueControl('colEnd', data.metadata.colEnd, 'Right display grid index')}
        </div>
        <div className="prefecture-selector-range-axis prefecture-selector-range-axis-vertical">
          {renderRangeValueControl('rowStart', data.metadata.rowStart, 'Top display grid index', 'vertical')}
          <div className="prefecture-selector-range-symbol prefecture-selector-range-symbol-vertical" aria-hidden />
          {renderRangeValueControl('rowEnd', data.metadata.rowEnd, 'Bottom display grid index', 'vertical')}
        </div>
      </div>
    )
  }

  const renderSelectedEditOverlay = () => {
    if (!isEditMode || !selectedEditComp || selectedEditComp.type !== 'rect' || !isRectRange(selectedEditComp.range)) return null
    const { top, left, width, height } = getRectPosition(selectedEditComp.range)

    return (
      <div
        className="prefecture-selector-edit-outline"
        style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }}
        aria-hidden
      >
        {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
          <button
            key={edge}
            type="button"
            className={`prefecture-selector-edge-handle prefecture-selector-edge-handle-${edge}`}
            onPointerDown={(event) => beginEdgeDrag(selectedEditComp, edge, event)}
            aria-label={`${selectedEditComp.label} ${edge} edge`}
          />
        ))}
      </div>
    )
  }

  const renderDragIndicator = () => {
    if (!isEditMode || !config.editDrag.isDragging || config.editDrag.dragType !== 'resize' || !config.editDrag.resize.edge || config.editDrag.resize.gridLine === null) return null
    const isVertical = config.editDrag.resize.edge === 'left' || config.editDrag.resize.edge === 'right'
    const linePosition = isVertical
      ? ((config.editDrag.resize.gridLine - data.metadata.colStart) / colCount) * 100
      : ((config.editDrag.resize.gridLine - data.metadata.rowStart) / rowCount) * 100
    const indicatorClassName = `prefecture-selector-drag-indicator ${isVertical ? 'is-vertical' : 'is-horizontal'} ${config.editDrag.resize.isDropValid ? 'is-valid' : 'is-invalid'}`

    return <div className={indicatorClassName} style={isVertical ? { left: `${linePosition}%` } : { top: `${linePosition}%` }} aria-hidden />
  }

  const renderMoveGhost = () => {
    const move = config.editDrag.move
    if (!isEditMode || !config.editDrag.isDragging || config.editDrag.dragType !== 'move' || !move.componentId || !move.candidateRange) return null
    const component = data.components.find((componentItem) => componentItem.id === move.componentId)
    if (!component) return null
    const groupId = component.compType === 'group' ? component.id : groupIdByBlockId.get(component.id)
    const colorClassName = groupId ? colorClassByGroupId.get(groupId) : ''
    const group = groupId ? groupById.get(groupId) : null
    const colorValue = typeof group?.metadata?.color === 'string' ? group.metadata.color : undefined
    const { top, left, width, height } = getRectPosition(move.candidateRange)
    const style = { top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%`, backgroundColor: colorValue } as CSSProperties

    return (
      <div
        className={`prefecture-selector-move-ghost prefecture-selector-render-${component.renderCompName} ${colorClassName ?? ''}`}
        style={style}
        aria-hidden
      >
        <span>{component.label}</span>
      </div>
    )
  }

  const renderMultiSelectionRectangle = () => {
    const rectDrag = isSelectMode ? config.selectRectDrag : config.editMultiSelection.rectDrag
    if ((!isEditMode && !isSelectMode) || !rectDrag.isDragging || !rectDrag.candidateBox) return null
    const { top, left, width, height } = getBoxPosition(rectDrag.candidateBox)
    return (
      <GridSelectionRectangle
        includeMode={rectDrag.includeMode}
        style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }}
      />
    )
  }

  const renderMultiMoveBoundingBox = () => {
    const move = isSelectMode ? selectMove : config.editMultiSelection.move
    if ((!isEditMode && !isSelectMode) || !move.isDragging || !move.candidateBoundingRange) return null
    const { top, left, width, height } = getRectPosition(move.candidateBoundingRange)
    const className = `prefecture-selector-multi-move-bounding-box ${move.isDropValid ? 'is-valid' : 'is-invalid'}`
    return <div className={className} style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }} aria-hidden />
  }

  return (
    <section className="prefecture-selector">
      <div
        className={`prefecture-selector-map-frame ${isEditMode ? 'is-edit-mode' : ''}`}
        style={{ '--prefecture-selector-map-width-max': `${mapWidthMax}px` } as CSSProperties}
      >
        {renderGridDisplayRangeControls()}
        <div
          ref={mapRef}
          className={`prefecture-selector-map ${isEditMode ? 'is-edit-mode' : ''} ${config.editMultiSelection.rectDrag.isDragging || config.selectRectDrag.isDragging ? 'is-multi-selecting' : ''}`}
          style={{
            aspectRatio: mapAspectRatio,
            backgroundColor: config.backgroundColor,
            '--tile-grid-cols': colCount,
            '--tile-grid-rows': rowCount,
          } as CSSProperties}
          aria-label={data.label}
          onClick={handleMapClick}
          onPointerDown={handleMapPointerDown}
        >
          {isEditMode ? <div className="prefecture-selector-grid-lines" aria-hidden /> : null}
          {data.components.map((component) => {
            const range = getComponentRect(component)
            const groupId = component.compType === 'group' ? component.id : groupIdByBlockId.get(component.id)
            const colorClassName = groupId ? colorClassByGroupId.get(groupId) : ''
            const isSelectedDirect = component.compType === 'block' && config.selectedBlockIds.has(component.id)
            const isSelectedFinal = component.compType === 'block'
              ? config.selectedBlockIdsFinal.has(component.id)
              : config.selectedGroupIds.has(component.id)
            const isDisabled = config.disabledComponentIds?.has(component.id) === true
            const isEditSelected = isEditMode && config.editSelectedComponentId === component.id
            const isEditMultiSelected = isEditMode && config.editSelectionMode === 'multi' && config.editMultiSelection.selectedComponentIds.has(component.id)
            const { top, left, width, height } = getRectPosition(range)
            const group = groupId ? groupById.get(groupId) : null
            const colorValue = typeof group?.metadata?.color === 'string' ? group.metadata.color : undefined
            const style = { top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%`, backgroundColor: colorValue } as CSSProperties

            return (
              <button
                key={component.id}
                type="button"
                className={`prefecture-selector-map-component prefecture-selector-render-${component.renderCompName} ${colorClassName ?? ''} ${isSelectedFinal ? 'is-selected-final' : ''} ${isSelectedDirect ? 'is-selected-direct' : ''} ${isDisabled ? 'is-disabled' : ''} ${isEditSelected ? 'is-edit-selected' : ''} ${isEditMultiSelected ? 'is-edit-multi-selected' : ''}`}
                style={style}
                aria-pressed={isEditMode ? isEditSelected || isEditMultiSelected : isSelectedFinal}
                disabled={isDisabled}
                draggable={false}
                title={component.label}
                onDragStart={(event) => event.preventDefault()}
                onContextMenu={(event) => onComponentContextMenu(component, event)}
                onPointerDown={(event) => beginMoveDrag(component, event)}
                onClick={(event) => handleComponentClick(component, event)}
                onDoubleClick={(event) => onComponentDoubleClick(component, event)}
              >
                <span>{config.renderComponentLabel?.(component) ?? component.label}</span>
              </button>
            )
          })}
          {renderMoveGhost()}
          {renderMultiMoveBoundingBox()}
          {renderMultiSelectionRectangle()}
          {renderSelectedEditOverlay()}
          {renderDragIndicator()}
        </div>
      </div>
    </section>
  )
})

type PrefectureSelectorElProps = {
  store?: PrefectureSelectorStore
  eyebrow?: string
  title?: string
}

type ComponentMenuState = {
  componentId: string
  label: string
  x: number
  y: number
}

type RenameState = {
  componentId: string
  labelDraft: string
}

const PrefectureSelectorEl = observer(({ store: storeProp, eyebrow, title }: PrefectureSelectorElProps) => {
  const localStore = useMemo(() => createPrefectureSelectorStore(), [])
  const store = storeProp ?? localStore
  const mapConfigPanelRef = useRef<HTMLElement | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [componentMenu, setComponentMenu] = useState<ComponentMenuState | null>(null)
  const [renameState, setRenameState] = useState<RenameState | null>(null)
  const [isJsonDialogOpen, setIsJsonDialogOpen] = useState(false)
  const isEditMode = store.config.mode === 'edit'
  const isDisplayMode = store.config.mode === 'display'
  const mapViewConfig = store.mapViewConfig
  const selectionEmpty = useMemo(() => new Set<string>(), [])
  const colorPopupPlacement = useCallback((triggerRect: DOMRect, popupSize: { width: number; height: number }) => {
    const anchorRect = mapConfigPanelRef.current?.getBoundingClientRect() ?? triggerRect
    const boundaryRect = rectFromViewportSize({ width: window.innerWidth, height: window.innerHeight })
    return chooseAnchoredPopupPos(anchorRect, popupSize, boundaryRect, 8)
  }, [])

  useEffect(() => {
    void store.fetchConfigs()
  }, [store])

  useEffect(() => {
    if (isEditMode) return
    store.closePropEditor()
  }, [isEditMode, store])

  useEffect(() => {
    if (!store.editPropEditorState.drag.isDragging) return undefined
    const handlePointerMove = (event: PointerEvent) => store.movePropEditorDrag(event.clientX, event.clientY)
    const handlePointerUp = () => store.endPropEditorDrag()
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', handlePointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [store, store.editPropEditorState.drag.isDragging])

  const openComponentMenu = (component: TileGridMapComponent, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!isEditMode) return
    event.preventDefault()
    event.stopPropagation()
    setComponentMenu({ componentId: component.id, label: component.label, x: event.clientX, y: event.clientY })
  }

  const toggleBlockPropEditor = (component: TileGridMapComponent, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!isEditMode || component.compType !== 'block') return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    store.toggleBlockPropEditor(component.id, {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
  }

  const handleComponentMenuEvent = (eventType: string, eventData: Record<string, unknown>) => {
    if (eventType === 'closeRequest' || eventType === 'close' || eventType === 'backdropContextMenu') {
      setComponentMenu(null)
      return
    }
    if (eventType !== 'itemClick' || !componentMenu) return

    const itemId = eventData.itemId
    if (itemId === 'rename') {
      setRenameState({ componentId: componentMenu.componentId, labelDraft: componentMenu.label })
      setComponentMenu(null)
      return
    }
    if (itemId === 'delete') {
      store.deleteComponent(componentMenu.componentId)
      setComponentMenu(null)
    }
  }

  const handleRenameConfirm = () => {
    if (!renameState) return
    const result = store.renameComponent(renameState.componentId, renameState.labelDraft)
    if (result.code === 0) setRenameState(null)
  }

  const handleConfigAllEvent = (eventType: string, eventData: Record<string, unknown> = {}) => {
    if (eventType === 'refresh') return void store.fetchConfigs()
    if (eventType === 'save') return void store.saveConfigVersion()
    if (eventType === 'select') {
      const id = typeof eventData.id === 'string' ? eventData.id : null
      store.setConfigSelected(id)
      return
    }
    const id = typeof eventData.id === 'string' ? eventData.id : null
    if (!id) return
    if (eventType === 'load') return void store.loadConfig(id)
    if (eventType === 'delete') return void store.deleteConfig(id)
  }

  const copyMapObjData = async () => {
    await navigator.clipboard.writeText(store.config.mapObjData)
    setCopyMessage('Copied')
    window.setTimeout(() => setCopyMessage(''), 1200)
  }

  const selectorRender = (
    <PrefectureSelectorRender
      data={store.data}
      config={{
        mode: store.config.mode,
        selectedBlockIds: isDisplayMode ? selectionEmpty : store.selectState.selectedBlockIds,
        selectedGroupIds: isDisplayMode ? selectionEmpty : store.selectState.selectedGroupIds,
        selectedBlockIdsFinal: isDisplayMode ? selectionEmpty : store.selectedBlockIdsFinal,
        disabledComponentIds: store.mapDisabledComponentIds,
        cellAspectRatio: store.data.metadata.cellAspectRatio,
        backgroundColor: mapViewConfig.backgroundColor,
        mapWidthMax: mapViewConfig.mapWidthMax,
        selectRectDrag: store.selectState.rectDrag,
        selectMove: store.selectState.move,
        isSelectMoveEnabled: false,
        editSelectionMode: store.editState.selectionMode,
        editSelectedComponentId: store.editState.selectedComponentId,
        editDrag: store.editState.drag,
        editMultiSelection: store.editMultiSelectionState,
      }}
      onEvent={store.handleEvent}
      onComponentContextMenu={openComponentMenu}
      onComponentDoubleClick={toggleBlockPropEditor}
    />
  )

  const selectionStatus = store.config.mode !== 'display' ? (
    <div className="prefecture-selector-status-row">
      <button type="button" className="prefecture-selector-clear" onClick={() => store.handleEvent('clearSelection', {})}>
        クリア
      </button>
      <div className="prefecture-selector-status" aria-live="polite">
        <div>
          <span>選択グループ</span>
          <strong>{store.selectedGroupLabels.length ? store.selectedGroupLabels.join('、') : 'なし'}</strong>
        </div>
        <div>
          <span>最終選択都道府県</span>
          <strong>{store.selectedBlockLabelsFinal.length ? store.selectedBlockLabelsFinal.join('、') : 'なし'}</strong>
        </div>
      </div>
    </div>
  ) : null

  return (
    <div className="prefecture-selector-shell">
      <PrefectureSelectorHeader
        data={{ modeOptions }}
        config={{ mode: store.config.mode }}
        onEvent={store.handleEvent}
        eyebrow={eyebrow}
        title={title}
        onJsonOpen={() => setIsJsonDialogOpen(true)}
      />

      <div
        className={`prefecture-selector-workspace prefecture-selector-workspace-${store.config.mode}`}
        style={{ '--prefecture-selector-map-width-max': `${mapViewConfig.mapWidthMax}px` } as CSSProperties}
      >
        <div className="prefecture-selector-preview-panel">
          {selectorRender}
          {selectionStatus}
        </div>
        <aside className="prefecture-selector-config-panel" ref={mapConfigPanelRef} aria-label="Map config">
          <div className="prefecture-selector-config-title">Map Config</div>
          <PropertyEditor
            data={store.mapConfigEditorData}
            config={{
              width: '100%',
              isLevelLeftShown: false,
              isLevelTopShown: true,
              groupCollapsedByPath: store.mapConfigEditorState.groupCollapsedByPath,
              keyColWidth: 'min',
              keyColMinWidth: '76px',
              keyColMaxWidth: '112px',
              requestTimeoutMs: 1200,
              valueConfigByType: {
                color: {
                  popupSize: { width: 264, height: 480 },
                  popupPlacement: colorPopupPlacement,
                  modeCommit: 'immediate',
                },
              },
            }}
            onEvent={store.handleMapConfigEditorEvent}
          />
        </aside>
      </div>

      {isEditMode ? <MapBlockPropEditorPopupTyped store={store} /> : null}

      {isEditMode ? (
        <ConfigAll
          data={{ rows: store.configRows }}
          config={{
            selectedId: store.backendState.configSelectedId,
            isLoading: store.backendState.isLoading,
            message: store.backendState.message,
            versionBase: store.backendState.versionBase,
          }}
          onEvent={handleConfigAllEvent}
        />
      ) : null}

      {componentMenu ? (
        <Menu
          data={{
            items: [
              { id: 'rename', label: 'Rename' },
              { id: 'delete', label: 'Delete' },
            ],
          }}
          config={{ minWidth: 132, isClickPropagationStopped: true, posOpen: { x: componentMenu.x, y: componentMenu.y } }}
          onEvent={handleComponentMenuEvent}
        />
      ) : null}

      {renameState ? (
        <div className="prefecture-selector-dialog-backdrop" role="presentation">
          <div className="prefecture-selector-dialog" role="dialog" aria-modal="true" aria-labelledby="prefecture-selector-rename-title">
            <h2 id="prefecture-selector-rename-title">Rename</h2>
            <input
              className="prefecture-selector-dialog-input"
              value={renameState.labelDraft}
              autoFocus
              onChange={(event) => setRenameState({ ...renameState, labelDraft: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleRenameConfirm()
                if (event.key === 'Escape') setRenameState(null)
              }}
            />
            <div className="prefecture-selector-dialog-actions">
              <button type="button" className="prefecture-selector-version-button" onClick={handleRenameConfirm}>
                Confirm
              </button>
              <button type="button" className="prefecture-selector-version-button" onClick={() => setRenameState(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditMode && isJsonDialogOpen ? (
        <div className="prefecture-selector-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsJsonDialogOpen(false)
        }}>
          <section className="prefecture-selector-dialog prefecture-selector-json-dialog" role="dialog" aria-modal="true" aria-labelledby="prefecture-selector-json-title">
            <div className="prefecture-selector-json-toolbar">
              <h2 id="prefecture-selector-json-title">Map Data Object</h2>
              <div className="prefecture-selector-json-actions">
                {copyMessage ? <span className="prefecture-selector-copy-message">{copyMessage}</span> : null}
                <SegmentedControl
                  data={{ valueSelected: store.config.mapObjDataFormat, options: mapObjDataFormatOptions }}
                  config={{ color: '#2d579e', widthMode: 'auto', classNameTrack: 'prefecture-selector-json-format-control' }}
                  onEvent={(_eventName: string, eventData: { valueSelected?: MapObjDataFormat }) => {
                    if (eventData.valueSelected) store.handleEvent('setMapObjDataFormat', { format: eventData.valueSelected })
                  }}
                />
                <button type="button" className="prefecture-selector-icon-button" onClick={() => store.handleEvent('refreshMapObjData', {})} aria-label="Refresh map data JSON">
                  <RefreshIcon width={16} height={16} />
                </button>
                <button type="button" className="prefecture-selector-copy-button" onClick={copyMapObjData}>
                  Copy
                </button>
                <button type="button" className="prefecture-selector-copy-button" onClick={() => setIsJsonDialogOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <pre className="prefecture-selector-json-content">{store.config.mapObjData}</pre>
          </section>
        </div>
      ) : null}
    </div>
  )
})

export default PrefectureSelectorEl