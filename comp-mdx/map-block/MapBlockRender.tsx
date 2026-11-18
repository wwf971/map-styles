import React, { useCallback, useEffect, useMemo, useRef, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { NumValue } from '@wwf971/react-comp-misc'
import {
  type EditDragType,
  type EditMultiSelectIncludeMode,
  type EditSelectionMode,
  type EditTool,
  type GridDisplayRangeKey,
  type MapBlockEventData,
  type MapBlockEventType,
  type MapBlockMode,
  type RectEdge,
  type SelectionOperation,
} from './MapBlockStore'
import {
  shapeCellRectGet,
  shapeIsPolygon,
  shapeIsRect,
  shapeShift,
  type GridBoxRange,
  type GridPoint,
  type GridRectRange,
  type MapBlockComp,
  type MapBlockData,
  type MapBlockGroup,
  type MapBlockShape,
} from './MapBlockData'
import { polygonLabelPointGet } from './MapBlockGeom'
import './MapBlock.css'

// The render of one block map (doc/map-block.md#the-render): the grid, its components and,
// by mode, what the pointer does on them. It holds no state of its own beyond a gesture in
// progress: everything it draws comes from data and config (the store), and everything the
// pointer does goes out as an event (MapBlockStoreEvent.ts).
//
// The gestures of the modes select and edit start on pointerdown and become a drag once the
// pointer has moved 4px (selectGestureDragThresholdPx): a press on a selected component moves
// it, a press elsewhere draws a selection box. A click that ended a drag is swallowed
// (suppressNextComponentClick / suppressNextMapClick), so it does not also toggle the
// selection. These timings were tuned by hand; change them only on purpose.

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
    originalShape?: MapBlockShape | null
    originalRange: GridRectRange | null
    candidateRange: GridRectRange | null
    isDropValid: boolean
  }
  point?: {
    componentId: string | null
    index: number | null
    pointListCandidate: GridPoint[] | null
    isDropValid: boolean
    problem: string
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

export type MapBlockRenderConfig = {
  mode: MapBlockMode
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
  renderComponentLabel?: (component: MapBlockComp) => ReactNode
  selectRectDrag: EditMultiSelectionState['rectDrag']
  selectMove?: EditMultiSelectionState['move']
  isSelectMoveEnabled?: boolean
  editTool?: EditTool
  editSelectionMode: EditSelectionMode
  editSelectedComponentId: string | null
  editDrag: EditDragState
  editMultiSelection: EditMultiSelectionState
  editRectCreate?: { isDragging: boolean; cellStart: GridPoint | null; cellCurrent: GridPoint | null }
  editPolygonDraw?: { pointList: GridPoint[]; pointerPoint: GridPoint | null; problem: string }
}

type MapBlockRenderProps = {
  data: MapBlockData
  config: MapBlockRenderConfig
  onEvent: (eventType: MapBlockEventType, eventData: MapBlockEventData) => unknown
  onComponentContextMenu: (component: MapBlockComp, event: ReactMouseEvent<HTMLButtonElement>) => void
  onComponentDoubleClick: (component: MapBlockComp, event: ReactMouseEvent<HTMLButtonElement>) => void
  // a right click on the empty grid in the edit mode, with the grid position under the pointer
  onMapContextMenu?: (pointerGridPoint: { pointerGridRow: number; pointerGridCol: number }, event: ReactMouseEvent<HTMLDivElement>) => void
  // a right click on a corner of the selected polygon in the edit mode
  onVertexContextMenu?: (component: MapBlockComp, index: number, event: ReactMouseEvent<HTMLElement>) => void
}

const groupColorByIndex = ['teal', 'yellow', 'coral', 'pink', 'violet', 'indigo'] as const
const selectGestureDragThresholdPx = 4
const selectMoveEmpty = {
  isDragging: false,
  candidateBoundingRange: null,
  isDropValid: true,
}

export const MapBlockRender = observer(({ data, config, onEvent, onComponentContextMenu, onComponentDoubleClick, onMapContextMenu, onVertexContextMenu }: MapBlockRenderProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const suppressNextMapClickRef = useRef(false)
  const suppressMapClickUntilRef = useRef(0)
  const suppressNextComponentClickRef = useRef(false)
  const suppressComponentClickUntilRef = useRef(0)
  const pendingSelectGestureRef = useRef<PendingSelectGesture | null>(null)
  const pendingEditMultiSelectGestureRef = useRef<PendingEditMultiSelectGesture | null>(null)
  const groups = data.compList.filter((component): component is MapBlockGroup => component.kind === 'group')
  const selectedEditComp = config.editSelectedComponentId
    ? data.compList.find((component) => component.id === config.editSelectedComponentId) ?? null
    : null
  const groupIdByBlockId = useMemo(() => buildGroupIdByBlockId(groups), [groups])
  const groupById = useMemo(() => new Map(groups.map((group) => [group.id, group])), [groups])
  const colorClassByGroupId = useMemo(() => buildColorClassByGroupId(groups), [groups])
  const rowCount = data.grid.rowEnd - data.grid.rowStart + 1
  const colCount = data.grid.colEnd - data.grid.colStart + 1
  const aspectWidth = config.cellAspectRatio?.width || data.grid.cellAspectRatio.width
  const aspectHeight = config.cellAspectRatio?.height || data.grid.cellAspectRatio.height
  const mapAspectRatio = `${colCount * aspectWidth} / ${rowCount * aspectHeight}`
  const mapWidthMax = Math.max(300, Number(config.mapWidthMax) || 980)
  const isEditMode = config.mode === 'edit'
  const isSelectMode = config.mode === 'select'
  const selectMove = config.selectMove ?? selectMoveEmpty
  const isSelectMoveEnabled = config.isSelectMoveEnabled !== false
  const editTool: EditTool = isEditMode ? config.editTool ?? 'select' : 'select'
  const isEditToolSelect = editTool === 'select'
  const isRectCreating = config.editRectCreate?.isDragging === true
  const editPointDrag = config.editDrag.point

  const getRectPosition = useCallback((range: GridRectRange) => {
    const top = ((range.rowStart - data.grid.rowStart) / rowCount) * 100
    const left = ((range.colStart - data.grid.colStart) / colCount) * 100
    const width = ((range.colEnd - range.colStart + 1) / colCount) * 100
    const height = ((range.rowEnd - range.rowStart + 1) / rowCount) * 100
    return { top, left, width, height }
  }, [colCount, data.grid.colStart, data.grid.rowStart, rowCount])

  const getBoxPosition = useCallback((box: GridBoxRange) => {
    const top = ((box.rowStart - data.grid.rowStart) / rowCount) * 100
    const left = ((box.colStart - data.grid.colStart) / colCount) * 100
    const width = ((box.colEnd - box.colStart) / colCount) * 100
    const height = ((box.rowEnd - box.rowStart) / rowCount) * 100
    return { top, left, width, height }
  }, [colCount, data.grid.colStart, data.grid.rowStart, rowCount])

  // a point on the grid lines, in percent of the map
  const getPointPosition = useCallback(([row, col]: GridPoint) => ({
    top: ((row - data.grid.rowStart) / rowCount) * 100,
    left: ((col - data.grid.colStart) / colCount) * 100,
  }), [colCount, data.grid.colStart, data.grid.rowStart, rowCount])

  const getGridLineFromPointer = useCallback((edge: RectEdge, event: PointerEvent) => {
    const mapElement = mapRef.current
    if (!mapElement) return null
    const rect = mapElement.getBoundingClientRect()

    if (edge === 'left' || edge === 'right') {
      const pointerRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
      return clamp(Math.round(pointerRatio * colCount) + data.grid.colStart, data.grid.colStart, data.grid.colEnd + 1)
    }

    const pointerRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    return clamp(Math.round(pointerRatio * rowCount) + data.grid.rowStart, data.grid.rowStart, data.grid.rowEnd + 1)
  }, [colCount, data.grid.colEnd, data.grid.colStart, data.grid.rowEnd, data.grid.rowStart, rowCount])

  const getGridPointFromPointer = useCallback((event: PointerEvent | ReactPointerEvent | ReactMouseEvent) => {
    const mapElement = mapRef.current
    if (!mapElement) return null
    const rect = mapElement.getBoundingClientRect()
    const colRatio = clamp((event.clientX - rect.left) / rect.width, 0, 1)
    const rowRatio = clamp((event.clientY - rect.top) / rect.height, 0, 1)
    return {
      pointerGridRow: data.grid.rowStart + rowRatio * rowCount,
      pointerGridCol: data.grid.colStart + colRatio * colCount,
    }
  }, [colCount, data.grid.colStart, data.grid.rowStart, rowCount])

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

  const beginSelectPointerGesture = useCallback((event: ReactPointerEvent, component: MapBlockComp | null) => {
    if (!isSelectMode || event.button !== 0) return
    const startGridPoint = getGridPointFromPointer(event)
    if (!startGridPoint) return

    event.stopPropagation()
    const isSelectedComponent = isSelectMoveEnabled && (component?.kind === 'block'
      ? config.selectedBlockIdsFinal.has(component.id)
      : component?.kind === 'group' && config.selectedGroupIds.has(component.id))
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
    if (!isSelectRectDragging && !isSelectMoveDragging && !isSingleDragging && !isMultiRectDragging && !isMultiMoveDragging && !isRectCreating) return undefined

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

      if (isRectCreating) {
        const pointerGridPoint = getGridPointFromPointer(event)
        if (pointerGridPoint) onEvent('updateRectCreateDrag', pointerGridPoint)
        return
      }

      if (config.editDrag.dragType === 'resize' && config.editDrag.resize.edge) {
        const gridLine = getGridLineFromPointer(config.editDrag.resize.edge, event)
        if (gridLine !== null) onEvent('updateRectEdgeDrag', { gridLine })
        return
      }

      if (config.editDrag.dragType === 'vertex' || config.editDrag.dragType === 'segment') {
        const pointerGridPoint = getGridPointFromPointer(event)
        if (pointerGridPoint) onEvent('updatePolygonPointDrag', pointerGridPoint)
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

      if (isRectCreating) {
        suppressNextComponentClick()
        suppressNextMapClick()
        onEvent('commitRectCreateDrag', {})
        return
      }

      suppressNextComponentClick()
      suppressNextMapClick()
      if (config.editDrag.dragType === 'vertex' || config.editDrag.dragType === 'segment') {
        onEvent('commitPolygonPointDrag', {})
        return
      }
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
  }, [config.editDrag.dragType, config.editDrag.isDragging, config.editDrag.resize.edge, config.editMultiSelection.move.isDragging, config.editMultiSelection.rectDrag.isDragging, selectMove.isDragging, config.selectRectDrag.isDragging, getGridLineFromPointer, getGridPointFromPointer, isRectCreating, isSelectMode, onEvent, suppressNextComponentClick, suppressNextMapClick])

  // a press with a tool that makes something (edit mode, tool rect or polygon): on the empty
  // grid and on a component alike, since a new shape may lie over others
  const beginEditToolPointer = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return false
    const pointerGridPoint = getGridPointFromPointer(event)
    if (!pointerGridPoint) return false
    event.preventDefault()
    event.stopPropagation()
    if (editTool === 'rect') onEvent('beginRectCreateDrag', pointerGridPoint)
    if (editTool === 'polygon') onEvent('addPolygonDrawPoint', { ...pointerGridPoint, isAxisLocked: event.shiftKey })
    return true
  }

  const handleComponentClick = (component: MapBlockComp, event: ReactMouseEvent<HTMLButtonElement>) => {
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
      if (!isEditToolSelect) return
      onEvent('selectEditComponent', { componentId: component.id, operation: getSelectionOperationFromEvent(event) })
      return
    }
    if (!isSelectMode) return
    onEvent(component.kind === 'group' ? 'toggleGroupSelection' : 'toggleBlockSelection', {
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
    if (isEditMode && isEditToolSelect) onEvent('clearEditSelection', {})
  }

  const handleMapPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isEditMode && !isEditToolSelect) {
      beginEditToolPointer(event)
      return
    }
    if (event.button !== 0 || event.target !== event.currentTarget) return
    if (isSelectMode) {
      beginSelectPointerGesture(event, null)
      return
    }
    if (!isEditMode) return
    beginEditMultiSelectPointerGesture(event)
  }

  const handleMapPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isEditMode || editTool !== 'polygon') return
    const pointerGridPoint = getGridPointFromPointer(event)
    if (pointerGridPoint) onEvent('movePolygonDrawPointer', { ...pointerGridPoint, isAxisLocked: event.shiftKey })
  }

  const handleMapDoubleClick = () => {
    if (isEditMode && editTool === 'polygon') onEvent('commitPolygonDraw', {})
  }

  const handleMapContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!isEditMode || !onMapContextMenu || event.target !== event.currentTarget) return
    const pointerGridPoint = getGridPointFromPointer(event)
    if (!pointerGridPoint) return
    event.preventDefault()
    onMapContextMenu(pointerGridPoint, event)
  }

  const beginEdgeDrag = (component: MapBlockComp, edge: RectEdge, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (!shapeIsRect(component.shape)) return
    const range = component.shape
    const initialLine = edge === 'left'
      ? range.colStart
      : edge === 'right'
        ? range.colEnd + 1
        : edge === 'top'
          ? range.rowStart
          : range.rowEnd + 1
    onEvent('beginRectEdgeDrag', { componentId: component.id, edge, gridLine: initialLine })
  }

  const beginMoveDrag = (component: MapBlockComp, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (isSelectMode) {
      beginSelectPointerGesture(event, component)
      return
    }
    if (!isEditMode) return
    if (!isEditToolSelect) {
      beginEditToolPointer(event)
      return
    }
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
    onEvent('beginMoveDrag', { componentId: component.id, ...pointerGridPoint })
  }

  const beginPolygonPointDrag = (component: MapBlockComp, eventType: 'beginPolygonVertexDrag' | 'beginPolygonSegmentDrag', index: number, event: ReactPointerEvent<Element>, isInserted = false) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    const pointerGridPoint = getGridPointFromPointer(event)
    if (!pointerGridPoint) return
    onEvent(eventType, { componentId: component.id, index, ...pointerGridPoint, isInserted })
  }

  const updateGridDisplayRange = (key: GridDisplayRangeKey, delta: number) => {
    onEvent('updateGridDisplayRange', { key, delta })
  }

  const renderRangeValueControl = (key: GridDisplayRangeKey, value: number, label: string) => (
    <div className="map-block-range-value" title={label} aria-label={label}>
      <NumValue
        data={{ value }}
        config={{ step: 1 }}
        onEvent={(eventType: string, eventData: Record<string, unknown>) => {
          if (eventType !== 'valueChangeAttempt') return
          const valueNext = Math.round(Number(eventData.value))
          if (Number.isFinite(valueNext) && valueNext !== value) updateGridDisplayRange(key, valueNext - value)
        }}
      />
    </div>
  )

  const renderGridDisplayRangeControls = () => {
    if (!isEditMode) return null

    return (
      <div className="map-block-range-controls" aria-label="Grid display range controls">
        <div className="map-block-range-axis map-block-range-axis-horizontal">
          {renderRangeValueControl('colStart', data.grid.colStart, 'Left display grid index')}
          <div className="map-block-range-symbol map-block-range-symbol-horizontal" aria-hidden />
          {renderRangeValueControl('colEnd', data.grid.colEnd, 'Right display grid index')}
        </div>
        <div className="map-block-range-axis map-block-range-axis-vertical">
          {renderRangeValueControl('rowStart', data.grid.rowStart, 'Top display grid index')}
          <div className="map-block-range-symbol map-block-range-symbol-vertical" aria-hidden />
          {renderRangeValueControl('rowEnd', data.grid.rowEnd, 'Bottom display grid index')}
        </div>
      </div>
    )
  }

  const renderSelectedEditOverlay = () => {
    if (!isEditMode || !isEditToolSelect || !selectedEditComp) return null
    if (shapeIsPolygon(selectedEditComp.shape)) return renderPolygonEditOverlay(selectedEditComp)
    if (!shapeIsRect(selectedEditComp.shape)) return null
    const { top, left, width, height } = getRectPosition(selectedEditComp.shape)

    return (
      <div
        className="map-block-edit-outline"
        style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }}
        aria-hidden
      >
        {(['top', 'right', 'bottom', 'left'] as const).map((edge) => (
          <button
            key={edge}
            type="button"
            className={`map-block-edge-handle map-block-edge-handle-${edge}`}
            onPointerDown={(event) => beginEdgeDrag(selectedEditComp, edge, event)}
            aria-label={`${selectedEditComp.label} ${edge} edge`}
          />
        ))}
      </div>
    )
  }

  // the selected polygon: its outline, a handle on every corner, every segment draggable,
  // and a handle in the middle of every segment adding a corner there
  const renderPolygonEditOverlay = (component: MapBlockComp) => {
    if (!shapeIsPolygon(component.shape)) return null
    const isPointDragging = editPointDrag?.componentId === component.id && (config.editDrag.dragType === 'vertex' || config.editDrag.dragType === 'segment')
    const pointList = isPointDragging && editPointDrag?.pointListCandidate ? editPointDrag.pointListCandidate : component.shape.pointList
    const isValid = !isPointDragging || editPointDrag?.isDropValid !== false
    return (
      <div className={`map-block-polygon-edit ${isValid ? 'is-valid' : 'is-invalid'}`} aria-hidden>
        <svg className="map-block-polygon-edit-svg" viewBox={`${data.grid.colStart} ${data.grid.rowStart} ${colCount} ${rowCount}`} preserveAspectRatio="none">
          <polygon className="map-block-polygon-edit-outline" points={svgPointsText(pointList)} vectorEffect="non-scaling-stroke" />
          {isPointDragging ? null : pointList.map((point, index) => {
            const pointNext = pointList[(index + 1) % pointList.length]
            const isHorizontal = point[0] === pointNext[0]
            const isVertical = point[1] === pointNext[1]
            return (
              <line
                key={`segment-${index}`}
                className={`map-block-polygon-edit-segment ${isHorizontal ? 'is-horizontal' : isVertical ? 'is-vertical' : 'is-slanted'}`}
                x1={point[1]} y1={point[0]} x2={pointNext[1]} y2={pointNext[0]}
                vectorEffect="non-scaling-stroke"
                onPointerDown={(event) => beginPolygonPointDrag(component, 'beginPolygonSegmentDrag', index, event)}
              />
            )
          })}
        </svg>
        {isPointDragging ? null : pointList.map((point, index) => {
          const pointNext = pointList[(index + 1) % pointList.length]
          const { top, left } = getPointPosition([(point[0] + pointNext[0]) / 2, (point[1] + pointNext[1]) / 2])
          return (
            <span
              key={`middle-${index}`}
              className="map-block-polygon-midpoint-handle"
              style={{ top: `${top}%`, left: `${left}%` }}
              title="Drag to add a corner"
              onPointerDown={(event) => beginPolygonPointDrag(component, 'beginPolygonVertexDrag', index + 1, event, true)}
            />
          )
        })}
        {pointList.map((point, index) => {
          const { top, left } = getPointPosition(point)
          const isDragged = isPointDragging && config.editDrag.dragType === 'vertex' && editPointDrag?.index === index
          return (
            <span
              key={`vertex-${index}`}
              className={`map-block-polygon-vertex-handle ${isDragged ? 'is-dragged' : ''}`}
              style={{ top: `${top}%`, left: `${left}%` }}
              title="Drag to move the corner; double-click to remove it"
              onPointerDown={(event) => beginPolygonPointDrag(component, 'beginPolygonVertexDrag', index, event)}
              onDoubleClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onEvent('deletePolygonVertex', { componentId: component.id, index })
              }}
              onContextMenu={(event) => {
                if (!onVertexContextMenu) return
                event.preventDefault()
                event.stopPropagation()
                onVertexContextMenu(component, index, event)
              }}
            />
          )
        })}
      </div>
    )
  }

  // the polygon being drawn (tool polygon): its points, the segment following the pointer,
  // and the first point, which closes it
  const renderPolygonDraw = () => {
    const draw = config.editPolygonDraw
    if (!isEditMode || editTool !== 'polygon' || !draw) return null
    const pointList = draw.pointList
    const pointPointer = draw.pointerPoint
    const pointListShown = pointPointer && pointList.length > 0 ? [...pointList, pointPointer] : pointList
    const pointFirst = pointList[0]
    const isClosing = pointFirst && pointPointer && pointList.length >= 3 && pointFirst[0] === pointPointer[0] && pointFirst[1] === pointPointer[1]
    return (
      <div className={`map-block-polygon-draw ${draw.problem ? 'is-invalid' : ''}`} aria-hidden>
        <svg className="map-block-polygon-edit-svg" viewBox={`${data.grid.colStart} ${data.grid.rowStart} ${colCount} ${rowCount}`} preserveAspectRatio="none">
          {pointList.length >= 3 ? <polygon className="map-block-polygon-draw-fill" points={svgPointsText(pointListShown)} /> : null}
          <polyline className="map-block-polygon-draw-line" points={svgPointsText(pointListShown)} vectorEffect="non-scaling-stroke" />
        </svg>
        {pointList.map((point, index) => {
          const { top, left } = getPointPosition(point)
          return <span key={index} className={`map-block-polygon-draw-point ${index === 0 ? 'is-first' : ''} ${index === 0 && isClosing ? 'is-closing' : ''}`} style={{ top: `${top}%`, left: `${left}%` }} />
        })}
        {pointPointer ? (() => {
          const { top, left } = getPointPosition(pointPointer)
          return <span className="map-block-polygon-draw-pointer" style={{ top: `${top}%`, left: `${left}%` }} />
        })() : null}
      </div>
    )
  }

  const renderRectCreateGhost = () => {
    const rectCreate = config.editRectCreate
    if (!isEditMode || !rectCreate?.isDragging || !rectCreate.cellStart || !rectCreate.cellCurrent) return null
    const { top, left, width, height } = getRectPosition({
      rowStart: Math.min(rectCreate.cellStart[0], rectCreate.cellCurrent[0]),
      rowEnd: Math.max(rectCreate.cellStart[0], rectCreate.cellCurrent[0]),
      colStart: Math.min(rectCreate.cellStart[1], rectCreate.cellCurrent[1]),
      colEnd: Math.max(rectCreate.cellStart[1], rectCreate.cellCurrent[1]),
    })
    return <div className="map-block-rect-create-ghost" style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }} aria-hidden />
  }

  const renderDragIndicator = () => {
    if (!isEditMode || !config.editDrag.isDragging || config.editDrag.dragType !== 'resize' || !config.editDrag.resize.edge || config.editDrag.resize.gridLine === null) return null
    const isVertical = config.editDrag.resize.edge === 'left' || config.editDrag.resize.edge === 'right'
    const linePosition = isVertical
      ? ((config.editDrag.resize.gridLine - data.grid.colStart) / colCount) * 100
      : ((config.editDrag.resize.gridLine - data.grid.rowStart) / rowCount) * 100
    const indicatorClassName = `map-block-drag-indicator ${isVertical ? 'is-vertical' : 'is-horizontal'} ${config.editDrag.resize.isDropValid ? 'is-valid' : 'is-invalid'}`

    return <div className={indicatorClassName} style={isVertical ? { left: `${linePosition}%` } : { top: `${linePosition}%` }} aria-hidden />
  }

  const renderMoveGhost = () => {
    const move = config.editDrag.move
    if (!isEditMode || !config.editDrag.isDragging || config.editDrag.dragType !== 'move' || !move.componentId || !move.candidateRange) return null
    const component = data.compList.find((componentItem) => componentItem.id === move.componentId)
    if (!component) return null
    const groupId = component.kind === 'group' ? component.id : groupIdByBlockId.get(component.id)
    const colorClassName = groupId ? colorClassByGroupId.get(groupId) : ''
    const group = groupId ? groupById.get(groupId) : null
    const colorValue = typeof group?.color === 'string' ? group.color : undefined
    const { top, left, width, height } = getRectPosition(move.candidateRange)
    const shapeGhost = shapeIsPolygon(component.shape) && move.originalRange
      ? shapeShift(component.shape, move.candidateRange.rowStart - move.originalRange.rowStart, move.candidateRange.colStart - move.originalRange.colStart)
      : null
    const style = { top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%`, backgroundColor: colorValue, ...(shapeGhost ? { clipPath: polygonClipPathGet(shapeGhost) } : {}) } as CSSProperties

    return (
      <div
        className={`map-block-move-ghost map-block-render-${component.kind} ${colorClassName ?? ''}`}
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
    const className = `map-block-multi-move-bounding-box ${move.isDropValid ? 'is-valid' : 'is-invalid'}`
    return <div className={className} style={{ top: `${top}%`, left: `${left}%`, width: `${width}%`, height: `${height}%` }} aria-hidden />
  }

  const isMultiSelecting = config.editMultiSelection.rectDrag.isDragging || config.selectRectDrag.isDragging || isRectCreating

  return (
    <section className="map-block">
      <div
        className={`map-block-map-frame ${isEditMode ? 'is-edit-mode' : ''}`}
        style={{ '--map-block-map-width-max': `${mapWidthMax}px` } as CSSProperties}
      >
        {renderGridDisplayRangeControls()}
        <div
          ref={mapRef}
          className={`map-block-map ${isEditMode ? 'is-edit-mode' : ''} ${isMultiSelecting ? 'is-multi-selecting' : ''} ${isEditMode ? `is-tool-${editTool}` : ''}`}
          style={{
            aspectRatio: mapAspectRatio,
            backgroundColor: config.backgroundColor,
            '--tile-grid-cols': colCount,
            '--tile-grid-rows': rowCount,
          } as CSSProperties}
          aria-label={data.label}
          tabIndex={isEditMode ? -1 : undefined}
          onClick={handleMapClick}
          onPointerDown={handleMapPointerDown}
          onPointerMove={handleMapPointerMove}
          onDoubleClick={handleMapDoubleClick}
          onContextMenu={handleMapContextMenu}
        >
          {isEditMode ? <div className="map-block-grid-lines" aria-hidden /> : null}
          {data.compList.map((component) => {
            const range = shapeCellRectGet(component.shape)
            if (!range) return null
            const groupId = component.kind === 'group' ? component.id : groupIdByBlockId.get(component.id)
            const colorClassName = groupId ? colorClassByGroupId.get(groupId) : ''
            const isSelectedDirect = component.kind === 'block' && config.selectedBlockIds.has(component.id)
            const isSelectedFinal = component.kind === 'block'
              ? config.selectedBlockIdsFinal.has(component.id)
              : config.selectedGroupIds.has(component.id)
            const isDisabled = config.disabledComponentIds?.has(component.id) === true
            const isEditSelected = isEditMode && config.editSelectedComponentId === component.id
            const isEditMultiSelected = isEditMode && config.editSelectionMode === 'multi' && config.editMultiSelection.selectedComponentIds.has(component.id)
            const isPolygon = shapeIsPolygon(component.shape)
            const { top, left, width, height } = getRectPosition(range)
            const group = groupId ? groupById.get(groupId) : null
            const colorValue = typeof group?.color === 'string' ? group.color : undefined
            const style = {
              top: `${top}%`,
              left: `${left}%`,
              width: `${width}%`,
              height: `${height}%`,
              backgroundColor: colorValue,
              ...(isPolygon ? { clipPath: polygonClipPathGet(component.shape) } : {}),
            } as CSSProperties
            const label = config.renderComponentLabel?.(component) ?? component.label

            return (
              <button
                key={component.id}
                type="button"
                className={`map-block-map-component map-block-render-${component.kind} ${colorClassName ?? ''} ${isPolygon ? 'is-shape-polygon' : ''} ${isSelectedFinal ? 'is-selected-final' : ''} ${isSelectedDirect ? 'is-selected-direct' : ''} ${isDisabled ? 'is-disabled' : ''} ${isEditSelected ? 'is-edit-selected' : ''} ${isEditMultiSelected ? 'is-edit-multi-selected' : ''}`}
                style={style}
                aria-pressed={isEditMode ? isEditSelected || isEditMultiSelected : isSelectedFinal}
                disabled={isDisabled}
                draggable={false}
                title={component.label}
                onDragStart={(event) => event.preventDefault()}
                onContextMenu={(event) => onComponentContextMenu(component, event)}
                onPointerDown={(event) => beginMoveDrag(component, event)}
                onClick={(event) => handleComponentClick(component, event)}
                onDoubleClick={(event) => {
                  if (isEditMode && editTool === 'polygon') {
                    event.preventDefault()
                    event.stopPropagation()
                    onEvent('commitPolygonDraw', {})
                    return
                  }
                  if (isEditMode && editTool !== 'select') return
                  onComponentDoubleClick(component, event)
                }}
              >
                {isPolygon ? <PolygonShapeOutline shape={component.shape} range={range} isSelectedFinal={isSelectedFinal} isSelectedDirect={isSelectedDirect} /> : null}
                {isPolygon ? (
                  <span className="map-block-shape-label" style={polygonLabelStyleGet(component.shape, range)}>{label}</span>
                ) : (
                  <span>{label}</span>
                )}
              </button>
            )
          })}
          {renderMoveGhost()}
          {renderMultiMoveBoundingBox()}
          {renderMultiSelectionRectangle()}
          {renderRectCreateGhost()}
          {renderSelectedEditOverlay()}
          {renderDragIndicator()}
          {renderPolygonDraw()}
        </div>
      </div>
    </section>
  )
})

// the border of a polygon block, drawn over its fill (the fill is the button itself, cut to the
// polygon by clip-path, which also limits the pointer to the polygon). the stroke is centered on
// the outline, so half of it is cut away: what remains reads as the border of a rectangle
const PolygonShapeOutline = ({ shape, range, isSelectedFinal, isSelectedDirect }: { shape: MapBlockShape; range: GridRectRange; isSelectedFinal: boolean; isSelectedDirect: boolean }) => {
  if (!shapeIsPolygon(shape)) return null
  const pointsText = svgPointsText(shape.pointList)
  const labelPoint = polygonLabelPointGet(shape.pointList)
  return (
    <svg className="map-block-shape-outline" viewBox={`${range.colStart} ${range.rowStart} ${range.colEnd - range.colStart + 1} ${range.rowEnd - range.rowStart + 1}`} preserveAspectRatio="none" aria-hidden>
      {isSelectedFinal ? <polygon className="map-block-shape-ring-selected" points={pointsText} vectorEffect="non-scaling-stroke" /> : null}
      <polygon className="map-block-shape-ring" points={pointsText} vectorEffect="non-scaling-stroke" />
      {isSelectedDirect ? <circle className="map-block-shape-dot" cx={labelPoint[1] + 0.3} cy={labelPoint[0] + 0.3} r={0.07} /> : null}
    </svg>
  )
}

const GridSelectionRectangle = ({ style, includeMode }: { style: CSSProperties; includeMode: EditMultiSelectIncludeMode | null }) => (
  <div className={`map-block-selection-rectangle ${includeMode === 'full' ? 'is-full-include' : 'is-partial-include'}`} style={style} aria-hidden />
)

function getSelectionOperationFromEvent(event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }): SelectionOperation {
  if (event.ctrlKey || event.metaKey) return 'toggle'
  if (event.shiftKey) return 'add'
  return 'replace'
}

function buildGroupIdByBlockId(groups: readonly MapBlockGroup[]) {
  const groupIdByBlockId = new Map<string, string>()
  for (const group of groups) {
    for (const childId of group.childIdList) {
      groupIdByBlockId.set(childId, group.id)
    }
  }
  return groupIdByBlockId
}

function buildColorClassByGroupId(groups: readonly MapBlockGroup[]) {
  const colorClassByGroupId = new Map<string, string>()
  groups.forEach((group, index) => {
    colorClassByGroupId.set(group.id, `map-block-color-${groupColorByIndex[index % groupColorByIndex.length]}`)
  })
  return colorClassByGroupId
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function svgPointsText(pointList: readonly GridPoint[]) {
  return pointList.map(([row, col]) => `${col},${row}`).join(' ')
}

// the polygon as a clip-path of its bounding box, in percent of the box
function polygonClipPathGet(shape: MapBlockShape) {
  if (!shapeIsPolygon(shape)) return undefined
  const range = shapeCellRectGet(shape)!
  const width = range.colEnd - range.colStart + 1
  const height = range.rowEnd - range.rowStart + 1
  const pointTextList = shape.pointList.map(([row, col]) => `${(((col - range.colStart) / width) * 100).toFixed(4)}% ${(((row - range.rowStart) / height) * 100).toFixed(4)}%`)
  return `polygon(${pointTextList.join(', ')})`
}

// the label of a polygon at a point inside it, not at the middle of its box
function polygonLabelStyleGet(shape: MapBlockShape, range: GridRectRange): CSSProperties {
  if (!shapeIsPolygon(shape)) return {}
  const [row, col] = polygonLabelPointGet(shape.pointList)
  const width = range.colEnd - range.colStart + 1
  const height = range.rowEnd - range.rowStart + 1
  return {
    top: `${((row - range.rowStart) / height) * 100}%`,
    left: `${((col - range.colStart) / width) * 100}%`,
  }
}

export default MapBlockRender
