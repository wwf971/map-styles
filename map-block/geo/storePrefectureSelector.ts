import { makeAutoObservable } from 'mobx'
import { japanPrefectureTileGridMap } from '../config/prefectureTileGridMapJp'
import { chooseAnchoredPopupPos, rectFromViewportSize } from '../utils/popupPlacement'
import { handlePrefectureSelectorEvent } from './storePrefectureSelectorEvent'
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
} from './storePrefectureSelectorMove'
import {
  beginRectEdgeDrag as beginRectEdgeDragAction,
  cancelRectEdgeDrag as cancelRectEdgeDragAction,
  clearRectEdgeDrag as clearRectEdgeDragAction,
  commitRectEdgeDrag as commitRectEdgeDragAction,
  getRangeAfterEdgeDrop as getRangeAfterEdgeDropAction,
  isGridLineValidForEdge as isGridLineValidForEdgeAction,
  updateRectEdgeDrag as updateRectEdgeDragAction,
} from './storePrefectureSelectorResize'
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
  isRectRange,
  normalizeRect,
  updateEditMultiSelectRectDrag as updateEditMultiSelectRectDragAction,
  updateSelectRectDrag as updateSelectRectDragAction,
} from './storePrefectureSelectorSelection'
import {
  getSelectionCandidateBlockComponents as getSelectionCandidateBlockComponentsAction,
  rebuildSelectionSpatialIndex as rebuildSelectionSpatialIndexAction,
} from './storePrefectureSelectorSpatialIndex'
import {
  type GridBoxRange,
  type GridCell,
  type GridRectRange,
  type TileGridMapComponent,
  type TileGridMapData,
} from './PrefectureSelectorConfig'

export type PrefectureSelectorMode = 'select' | 'display' | 'edit'
export type MapObjDataFormat = 'tight' | 'pretty'
export type EditSelectionMode = 'single' | 'multi'
export type EditMultiSelectIncludeMode = 'partial' | 'full'
export type RectEdge = 'left' | 'right' | 'top' | 'bottom'
export type EditDragType = 'resize' | 'move'
export type SelectionOperation = 'replace' | 'add' | 'toggle'
export type SelectionSpatialIndexMode = 'linear' | 'rbush'
export type GridDisplayRangeKey = 'rowStart' | 'rowEnd' | 'colStart' | 'colEnd'
export type PropEditorPropertyKey = 'label' | 'color' | 'range.rowStart' | 'range.rowEnd' | 'range.colStart' | 'range.colEnd'
export type MapConfigPropertyKey = 'config.mode' | 'metadata.view.mapWidthMax' | 'metadata.cellAspectRatio.width' | 'metadata.cellAspectRatio.height' | 'metadata.view.backgroundColor'

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

export type ConfigVersionData = {
  id: string
  version: number
  versionPrev: number | null
  createAt: string
  createAtTimezone: number
  updateAt: string
  updateAtTimezone: number
  contentJson?: string
}

export type ConfigCheckoutData = {
  id: string
  version: number
  versionPrev: number | null
  updateAt: string
  updateAtTimezone: number
}

type ApiResponse<Data> = {
  code: number
  data?: Data
  message?: string
}

const apiBasePath = '/map-block/api'
const groupColorHexByIndex = ['#BCEEE0FF', '#F3E889FF', '#F2A391FF', '#EE8CADFF', '#B994D1FF', '#8A91D9FF']
const mapViewDefault = {
  mapWidthMax: 620,
  backgroundColor: '#eaf5ff',
  regionGreyedIds: [] as string[],
}

export type PrefectureSelectorEventType =
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

export type PrefectureSelectorEventData = Record<string, unknown>

const cloneMapData = (data: TileGridMapData): TileGridMapData => JSON.parse(JSON.stringify(data)) as TileGridMapData

function colorValueNormalize(valueRaw: unknown, fallback: string) {
  const valueText = String(valueRaw || '').trim()
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(valueText)) return valueText
  return fallback
}

function mapDataNormalize(data: TileGridMapData): TileGridMapData {
  const dataNext = cloneMapData(data)
  dataNext.metadata.cellAspectRatio = {
    width: Math.max(0.2, Number(dataNext.metadata.cellAspectRatio?.width) || 1),
    height: Math.max(0.2, Number(dataNext.metadata.cellAspectRatio?.height) || 1),
  }
  dataNext.metadata.view = {
    ...mapViewDefault,
    ...(dataNext.metadata.view ?? {}),
    mapWidthMax: Math.max(360, Math.min(980, Math.round(Number(dataNext.metadata.view?.mapWidthMax) || mapViewDefault.mapWidthMax))),
    backgroundColor: colorValueNormalize(dataNext.metadata.view?.backgroundColor, mapViewDefault.backgroundColor),
    regionGreyedIds: Array.isArray(dataNext.metadata.view?.regionGreyedIds) ? [...dataNext.metadata.view.regionGreyedIds] : [],
  }
  return dataNext
}

const parseApiResponse = async <Data>(response: Response): Promise<ApiResponse<Data>> => {
  const body = await response.json().catch(() => null) as ApiResponse<Data> | null
  if (!body) return { code: -1, message: `HTTP ${response.status}` }
  if (!response.ok && body.code === 0) return { ...body, code: -1, message: body.message ?? `HTTP ${response.status}` }
  return body
}

const messageFromError = (error: unknown) => (error instanceof Error ? error.message : String(error))

function stringifyTileGridMapTight(data: TileGridMapData) {
  const componentLines = data.components.map((component) => `    ${JSON.stringify(component)}`)
  return [
    '{',
    `  "id": ${JSON.stringify(data.id)},`,
    `  "label": ${JSON.stringify(data.label)},`,
    `  "metadata": ${JSON.stringify(data.metadata)},`,
    '  "components": [',
    `${componentLines.join(',\n')}`,
    '  ]',
    '}',
  ].join('\n')
}

export class PrefectureSelectorStore {
  data: TileGridMapData
  config = {
    mode: 'display' as PrefectureSelectorMode,
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
          originalRanges: new Map<string, GridRectRange | GridCell[]>(),
          originalBoundingRange: null as GridRectRange | null,
          candidateBoundingRange: null as GridRectRange | null,
          rowDelta: 0,
          colDelta: 0,
          isDropValid: true,
        },
      },
      display: {},
      edit: {
        selectionMode: 'single' as EditSelectionMode,
        selectedComponentId: null as string | null,
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
            originalRange: null as GridRectRange | null,
            candidateRange: null as GridRectRange | null,
            isDropValid: true,
          },
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
            originalRanges: new Map<string, GridRectRange | GridCell[]>(),
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
    backend: {
      configs: [] as ConfigCheckoutData[],
      versions: [] as ConfigVersionData[],
      configSelectedId: null as string | null,
      versionBase: null as number | null,
      versionSelected: null as number | null,
      isLoading: false,
      message: '',
    },
    mapConfigEditor: {
      levelTopSelectedId: 'view',
      groupCollapsedByPath: {} as Record<string, boolean>,
    },
    mapObjData: '',
    mapObjDataFormat: 'tight' as MapObjDataFormat,
  }

  constructor(data: TileGridMapData = japanPrefectureTileGridMap) {
    this.data = mapDataNormalize(data)
    this.config.mapObjData = this.getMapObjDataText()
    makeAutoObservable(this, {}, { autoBind: true })
    this.rebuildSelectionSpatialIndex()
  }

  get selectState() {
    return this.config.modeState.select
  }

  get editState() {
    return this.config.modeState.edit
  }

  get backendState() {
    return this.config.backend
  }

  get mapConfigEditorState() {
    return this.config.mapConfigEditor
  }

  get blockComponents() {
    return this.data.components.filter((component) => component.compType === 'block')
  }

  get groupComponents() {
    return this.data.components.filter((component) => component.compType === 'group')
  }

  get componentById() {
    return new Map(this.data.components.map((component) => [component.id, component]))
  }

  get groupByBlockId() {
    const groupByBlockId = new Map<string, TileGridMapComponent>()
    for (const group of this.groupComponents) {
      for (const childId of group.children) {
        groupByBlockId.set(childId, group)
      }
    }
    return groupByBlockId
  }

  getBlockColorValue(componentId: string) {
    const group = this.groupByBlockId.get(componentId)
    const colorValue = group?.metadata?.color
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
    if (!component || component.compType !== 'block') return null

    const propertyById: Record<string, Record<string, unknown>> = {
      label: { id: 'label', label: 'Label', valueType: 'text', value: component.label },
      color: { id: 'color', label: 'Color', valueType: 'color', value: this.getBlockColorValue(component.id) },
    }
    const layoutChildren: Array<{ id: string; type: 'property' }> = []

    if (component.type === 'rect' && isRectRange(component.range)) {
      propertyById['range.rowStart'] = { id: 'range.rowStart', label: 'Row Start', valueType: 'number', step: 1, value: component.range.rowStart, min: this.data.metadata.rowStart, max: this.data.metadata.rowEnd }
      propertyById['range.rowEnd'] = { id: 'range.rowEnd', label: 'Row End', valueType: 'number', step: 1, value: component.range.rowEnd, min: this.data.metadata.rowStart, max: this.data.metadata.rowEnd }
      propertyById['range.colStart'] = { id: 'range.colStart', label: 'Col Start', valueType: 'number', step: 1, value: component.range.colStart, min: this.data.metadata.colStart, max: this.data.metadata.colEnd }
      propertyById['range.colEnd'] = { id: 'range.colEnd', label: 'Col End', valueType: 'number', step: 1, value: component.range.colEnd, min: this.data.metadata.colStart, max: this.data.metadata.colEnd }
      layoutChildren.push(
        { id: 'range.rowStart', type: 'property' },
        { id: 'range.rowEnd', type: 'property' },
        { id: 'range.colStart', type: 'property' },
        { id: 'range.colEnd', type: 'property' },
      )
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
    const view = this.data.metadata.view ?? mapViewDefault
    return {
      ...mapViewDefault,
      ...view,
      regionGreyedIds: Array.isArray(view.regionGreyedIds) ? view.regionGreyedIds : [],
    }
  }

  get mapDisabledComponentIds() {
    const componentIds = new Set<string>()
    const regionGreyedIdSet = new Set(this.mapViewConfig.regionGreyedIds)
    for (const group of this.groupComponents) {
      if (!regionGreyedIdSet.has(group.id)) continue
      componentIds.add(group.id)
      for (const childId of group.children) componentIds.add(childId)
    }
    return componentIds
  }

  get mapConfigEditorData() {
    const view = this.mapViewConfig
    const regionGreyedIdSet = new Set(view.regionGreyedIds)
    const propertyById: Record<string, Record<string, unknown>> = {
      'config.mode': { id: 'config.mode', label: 'Mode', valueType: 'select', value: this.config.mode, optionList: [
        { id: 'display', label: 'Display' },
        { id: 'select', label: 'Select' },
        { id: 'edit', label: 'Edit' },
      ] },
      'metadata.view.mapWidthMax': { id: 'metadata.view.mapWidthMax', label: 'Map Width', valueType: 'number', min: 360, max: 980, step: 10, value: view.mapWidthMax },
      'metadata.cellAspectRatio.width': { id: 'metadata.cellAspectRatio.width', label: 'Cell Width', valueType: 'number', min: 0.2, max: 2.5, step: 0.05, value: this.data.metadata.cellAspectRatio.width },
      'metadata.cellAspectRatio.height': { id: 'metadata.cellAspectRatio.height', label: 'Cell Height', valueType: 'number', min: 0.2, max: 2.5, step: 0.05, value: this.data.metadata.cellAspectRatio.height },
      'metadata.view.backgroundColor': { id: 'metadata.view.backgroundColor', label: 'Background', valueType: 'color', value: view.backgroundColor },
      ...Object.fromEntries(this.groupComponents.map((group) => [
        `metadata.view.regionGreyed.${group.id}`,
        { id: `metadata.view.regionGreyed.${group.id}`, label: group.label, valueType: 'bool', value: regionGreyedIdSet.has(group.id) },
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
                { id: 'metadata.view.mapWidthMax', type: 'property' },
                { id: 'metadata.cellAspectRatio.width', type: 'property' },
                { id: 'metadata.cellAspectRatio.height', type: 'property' },
                { id: 'metadata.view.backgroundColor', type: 'property' },
              ],
            },
          ],
        },
        {
          id: 'greyOut',
          label: 'Grey Out',
          children: [
            {
              id: 'regions',
              label: 'Regions',
              type: 'group',
              children: this.groupComponents.map((group) => ({ id: `metadata.view.regionGreyed.${group.id}`, type: 'property' })),
            },
          ],
        },
      ],
    }
  }

  get selectedEditMultiComponents() {
    return Array.from(this.editMultiSelectionState.selectedComponentIds)
      .map((componentId) => this.componentById.get(componentId))
      .filter((component): component is TileGridMapComponent => component !== undefined)
  }

  get configVersionRows() {
    return this.backendState.versions.map((versionData) => ({
      id: String(versionData.version),
      data: {
        version: String(versionData.version),
        versionPrev: versionData.versionPrev === null ? '' : String(versionData.versionPrev),
        id: versionData.id,
        updateAt: versionData.updateAt,
        createAt: versionData.createAt,
      },
    }))
  }

  get configRows() {
    return this.backendState.configs
  }

  get selectedBlockIdsFinal() {
    const selectedIds = new Set(this.selectState.selectedBlockIds)
    for (const group of this.groupComponents) {
      if (!this.selectState.selectedGroupIds.has(group.id)) continue
      for (const childId of group.children) {
        const child = this.componentById.get(childId)
        if (child?.compType === 'block') {
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
    if (format === 'pretty') return JSON.stringify(this.data, null, 2)
    return stringifyTileGridMapTight(this.data)
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

  setData(data: TileGridMapData) {
    this.data = mapDataNormalize(data)
    this.clearEditSelection()
    this.commitGeometryChange()
  }

  setBackendMessage(message: string) {
    this.backendState.message = message
  }

  setConfigVersionSelected(version: number | null) {
    this.backendState.versionSelected = version
  }

  setConfigSelected(id: string | null) {
    this.backendState.configSelectedId = id
    const configRow = id ? this.backendState.configs.find((item) => item.id === id) : null
    this.backendState.versionSelected = configRow?.version ?? null
  }

  async fetchConfigs() {
    this.backendState.isLoading = true
    this.setBackendMessage('Loading configs')
    try {
      const response = await fetch(`${apiBasePath}/configs`)
      const body = await parseApiResponse<ConfigCheckoutData[]>(response)
      if (body.code !== 0) {
        this.setBackendMessage(body.message ?? 'Failed to load configs')
        return body
      }
      this.backendState.configs = body.data ?? []
      if (this.backendState.configSelectedId && !this.backendState.configs.some((item) => item.id === this.backendState.configSelectedId)) {
        this.setConfigSelected(null)
      }
      this.setBackendMessage(this.backendState.configs.length ? `Loaded ${this.backendState.configs.length} configs` : 'No saved configs')
      return body
    } catch (error) {
      const message = messageFromError(error)
      this.setBackendMessage(message)
      return { code: -1, message }
    } finally {
      this.backendState.isLoading = false
    }
  }

  async fetchConfigVersions() {
    this.backendState.isLoading = true
    this.setBackendMessage('Loading versions')
    try {
      const response = await fetch(`${apiBasePath}/configs/${encodeURIComponent(this.data.id)}/versions`)
      const body = await parseApiResponse<ConfigVersionData[]>(response)
      if (body.code !== 0) {
        this.setBackendMessage(body.message ?? 'Failed to load versions')
        return body
      }
      this.backendState.versions = body.data ?? []
      this.setBackendMessage(this.backendState.versions.length ? `Loaded ${this.backendState.versions.length} versions` : 'No saved versions')
      return body
    } catch (error) {
      const message = messageFromError(error)
      this.setBackendMessage(message)
      return { code: -1, message }
    } finally {
      this.backendState.isLoading = false
    }
  }

  async loadConfigVersion(version: number, id: string = this.data.id) {
    this.backendState.isLoading = true
    this.setBackendMessage(`Loading ${id} version ${version}`)
    try {
      const response = await fetch(`${apiBasePath}/configs/${encodeURIComponent(id)}/versions/${version}`)
      const body = await parseApiResponse<ConfigVersionData>(response)
      if (body.code !== 0 || !body.data?.contentJson) {
        this.setBackendMessage(body.message ?? 'Failed to load version')
        return body
      }
      const dataNext = JSON.parse(body.data.contentJson) as TileGridMapData
      this.setData(dataNext)
      this.backendState.versionBase = body.data.version
      this.backendState.versionSelected = body.data.version
      this.backendState.configSelectedId = body.data.id
      this.setBackendMessage(`Loaded version ${body.data.version}`)
      return body
    } catch (error) {
      const message = messageFromError(error)
      this.setBackendMessage(message)
      return { code: -1, message }
    } finally {
      this.backendState.isLoading = false
    }
  }

  async loadConfig(id: string) {
    const configRow = this.backendState.configs.find((item) => item.id === id)
    if (!configRow) return { code: -1, message: 'Config not found' }
    return this.loadConfigVersion(configRow.version, id)
  }

  async saveConfigVersion() {
    this.backendState.isLoading = true
    this.setBackendMessage('Saving current map')
    try {
      const versionBase = this.backendState.versionBase
      const idEncoded = encodeURIComponent(this.data.id)
      const url = versionBase === null ? `${apiBasePath}/configs/${idEncoded}/versions` : `${apiBasePath}/configs/${idEncoded}/versions/${versionBase}/children`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: this.data.id, contentJson: this.data }),
      })
      const body = await parseApiResponse<ConfigVersionData>(response)
      if (body.code !== 0 || !body.data) {
        this.setBackendMessage(body.message ?? 'Failed to save version')
        return body
      }
      this.backendState.versionBase = body.data.version
      this.backendState.versionSelected = body.data.version
      this.backendState.configSelectedId = body.data.id
      await this.fetchConfigs()
      this.setBackendMessage(`Saved version ${body.data.version}`)
      return body
    } catch (error) {
      const message = messageFromError(error)
      this.setBackendMessage(message)
      return { code: -1, message }
    } finally {
      this.backendState.isLoading = false
    }
  }

  async deleteConfigVersion(version: number, id: string = this.data.id) {
    this.backendState.isLoading = true
    this.setBackendMessage(`Deleting ${id} version ${version}`)
    try {
      const response = await fetch(`${apiBasePath}/configs/${encodeURIComponent(id)}/versions/${version}`, { method: 'DELETE' })
      const body = await parseApiResponse<unknown>(response)
      if (body.code !== 0) {
        this.setBackendMessage(body.message ?? 'Failed to delete version')
        return body
      }
      if (this.backendState.versionBase === version) this.backendState.versionBase = null
      if (this.backendState.versionSelected === version) this.backendState.versionSelected = null
      await this.fetchConfigs()
      this.setBackendMessage(`Deleted version ${version}`)
      return body
    } catch (error) {
      const message = messageFromError(error)
      this.setBackendMessage(message)
      return { code: -1, message }
    } finally {
      this.backendState.isLoading = false
    }
  }

  async deleteConfig(id: string) {
    const configRow = this.backendState.configs.find((item) => item.id === id)
    if (!configRow) return { code: -1, message: 'Config not found' }
    return this.deleteConfigVersion(configRow.version, id)
  }

  setMapObjDataFormat(format: MapObjDataFormat) {
    this.config.mapObjDataFormat = format
    this.updateMapObjData()
  }

  setMode(mode: PrefectureSelectorMode) {
    this.config.mode = mode
  }

  updateGridDisplayRange(key: GridDisplayRangeKey, delta: number) {
    const metadata = this.data.metadata
    const valueNext = metadata[key] + delta

    if (key === 'rowStart') metadata.rowStart = Math.min(valueNext, metadata.rowEnd)
    if (key === 'rowEnd') metadata.rowEnd = Math.max(valueNext, metadata.rowStart)
    if (key === 'colStart') metadata.colStart = Math.min(valueNext, metadata.colEnd)
    if (key === 'colEnd') metadata.colEnd = Math.max(valueNext, metadata.colStart)

    this.updateMapObjData()
  }

  setMapConfigValue(propertyPath: string, valueNextRaw: unknown) {
    const metadata = this.data.metadata
    metadata.view = { ...mapViewDefault, ...(metadata.view ?? {}) }

    if (propertyPath === 'config.mode') {
      if (valueNextRaw !== 'display' && valueNextRaw !== 'select' && valueNextRaw !== 'edit') return { code: -1, message: 'Unsupported mode' }
      this.setMode(valueNextRaw)
      return { code: 0 }
    }

    if (propertyPath === 'metadata.view.mapWidthMax') {
      const valueNext = Math.round(Number(valueNextRaw))
      if (!Number.isFinite(valueNext)) return { code: -1, message: 'Map width must be a number' }
      metadata.view.mapWidthMax = Math.max(360, Math.min(980, valueNext))
      this.updateMapObjData()
      return { code: 0 }
    }

    if (propertyPath === 'metadata.cellAspectRatio.width' || propertyPath === 'metadata.cellAspectRatio.height') {
      const valueNext = Number(valueNextRaw)
      if (!Number.isFinite(valueNext)) return { code: -1, message: 'Aspect ratio must be a number' }
      const valueSafe = Math.max(0.2, Math.min(2.5, valueNext))
      if (propertyPath === 'metadata.cellAspectRatio.width') metadata.cellAspectRatio.width = valueSafe
      if (propertyPath === 'metadata.cellAspectRatio.height') metadata.cellAspectRatio.height = valueSafe
      this.updateMapObjData()
      return { code: 0 }
    }

    if (propertyPath === 'metadata.view.backgroundColor') {
      metadata.view.backgroundColor = colorValueNormalize(valueNextRaw, metadata.view.backgroundColor ?? mapViewDefault.backgroundColor)
      this.updateMapObjData()
      return { code: 0 }
    }

    if (propertyPath.startsWith('metadata.view.regionGreyed.')) {
      const groupId = propertyPath.replace(/^metadata\.view\.regionGreyed\./, '')
      if (!this.groupComponents.some((group) => group.id === groupId)) return { code: -1, message: 'Region is not found' }
      const regionGreyedIds = new Set(metadata.view.regionGreyedIds ?? [])
      if (Boolean(valueNextRaw)) regionGreyedIds.add(groupId)
      else regionGreyedIds.delete(groupId)
      metadata.view.regionGreyedIds = this.groupComponents.map((group) => group.id).filter((groupIdItem) => regionGreyedIds.has(groupIdItem))
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

  increaseGridDensity() {
    const scaleCell = (value: number, isEnd: boolean) => (isEnd ? value * 2 : value * 2 - 1)
    this.data.metadata.rowStart = scaleCell(this.data.metadata.rowStart, false)
    this.data.metadata.rowEnd = scaleCell(this.data.metadata.rowEnd, true)
    this.data.metadata.colStart = scaleCell(this.data.metadata.colStart, false)
    this.data.metadata.colEnd = scaleCell(this.data.metadata.colEnd, true)

    for (const component of this.data.components) {
      if (isRectRange(component.range)) {
        component.range = {
          rowStart: scaleCell(component.range.rowStart, false),
          rowEnd: scaleCell(component.range.rowEnd, true),
          colStart: scaleCell(component.range.colStart, false),
          colEnd: scaleCell(component.range.colEnd, true),
        }
        continue
      }

      component.range = component.range.flatMap((cell) => ([
        { row: cell.row * 2 - 1, col: cell.col * 2 - 1 },
        { row: cell.row * 2 - 1, col: cell.col * 2 },
        { row: cell.row * 2, col: cell.col * 2 - 1 },
        { row: cell.row * 2, col: cell.col * 2 },
      ]))
    }

    this.commitGeometryChange()
  }

  decreaseGridDensity() {
    const scaleStart = (value: number) => Math.floor((value + 1) / 2)
    const scaleEnd = (value: number) => Math.ceil(value / 2)
    const scaleCell = (value: number) => Math.ceil(value / 2)
    const dedupeCells = (cells: readonly GridCell[]) => {
      const cellByKey = new Map<string, GridCell>()
      for (const cell of cells) {
        const row = scaleCell(cell.row)
        const col = scaleCell(cell.col)
        cellByKey.set(`${row}:${col}`, { row, col })
      }
      return Array.from(cellByKey.values())
    }

    this.data.metadata.rowStart = scaleStart(this.data.metadata.rowStart)
    this.data.metadata.rowEnd = Math.max(this.data.metadata.rowStart, scaleEnd(this.data.metadata.rowEnd))
    this.data.metadata.colStart = scaleStart(this.data.metadata.colStart)
    this.data.metadata.colEnd = Math.max(this.data.metadata.colStart, scaleEnd(this.data.metadata.colEnd))

    for (const component of this.data.components) {
      if (isRectRange(component.range)) {
        const rowStart = scaleStart(component.range.rowStart)
        const rowEnd = scaleEnd(component.range.rowEnd)
        const colStart = scaleStart(component.range.colStart)
        const colEnd = scaleEnd(component.range.colEnd)
        component.range = {
          rowStart: Math.max(this.data.metadata.rowStart, rowStart),
          rowEnd: Math.min(this.data.metadata.rowEnd, Math.max(rowStart, rowEnd)),
          colStart: Math.max(this.data.metadata.colStart, colStart),
          colEnd: Math.min(this.data.metadata.colEnd, Math.max(colStart, colEnd)),
        }
        continue
      }

      component.range = dedupeCells(component.range)
    }

    this.commitGeometryChange()
  }

  renameComponent(componentId: string, label: string) {
    const labelNext = label.trim()
    if (!labelNext) return { code: -1, message: 'Name is required' }
    const component = this.componentById.get(componentId)
    if (!component) return { code: -1, message: 'Component not found' }
    component.label = labelNext
    this.updateMapObjData()
    return { code: 0 }
  }

  deleteComponent(componentId: string) {
    const component = this.componentById.get(componentId)
    if (!component) return { code: -1, message: 'Component not found' }
    this.data.components = this.data.components
      .filter((componentItem) => componentItem.id !== componentId)
      .map((componentItem) => {
        if (componentItem.compType !== 'group') return componentItem
        return { ...componentItem, children: componentItem.children.filter((childId) => childId !== componentId) }
      })
    this.selectState.selectedBlockIds.delete(componentId)
    this.selectState.selectedGroupIds.delete(componentId)
    if (this.editState.selectedComponentId === componentId) this.editState.selectedComponentId = null
    this.editMultiSelectionState.selectedComponentIds.delete(componentId)
    this.commitGeometryChange()
    return { code: 0 }
  }

  isBlockSelectedFinal(componentId: string) {
    return this.selectedBlockIdsFinal.has(componentId)
  }

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
    if (component.compType === 'block') return [component.id]
    if (component.compType === 'group') {
      return component.children.filter((childId) => this.componentById.get(childId)?.compType === 'block')
    }
    return []
  }

  applySelectComponentOperation(componentId: string, operation: SelectionOperation, isGroupCollapseEnabled = false) {
    const component = this.componentById.get(componentId)
    if (operation === 'add' && component?.compType === 'block') {
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
    if (group?.compType === 'group' && this.selectState.selectedGroupIds.has(group.id) && this.selectState.selectedBlockIds.has(componentId)) {
      this.selectState.selectedGroupIds.delete(group.id)
      for (const childId of group.children) {
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
      if (group?.compType === 'group' && group.children.every((childId) => this.selectState.selectedBlockIds.has(childId))) {
        this.selectState.selectedGroupIds.add(group.id)
      }
    }
  }

  toggleGroupSelection(componentId: string) {
    if (this.selectState.selectedGroupIds.has(componentId)) {
      const group = this.componentById.get(componentId)
      if (group?.compType === 'group') {
        const areAllChildrenSelectedInternal = group.children.every((childId) => this.selectState.selectedBlockIds.has(childId))
        if (areAllChildrenSelectedInternal) {
          for (const childId of group.children) {
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
      if (component?.compType === 'block') this.selectState.selectedBlockIds.add(blockId)
    }
    if (!isGroupCollapseEnabled) return
    for (const group of this.groupComponents) {
      if (group.children.every((childId) => this.selectState.selectedBlockIds.has(childId))) {
        this.selectState.selectedGroupIds.add(group.id)
        for (const childId of group.children) {
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
    if (this.componentById.get(componentId)?.compType !== 'block') return
    const mergedIds = this.mergeSelectionIds(this.getEditSelectionIds(), [componentId], operation)
    this.setEditSelectionByComponentIds(mergedIds)
  }

  clearEditSelection() {
    this.editState.selectionMode = 'single'
    this.editState.selectedComponentId = null
    this.clearEditMultiSelection()
  }

  toggleBlockPropEditor(componentId: string, anchorRect: ViewRect, viewportSize: ViewSize) {
    const component = this.componentById.get(componentId)
    if (!component || component.compType !== 'block') return { code: -1, message: 'Block component not found' }
    const editorState = this.editPropEditorState
    if (editorState.isShown && editorState.componentId === componentId) {
      this.closePropEditor()
      return { code: 0 }
    }
    this.selectEditComponent(componentId)
    editorState.isShown = true
    editorState.componentId = componentId
    editorState.pos = chooseAnchoredPopupPos(anchorRect, editorState.popupSize, rectFromViewportSize(viewportSize))
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
    const group = component.compType === 'block' ? this.groupByBlockId.get(componentId) : component
    if (!group || group.compType !== 'group') return { code: -1, message: 'Group not found' }
    const colorNext = color.trim()
    if (!colorNext) return { code: -1, message: 'Color is required' }
    group.metadata = { ...(group.metadata ?? {}), color: colorNext }
    if (component.compType === 'block') {
      for (const childId of group.children) {
        const child = this.componentById.get(childId)
        if (child?.metadata && Object.prototype.hasOwnProperty.call(child.metadata, 'color')) {
          const { color: _color, ...metadataNext } = child.metadata
          child.metadata = Object.keys(metadataNext).length > 0 ? metadataNext : undefined
        }
      }
    }
    this.updateMapObjData()
    return { code: 0 }
  }

  setComponentRectValue(componentId: string, key: Extract<PropEditorPropertyKey, 'range.rowStart' | 'range.rowEnd' | 'range.colStart' | 'range.colEnd'>, valueNextRaw: unknown) {
    const component = this.componentById.get(componentId)
    if (!component || component.type !== 'rect' || !isRectRange(component.range)) return { code: -1, message: 'Selected component is not rectangular' }
    const valueNext = Math.round(Number(valueNextRaw))
    if (!Number.isFinite(valueNext)) return { code: -1, message: 'Value must be a number' }
    const rangeNext = normalizeRect(component.range)
    if (key === 'range.rowStart') rangeNext.rowStart = Math.min(Math.max(this.data.metadata.rowStart, valueNext), rangeNext.rowEnd)
    if (key === 'range.rowEnd') rangeNext.rowEnd = Math.max(Math.min(this.data.metadata.rowEnd, valueNext), rangeNext.rowStart)
    if (key === 'range.colStart') rangeNext.colStart = Math.min(Math.max(this.data.metadata.colStart, valueNext), rangeNext.colEnd)
    if (key === 'range.colEnd') rangeNext.colEnd = Math.max(Math.min(this.data.metadata.colEnd, valueNext), rangeNext.colStart)
    component.range = rangeNext
    this.commitGeometryChange()
    return { code: 0 }
  }

  setComponentPropEditorValue(componentId: string, propertyPath: string, valueNext: unknown) {
    if (propertyPath === 'label') return this.renameComponent(componentId, String(valueNext))
    if (propertyPath === 'color') return this.setComponentColor(componentId, String(valueNext))
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

  isComponentIncludedInSelectionBox(component: TileGridMapComponent, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
    return isComponentIncludedInSelectionBoxAction(this, component, box, includeMode)
  }

  isComponentIncludedInEditSelectionBox(component: TileGridMapComponent, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
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

  isGridLineValidForEdge(component: TileGridMapComponent, edge: RectEdge, gridLine: number) {
    return isGridLineValidForEdgeAction(this, component, edge, gridLine)
  }

  getRangeAfterEdgeDrop(range: GridRectRange, edge: RectEdge, gridLine: number): GridRectRange {
    return getRangeAfterEdgeDropAction(range, edge, gridLine)
  }

  handleEvent(eventType: PrefectureSelectorEventType, eventData: PrefectureSelectorEventData) {
    return handlePrefectureSelectorEvent(this, eventType, eventData)
  }
}

export function createPrefectureSelectorStore(data?: TileGridMapData) {
  return new PrefectureSelectorStore(data)
}