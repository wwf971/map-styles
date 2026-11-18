// The data of one block map (doc/map-block-data.md): a grid of cells, and the components
// lying on it, blocks and the groups holding them. This file is the format: its types, how a
// map read from anywhere is made valid, how it is written as text, how the format of the first
// version is read, and what a shape is (a rectangle of cells, or a polygon on the grid lines).
import {
  type GridLineBox,
  type GridPoint,
  polygonIsRect,
  polygonLineBoxGet,
  polygonNormalize,
} from './MapBlockGeom'

export type { GridPoint, GridLineBox }

export const MAP_BLOCK_FORMAT_VERSION = 2

// a range of cells, by cell index, both ends included
export type GridRectRange = {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

// a box between grid lines (a selection drag): continuous, ends are lines
export type GridBoxRange = GridLineBox

export type MapBlockShapeRect = { type: 'rect' } & GridRectRange
export type MapBlockShapePolygon = { type: 'polygon'; pointList: GridPoint[] }
export type MapBlockShape = MapBlockShapeRect | MapBlockShapePolygon

type MapBlockCompBase = {
  id: string
  label: string
  shape: MapBlockShape
  // free data of whoever uses the map (an application linking a block to its own items)
  metadata?: Record<string, unknown>
}

export type MapBlockBlock = MapBlockCompBase & { kind: 'block' }
export type MapBlockGroup = MapBlockCompBase & {
  kind: 'group'
  childIdList: string[]
  // the color of the group's blocks; absent, a color of the palette by the group's order
  color?: string
}
export type MapBlockComp = MapBlockBlock | MapBlockGroup

export type MapBlockGrid = GridRectRange & {
  cellAspectRatio: { width: number; height: number }
}

export type MapBlockView = {
  mapWidthMax: number
  backgroundColor: string
  groupGreyedIdList: string[]
}

export type MapBlockData = {
  formatVersion: typeof MAP_BLOCK_FORMAT_VERSION
  label: string
  grid: MapBlockGrid
  view: MapBlockView
  compList: MapBlockComp[]
}

export type MapBlockTextFormat = 'tight' | 'pretty'

export const MAP_BLOCK_VIEW_DEFAULT: MapBlockView = {
  mapWidthMax: 620,
  backgroundColor: '#eaf5ff',
  groupGreyedIdList: [],
}

export const MAP_BLOCK_MAP_WIDTH_MIN = 360
export const MAP_BLOCK_MAP_WIDTH_MAX = 980

// ---------- reading a map ----------

// a map as the store keeps it, from whatever was read (a file, an asset, a paste): the
// format of the first version is converted, missing values get their defaults
export function mapBlockDataNormalize(dataRaw: unknown): MapBlockData {
  const dataInput = (dataRaw && typeof dataRaw === 'object' ? dataRaw : {}) as Record<string, any>
  const data = mapBlockDataIsV1(dataInput) ? mapBlockDataFromV1(dataInput) : dataClone(dataInput)
  const grid = (data.grid ?? {}) as Partial<MapBlockGrid>
  const view = (data.view ?? {}) as Partial<MapBlockView>
  const rowStart = numberInt(grid.rowStart, 1)
  const colStart = numberInt(grid.colStart, 1)
  return {
    formatVersion: MAP_BLOCK_FORMAT_VERSION,
    label: String(data.label ?? ''),
    grid: {
      rowStart,
      rowEnd: Math.max(rowStart, numberInt(grid.rowEnd, rowStart)),
      colStart,
      colEnd: Math.max(colStart, numberInt(grid.colEnd, colStart)),
      cellAspectRatio: {
        width: Math.max(0.2, Number(grid.cellAspectRatio?.width) || 1),
        height: Math.max(0.2, Number(grid.cellAspectRatio?.height) || 1),
      },
    },
    view: {
      mapWidthMax: Math.max(MAP_BLOCK_MAP_WIDTH_MIN, Math.min(MAP_BLOCK_MAP_WIDTH_MAX, Math.round(Number(view.mapWidthMax) || MAP_BLOCK_VIEW_DEFAULT.mapWidthMax))),
      backgroundColor: colorValueNormalize(view.backgroundColor, MAP_BLOCK_VIEW_DEFAULT.backgroundColor),
      groupGreyedIdList: Array.isArray(view.groupGreyedIdList) ? view.groupGreyedIdList.map(String) : [],
    },
    compList: (Array.isArray(data.compList) ? data.compList : []).map(compNormalize).filter((comp): comp is MapBlockComp => comp !== null),
  }
}

export function colorValueNormalize(valueRaw: unknown, fallback: string) {
  const valueText = String(valueRaw || '').trim()
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(valueText)) return valueText
  return fallback
}

function compNormalize(compRaw: any): MapBlockComp | null {
  if (!compRaw || typeof compRaw !== 'object') return null
  const shape = shapeNormalize(compRaw.shape)
  if (!shape) return null
  const id = String(compRaw.id ?? '')
  if (!id) return null
  const label = String(compRaw.label ?? '')
  const metadata = compRaw.metadata && typeof compRaw.metadata === 'object' && Object.keys(compRaw.metadata).length > 0 ? { metadata: { ...compRaw.metadata } } : {}
  // the keys in the order a line of the tight text reads well: what it is, then where
  if (compRaw.kind === 'group') {
    return {
      id,
      kind: 'group',
      label,
      shape,
      childIdList: Array.isArray(compRaw.childIdList) ? compRaw.childIdList.map(String) : [],
      ...(typeof compRaw.color === 'string' && compRaw.color ? { color: compRaw.color } : {}),
      ...metadata,
    }
  }
  return { id, kind: 'block', label, shape, ...metadata }
}

function shapeNormalize(shapeRaw: any): MapBlockShape | null {
  if (!shapeRaw || typeof shapeRaw !== 'object') return null
  if (shapeRaw.type === 'polygon') {
    if (!Array.isArray(shapeRaw.pointList)) return null
    const pointList = shapeRaw.pointList
      .filter((point: unknown) => Array.isArray(point) && point.length >= 2)
      .map((point: unknown[]) => [Number(point[0]), Number(point[1])] as GridPoint)
    if (pointList.length < 3) return null
    return { type: 'polygon', pointList }
  }
  if (shapeRaw.type !== 'rect') return null
  return {
    type: 'rect',
    rowStart: Number(shapeRaw.rowStart),
    rowEnd: Number(shapeRaw.rowEnd),
    colStart: Number(shapeRaw.colStart),
    colEnd: Number(shapeRaw.colEnd),
  }
}

// ---------- writing a map ----------

// the text of a map: "tight" keeps one component per line, which reads well in a diff;
// "pretty" is the usual indented json
export function mapBlockDataTextBuild(data: MapBlockData, format: MapBlockTextFormat = 'tight') {
  if (format === 'pretty') return JSON.stringify(data, null, 2)
  const compLineList = data.compList.map((component) => `    ${JSON.stringify(component)}`)
  return [
    '{',
    `  "formatVersion": ${JSON.stringify(data.formatVersion)},`,
    `  "label": ${JSON.stringify(data.label)},`,
    `  "grid": ${JSON.stringify(data.grid)},`,
    `  "view": ${JSON.stringify(data.view)},`,
    '  "compList": [',
    `${compLineList.join(',\n')}`,
    '  ]',
    '}',
  ].join('\n')
}

// the text read back: the map, or why it is not one
export function mapBlockDataTextParse(text: string): { code: number; data?: MapBlockData; message?: string } {
  let dataRaw: unknown
  try {
    dataRaw = JSON.parse(text)
  } catch (error) {
    return { code: -1, message: `the map is not json: ${(error as Error)?.message ?? error}` }
  }
  if (!dataRaw || typeof dataRaw !== 'object' || Array.isArray(dataRaw)) return { code: -1, message: 'the map is not a json object' }
  return { code: 0, data: mapBlockDataNormalize(dataRaw) }
}

// a new map: a grid and nothing on it but a group and two blocks, so that there is something
// to select and to move from the first moment (react-doc: create without a form)
export function mapBlockDataNewBuild(label: string): MapBlockData {
  return mapBlockDataNormalize({
    formatVersion: MAP_BLOCK_FORMAT_VERSION,
    label,
    grid: { rowStart: 1, rowEnd: 8, colStart: 1, colEnd: 12, cellAspectRatio: { width: 1, height: 1 } },
    view: { ...MAP_BLOCK_VIEW_DEFAULT },
    compList: [
      { id: 'group-1', kind: 'group', label: 'Group 1', shape: { type: 'rect', rowStart: 1, rowEnd: 1, colStart: 1, colEnd: 2 }, childIdList: ['block-1', 'block-2'] },
      { id: 'block-1', kind: 'block', label: 'Block 1', shape: { type: 'rect', rowStart: 3, rowEnd: 4, colStart: 3, colEnd: 4 } },
      { id: 'block-2', kind: 'block', label: 'Block 2', shape: { type: 'rect', rowStart: 3, rowEnd: 4, colStart: 5, colEnd: 6 } },
    ],
  })
}

// ---------- shapes ----------

export function shapeIsRect(shape: MapBlockShape | undefined | null): shape is MapBlockShapeRect {
  return shape?.type === 'rect'
}

export function shapeIsPolygon(shape: MapBlockShape | undefined | null): shape is MapBlockShapePolygon {
  return shape?.type === 'polygon'
}

export function rectNormalize(range: GridRectRange): GridRectRange {
  return {
    rowStart: Math.min(range.rowStart, range.rowEnd),
    rowEnd: Math.max(range.rowStart, range.rowEnd),
    colStart: Math.min(range.colStart, range.colEnd),
    colEnd: Math.max(range.colStart, range.colEnd),
  }
}

// the cells a shape covers at most: a rectangle itself, a polygon its bounding box. this is
// where a shape is drawn, moved and kept inside the grid
export function shapeCellRectGet(shape: MapBlockShape): GridRectRange | null {
  if (shapeIsRect(shape)) return rectNormalize(shape)
  const box = polygonLineBoxGet(shape.pointList)
  if (!box) return null
  return {
    rowStart: box.rowStart,
    rowEnd: Math.max(box.rowStart, box.rowEnd - 1),
    colStart: box.colStart,
    colEnd: Math.max(box.colStart, box.colEnd - 1),
  }
}

// the corners of a shape on the grid lines, clockwise from the top left for a rectangle
export function shapePointListGet(shape: MapBlockShape): GridPoint[] {
  if (shapeIsPolygon(shape)) return shape.pointList.map(([row, col]) => [row, col])
  const range = rectNormalize(shape)
  return [
    [range.rowStart, range.colStart],
    [range.rowStart, range.colEnd + 1],
    [range.rowEnd + 1, range.colEnd + 1],
    [range.rowEnd + 1, range.colStart],
  ]
}

export function shapeRectBuild(range: GridRectRange): MapBlockShapeRect {
  return { type: 'rect', ...rectNormalize(range) }
}

export function shapePolygonBuild(pointList: readonly GridPoint[]): MapBlockShapePolygon {
  return { type: 'polygon', pointList: polygonNormalize(pointList) }
}

// a polygon that is an axis-aligned rectangle, as a rectangle; null for any other
export function shapePolygonToRect(shape: MapBlockShape): MapBlockShapeRect | null {
  if (shapeIsRect(shape)) return shape
  if (!polygonIsRect(shape.pointList)) return null
  return shapeRectBuild(shapeCellRectGet(shape)!)
}

export function shapeClone(shape: MapBlockShape): MapBlockShape {
  if (shapeIsPolygon(shape)) return { type: 'polygon', pointList: shape.pointList.map(([row, col]) => [row, col]) }
  return { ...shape }
}

export function shapeShift(shape: MapBlockShape, rowDelta: number, colDelta: number): MapBlockShape {
  if (shapeIsPolygon(shape)) {
    return { type: 'polygon', pointList: shape.pointList.map(([row, col]) => [row + rowDelta, col + colDelta]) }
  }
  return {
    type: 'rect',
    rowStart: shape.rowStart + rowDelta,
    rowEnd: shape.rowEnd + rowDelta,
    colStart: shape.colStart + colDelta,
    colEnd: shape.colEnd + colDelta,
  }
}

// ---------- the density of the grid ----------
//
// Doubling the density splits every cell into 2 x 2 cells. Cell indices start at 1, so cell r
// becomes cells 2r-1 and 2r, and grid line l becomes grid line 2l-1. Halving is the inverse,
// l -> (l+1)/2, and is exact only for odd lines: a shape whose lines are all odd comes back
// as it was, any other has to grow to the coarser lines (doc/map-block-edit.md#density).

export function gridLineDouble(line: number) {
  return line * 2 - 1
}

export function gridLineIsHalvable(line: number) {
  return Math.abs(line % 2) === 1
}

// a line halved: exact for an odd line; an even one goes outward, so a shape never shrinks
// to nothing (a start rounds down, an end rounds up)
export function gridLineHalve(line: number, side: 'start' | 'end') {
  if (gridLineIsHalvable(line)) return (line + 1) / 2
  return side === 'start' ? Math.floor((line + 1) / 2) : Math.ceil((line + 1) / 2)
}

export function rectDensityDouble(range: GridRectRange): GridRectRange {
  // cell indices: start cell r -> 2r-1, end cell r -> 2r (its end line r+1 -> 2r+1)
  return {
    rowStart: gridLineDouble(range.rowStart),
    rowEnd: gridLineDouble(range.rowEnd + 1) - 1,
    colStart: gridLineDouble(range.colStart),
    colEnd: gridLineDouble(range.colEnd + 1) - 1,
  }
}

export function rectDensityIsHalvable(range: GridRectRange) {
  return gridLineIsHalvable(range.rowStart) && gridLineIsHalvable(range.rowEnd + 1)
    && gridLineIsHalvable(range.colStart) && gridLineIsHalvable(range.colEnd + 1)
}

export function rectDensityHalve(range: GridRectRange): GridRectRange {
  const rowStart = gridLineHalve(range.rowStart, 'start')
  const colStart = gridLineHalve(range.colStart, 'start')
  return {
    rowStart,
    rowEnd: Math.max(rowStart, gridLineHalve(range.rowEnd + 1, 'end') - 1),
    colStart,
    colEnd: Math.max(colStart, gridLineHalve(range.colEnd + 1, 'end') - 1),
  }
}

export function shapeDensityDouble(shape: MapBlockShape): MapBlockShape {
  if (shapeIsPolygon(shape)) {
    return { type: 'polygon', pointList: shape.pointList.map(([row, col]) => [gridLineDouble(row), gridLineDouble(col)]) }
  }
  return { type: 'rect', ...rectDensityDouble(shape) }
}

export function shapeDensityIsHalvable(shape: MapBlockShape) {
  if (shapeIsPolygon(shape)) return shape.pointList.every(([row, col]) => gridLineIsHalvable(row) && gridLineIsHalvable(col))
  return rectDensityIsHalvable(shape)
}

// a shape halved: exact when it is halvable; a rectangle grows outward otherwise, and a
// polygon's points go to the nearest coarser line, which may leave it without area (null)
export function shapeDensityHalve(shape: MapBlockShape): MapBlockShape | null {
  if (shapeIsRect(shape)) return { type: 'rect', ...rectDensityHalve(shape) }
  const pointList = polygonNormalize(shape.pointList.map(([row, col]) => [Math.round((row + 1) / 2), Math.round((col + 1) / 2)] as GridPoint))
  if (pointList.length < 3) return null
  return { type: 'polygon', pointList }
}

// ---------- the format of the first version ----------
//
// The first version (the reference implementation, kept in a sqlite backend and in TypeScript
// constants) named the map's grid and view "metadata", a component's kind "compType", its
// shape "type" and "range" (a rectangle, or a list of cells), the children of a group
// "children", and its color "metadata.color". It also carried "renderCompName", which only
// repeated the kind, and "metadata.view.regionGreyedIds".

export function mapBlockDataIsV1(dataRaw: Record<string, any>) {
  return Array.isArray(dataRaw.components) && dataRaw.metadata && typeof dataRaw.metadata === 'object'
}

export function mapBlockDataFromV1(dataV1: Record<string, any>): MapBlockData {
  const metadata = dataV1.metadata ?? {}
  const view = metadata.view ?? {}
  return {
    formatVersion: MAP_BLOCK_FORMAT_VERSION,
    label: String(dataV1.label ?? ''),
    grid: {
      rowStart: metadata.rowStart,
      rowEnd: metadata.rowEnd,
      colStart: metadata.colStart,
      colEnd: metadata.colEnd,
      cellAspectRatio: { width: metadata.cellAspectRatio?.width ?? 1, height: metadata.cellAspectRatio?.height ?? 1 },
    },
    view: {
      mapWidthMax: view.mapWidthMax ?? MAP_BLOCK_VIEW_DEFAULT.mapWidthMax,
      backgroundColor: view.backgroundColor ?? MAP_BLOCK_VIEW_DEFAULT.backgroundColor,
      groupGreyedIdList: Array.isArray(view.regionGreyedIds) ? [...view.regionGreyedIds] : [],
    },
    compList: dataV1.components.map((componentV1: Record<string, any>) => {
      const { color, ...metadataRest } = componentV1.metadata ?? {}
      const shape = componentV1.type === 'cells' ? shapeFromCellList(componentV1.range ?? []) : { type: 'rect', ...componentV1.range }
      const base = {
        id: componentV1.id,
        label: componentV1.label,
        shape,
        ...(Object.keys(metadataRest).length > 0 ? { metadata: metadataRest } : {}),
      }
      if (componentV1.compType === 'group') {
        return { ...base, kind: 'group', childIdList: [...(componentV1.children ?? [])], ...(color ? { color } : {}) }
      }
      return { ...base, kind: 'block', ...(color ? { metadata: { ...metadataRest, color } } : {}) }
    }),
  } as MapBlockData
}

// a set of cells (a shape of the first version) as the outline of their union: a rectangle when
// they fill one, else a polygon traced along the outer edges of the cells. a set making several
// pieces or holes cannot be one polygon and keeps its bounding box
export function shapeFromCellList(cellList: readonly { row: number; col: number }[]): MapBlockShape {
  const keySet = new Set(cellList.map((cell) => `${cell.row}:${cell.col}`))
  const rowList = cellList.map((cell) => cell.row)
  const colList = cellList.map((cell) => cell.col)
  const range = { rowStart: Math.min(...rowList), rowEnd: Math.max(...rowList), colStart: Math.min(...colList), colEnd: Math.max(...colList) }
  if (keySet.size === (range.rowEnd - range.rowStart + 1) * (range.colEnd - range.colStart + 1)) return shapeRectBuild(range)
  // the edges of the cells that have no cell on their other side, each directed so that its
  // cell is on its right; joined head to tail they make the rings of the outline
  const edgeByStart = new Map<string, GridPoint[]>()
  const edgeAdd = (from: GridPoint, to: GridPoint) => {
    const key = `${from[0]}:${from[1]}`
    edgeByStart.set(key, [...(edgeByStart.get(key) ?? []), to])
  }
  for (const { row, col } of cellList) {
    if (!keySet.has(`${row - 1}:${col}`)) edgeAdd([row, col], [row, col + 1])
    if (!keySet.has(`${row}:${col + 1}`)) edgeAdd([row, col + 1], [row + 1, col + 1])
    if (!keySet.has(`${row + 1}:${col}`)) edgeAdd([row + 1, col + 1], [row + 1, col])
    if (!keySet.has(`${row}:${col - 1}`)) edgeAdd([row + 1, col], [row, col])
  }
  const edgeCount = [...edgeByStart.values()].reduce((sum, list) => sum + list.length, 0)
  const pointStart: GridPoint = [range.rowStart, Math.min(...cellList.filter((cell) => cell.row === range.rowStart).map((cell) => cell.col))]
  const ring: GridPoint[] = [pointStart]
  let point = pointStart
  for (let step = 0; step < edgeCount; step += 1) {
    const toList = edgeByStart.get(`${point[0]}:${point[1]}`)
    if (!toList?.length) break
    const pointNext = toList.shift()!
    if (pointNext[0] === pointStart[0] && pointNext[1] === pointStart[1]) break
    ring.push(pointNext)
    point = pointNext
  }
  // one ring walks every edge once: as many points as edges
  if (ring.length !== edgeCount) return shapeRectBuild(range)
  return shapePolygonBuild(ring)
}

// ---------- helpers ----------

function dataClone<Data>(data: Data): Data {
  return JSON.parse(JSON.stringify(data)) as Data
}

function numberInt(valueRaw: unknown, fallback: number) {
  const value = Math.round(Number(valueRaw))
  return Number.isFinite(value) ? value : fallback
}
