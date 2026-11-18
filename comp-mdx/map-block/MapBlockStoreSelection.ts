import type {
	EditMultiSelectIncludeMode,
	MapBlockStore,
	SelectionOperation,
} from './MapBlockStore'
import {
	shapeCellRectGet,
	shapeIsPolygon,
	type GridBoxRange,
	type GridRectRange,
	type MapBlockComp,
} from './MapBlockData'
import { polygonBoxOverlapArea, polygonLineBoxGet } from './MapBlockGeom'

// Range selection (doc/map-block-select.md#range-selection): a box dragged over the grid,
// in the mode select and in the edit mode. Dragging downward selects what the box touches,
// dragging upward what it holds whole.

const normalizeBox = (rowA: number, colA: number, rowB: number, colB: number): GridBoxRange => ({
	rowStart: Math.min(rowA, rowB),
	rowEnd: Math.max(rowA, rowB),
	colStart: Math.min(colA, colB),
	colEnd: Math.max(colA, colB),
})

const doesBoxIntersectRect = (box: GridBoxRange, rect: GridRectRange) => (
	box.rowStart < rect.rowEnd + 1
	&& box.rowEnd > rect.rowStart
	&& box.colStart < rect.colEnd + 1
	&& box.colEnd > rect.colStart
)

const doesBoxContainRect = (box: GridBoxRange, rect: GridRectRange) => (
	box.rowStart <= rect.rowStart
	&& box.rowEnd >= rect.rowEnd + 1
	&& box.colStart <= rect.colStart
	&& box.colEnd >= rect.colEnd + 1
)

export function beginSelectRectDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number, operation: SelectionOperation = 'replace') {
	const rectDrag = store.selectState.rectDrag
	rectDrag.isDragging = true
	rectDrag.pointerStartRow = pointerGridRow
	rectDrag.pointerStartCol = pointerGridCol
	rectDrag.pointerCurrentRow = pointerGridRow
	rectDrag.pointerCurrentCol = pointerGridCol
	rectDrag.candidateBox = normalizeBox(pointerGridRow, pointerGridCol, pointerGridRow, pointerGridCol)
	rectDrag.includeMode = 'partial'
	rectDrag.operation = operation
}

export function updateSelectRectDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const rectDrag = store.selectState.rectDrag
	if (!rectDrag.isDragging || rectDrag.pointerStartRow === null || rectDrag.pointerStartCol === null) return

	rectDrag.pointerCurrentRow = pointerGridRow
	rectDrag.pointerCurrentCol = pointerGridCol
	rectDrag.candidateBox = normalizeBox(rectDrag.pointerStartRow, rectDrag.pointerStartCol, pointerGridRow, pointerGridCol)
	rectDrag.includeMode = pointerGridRow >= rectDrag.pointerStartRow ? 'partial' : 'full'
}

export function commitSelectRectDrag(store: MapBlockStore) {
	const rectDrag = store.selectState.rectDrag
	if (!rectDrag.candidateBox || !rectDrag.includeMode) {
		clearSelectRectDrag(store)
		return { code: -1, message: 'Invalid selection rectangle' }
	}

	const selectedBlockIds = store.getSelectionCandidateBlockComponents(rectDrag.candidateBox!)
		.filter((component) => isComponentIncludedInSelectionBox(store, component, rectDrag.candidateBox!, rectDrag.includeMode!))
		.map((component) => component.id)
	const mergedBlockIds = store.mergeSelectionIds(store.selectedBlockIdsFinal, selectedBlockIds, rectDrag.operation)

	clearSelectRectDrag(store)
	store.setSelectionByBlockIds(mergedBlockIds, true)
	return { code: 0 }
}

export function cancelSelectRectDrag(store: MapBlockStore) {
	clearSelectRectDrag(store)
}

export function clearSelectRectDrag(store: MapBlockStore) {
	const rectDrag = store.selectState.rectDrag
	rectDrag.isDragging = false
	rectDrag.pointerStartRow = null
	rectDrag.pointerStartCol = null
	rectDrag.pointerCurrentRow = null
	rectDrag.pointerCurrentCol = null
	rectDrag.candidateBox = null
	rectDrag.includeMode = null
	rectDrag.operation = 'replace'
}

export function beginEditMultiSelectRectDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number, operation: SelectionOperation = 'replace') {
	const existingSelectionIds = store.getEditSelectionIds()
	store.editState.selectionMode = 'multi'
	store.editState.selectedComponentId = null
	store.clearEditMultiSelection()
	if (operation !== 'replace') {
		existingSelectionIds.forEach((componentId) => store.editMultiSelectionState.selectedComponentIds.add(componentId))
	}
	store.clearMoveDrag()
	store.clearRectEdgeDrag()

	const rectDrag = store.editMultiSelectionState.rectDrag
	rectDrag.isDragging = true
	rectDrag.pointerStartRow = pointerGridRow
	rectDrag.pointerStartCol = pointerGridCol
	rectDrag.pointerCurrentRow = pointerGridRow
	rectDrag.pointerCurrentCol = pointerGridCol
	rectDrag.candidateBox = normalizeBox(pointerGridRow, pointerGridCol, pointerGridRow, pointerGridCol)
	rectDrag.includeMode = 'partial'
	rectDrag.operation = operation
}

export function updateEditMultiSelectRectDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const rectDrag = store.editMultiSelectionState.rectDrag
	if (!rectDrag.isDragging || rectDrag.pointerStartRow === null || rectDrag.pointerStartCol === null) return

	rectDrag.pointerCurrentRow = pointerGridRow
	rectDrag.pointerCurrentCol = pointerGridCol
	rectDrag.candidateBox = normalizeBox(rectDrag.pointerStartRow, rectDrag.pointerStartCol, pointerGridRow, pointerGridCol)
	rectDrag.includeMode = pointerGridRow >= rectDrag.pointerStartRow ? 'partial' : 'full'
}

export function commitEditMultiSelectRectDrag(store: MapBlockStore) {
	const rectDrag = store.editMultiSelectionState.rectDrag
	if (!rectDrag.candidateBox || !rectDrag.includeMode) {
		clearEditMultiSelectRectDrag(store)
		return { code: -1, message: 'Invalid selection rectangle' }
	}

	const selectedIds = store.getSelectionCandidateBlockComponents(rectDrag.candidateBox!)
		.filter((component) => isComponentIncludedInEditSelectionBox(store, component, rectDrag.candidateBox!, rectDrag.includeMode!))
		.map((component) => component.id)
	const mergedIds = Array.from(store.mergeSelectionIds(store.getEditSelectionIds(), selectedIds, rectDrag.operation))
		.filter((componentId) => store.componentById.get(componentId)?.kind === 'block')

	clearEditMultiSelectRectDrag(store)
	store.setEditSelectionByComponentIds(mergedIds)
	return { code: 0 }
}

export function cancelEditMultiSelectRectDrag(store: MapBlockStore) {
	clearEditMultiSelectRectDrag(store)
}

export function clearEditMultiSelectRectDrag(store: MapBlockStore) {
	const rectDrag = store.editMultiSelectionState.rectDrag
	rectDrag.isDragging = false
	rectDrag.pointerStartRow = null
	rectDrag.pointerStartCol = null
	rectDrag.pointerCurrentRow = null
	rectDrag.pointerCurrentCol = null
	rectDrag.candidateBox = null
	rectDrag.includeMode = null
	rectDrag.operation = 'replace'
}

// whether a component is in a box: touched by it (partial) or held whole (full). a rectangle by
// its cells; a polygon by its own outline, so that a box over the empty corner of an L shape
// does not touch it
export function isComponentIncludedInSelectionBox(_store: MapBlockStore, component: MapBlockComp, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
	if (shapeIsPolygon(component.shape)) {
		const lineBox = polygonLineBoxGet(component.shape.pointList)
		if (!lineBox) return false
		if (includeMode === 'full') {
			return box.rowStart <= lineBox.rowStart && box.rowEnd >= lineBox.rowEnd
				&& box.colStart <= lineBox.colStart && box.colEnd >= lineBox.colEnd
		}
		return polygonBoxOverlapArea(component.shape.pointList, box) > 1e-9
	}
	const rect = shapeCellRectGet(component.shape)
	if (!rect) return false
	if (includeMode === 'full') return doesBoxContainRect(box, rect)
	return doesBoxIntersectRect(box, rect)
}

export function isComponentIncludedInEditSelectionBox(store: MapBlockStore, component: MapBlockComp, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
	return isComponentIncludedInSelectionBox(store, component, box, includeMode)
}
