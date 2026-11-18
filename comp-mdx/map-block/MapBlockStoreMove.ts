import type { MapBlockStore } from './MapBlockStore'
import {
	shapeCellRectGet,
	shapeClone,
	shapeShift,
	type GridRectRange,
	type MapBlockComp,
} from './MapBlockData'

// Moving shapes on the grid (doc/map-block-edit.md#moving): one component in the edit mode,
// several selected ones together, and the selected blocks of the mode select. A shape moves by
// whole cells; what is kept inside the grid is its bounding box, a rectangle itself, the cells
// a polygon covers at most for a polygon.

const getBoundingRect = (components: readonly MapBlockComp[]): GridRectRange | null => {
	const rects = components.map((component) => shapeCellRectGet(component.shape)).filter((rect): rect is GridRectRange => rect !== null)
	if (!rects.length) return null
	return {
		rowStart: Math.min(...rects.map((rect) => rect.rowStart)),
		rowEnd: Math.max(...rects.map((rect) => rect.rowEnd)),
		colStart: Math.min(...rects.map((rect) => rect.colStart)),
		colEnd: Math.max(...rects.map((rect) => rect.colEnd)),
	}
}

// where a box of the given size starts when the pointer holding it at an offset is at a point,
// kept inside the grid
const getCandidateStart = (store: MapBlockStore, range: GridRectRange, pointerGridRow: number, pointerGridCol: number, pointerOffsetRow: number, pointerOffsetCol: number) => {
	const height = range.rowEnd - range.rowStart + 1
	const width = range.colEnd - range.colStart + 1
	const rowMin = store.data.grid.rowStart
	const colMin = store.data.grid.colStart
	const rowMax = store.data.grid.rowEnd - height + 1
	const colMax = store.data.grid.colEnd - width + 1
	const rowStart = Math.min(rowMax, Math.max(rowMin, Math.round(pointerGridRow - pointerOffsetRow)))
	const colStart = Math.min(colMax, Math.max(colMin, Math.round(pointerGridCol - pointerOffsetCol)))
	return {
		rowStart,
		rowEnd: rowStart + height - 1,
		colStart,
		colEnd: colStart + width - 1,
	}
}

export function beginPropEditorDrag(store: MapBlockStore, x: number, y: number) {
	const editorState = store.editPropEditorState
	editorState.drag = { isDragging: true, xStart: x, yStart: y, xOrigin: editorState.pos.x, yOrigin: editorState.pos.y }
}

export function movePropEditorDrag(store: MapBlockStore, x: number, y: number) {
	const drag = store.editPropEditorState.drag
	if (!drag.isDragging) return
	store.editPropEditorState.pos = { x: drag.xOrigin + x - drag.xStart, y: drag.yOrigin + y - drag.yStart }
}

export function endPropEditorDrag(store: MapBlockStore) {
	store.editPropEditorState.drag.isDragging = false
}

export function beginEditMultiMoveDrag(store: MapBlockStore, componentId: string, pointerGridRow: number, pointerGridCol: number) {
	const selectedComponentIds = store.editMultiSelectionState.selectedComponentIds
	if (store.editState.selectionMode !== 'multi' || selectedComponentIds.size <= 1 || !selectedComponentIds.has(componentId)) return

	const selectedComponents = store.selectedEditMultiComponents
	const originalBoundingRange = getBoundingRect(selectedComponents)
	if (!originalBoundingRange) return

	store.clearMoveDrag()
	store.clearRectEdgeDrag()
	const move = store.editMultiSelectionState.move
	move.isDragging = true
	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.pointerOffsetRow = pointerGridRow - originalBoundingRange.rowStart
	move.pointerOffsetCol = pointerGridCol - originalBoundingRange.colStart
	move.originalShapes.clear()
	selectedComponents.forEach((component) => move.originalShapes.set(component.id, shapeClone(component.shape)))
	move.originalBoundingRange = { ...originalBoundingRange }
	move.candidateBoundingRange = { ...originalBoundingRange }
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
	updateEditMultiMoveDrag(store, pointerGridRow, pointerGridCol)
}

export function beginSelectMoveDrag(store: MapBlockStore, componentId: string, pointerGridRow: number, pointerGridCol: number) {
	const componentStarted = store.componentById.get(componentId)
	const selectedBlockIds = store.selectedBlockIdsFinal
	const isStartedFromSelectedComponent = componentStarted?.kind === 'block'
		? selectedBlockIds.has(componentId)
		: componentStarted?.kind === 'group' && store.selectState.selectedGroupIds.has(componentId)
	if (!isStartedFromSelectedComponent) return

	const selectedComponents = store.blockComponents.filter((component) => selectedBlockIds.has(component.id))
	const originalBoundingRange = getBoundingRect(selectedComponents)
	if (!originalBoundingRange) return

	store.clearSelectRectDrag()
	const move = store.selectState.move
	move.isDragging = true
	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.pointerOffsetRow = pointerGridRow - originalBoundingRange.rowStart
	move.pointerOffsetCol = pointerGridCol - originalBoundingRange.colStart
	move.originalShapes.clear()
	selectedComponents.forEach((component) => move.originalShapes.set(component.id, shapeClone(component.shape)))
	move.originalBoundingRange = { ...originalBoundingRange }
	move.candidateBoundingRange = { ...originalBoundingRange }
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
	updateSelectMoveDrag(store, pointerGridRow, pointerGridCol)
}

export function updateSelectMoveDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const move = store.selectState.move
	if (!move.isDragging || !move.originalBoundingRange) return
	if (move.pointerOffsetRow === null || move.pointerOffsetCol === null) return

	const candidate = getCandidateStart(store, move.originalBoundingRange, pointerGridRow, pointerGridCol, move.pointerOffsetRow, move.pointerOffsetCol)
	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.rowDelta = candidate.rowStart - move.originalBoundingRange.rowStart
	move.colDelta = candidate.colStart - move.originalBoundingRange.colStart
	move.candidateBoundingRange = candidate
	move.isDropValid = true
}

export function commitSelectMoveDrag(store: MapBlockStore) {
	const move = store.selectState.move
	if (!move.isDragging || !move.isDropValid || !move.candidateBoundingRange) {
		clearSelectMoveDrag(store)
		return { code: -1, message: 'Invalid selected-block move position' }
	}

	store.dataChange(() => {
		for (const [componentId, originalShape] of move.originalShapes) {
			const component = store.componentById.get(componentId)
			if (!component) continue
			component.shape = shapeShift(originalShape, move.rowDelta, move.colDelta)
		}
	})
	clearSelectMoveDrag(store)
	return { code: 0 }
}

export function cancelSelectMoveDrag(store: MapBlockStore) {
	clearSelectMoveDrag(store)
}

export function clearSelectMoveDrag(store: MapBlockStore) {
	const move = store.selectState.move
	move.isDragging = false
	move.pointerGridRow = null
	move.pointerGridCol = null
	move.pointerOffsetRow = null
	move.pointerOffsetCol = null
	move.originalShapes.clear()
	move.originalBoundingRange = null
	move.candidateBoundingRange = null
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
}

export function updateEditMultiMoveDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const move = store.editMultiSelectionState.move
	if (!move.isDragging || !move.originalBoundingRange) return
	if (move.pointerOffsetRow === null || move.pointerOffsetCol === null) return

	const candidate = getCandidateStart(store, move.originalBoundingRange, pointerGridRow, pointerGridCol, move.pointerOffsetRow, move.pointerOffsetCol)
	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.rowDelta = candidate.rowStart - move.originalBoundingRange.rowStart
	move.colDelta = candidate.colStart - move.originalBoundingRange.colStart
	move.candidateBoundingRange = candidate
	move.isDropValid = true
}

export function commitEditMultiMoveDrag(store: MapBlockStore) {
	const move = store.editMultiSelectionState.move
	if (!move.isDragging || !move.isDropValid || !move.candidateBoundingRange) {
		clearEditMultiMoveDrag(store)
		return { code: -1, message: 'Invalid multi move position' }
	}

	store.dataChange(() => {
		for (const [componentId, originalShape] of move.originalShapes) {
			const component = store.componentById.get(componentId)
			if (!component) continue
			component.shape = shapeShift(originalShape, move.rowDelta, move.colDelta)
		}
	})
	clearEditMultiMoveDrag(store)
	return { code: 0 }
}

export function cancelEditMultiMoveDrag(store: MapBlockStore) {
	clearEditMultiMoveDrag(store)
}

export function clearEditMultiMoveDrag(store: MapBlockStore) {
	const move = store.editMultiSelectionState.move
	move.isDragging = false
	move.pointerGridRow = null
	move.pointerGridCol = null
	move.pointerOffsetRow = null
	move.pointerOffsetCol = null
	move.originalShapes.clear()
	move.originalBoundingRange = null
	move.candidateBoundingRange = null
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
}

export function beginMoveDrag(store: MapBlockStore, componentId: string, pointerGridRow: number, pointerGridCol: number) {
	const component = store.componentById.get(componentId)
	const range = component ? shapeCellRectGet(component.shape) : null
	if (!component || !range) return

	store.editState.selectedComponentId = componentId
	store.editState.selectionMode = 'single'
	store.clearEditMultiSelection()
	store.editState.drag.isDragging = true
	store.editState.drag.dragType = 'move'
	store.editState.drag.move.componentId = componentId
	store.editState.drag.move.pointerOffsetRow = pointerGridRow - range.rowStart
	store.editState.drag.move.pointerOffsetCol = pointerGridCol - range.colStart
	store.editState.drag.move.originalShape = shapeClone(component.shape)
	store.editState.drag.move.originalRange = { ...range }
	updateMoveDrag(store, pointerGridRow, pointerGridCol)
}

export function updateMoveDrag(store: MapBlockStore, pointerGridRow: number, pointerGridCol: number) {
	const move = store.editState.drag.move
	if (!store.editState.drag.isDragging || store.editState.drag.dragType !== 'move' || !move.originalRange) return
	if (move.pointerOffsetRow === null || move.pointerOffsetCol === null) return

	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.candidateRange = getCandidateStart(store, move.originalRange, pointerGridRow, pointerGridCol, move.pointerOffsetRow, move.pointerOffsetCol)
	move.isDropValid = true
}

export function commitMoveDrag(store: MapBlockStore) {
	const { componentId, candidateRange, originalRange, originalShape, isDropValid } = store.editState.drag.move
	if (!componentId || !candidateRange || !originalRange || !originalShape || !isDropValid) {
		clearMoveDrag(store)
		return { code: -1, message: 'Invalid move position' }
	}

	const component = store.componentById.get(componentId)
	if (!component) {
		clearMoveDrag(store)
		return { code: -1, message: 'The moved component is gone' }
	}

	store.dataChange(() => {
		component.shape = shapeShift(originalShape, candidateRange.rowStart - originalRange.rowStart, candidateRange.colStart - originalRange.colStart)
	})
	clearMoveDrag(store)
	return { code: 0 }
}

export function cancelMoveDrag(store: MapBlockStore) {
	clearMoveDrag(store)
}

export function clearMoveDrag(store: MapBlockStore) {
	if (store.editState.drag.dragType === 'move') {
		store.editState.drag.isDragging = false
		store.editState.drag.dragType = null
	}
	store.editState.drag.move.componentId = null
	store.editState.drag.move.pointerGridRow = null
	store.editState.drag.move.pointerGridCol = null
	store.editState.drag.move.pointerOffsetRow = null
	store.editState.drag.move.pointerOffsetCol = null
	store.editState.drag.move.originalShape = null
	store.editState.drag.move.originalRange = null
	store.editState.drag.move.candidateRange = null
	store.editState.drag.move.isDropValid = true
}
