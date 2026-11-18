import { makeAutoObservable } from 'mobx'
import { chooseAnchoredPopupPos, rectFromViewportSize } from './popupPlacement'
import { handleMapBlockEvent } from './MapBlockStoreEvent'
import {
  beginEditMultiMoveDrag as beginEditMultiMoveDragAction,
  beginMoveDrag as beginMoveDragAction,
  beginPropEditorDrag as beginPropEditorDragAction,
  beginSelectMoveDrag as beginSelectMoveDragAction,
  cancelEditMultiMoveDrag as cancelEditMultiMoveDragAction,
  cancelMoveDrag as cancelMoveDragAction,
  cancelSelectMoveDrag as cancelSelectMoveDragAction,
  clearEditMultiMoveDrag as clearEditMultiMoveDragAction,
  clearMoveDrag as clearMoveDragAction,
  clearSelectMoveDrag as clearSelectMoveDragAction,
  commitEditMultiMoveDrag as commitEditMultiMoveDragAction,
  commitMoveDrag as commitMoveDragAction,
  commitSelectMoveDrag as commitSelectMoveDragAction,
  endPropEditorDrag as endPropEditorDragAction,
  movePropEditorDrag as movePropEditorDragAction,
  updateEditMultiMoveDrag as updateEditMultiMoveDragAction,
  updateMoveDrag as updateMoveDragAction,
  updateSelectMoveDrag as updateSelectMoveDragAction,
} from './MapBlockStoreMove'
import {
  beginRectEdgeDrag as beginRectEdgeDragAction,
  cancelRectEdgeDrag as cancelRectEdgeDragAction,
  clearRectEdgeDrag as clearRectEdgeDragAction,
  commitRectEdgeDrag as commitRectEdgeDragAction,
  getRangeAfterEdgeDrop as getRangeAfterEdgeDropAction,
  isGridLineValidForEdge as isGridLineValidForEdgeAction,
  updateRectEdgeDrag as updateRectEdgeDragAction,
} from './MapBlockStoreResize'
import {
  beginEditMultiSelectRectDrag as beginEditMultiSelectRectDragAction,
  beginSelectRectDrag as beginSelectRectDragAction,
  cancelEditMultiSelectRectDrag as cancelEditMultiSelectRectDragAction,
  cancelSelectRectDrag as cancelSelectRectDragAction,
  clearEditMultiSelectRectDrag as clearEditMultiSelectRectDragAction,
  clearSelectRectDrag as clearSelectRectDragAction,
  commitEditMultiSelectRectDrag as commitEditMultiSelectRectDragAction,
  commitSelectRectDrag as commitSelectRectDragAction,
  isComponentIncludedInEditSelectionBox as isComponentIncludedInEditSelectionBoxAction,
  isComponentIncludedInSelectionBox as isComponentIncludedInSelectionBoxAction,
  updateEditMultiSelectRectDrag as updateEditMultiSelectRectDragAction,
  updateSelectRectDrag as updateSelectRectDragAction,
} from './MapBlockStoreSelection'
import {
  getSelectionCandidateBlockComponents as getSelectionCandidateBlockComponentsAction,
  rebuildSelectionSpatialIndex as rebuildSelectionSpatialIndexAction,
} from './MapBlockStoreSpatialIndex'
import {
  beginRectCreateDrag as beginRectCreateDragAction,
  beginPolygonSegmentDrag as beginPolygonSegmentDragAction,
  beginPolygonVertexDrag as beginPolygonVertexDragAction,
  cancelPolygonDraw as cancelPolygonDrawAction,
  cancelPolygonPointDrag as cancelPolygonPointDragAction,
  cancelRectCreateDrag as cancelRectCreateDragAction,
  commitPolygonDraw as commitPolygonDrawAction,
  commitPolygonPointDrag as commitPolygonPointDragAction,
  commitRectCreateDrag as commitRectCreateDragAction,
  deletePolygonVertex as deletePolygonVertexAction,
  movePolygonDrawPointer as movePolygonDrawPointerAction,
  addPolygonDrawPoint as addPolygonDrawPointAction,
  removePolygonDrawPointLast as removePolygonDrawPointLastAction,
  updatePolygonPointDrag as updatePolygonPointDragAction,
  updateRectCreateDrag as updateRectCreateDragAction,
} from './MapBlockStorePolygon'
import {
  MAP_BLOCK_MAP_WIDTH_MAX,
  MAP_BLOCK_MAP_WIDTH_MIN,
  MAP_BLOCK_VIEW_DEFAULT,
  colorValueNormalize,
  mapBlockDataNewBuild,
  mapBlockDataNormalize,
  mapBlockDataTextBuild,
  rectNormalize,
  shapeCellRectGet,
  shapeDensityDouble,
  shapeDensityHalve,
  shapeDensityIsHalvable,
  shapeIsPolygon,
  shapeIsRect,
  shapePolygonBuild,
  shapePolygonToRect,
  shapePointListGet,
  gridLineDouble,
  gridLineHalve,
  gridLineIsHalvable,
  type GridBoxRange,
  type GridPoint,
  type GridRectRange,
  type MapBlockComp,
  type MapBlockData,
  type MapBlockGroup,
  type MapBlockShape,
  type MapBlockTextFormat,
} from './MapBlockData'

// The store of one block map (doc/map-block.md#the-store): the map's data, and the state of
// every interaction with it, by mode. It is the truth for MapBlockRender, which only renders
// it and reports what the pointer did (handleEvent).
//
// Reading order: the state (config) first, then the derived values (getters), then the
// changes of the data, which all go through dataChange so that undo covers them, then the
// selection of the mode select, then the edit mode's operations, most of them in the
// MapBlockStore*.ts files beside this one.

export type MapBlockMode = 'select' | 'display' | 'edit'
export type MapObjDataFormat = MapBlockTextFormat
export type EditSelectionMode = 'single' | 'multi'
export type EditMultiSelectIncludeMode = 'partial' | 'full'
export type RectEdge = 'left' | 'right' | 'top' | 'bottom'
export type EditDragType = 'resize' | 'move' | 'vertex' | 'segment'
export type EditTool = 'select' | 'rect' | 'polygon'
export type SelectionOperation = 'replace' | 'add' | 'toggle'
export type SelectionSpatialIndexMode = 'linear' | 'rbush'
export type GridDisplayRangeKey = 'rowStart' | 'rowEnd' | 'colStart' | 'colEnd'
export type PropEditorPropertyKey = 'label' | 'color' | 'group' | 'range.rowStart' | 'range.rowEnd' | 'range.colStart' | 'range.colEnd'

type ViewRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

type ViewSize = {
  width: number
  height: number
}

const historyLengthMax = 200
const groupColorHexByIndex = ['#BCEEE0FF', '#F3E889FF', '#F2A391FF', '#EE8CADFF', '#B994D1FF', '#8A91D9FF']

export type MapBlockEventType =
  | 'setMode'
  | 'toggleBlockSelection'
  | 'toggleGroupSelection'
  | 'clearSelection'
  | 'beginSelectRectDrag'
  | 'updateSelectRectDrag'
  | 'commitSelectRectDrag'
  | 'cancelSelectRectDrag'
  | 'beginSelectMoveDrag'
  | 'updateSelectMoveDrag'
  | 'commitSelectMoveDrag'
  | 'cancelSelectMoveDrag'
  | 'selectEditComponent'
  | 'clearEditSelection'
  | 'beginEditMultiSelectRectDrag'
  | 'updateEditMultiSelectRectDrag'
  | 'commitEditMultiSelectRectDrag'
  | 'cancelEditMultiSelectRectDrag'
  | 'beginEditMultiMoveDrag'
  | 'updateEditMultiMoveDrag'
  | 'commitEditMultiMoveDrag'
  | 'cancelEditMultiMoveDrag'
  | 'beginRectEdgeDrag'
  | 'updateRectEdgeDrag'
  | 'commitRectEdgeDrag'
  | 'cancelRectEdgeDrag'
  | 'beginMoveDrag'
  | 'updateMoveDrag'
  | 'commitMoveDrag'
  | 'cancelMoveDrag'
  | 'updateGridDisplayRange'
  | 'refreshMapObjData'
  | 'setMapObjDataFormat'
  | 'increaseGridDensity'
  | 'decreaseGridDensity'
  | 'decreaseGridDensityCancel'
  | 'setEditTool'
  | 'undo'
  | 'redo'
  | 'beginRectCreateDrag'
  | 'updateRectCreateDrag'
  | 'commitRectCreateDrag'
  | 'cancelRectCreateDrag'
  | 'addPolygonDrawPoint'
  | 'movePolygonDrawPointer'
  | 'removePolygonDrawPointLast'
  | 'commitPolygonDraw'
  | 'cancelPolygonDraw'
  | 'beginPolygonVertexDrag'
  | 'beginPolygonSegmentDrag'
  | 'updatePolygonPointDrag'
  | 'commitPolygonPointDrag'
  | 'cancelPolygonPointDrag'
  | 'deletePolygonVertex'
  | 'createGroupAt'
  | 'createBlockAt'

export type MapBlockEventData = Record<string, unknown>

export class MapBlockStore {
  data: MapBlockData
  config = {
    mode: 'display' as MapBlockMode,
    selectionSpatialIndexMode: 'rbush' as SelectionSpatialIndexMode,
    modeState: {
      select: {
        selectedBlockIds: new Set<string>(),
        selectedGroupIds: new Set<string>(),
        rectDrag: {
          isDragging: false,
          pointerStartRow: null as number | null,
          pointerStartCol: null as number | null,
          pointerCurrentRow: null as number | null,
          pointerCurrentCol: null as number | null,
          candidateBox: null as GridBoxRange | null,
          includeMode: null as EditMultiSelectIncludeMode | null,
          operation: 'replace' as SelectionOperation,
        },
        move: {
          isDragging: false,
          pointerGridRow: null as number | null,
          pointerGridCol: null as number | null,
          pointerOffsetRow: null as number | null,
          pointerOffsetCol: null as number | null,
          originalShapes: new Map<string, MapBlockShape>(),
          originalBoundingRange: null as GridRectRange | null,
          candidateBoundingRange: null as GridRectRange | null,
          rowDelta: 0,
          colDelta: 0,
          isDropValid: true,
        },
      },
      display: {},
      edit: {
        tool: 'select' as EditTool,
        selectionMode: 'single' as EditSelectionMode,
        selectedComponentId: null as string | null,
        // what the last refused operation said, until the next one
        message: '',
        drag: {
          isDragging: false,
          dragType: null as EditDragType | null,
          resize: {
            componentId: null as string | null,
            edge: null as RectEdge | null,
            gridLine: null as number | null,
            isDropValid: true,
          },
          move: {
            componentId: null as string | null,
            pointerGridRow: null as number | null,
            pointerGridCol: null as number | null,
            pointerOffsetRow: null as number | null,
            pointerOffsetCol: null as number | null,
            originalShape: null as MapBlockShape | null,
            originalRange: null as GridRectRange | null,
            candidateRange: null as GridRectRange | null,
            isDropValid: true,
          },
          // a point of a polygon dragged (vertex), or the two ends of one of its segments
          point: {
            componentId: null as string | null,
            index: null as number | null,
            pointerStart: null as GridPoint | null,
            pointListOriginal: null as GridPoint[] | null,
            pointListCandidate: null as GridPoint[] | null,
            isDropValid: true,
            problem: '',
          },
        },
        // a new rectangular block dragged out on the grid (tool rect)
        rectCreate: {
          isDragging: false,
          cellStart: null as GridPoint | null,
          cellCurrent: null as GridPoint | null,
        },
        // a new polygon block, its points clicked one by one (tool polygon)
        polygonDraw: {
          pointList: [] as GridPoint[],
          pointerPoint: null as GridPoint | null,
          problem: '',
        },
        // halving the density would change some shapes: they are named, and the user decides
        densityHalve: {
          isAsked: false,
          componentLabelList: [] as string[],
        },
        multiSelection: {
          selectedComponentIds: new Set<string>(),
          rectDrag: {
            isDragging: false,
            pointerStartRow: null as number | null,
            pointerStartCol: null as number | null,
            pointerCurrentRow: null as number | null,
            pointerCurrentCol: null as number | null,
            candidateBox: null as GridBoxRange | null,
            includeMode: null as EditMultiSelectIncludeMode | null,
            operation: 'replace' as SelectionOperation,
          },
          move: {
            isDragging: false,
            pointerGridRow: null as number | null,
            pointerGridCol: null as number | null,
            pointerOffsetRow: null as number | null,
            pointerOffsetCol: null as number | null,
            originalShapes: new Map<string, MapBlockShape>(),
            originalBoundingRange: null as GridRectRange | null,
            candidateBoundingRange: null as GridRectRange | null,
            rowDelta: 0,
            colDelta: 0,
            isDropValid: true,
          },
        },
        propEditor: {
          isShown: false,
          componentId: null as string | null,
          levelTopSelectedId: 'basic',
          pos: { x: 0, y: 0 },
          popupSize: { width: 300, height: 300 },
          groupCollapsedByPath: {} as Record<string, boolean>,
          drag: {
            isDragging: false,
            xStart: 0,
            yStart: 0,
            xOrigin: 0,
            yOrigin: 0,
          },
        },
      },
    },
    mapConfigEditor: {
      levelTopSelectedId: 'view',
      groupCollapsedByPath: {} as Record<string, boolean>,
    },
    mapObjData: '',
    mapObjDataFormat: 'tight' as MapObjDataFormat,
  }

  // the states of the data before each change (undo) and after each undone one (redo), as text
  history = {
    undoList: [] as string[],
    redoList: [] as string[],
  }

  // the text of the data as last loaded or saved: what tells whether there is something to save
  dataTextSaved = ''

  constructor(data?: unknown) {
    this.data = mapBlockDataNormalize(data ?? mapBlockDataNewBuild('Map'))
    this.config.mapObjData = this.getMapObjDataText()
    this.dataTextSaved = mapBlockDataTextBuild(this.data, 'tight')
    makeAutoObservable(this, {}, { autoBind: true })
    this.rebuildSelectionSpatialIndex()
  }

  get selectState() {
    return this.config.modeState.select
  }

  get editState() {
    return this.config.modeState.edit
  }

  get mapConfigEditorState() {
    return this.config.mapConfigEditor
  }

  get blockComponents() {
    return this.data.compList.filter((component) => component.kind === 'block')
  }

  get groupComponents() {
    return this.data.compList.filter((component): component is MapBlockGroup => component.kind === 'group')
  }

  get componentById() {
    return new Map(this.data.compList.map((component) => [component.id, component]))
  }

  get groupByBlockId() {
    const groupByBlockId = new Map<string, MapBlockGroup>()
    for (const group of this.groupComponents) {
      for (const childId of group.childIdList) {
        groupByBlockId.set(childId, group)
      }
    }
    return groupByBlockId
  }

  get dataTextTight() {
    return mapBlockDataTextBuild(this.data, 'tight')
  }

  get isDirty() {
    return this.dataTextTight !== this.dataTextSaved
  }

  get isUndoAvailable() {
    return this.history.undoList.length > 0
  }

  get isRedoAvailable() {
    return this.history.redoList.length > 0
  }

  getBlockColorValue(componentId: string) {
    const group = this.groupByBlockId.get(componentId)
    const colorValue = group?.color
    if (typeof colorValue === 'string' && colorValue) return colorValue

    const groupIndex = group ? this.groupComponents.findIndex((groupItem) => groupItem.id === group.id) : 0
    return groupColorHexByIndex[Math.max(0, groupIndex) % groupColorHexByIndex.length]
  }

  get selectedEditComp() {
    const componentId = this.editState.selectedComponentId
    return componentId ? this.componentById.get(componentId) ?? null : null
  }

  get editMultiSelectionState() {
    return this.editState.multiSelection
  }

  get editPropEditorState() {
    return this.editState.propEditor
  }

  get propEditorConfig() {
    const component = this.editPropEditorState.componentId ? this.componentById.get(this.editPropEditorState.componentId) : null
    return {
      titleText: component ? `${component.label} Properties` : 'Block Properties',
      groupCollapsedByPath: this.editPropEditorState.groupCollapsedByPath,
    }
  }

  get propEditorData() {
    const component = this.editPropEditorState.componentId ? this.componentById.get(this.editPropEditorState.componentId) : null
    if (!component || component.kind !== 'block') return null

    const groupOfBlock = this.groupByBlockId.get(component.id)
    const propertyById: Record<string, Record<string, unknown>> = {
      label: { id: 'label', label: 'Label', valueType: 'text', value: component.label },
      color: { id: 'color', label: 'Color', valueType: 'color', value: this.getBlockColorValue(component.id) },
      group: {
        id: 'group',
        label: 'Group',
        valueType: 'enum',
        // a few groups side by side, more in a list (a map of regions has six or more)
        displayType: this.groupComponents.length > 2 ? 'radio-vertical' : 'segmented',
        value: groupOfBlock?.id ?? '',
        optionList: [
          { id: '', label: 'None' },
          ...this.groupComponents.map((group) => ({ id: group.id, label: group.label })),
        ],
      },
    }
    const layoutChildren: Array<{ id: string; type: 'property' }> = []

    if (shapeIsRect(component.shape)) {
      const range = component.shape
      propertyById['range.rowStart'] = { id: 'range.rowStart', label: 'Row Start', valueType: 'number', step: 1, value: range.rowStart, min: this.data.grid.rowStart, max: this.data.grid.rowEnd }
      propertyById['range.rowEnd'] = { id: 'range.rowEnd', label: 'Row End', valueType: 'number', step: 1, value: range.rowEnd, min: this.data.grid.rowStart, max: this.data.grid.rowEnd }
      propertyById['range.colStart'] = { id: 'range.colStart', label: 'Col Start', valueType: 'number', step: 1, value: range.colStart, min: this.data.grid.colStart, max: this.data.grid.colEnd }
      propertyById['range.colEnd'] = { id: 'range.colEnd', label: 'Col End', valueType: 'number', step: 1, value: range.colEnd, min: this.data.grid.colStart, max: this.data.grid.colEnd }
      layoutChildren.push(
        { id: 'range.rowStart', type: 'property' },
        { id: 'range.rowEnd', type: 'property' },
        { id: 'range.colStart', type: 'property' },
        { id: 'range.colEnd', type: 'property' },
      )
    } else {
      propertyById['shape.pointCount'] = { id: 'shape.pointCount', label: 'Corners', valueType: 'text', value: String(component.shape.pointList.length), isReadOnly: true }
      layoutChildren.push({ id: 'shape.pointCount', type: 'property' })
    }

    return {
      levelTopSelectedId: this.editPropEditorState.levelTopSelectedId,
      levelTopList: [
        {
          id: 'basic',
          label: 'Basic',
          children: [
            { id: 'label', type: 'property' },
            { id: 'color', type: 'property' },
            { id: 'group', type: 'property' },
          ],
        },
        {
          id: 'layout',
          label: 'Layout',
          children: layoutChildren,
        },
      ],
      propertyById,
    }
  }

  get mapViewConfig() {
    const view = this.data.view ?? MAP_BLOCK_VIEW_DEFAULT
    return {
      ...MAP_BLOCK_VIEW_DEFAULT,
      ...view,
      groupGreyedIdList: Array.isArray(view.groupGreyedIdList) ? view.groupGreyedIdList : [],
    }
  }

  get mapDisabledComponentIds() {
    const componentIds = new Set<string>()
    const groupGreyedIdSet = new Set(this.mapViewConfig.groupGreyedIdList)
    for (const group of this.groupComponents) {
      if (!groupGreyedIdSet.has(group.id)) continue
      componentIds.add(group.id)
      for (const childId of group.childIdList) componentIds.add(childId)
    }
    return componentIds
  }

  get mapConfigEditorData() {
    const view = this.mapViewConfig
    const groupGreyedIdSet = new Set(view.groupGreyedIdList)
    const propertyById: Record<string, Record<string, unknown>> = {
      'config.mode': { id: 'config.mode', label: 'Mode', valueType: 'enum', value: this.config.mode, optionList: [
        { id: 'display', label: 'Display' },
        { id: 'select', label: 'Select' },
        { id: 'edit', label: 'Edit' },
      ] },
      'view.mapWidthMax': { id: 'view.mapWidthMax', label: 'Map Width', valueType: 'number', min: MAP_BLOCK_MAP_WIDTH_MIN, max: MAP_BLOCK_MAP_WIDTH_MAX, step: 10, value: view.mapWidthMax },
      'grid.cellAspectRatio.width': { id: 'grid.cellAspectRatio.width', label: 'Cell Width', valueType: 'number', min: 0.2, max: 2.5, step: 0.05, value: this.data.grid.cellAspectRatio.width },
      'grid.cellAspectRatio.height': { id: 'grid.cellAspectRatio.height', label: 'Cell Height', valueType: 'number', min: 0.2, max: 2.5, step: 0.05, value: this.data.grid.cellAspectRatio.height },
      'view.backgroundColor': { id: 'view.backgroundColor', label: 'Background', valueType: 'color', value: view.backgroundColor },
      ...Object.fromEntries(this.groupComponents.map((group) => [
        `view.groupGreyed.${group.id}`,
        { id: `view.groupGreyed.${group.id}`, label: group.label, valueType: 'bool', value: groupGreyedIdSet.has(group.id) },
      ])),
    }

    return {
      levelTopSelectedId: this.mapConfigEditorState.levelTopSelectedId,
      propertyById,
      levelTopList: [
        {
          id: 'view',
          label: 'View',
          children: [
            {
              id: 'layout',
              label: 'Layout',
              type: 'group',
              children: [
                { id: 'config.mode', type: 'property' },
                { id: 'view.mapWidthMax', type: 'property' },
                { id: 'grid.cellAspectRatio.width', type: 'property' },
                { id: 'grid.cellAspectRatio.height', type: 'property' },
                { id: 'view.backgroundColor', type: 'property' },
              ],
            },
          ],
        },
        {
          id: 'greyOut',
          label: 'Grey Out',
          children: [
            {
              id: 'groups',
              label: 'Groups',
              type: 'group',
              children: this.groupComponents.map((group) => ({ id: `view.groupGreyed.${group.id}`, type: 'property' })),
            },
          ],
        },
      ],
    }
  }

  get selectedEditMultiComponents() {
    return Array.from(this.editMultiSelectionState.selectedComponentIds)
      .map((componentId) => this.componentById.get(componentId))
      .filter((component): component is MapBlockComp => component !== undefined)
  }

  get selectedBlockIdsFinal() {
    const selectedIds = new Set(this.selectState.selectedBlockIds)
    for (const group of this.groupComponents) {
      if (!this.selectState.selectedGroupIds.has(group.id)) continue
      for (const childId of group.childIdList) {
        const child = this.componentById.get(childId)
        if (child?.kind === 'block') {
          selectedIds.add(childId)
        }
      }
    }
    return selectedIds
  }

  get selectedBlockLabelsFinal() {
    const selectedIds = this.selectedBlockIdsFinal
    return this.blockComponents
      .filter((component) => selectedIds.has(component.id))
      .map((component) => component.label)
  }

  get selectedGroupLabels() {
    return this.groupComponents
      .filter((component) => this.selectState.selectedGroupIds.has(component.id))
      .map((component) => component.label)
  }

  getMapObjDataText(format: MapObjDataFormat = this.config.mapObjDataFormat) {
    return mapBlockDataTextBuild(this.data, format)
  }

  updateMapObjData() {
    this.config.mapObjData = this.getMapObjDataText()
  }

  commitGeometryChange() {
    this.updateMapObjData()
    this.rebuildSelectionSpatialIndex()
  }

  rebuildSelectionSpatialIndex() {
    rebuildSelectionSpatialIndexAction(this)
  }

  getSelectionCandidateBlockComponents(box: GridBoxRange) {
    return getSelectionCandidateBlockComponentsAction(this, box)
  }

  // ---------- the data: loading, saving, and every change, which undo covers ----------

  // a map loaded: the history starts again, and the map counts as saved
  setData(data: unknown) {
    this.data = mapBlockDataNormalize(data)
    this.clearEditSelection()
    this.closePropEditor()
    this.clearSelection()
    this.history.undoList = []
    this.history.redoList = []
    this.dataTextSaved = mapBlockDataTextBuild(this.data, 'tight')
    this.editState.densityHalve.isAsked = false
    this.editState.message = ''
    this.commitGeometryChange()
  }

  // the data as it is now is what is saved (after a write of its owner succeeded)
  markSaved(text = this.dataTextTight) {
    this.dataTextSaved = text
  }

  // the state before a change, kept for undo; a new change drops what could be redone
  historyCheckpoint(textBefore = mapBlockDataTextBuild(this.data, 'tight')) {
    this.history.undoList.push(textBefore)
    if (this.history.undoList.length > historyLengthMax) this.history.undoList.shift()
    this.history.redoList = []
  }

  // a change of the data, and what depends on the geometry rebuilt. only a change that changed
  // something is kept for undo: a click ending a drag that went nowhere leaves no step
  dataChange(change: () => void) {
    const textBefore = mapBlockDataTextBuild(this.data, 'tight')
    change()
    if (mapBlockDataTextBuild(this.data, 'tight') !== textBefore) this.historyCheckpoint(textBefore)
    this.commitGeometryChange()
  }

  undo() {
    const text = this.history.undoList.pop()
    if (text === undefined) return { code: -1, message: 'Nothing to undo' }
    this.history.redoList.push(mapBlockDataTextBuild(this.data, 'tight'))
    this.dataRestore(text)
    return { code: 0 }
  }

  redo() {
    const text = this.history.redoList.pop()
    if (text === undefined) return { code: -1, message: 'Nothing to redo' }
    this.history.undoList.push(mapBlockDataTextBuild(this.data, 'tight'))
    this.dataRestore(text)
    return { code: 0 }
  }

  // a state of the history put back; what is selected and no longer exists is let go
  private dataRestore(text: string) {
    this.data = mapBlockDataNormalize(JSON.parse(text))
    const componentById = this.componentById
    for (const componentId of Array.from(this.selectState.selectedBlockIds)) if (!componentById.has(componentId)) this.selectState.selectedBlockIds.delete(componentId)
    for (const componentId of Array.from(this.selectState.selectedGroupIds)) if (!componentById.has(componentId)) this.selectState.selectedGroupIds.delete(componentId)
    for (const componentId of Array.from(this.editMultiSelectionState.selectedComponentIds)) if (!componentById.has(componentId)) this.editMultiSelectionState.selectedComponentIds.delete(componentId)
    if (this.editState.selectedComponentId && !componentById.has(this.editState.selectedComponentId)) this.editState.selectedComponentId = null
    if (this.editPropEditorState.componentId && !componentById.has(this.editPropEditorState.componentId)) this.closePropEditor()
    this.editState.densityHalve.isAsked = false
    this.editState.message = ''
    this.commitGeometryChange()
  }

  setEditMessage(message: string) {
    this.editState.message = message
  }

  setMapObjDataFormat(format: MapObjDataFormat) {
    this.config.mapObjDataFormat = format
    this.updateMapObjData()
  }

  setMode(mode: MapBlockMode) {
    this.config.mode = mode
    if (mode !== 'edit') this.cancelEditGesture()
  }

  setEditTool(tool: EditTool) {
    if (this.editState.tool === tool) return
    this.cancelEditGesture()
    this.editState.tool = tool
    this.editState.message = ''
  }

  // whatever the edit mode was in the middle of, given up
  cancelEditGesture() {
    cancelPolygonDrawAction(this)
    cancelRectCreateDragAction(this)
    cancelPolygonPointDragAction(this)
  }

  updateGridDisplayRange(key: GridDisplayRangeKey, delta: number) {
    const grid = this.data.grid
    const valueNext = grid[key] + delta
    const valueChanged = key === 'rowStart' ? Math.min(valueNext, grid.rowEnd)
      : key === 'rowEnd' ? Math.max(valueNext, grid.rowStart)
        : key === 'colStart' ? Math.min(valueNext, grid.colEnd)
          : Math.max(valueNext, grid.colStart)
    if (valueChanged === grid[key]) return

    this.historyCheckpoint()
    grid[key] = valueChanged
    this.updateMapObjData()
  }

  setMapConfigValue(propertyPath: string, valueNextRaw: unknown) {
    if (propertyPath === 'config.mode') {
      if (valueNextRaw !== 'display' && valueNextRaw !== 'select' && valueNextRaw !== 'edit') return { code: -1, message: 'Unsupported mode' }
      this.setMode(valueNextRaw)
      return { code: 0 }
    }

    const view = this.data.view

    if (propertyPath === 'view.mapWidthMax') {
      const valueNext = Math.round(Number(valueNextRaw))
      if (!Number.isFinite(valueNext)) return { code: -1, message: 'Map width must be a number' }
      this.historyCheckpoint()
      view.mapWidthMax = Math.max(MAP_BLOCK_MAP_WIDTH_MIN, Math.min(MAP_BLOCK_MAP_WIDTH_MAX, valueNext))
      this.updateMapObjData()
      return { code: 0 }
    }

    if (propertyPath === 'grid.cellAspectRatio.width' || propertyPath === 'grid.cellAspectRatio.height') {
      const valueNext = Number(valueNextRaw)
      if (!Number.isFinite(valueNext)) return { code: -1, message: 'Aspect ratio must be a number' }
      const valueSafe = Math.max(0.2, Math.min(2.5, valueNext))
      this.historyCheckpoint()
      if (propertyPath === 'grid.cellAspectRatio.width') this.data.grid.cellAspectRatio.width = valueSafe
      if (propertyPath === 'grid.cellAspectRatio.height') this.data.grid.cellAspectRatio.height = valueSafe
      this.updateMapObjData()
      return { code: 0 }
    }

    if (propertyPath === 'view.backgroundColor') {
      this.historyCheckpoint()
      view.backgroundColor = colorValueNormalize(valueNextRaw, view.backgroundColor ?? MAP_BLOCK_VIEW_DEFAULT.backgroundColor)
      this.updateMapObjData()
      return { code: 0 }
    }

    if (propertyPath.startsWith('view.groupGreyed.')) {
      const groupId = propertyPath.replace(/^view\.groupGreyed\./, '')
      if (!this.groupComponents.some((group) => group.id === groupId)) return { code: -1, message: 'Group is not found' }
      const groupGreyedIdSet = new Set(view.groupGreyedIdList ?? [])
      if (Boolean(valueNextRaw)) groupGreyedIdSet.add(groupId)
      else groupGreyedIdSet.delete(groupId)
      this.historyCheckpoint()
      view.groupGreyedIdList = this.groupComponents.map((group) => group.id).filter((groupIdItem) => groupGreyedIdSet.has(groupIdItem))
      this.updateMapObjData()
      return { code: 0 }
    }

    return { code: -1, message: `Unknown map config property: ${propertyPath}` }
  }

  handleMapConfigEditorEvent(eventType: string, eventData: Record<string, unknown> = {}) {
    if (eventType === 'levelTopSelect') {
      this.mapConfigEditorState.levelTopSelectedId = typeof eventData.levelId === 'string' ? eventData.levelId : this.mapConfigEditorState.levelTopSelectedId
      return { code: 0 }
    }

    if (eventType === 'groupToggle') {
      const path = typeof eventData.groupPath === 'string' ? eventData.groupPath : null
      if (!path) return { code: -1, message: 'groupPath is required' }
      this.mapConfigEditorState.groupCollapsedByPath[path] = !this.mapConfigEditorState.groupCollapsedByPath[path]
      return { code: 0 }
    }

    if (eventType !== 'propertyChangeAttempt') return { code: -1, message: `Unknown editor event: ${eventType}` }
    const propertyPath = typeof eventData.propertyPath === 'string' ? eventData.propertyPath : null
    if (!propertyPath) return { code: -1, message: 'propertyPath is required' }
    return this.setMapConfigValue(propertyPath, eventData.valueNext)
  }

  // every cell split into 2 x 2 cells: exact, and undone exactly by halving
  increaseGridDensity() {
    this.dataChange(() => {
      const grid = this.data.grid
      grid.rowStart = gridLineDouble(grid.rowStart)
      grid.rowEnd = gridLineDouble(grid.rowEnd + 1) - 1
      grid.colStart = gridLineDouble(grid.colStart)
      grid.colEnd = gridLineDouble(grid.colEnd + 1) - 1
      for (const component of this.data.compList) {
        component.shape = shapeDensityDouble(component.shape)
      }
      this.editState.densityHalve.isAsked = false
    })
  }

  // the shapes that halving would change, since they do not lie on the coarser lines
  get densityHalveChangedComponents() {
    return this.data.compList.filter((component) => !shapeDensityIsHalvable(component.shape))
  }

  get isDensityHalveExact() {
    const grid = this.data.grid
    return this.densityHalveChangedComponents.length === 0
      && gridLineIsHalvable(grid.rowStart) && gridLineIsHalvable(grid.rowEnd + 1)
      && gridLineIsHalvable(grid.colStart) && gridLineIsHalvable(grid.colEnd + 1)
  }

  // every 2 x 2 cells merged into one. a map whose shapes all lie on the coarser lines is halved
  // exactly; otherwise the shapes that would change are named first, and halved only when
  // the user insists (isForced): a rectangle then grows to the coarser lines, a polygon's points
  // move to the nearest ones
  decreaseGridDensity(isForced = false) {
    if (!this.isDensityHalveExact && !isForced) {
      this.editState.densityHalve.isAsked = true
      this.editState.densityHalve.componentLabelList = this.densityHalveChangedComponents.map((component) => component.label || component.id)
      return { code: -2, message: 'Halving the density would change some shapes' }
    }
    this.editState.densityHalve.isAsked = false
    const polygonLostLabelList: string[] = []
    this.dataChange(() => {
      const grid = this.data.grid
      grid.rowStart = gridLineHalve(grid.rowStart, 'start')
      grid.rowEnd = Math.max(grid.rowStart, gridLineHalve(grid.rowEnd + 1, 'end') - 1)
      grid.colStart = gridLineHalve(grid.colStart, 'start')
      grid.colEnd = Math.max(grid.colStart, gridLineHalve(grid.colEnd + 1, 'end') - 1)

      for (const component of this.data.compList) {
        const shapeHalved = shapeDensityHalve(component.shape)
        if (!shapeHalved) {
          // a polygon too small for the coarser grid keeps the cells it covers at most
          polygonLostLabelList.push(component.label || component.id)
          component.shape = { type: 'rect', ...shapeDensityHalve({ type: 'rect', ...shapeCellRectGet(component.shape)! })! } as MapBlockShape
          continue
        }
        if (shapeIsRect(shapeHalved)) {
          // the grid's own clamp, as before: a shape is never wider than the grid
          shapeHalved.rowStart = Math.max(grid.rowStart, shapeHalved.rowStart)
          shapeHalved.rowEnd = Math.min(grid.rowEnd, Math.max(shapeHalved.rowStart, shapeHalved.rowEnd))
          shapeHalved.colStart = Math.max(grid.colStart, shapeHalved.colStart)
          shapeHalved.colEnd = Math.min(grid.colEnd, Math.max(shapeHalved.colStart, shapeHalved.colEnd))
        }
        component.shape = shapeHalved
      }
    })
    this.editState.message = polygonLostLabelList.length ? `Too small for the coarser grid, made rectangles: ${polygonLostLabelList.join(', ')}` : ''
    return { code: 0 }
  }

  decreaseGridDensityCancel() {
    this.editState.densityHalve.isAsked = false
  }

  renameComponent(componentId: string, label: string) {
    const labelNext = label.trim()
    if (!labelNext) return { code: -1, message: 'Name is required' }
    const component = this.componentById.get(componentId)
    if (!component) return { code: -1, message: 'Component not found' }
    if (component.label === labelNext) return { code: 0 }
    this.historyCheckpoint()
    component.label = labelNext
    this.updateMapObjData()
    return { code: 0 }
  }

  deleteComponent(componentId: string) {
    const component = this.componentById.get(componentId)
    if (!component) return { code: -1, message: 'Component not found' }
    this.dataChange(() => {
      this.data.compList = this.data.compList
        .filter((componentItem) => componentItem.id !== componentId)
        .map((componentItem) => {
          if (componentItem.kind !== 'group') return componentItem
          return { ...componentItem, childIdList: componentItem.childIdList.filter((childId) => childId !== componentId) }
        })
      this.data.view.groupGreyedIdList = this.data.view.groupGreyedIdList.filter((groupId) => groupId !== componentId)
    })
    this.selectState.selectedBlockIds.delete(componentId)
    this.selectState.selectedGroupIds.delete(componentId)
    if (this.editState.selectedComponentId === componentId) this.editState.selectedComponentId = null
    this.editMultiSelectionState.selectedComponentIds.delete(componentId)
    if (this.editPropEditorState.componentId === componentId) this.closePropEditor()
    return { code: 0 }
  }

  // a new component on the map, selected at once; it takes a name of its kind not taken yet
  createComponent(kind: 'block' | 'group', shape: MapBlockShape) {
    const component = {
      id: componentIdNew(this.componentById),
      kind,
      label: componentLabelNew(kind, this.data.compList),
      shape,
      ...(kind === 'group' ? { childIdList: [] } : {}),
    } as MapBlockComp
    this.dataChange(() => {
      this.data.compList.push(component)
    })
    this.selectEditComponent(component.id)
    return { code: 0, data: { componentId: component.id } }
  }

  // a block or a group of one cell (a group: two, as a label needs room) where the user asked
  createComponentAt(kind: 'block' | 'group', pointerGridRow: number, pointerGridCol: number) {
    const grid = this.data.grid
    const row = Math.min(grid.rowEnd, Math.max(grid.rowStart, Math.floor(pointerGridRow)))
    const col = Math.min(grid.colEnd, Math.max(grid.colStart, Math.floor(pointerGridCol)))
    const colEnd = kind === 'group' ? Math.min(grid.colEnd, col + 1) : col
    return this.createComponent(kind, { type: 'rect', rowStart: row, rowEnd: row, colStart: col, colEnd })
  }

  // a rectangle as a polygon of its four corners, whose points can then be moved one by one;
  // a polygon that is a rectangle back to a rectangle, whose edges can be dragged
  convertComponentShape(componentId: string, shapeType: 'rect' | 'polygon') {
    const component = this.componentById.get(componentId)
    if (!component) return { code: -1, message: 'Component not found' }
    if (component.shape.type === shapeType) return { code: 0 }
    if (shapeType === 'polygon') {
      this.dataChange(() => {
        component.shape = shapePolygonBuild(shapePointListGet(component.shape))
      })
      return { code: 0 }
    }
    const shapeRect = shapePolygonToRect(component.shape)
    if (!shapeRect) return { code: -1, message: 'Only a polygon of four right angles can become a rectangle' }
    this.dataChange(() => {
      component.shape = shapeRect
    })
    return { code: 0 }
  }

  // a block moved into a group (or out of every group: groupId '')
  setComponentGroup(componentId: string, groupId: string) {
    const component = this.componentById.get(componentId)
    if (!component || component.kind !== 'block') return { code: -1, message: 'Block not found' }
    const groupTarget = groupId ? this.componentById.get(groupId) : null
    if (groupId && groupTarget?.kind !== 'group') return { code: -1, message: 'Group not found' }
    if ((this.groupByBlockId.get(componentId)?.id ?? '') === groupId) return { code: 0 }
    this.dataChange(() => {
      for (const group of this.groupComponents) {
        if (group.childIdList.includes(componentId)) group.childIdList = group.childIdList.filter((childId) => childId !== componentId)
      }
      if (groupTarget?.kind === 'group') groupTarget.childIdList = [...groupTarget.childIdList, componentId]
    })
    return { code: 0 }
  }

  isBlockSelectedFinal(componentId: string) {
    return this.selectedBlockIdsFinal.has(componentId)
  }

  // ---------- the selection of the mode select (doc/map-block-select.md) ----------

  mergeSelectionIds(currentIds: Iterable<string>, selectedIds: Iterable<string>, operation: SelectionOperation) {
    if (operation === 'replace') return new Set(selectedIds)

    const mergedIds = new Set(currentIds)
    for (const selectedId of selectedIds) {
      if (operation === 'toggle' && mergedIds.has(selectedId)) {
        mergedIds.delete(selectedId)
      } else {
        mergedIds.add(selectedId)
      }
    }
    return mergedIds
  }

  getSelectComponentBlockIds(componentId: string) {
    const component = this.componentById.get(componentId)
    if (!component) return []
    if (component.kind === 'block') return [component.id]
    if (component.kind === 'group') {
      return component.childIdList.filter((childId) => this.componentById.get(childId)?.kind === 'block')
    }
    return []
  }

  applySelectComponentOperation(componentId: string, operation: SelectionOperation, isGroupCollapseEnabled = false) {
    const component = this.componentById.get(componentId)
    if (operation === 'add' && component?.kind === 'block') {
      this.selectState.selectedBlockIds.add(componentId)
      return
    }
    const selectedIds = this.getSelectComponentBlockIds(componentId)
    const mergedIds = this.mergeSelectionIds(this.selectedBlockIdsFinal, selectedIds, operation)
    this.setSelectionByBlockIds(mergedIds, isGroupCollapseEnabled)
  }

  addSelectGroupBlocks(componentId: string) {
    const selectedIds = this.getSelectComponentBlockIds(componentId)
    const mergedIds = this.mergeSelectionIds(this.selectedBlockIdsFinal, selectedIds, 'add')
    this.setSelectionByBlockIds(mergedIds, true)
  }

  applySelectGroupToggleOperation(componentId: string) {
    const selectedIds = this.getSelectComponentBlockIds(componentId)
    const mergedIds = new Set(this.selectedBlockIdsFinal)
    if (this.selectState.selectedGroupIds.has(componentId)) {
      for (const selectedId of selectedIds) mergedIds.delete(selectedId)
    } else {
      for (const selectedId of selectedIds) mergedIds.add(selectedId)
    }
    this.setSelectionByBlockIds(mergedIds, true)
  }

  toggleBlockSelection(componentId: string) {
    const group = this.groupByBlockId.get(componentId)
    if (group?.kind === 'group' && this.selectState.selectedGroupIds.has(group.id) && this.selectState.selectedBlockIds.has(componentId)) {
      this.selectState.selectedGroupIds.delete(group.id)
      for (const childId of group.childIdList) {
        if (childId === componentId) {
          this.selectState.selectedBlockIds.delete(childId)
        } else {
          this.selectState.selectedBlockIds.add(childId)
        }
      }
      return
    }

    const isSelectedInternal = this.selectState.selectedBlockIds.has(componentId)
    if (isSelectedInternal) {
      this.selectState.selectedBlockIds.delete(componentId)
    } else {
      this.selectState.selectedBlockIds.add(componentId)
      if (group?.kind === 'group' && group.childIdList.every((childId) => this.selectState.selectedBlockIds.has(childId))) {
        this.selectState.selectedGroupIds.add(group.id)
      }
    }
  }

  toggleGroupSelection(componentId: string) {
    if (this.selectState.selectedGroupIds.has(componentId)) {
      const group = this.componentById.get(componentId)
      if (group?.kind === 'group') {
        const areAllChildrenSelectedInternal = group.childIdList.every((childId) => this.selectState.selectedBlockIds.has(childId))
        if (areAllChildrenSelectedInternal) {
          for (const childId of group.childIdList) {
            this.selectState.selectedBlockIds.delete(childId)
          }
        }
      }
      this.selectState.selectedGroupIds.delete(componentId)
    } else {
      this.selectState.selectedGroupIds.add(componentId)
    }
  }

  clearSelection() {
    this.selectState.selectedBlockIds.clear()
    this.selectState.selectedGroupIds.clear()
  }

  setSelectionByBlockIds(blockIds: Iterable<string>, isGroupCollapseEnabled = true) {
    this.selectState.selectedBlockIds.clear()
    this.selectState.selectedGroupIds.clear()
    for (const blockId of blockIds) {
      const component = this.componentById.get(blockId)
      if (component?.kind === 'block') this.selectState.selectedBlockIds.add(blockId)
    }
    if (!isGroupCollapseEnabled) return
    for (const group of this.groupComponents) {
      if (group.childIdList.every((childId) => this.selectState.selectedBlockIds.has(childId))) {
        this.selectState.selectedGroupIds.add(group.id)
        for (const childId of group.childIdList) {
          this.selectState.selectedBlockIds.delete(childId)
        }
      }
    }
  }

  beginSelectRectDrag(pointerGridRow: number, pointerGridCol: number, operation: SelectionOperation = 'replace') {
    beginSelectRectDragAction(this, pointerGridRow, pointerGridCol, operation)
  }

  updateSelectRectDrag(pointerGridRow: number, pointerGridCol: number) {
    updateSelectRectDragAction(this, pointerGridRow, pointerGridCol)
  }

  commitSelectRectDrag() {
    return commitSelectRectDragAction(this)
  }

  cancelSelectRectDrag() {
    cancelSelectRectDragAction(this)
  }

  clearSelectRectDrag() {
    clearSelectRectDragAction(this)
  }

  beginSelectMoveDrag(componentId: string, pointerGridRow: number, pointerGridCol: number) {
    beginSelectMoveDragAction(this, componentId, pointerGridRow, pointerGridCol)
  }

  updateSelectMoveDrag(pointerGridRow: number, pointerGridCol: number) {
    updateSelectMoveDragAction(this, pointerGridRow, pointerGridCol)
  }

  commitSelectMoveDrag() {
    return commitSelectMoveDragAction(this)
  }

  cancelSelectMoveDrag() {
    cancelSelectMoveDragAction(this)
  }

  clearSelectMoveDrag() {
    clearSelectMoveDragAction(this)
  }

  // ---------- the edit mode (doc/map-block-edit.md) ----------

  selectEditComponent(componentId: string) {
    this.editState.selectionMode = 'single'
    this.editState.selectedComponentId = componentId
    this.clearEditMultiSelection()
  }

  getEditSelectionIds() {
    if (this.editState.selectionMode === 'multi') return new Set(this.editMultiSelectionState.selectedComponentIds)
    return this.editState.selectedComponentId ? new Set([this.editState.selectedComponentId]) : new Set<string>()
  }

  setEditSelectionByComponentIds(componentIds: Iterable<string>) {
    const componentIdList = Array.from(new Set(componentIds)).filter((componentId) => this.componentById.has(componentId))
    if (componentIdList.length === 0) {
      this.clearEditSelection()
      return
    }
    if (componentIdList.length === 1) {
      this.selectEditComponent(componentIdList[0])
      return
    }
    this.editState.selectionMode = 'multi'
    this.editState.selectedComponentId = null
    this.editMultiSelectionState.selectedComponentIds.clear()
    componentIdList.forEach((componentId) => this.editMultiSelectionState.selectedComponentIds.add(componentId))
  }

  selectEditComponentWithOperation(componentId: string, operation: SelectionOperation = 'replace') {
    if (operation === 'replace') {
      this.selectEditComponent(componentId)
      return
    }
    if (this.componentById.get(componentId)?.kind !== 'block') return
    const mergedIds = this.mergeSelectionIds(this.getEditSelectionIds(), [componentId], operation)
    this.setEditSelectionByComponentIds(mergedIds)
  }

  clearEditSelection() {
    this.editState.selectionMode = 'single'
    this.editState.selectedComponentId = null
    this.clearEditMultiSelection()
  }

  // the properties of a block, in a popup beside it: inside boundaryRect when given (the column
  // of the editor, so that a side panel of the page does not cover it), else the viewport
  toggleBlockPropEditor(componentId: string, anchorRect: ViewRect, viewportSize: ViewSize, boundaryRect?: ViewRect) {
    const component = this.componentById.get(componentId)
    if (!component || component.kind !== 'block') return { code: -1, message: 'Block component not found' }
    const editorState = this.editPropEditorState
    if (editorState.isShown && editorState.componentId === componentId) {
      this.closePropEditor()
      return { code: 0 }
    }
    this.selectEditComponent(componentId)
    editorState.isShown = true
    editorState.componentId = componentId
    editorState.pos = chooseAnchoredPopupPos(anchorRect, editorState.popupSize, boundaryRect ?? rectFromViewportSize(viewportSize))
    editorState.drag.isDragging = false
    return { code: 0 }
  }

  closePropEditor() {
    this.editPropEditorState.isShown = false
    this.editPropEditorState.componentId = null
    this.editPropEditorState.drag.isDragging = false
  }

  beginPropEditorDrag(x: number, y: number) {
    beginPropEditorDragAction(this, x, y)
  }

  movePropEditorDrag(x: number, y: number) {
    movePropEditorDragAction(this, x, y)
  }

  endPropEditorDrag() {
    endPropEditorDragAction(this)
  }

  setComponentColor(componentId: string, color: string) {
    const component = this.componentById.get(componentId)
    if (!component) return { code: -1, message: 'Component not found' }
    const group = component.kind === 'block' ? this.groupByBlockId.get(componentId) : component
    if (!group || group.kind !== 'group') return { code: -1, message: 'Put the block in a group first: the color is the group\'s' }
    const colorNext = color.trim()
    if (!colorNext) return { code: -1, message: 'Color is required' }
    if (group.color === colorNext) return { code: 0 }
    this.historyCheckpoint()
    group.color = colorNext
    this.updateMapObjData()
    return { code: 0 }
  }

  setComponentRectValue(componentId: string, key: Extract<PropEditorPropertyKey, 'range.rowStart' | 'range.rowEnd' | 'range.colStart' | 'range.colEnd'>, valueNextRaw: unknown) {
    const component = this.componentById.get(componentId)
    if (!component || !shapeIsRect(component.shape)) return { code: -1, message: 'Selected component is not rectangular' }
    const valueNext = Math.round(Number(valueNextRaw))
    if (!Number.isFinite(valueNext)) return { code: -1, message: 'Value must be a number' }
    const rangeNext = rectNormalize(component.shape)
    if (key === 'range.rowStart') rangeNext.rowStart = Math.min(Math.max(this.data.grid.rowStart, valueNext), rangeNext.rowEnd)
    if (key === 'range.rowEnd') rangeNext.rowEnd = Math.max(Math.min(this.data.grid.rowEnd, valueNext), rangeNext.rowStart)
    if (key === 'range.colStart') rangeNext.colStart = Math.min(Math.max(this.data.grid.colStart, valueNext), rangeNext.colEnd)
    if (key === 'range.colEnd') rangeNext.colEnd = Math.max(Math.min(this.data.grid.colEnd, valueNext), rangeNext.colStart)
    this.dataChange(() => {
      component.shape = { type: 'rect', ...rangeNext }
    })
    return { code: 0 }
  }

  setComponentPropEditorValue(componentId: string, propertyPath: string, valueNext: unknown) {
    if (propertyPath === 'label') return this.renameComponent(componentId, String(valueNext))
    if (propertyPath === 'color') return this.setComponentColor(componentId, String(valueNext))
    if (propertyPath === 'group') return this.setComponentGroup(componentId, String(valueNext ?? ''))
    if (propertyPath === 'range.rowStart' || propertyPath === 'range.rowEnd' || propertyPath === 'range.colStart' || propertyPath === 'range.colEnd') {
      return this.setComponentRectValue(componentId, propertyPath, valueNext)
    }
    return { code: -1, message: `Unknown property: ${propertyPath}` }
  }

  handlePropEditorEvent(eventType: string, eventData: Record<string, unknown> = {}) {
    if (eventType === 'levelTopSelect') {
      this.editPropEditorState.levelTopSelectedId = typeof eventData.levelId === 'string' ? eventData.levelId : this.editPropEditorState.levelTopSelectedId
      return { code: 0 }
    }

    if (eventType === 'groupToggle') {
      const path = typeof eventData.groupPath === 'string' ? eventData.groupPath : null
      if (!path) return { code: -1, message: 'groupPath is required' }
      this.editPropEditorState.groupCollapsedByPath[path] = !this.editPropEditorState.groupCollapsedByPath[path]
      return { code: 0 }
    }

    if (eventType !== 'propertyChangeAttempt') return { code: -1, message: `Unknown editor event: ${eventType}` }
    const componentId = this.editPropEditorState.componentId
    const propertyPath = typeof eventData.propertyPath === 'string' ? eventData.propertyPath : null
    if (!componentId || !propertyPath) return { code: -1, message: 'Property editor selection is missing' }
    return this.setComponentPropEditorValue(componentId, propertyPath, eventData.valueNext)
  }

  clearEditMultiSelection() {
    this.editMultiSelectionState.selectedComponentIds.clear()
  }

  beginEditMultiSelectRectDrag(pointerGridRow: number, pointerGridCol: number, operation: SelectionOperation = 'replace') {
    beginEditMultiSelectRectDragAction(this, pointerGridRow, pointerGridCol, operation)
  }

  updateEditMultiSelectRectDrag(pointerGridRow: number, pointerGridCol: number) {
    updateEditMultiSelectRectDragAction(this, pointerGridRow, pointerGridCol)
  }

  commitEditMultiSelectRectDrag() {
    return commitEditMultiSelectRectDragAction(this)
  }

  cancelEditMultiSelectRectDrag() {
    cancelEditMultiSelectRectDragAction(this)
  }

  clearEditMultiSelectRectDrag() {
    clearEditMultiSelectRectDragAction(this)
  }

  isComponentIncludedInSelectionBox(component: MapBlockComp, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
    return isComponentIncludedInSelectionBoxAction(this, component, box, includeMode)
  }

  isComponentIncludedInEditSelectionBox(component: MapBlockComp, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
    return isComponentIncludedInEditSelectionBoxAction(this, component, box, includeMode)
  }

  beginEditMultiMoveDrag(componentId: string, pointerGridRow: number, pointerGridCol: number) {
    beginEditMultiMoveDragAction(this, componentId, pointerGridRow, pointerGridCol)
  }

  updateEditMultiMoveDrag(pointerGridRow: number, pointerGridCol: number) {
    updateEditMultiMoveDragAction(this, pointerGridRow, pointerGridCol)
  }

  commitEditMultiMoveDrag() {
    return commitEditMultiMoveDragAction(this)
  }

  cancelEditMultiMoveDrag() {
    cancelEditMultiMoveDragAction(this)
  }

  clearEditMultiMoveDrag() {
    clearEditMultiMoveDragAction(this)
  }

  beginRectEdgeDrag(componentId: string, edge: RectEdge, gridLine: number) {
    beginRectEdgeDragAction(this, componentId, edge, gridLine)
  }

  updateRectEdgeDrag(gridLine: number) {
    updateRectEdgeDragAction(this, gridLine)
  }

  commitRectEdgeDrag() {
    return commitRectEdgeDragAction(this)
  }

  cancelRectEdgeDrag() {
    cancelRectEdgeDragAction(this)
  }

  clearRectEdgeDrag() {
    clearRectEdgeDragAction(this)
  }

  beginMoveDrag(componentId: string, pointerGridRow: number, pointerGridCol: number) {
    beginMoveDragAction(this, componentId, pointerGridRow, pointerGridCol)
  }

  updateMoveDrag(pointerGridRow: number, pointerGridCol: number) {
    updateMoveDragAction(this, pointerGridRow, pointerGridCol)
  }

  commitMoveDrag() {
    return commitMoveDragAction(this)
  }

  cancelMoveDrag() {
    cancelMoveDragAction(this)
  }

  clearMoveDrag() {
    clearMoveDragAction(this)
  }

  isGridLineValidForEdge(component: MapBlockComp, edge: RectEdge, gridLine: number) {
    return isGridLineValidForEdgeAction(this, component, edge, gridLine)
  }

  getRangeAfterEdgeDrop(range: GridRectRange, edge: RectEdge, gridLine: number): GridRectRange {
    return getRangeAfterEdgeDropAction(range, edge, gridLine)
  }

  // the tools making new shapes, and the points of a polygon (MapBlockStorePolygon.ts)

  beginRectCreateDrag(pointerGridRow: number, pointerGridCol: number) {
    beginRectCreateDragAction(this, pointerGridRow, pointerGridCol)
  }

  updateRectCreateDrag(pointerGridRow: number, pointerGridCol: number) {
    updateRectCreateDragAction(this, pointerGridRow, pointerGridCol)
  }

  commitRectCreateDrag() {
    return commitRectCreateDragAction(this)
  }

  cancelRectCreateDrag() {
    cancelRectCreateDragAction(this)
  }

  addPolygonDrawPoint(pointerGridRow: number, pointerGridCol: number, isAxisLocked = false) {
    return addPolygonDrawPointAction(this, pointerGridRow, pointerGridCol, isAxisLocked)
  }

  movePolygonDrawPointer(pointerGridRow: number, pointerGridCol: number, isAxisLocked = false) {
    movePolygonDrawPointerAction(this, pointerGridRow, pointerGridCol, isAxisLocked)
  }

  removePolygonDrawPointLast() {
    removePolygonDrawPointLastAction(this)
  }

  commitPolygonDraw() {
    return commitPolygonDrawAction(this)
  }

  cancelPolygonDraw() {
    cancelPolygonDrawAction(this)
  }

  beginPolygonVertexDrag(componentId: string, index: number, pointerGridRow: number, pointerGridCol: number, isInserted = false) {
    beginPolygonVertexDragAction(this, componentId, index, pointerGridRow, pointerGridCol, isInserted)
  }

  beginPolygonSegmentDrag(componentId: string, index: number, pointerGridRow: number, pointerGridCol: number) {
    beginPolygonSegmentDragAction(this, componentId, index, pointerGridRow, pointerGridCol)
  }

  updatePolygonPointDrag(pointerGridRow: number, pointerGridCol: number) {
    updatePolygonPointDragAction(this, pointerGridRow, pointerGridCol)
  }

  commitPolygonPointDrag() {
    return commitPolygonPointDragAction(this)
  }

  cancelPolygonPointDrag() {
    cancelPolygonPointDragAction(this)
  }

  deletePolygonVertex(componentId: string, index: number) {
    return deletePolygonVertexAction(this, componentId, index)
  }

  handleEvent(eventType: MapBlockEventType, eventData: MapBlockEventData) {
    return handleMapBlockEvent(this, eventType, eventData)
  }
}

export function createMapBlockStore(data?: unknown) {
  return new MapBlockStore(data)
}

// a new id: random letters and digits, which say nothing (react-doc: id-format.md)
function componentIdNew(componentById: Map<string, unknown>) {
  for (;;) {
    const id = Math.random().toString(36).slice(2, 10)
    if (/^[a-z]/.test(id) && !componentById.has(id)) return id
  }
}

function componentLabelNew(kind: 'block' | 'group', compList: readonly MapBlockComp[]) {
  const prefix = kind === 'group' ? 'Group' : 'Block'
  const labelSet = new Set(compList.map((component) => component.label))
  for (let index = compList.filter((component) => component.kind === kind).length + 1; ; index += 1) {
    if (!labelSet.has(`${prefix} ${index}`)) return `${prefix} ${index}`
  }
}

export { shapeCellRectGet, shapeIsPolygon }
