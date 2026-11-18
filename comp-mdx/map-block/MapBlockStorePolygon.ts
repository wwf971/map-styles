import type { MapBlockStore } from './MapBlockStore'
import { shapeIsPolygon, shapePolygonBuild, type GridPoint } from './MapBlockData'
import { polygonNormalize, polygonProblemGet } from './MapBlockGeom'

// The tools making new shapes and the editing of a polygon's points
// (doc/map-block-edit.md#tools). Every point lies on the grid lines: a pointer is rounded to the
// nearest crossing of two lines, kept inside the grid.
//
//   tool rect      drag over the cells          -> a new rectangular block covering them
//   tool polygon   click point after point      -> a new polygon block, closed on its first point
//   a polygon      drag a corner / a segment    -> the corner / the segment's two ends moved
//                  drag the middle of a segment -> a new corner there, moved at once
//                  double-click a corner        -> the corner removed
//
// A polygon that would cross itself or lose its area is never written: the drop is refused and
// says why (drag.point.problem, polygonDraw.problem).

// ---------- tool rect ----------

export function beginRectCreateDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const rectCreate = store.editState.rectCreate
	const cell = cellAtPointer(store, pointerGridRow, pointerGridCol)
	rectCreate.isDragging = true
	rectCreate.cellStart = cell
	rectCreate.cellCurrent = cell
}

export function updateRectCreateDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const rectCreate = store.editState.rectCreate
	if (!rectCreate.isDragging) return
	rectCreate.cellCurrent = cellAtPointer(store, pointerGridRow, pointerGridCol)
}

export function commitRectCreateDrag(store: MapBlockStore) {
	const { cellStart, cellCurrent, isDragging } = store.editState.rectCreate
	clearRectCreate(store)
	if (!isDragging || !cellStart || !cellCurrent) return { code: -1, message: 'No rectangle was dragged' }
	return store.createComponent('block', {
		type: 'rect',
		rowStart: Math.min(cellStart[0], cellCurrent[0]),
		rowEnd: Math.max(cellStart[0], cellCurrent[0]),
		colStart: Math.min(cellStart[1], cellCurrent[1]),
		colEnd: Math.max(cellStart[1], cellCurrent[1]),
	})
}

export function cancelRectCreateDrag(store: MapBlockStore) {
	clearRectCreate(store)
}

function clearRectCreate(store: MapBlockStore) {
	const rectCreate = store.editState.rectCreate
	rectCreate.isDragging = false
	rectCreate.cellStart = null
	rectCreate.cellCurrent = null
}

// ---------- tool polygon ----------

// a point clicked: added, or, on the first point, the polygon closed
export function addPolygonDrawPoint(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number, isAxisLocked = false) {
	const draw = store.editState.polygonDraw
	const point = drawPointAtPointer(store, pointerGridRow, pointerGridCol, isAxisLocked)
	const pointFirst = draw.pointList[0]
	const pointLast = draw.pointList[draw.pointList.length - 1]
	draw.problem = ''
	if (pointFirst && draw.pointList.length >= 3 && pointEqual(point, pointFirst)) return commitPolygonDraw(store)
	if (pointLast && pointEqual(point, pointLast)) return { code: 0 }
	draw.pointList.push(point)
	draw.pointerPoint = point
	return { code: 0 }
}

export function movePolygonDrawPointer(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number, isAxisLocked = false) {
	store.editState.polygonDraw.pointerPoint = drawPointAtPointer(store, pointerGridRow, pointerGridCol, isAxisLocked)
}

export function removePolygonDrawPointLast(store: MapBlockStore) {
	const draw = store.editState.polygonDraw
	draw.pointList.pop()
	draw.problem = ''
}

// the points so far closed into a polygon: a new block, when they make one
export function commitPolygonDraw(store: MapBlockStore) {
	const draw = store.editState.polygonDraw
	const pointList = polygonNormalize(draw.pointList)
	const problem = polygonProblemGet(pointList)
	if (problem) {
		draw.problem = problem
		return { code: -1, message: problem }
	}
	cancelPolygonDraw(store)
	return store.createComponent('block', { type: 'polygon', pointList })
}

export function cancelPolygonDraw(store: MapBlockStore) {
	const draw = store.editState.polygonDraw
	draw.pointList = []
	draw.pointerPoint = null
	draw.problem = ''
}

// ---------- the points of a polygon ----------

// a corner dragged; with isInserted, a new corner put at index (the middle of the segment
// before it was pressed) and dragged from there
export function beginPolygonVertexDrag(store: MapBlockStore, componentId: string, index: number, pointerGridRow: number, pointerGridCol: number, isInserted = false) {
	const component = store.componentById.get(componentId)
	if (!component || !shapeIsPolygon(component.shape)) return
	const pointListOriginal = component.shape.pointList.map(([row, col]) => [row, col] as GridPoint)
	const pointerPoint = gridPointAtPointer(store, pointerGridRow, pointerGridCol)
	const pointListCandidate = pointListOriginal.map(([row, col]) => [row, col] as GridPoint)
	if (isInserted) pointListCandidate.splice(index, 0, pointerPoint)
	pointDragBegin(store, 'vertex', componentId, index, pointerPoint, isInserted ? pointListCandidate : pointListOriginal, pointListCandidate)
}

// a border segment dragged, from point index to the next: a horizontal segment moves up and
// down, a vertical one left and right, a slanted one both ways
export function beginPolygonSegmentDrag(store: MapBlockStore, componentId: string, index: number, pointerGridRow: number, pointerGridCol: number) {
	const component = store.componentById.get(componentId)
	if (!component || !shapeIsPolygon(component.shape)) return
	const pointListOriginal = component.shape.pointList.map(([row, col]) => [row, col] as GridPoint)
	pointDragBegin(store, 'segment', componentId, index, gridPointAtPointer(store, pointerGridRow, pointerGridCol), pointListOriginal, pointListOriginal.map(([row, col]) => [row, col] as GridPoint))
}

export function updatePolygonPointDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const drag = store.editState.drag
	const point = drag.point
	if (!drag.isDragging || (drag.dragType !== 'vertex' && drag.dragType !== 'segment')) return
	if (point.index === null || !point.pointerStart || !point.pointListOriginal) return
	const pointerPoint = gridPointAtPointer(store, pointerGridRow, pointerGridCol)
	const pointListCandidate = point.pointListOriginal.map(([row, col]) => [row, col] as GridPoint)
	if (drag.dragType === 'vertex') {
		pointListCandidate[point.index] = pointerPoint
	} else {
		const indexNext = (point.index + 1) % pointListCandidate.length
		const pointA = pointListCandidate[point.index]
		const pointB = pointListCandidate[indexNext]
		const isHorizontal = pointA[0] === pointB[0]
		const isVertical = pointA[1] === pointB[1]
		const rowDelta = isVertical ? 0 : pointerPoint[0] - point.pointerStart[0]
		const colDelta = isHorizontal ? 0 : pointerPoint[1] - point.pointerStart[1]
		pointListCandidate[point.index] = pointClamp(store, [pointA[0] + rowDelta, pointA[1] + colDelta])
		pointListCandidate[indexNext] = pointClamp(store, [pointB[0] + rowDelta, pointB[1] + colDelta])
	}
	point.pointListCandidate = pointListCandidate
	point.problem = polygonProblemGet(polygonNormalize(pointListCandidate))
	point.isDropValid = point.problem === ''
}

export function commitPolygonPointDrag(store: MapBlockStore) {
	const drag = store.editState.drag
	const { componentId, pointListCandidate, isDropValid, problem } = drag.point
	const component = componentId ? store.componentById.get(componentId) : null
	if (!component || !shapeIsPolygon(component.shape) || !pointListCandidate) {
		cancelPolygonPointDrag(store)
		return { code: -1, message: 'The polygon is gone' }
	}
	if (!isDropValid) {
		cancelPolygonPointDrag(store)
		store.setEditMessage(`Not moved: ${problem}`)
		return { code: -1, message: problem }
	}
	store.dataChange(() => {
		component.shape = shapePolygonBuild(pointListCandidate)
	})
	cancelPolygonPointDrag(store)
	store.setEditMessage('')
	return { code: 0 }
}

export function cancelPolygonPointDrag(store: MapBlockStore) {
	const drag = store.editState.drag
	if (drag.dragType === 'vertex' || drag.dragType === 'segment') {
		drag.isDragging = false
		drag.dragType = null
	}
	drag.point.componentId = null
	drag.point.index = null
	drag.point.pointerStart = null
	drag.point.pointListOriginal = null
	drag.point.pointListCandidate = null
	drag.point.isDropValid = true
	drag.point.problem = ''
}

export function deletePolygonVertex(store: MapBlockStore, componentId: string, index: number) {
	const component = store.componentById.get(componentId)
	if (!component || !shapeIsPolygon(component.shape)) return { code: -1, message: 'Not a polygon' }
	const pointList = polygonNormalize(component.shape.pointList.filter((_point, indexPoint) => indexPoint !== index))
	const problem = polygonProblemGet(pointList)
	if (problem) {
		store.setEditMessage(`The corner stays: ${problem}`)
		return { code: -1, message: problem }
	}
	store.dataChange(() => {
		component.shape = { type: 'polygon', pointList }
	})
	store.setEditMessage('')
	return { code: 0 }
}

// ---------- helpers ----------

function pointDragBegin(store: MapBlockStore, dragType: 'vertex' | 'segment', componentId: string, index: number, pointerStart: GridPoint, pointListOriginal: GridPoint[], pointListCandidate: GridPoint[]) {
	store.editState.selectedComponentId = componentId
	store.editState.selectionMode = 'single'
	store.clearEditMultiSelection()
	const drag = store.editState.drag
	drag.isDragging = true
	drag.dragType = dragType
	drag.point.componentId = componentId
	drag.point.index = index
	drag.point.pointerStart = pointerStart
	drag.point.pointListOriginal = pointListOriginal
	drag.point.pointListCandidate = pointListCandidate
	drag.point.problem = polygonProblemGet(polygonNormalize(pointListCandidate))
	drag.point.isDropValid = drag.point.problem === ''
}

function pointEqual(pointA: GridPoint, pointB: GridPoint) {
	return pointA[0] === pointB[0] && pointA[1] === pointB[1]
}

// the crossing of grid lines nearest to the pointer, inside the grid
function gridPointAtPointer(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number): GridPoint {
	return pointClamp(store, [Math.round(pointerGridRow), Math.round(pointerGridCol)])
}

function pointClamp(store: MapBlockStore, [row, col]: GridPoint): GridPoint {
	const grid = store.data.grid
	return [
		Math.min(grid.rowEnd + 1, Math.max(grid.rowStart, row)),
		Math.min(grid.colEnd + 1, Math.max(grid.colStart, col)),
	]
}

// the next point of a polygon being drawn; with isAxisLocked (Shift held), on the horizontal or
// vertical line through the last point, whichever is nearer to the pointer
function drawPointAtPointer(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number, isAxisLocked: boolean): GridPoint {
	const point = gridPointAtPointer(store, pointerGridRow, pointerGridCol)
	const pointList = store.editState.polygonDraw.pointList
	const pointLast = pointList[pointList.length - 1]
	if (!isAxisLocked || !pointLast) return point
	const isHorizontal = Math.abs(point[1] - pointLast[1]) >= Math.abs(point[0] - pointLast[0])
	return isHorizontal ? [pointLast[0], point[1]] : [point[0], pointLast[1]]
}

// the cell under the pointer, inside the grid
function cellAtPointer(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number): GridPoint {
	const grid = store.data.grid
	return [
		Math.min(grid.rowEnd, Math.max(grid.rowStart, Math.floor(pointerGridRow))),
		Math.min(grid.colEnd, Math.max(grid.colStart, Math.floor(pointerGridCol))),
	]
}
