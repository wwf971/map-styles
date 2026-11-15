import type { PrefectureSelectorStore } from './storePrefectureSelector'
import {
	type GridCell,
	type GridRectRange,
	type TileGridMapComponent,
} from './PrefectureSelectorConfig'
import { isRectRange, normalizeRect } from './storePrefectureSelectorSelection'

const cloneRange = (range: GridRectRange | readonly GridCell[]) => (
	isRectRange(range) ? { ...range } : range.map((cell) => ({ ...cell }))
)

const getComponentRect = (component: TileGridMapComponent): GridRectRange | null => {
	if (component.type === 'rect' && isRectRange(component.range)) return normalizeRect(component.range)

	const cells = component.range as readonly GridCell[]
	if (!cells.length) return null
	const rows = cells.map((cell) => cell.row)
	const cols = cells.map((cell) => cell.col)
	return {
		rowStart: Math.min(...rows),
		rowEnd: Math.max(...rows),
		colStart: Math.min(...cols),
		colEnd: Math.max(...cols),
	}
}

const getBoundingRect = (components: readonly TileGridMapComponent[]): GridRectRange | null => {
	const rects = components.map((component) => getComponentRect(component)).filter((rect): rect is GridRectRange => rect !== null)
	if (!rects.length) return null
	return {
		rowStart: Math.min(...rects.map((rect) => rect.rowStart)),
		rowEnd: Math.max(...rects.map((rect) => rect.rowEnd)),
		colStart: Math.min(...rects.map((rect) => rect.colStart)),
		colEnd: Math.max(...rects.map((rect) => rect.colEnd)),
	}
}

const shiftRange = (range: GridRectRange | readonly GridCell[], rowDelta: number, colDelta: number) => {
	if (isRectRange(range)) {
		return {
			rowStart: range.rowStart + rowDelta,
			rowEnd: range.rowEnd + rowDelta,
			colStart: range.colStart + colDelta,
			colEnd: range.colEnd + colDelta,
		}
	}

	return range.map((cell) => ({ row: cell.row + rowDelta, col: cell.col + colDelta }))
}

export function beginPropEditorDrag(store: PrefectureSelectorStore, x: number, y: number) {
	const editorState = store.editPropEditorState
	editorState.drag = { isDragging: true, xStart: x, yStart: y, xOrigin: editorState.pos.x, yOrigin: editorState.pos.y }
}

export function movePropEditorDrag(store: PrefectureSelectorStore, x: number, y: number) {
	const drag = store.editPropEditorState.drag
	if (!drag.isDragging) return
	store.editPropEditorState.pos = { x: drag.xOrigin + x - drag.xStart, y: drag.yOrigin + y - drag.yStart }
}

export function endPropEditorDrag(store: PrefectureSelectorStore) {
	store.editPropEditorState.drag.isDragging = false
}

export function beginEditMultiMoveDrag(store: PrefectureSelectorStore, componentId: string, pointerGridRow: number, pointerGridCol: number) {
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
	move.originalRanges.clear()
	selectedComponents.forEach((component) => move.originalRanges.set(component.id, cloneRange(component.range)))
	move.originalBoundingRange = { ...originalBoundingRange }
	move.candidateBoundingRange = { ...originalBoundingRange }
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
	updateEditMultiMoveDrag(store, pointerGridRow, pointerGridCol)
}

export function beginSelectMoveDrag(store: PrefectureSelectorStore, componentId: string, pointerGridRow: number, pointerGridCol: number) {
	const componentStarted = store.componentById.get(componentId)
	const selectedBlockIds = store.selectedBlockIdsFinal
	const isStartedFromSelectedComponent = componentStarted?.compType === 'block'
		? selectedBlockIds.has(componentId)
		: componentStarted?.compType === 'group' && store.selectState.selectedGroupIds.has(componentId)
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
	move.originalRanges.clear()
	selectedComponents.forEach((component) => move.originalRanges.set(component.id, cloneRange(component.range)))
	move.originalBoundingRange = { ...originalBoundingRange }
	move.candidateBoundingRange = { ...originalBoundingRange }
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
	updateSelectMoveDrag(store, pointerGridRow, pointerGridCol)
}

export function updateSelectMoveDrag(store: PrefectureSelectorStore, pointerGridRow: number, pointerGridCol: number) {
	const move = store.selectState.move
	if (!move.isDragging || !move.originalBoundingRange) return
	if (move.pointerOffsetRow === null || move.pointerOffsetCol === null) return

	const height = move.originalBoundingRange.rowEnd - move.originalBoundingRange.rowStart + 1
	const width = move.originalBoundingRange.colEnd - move.originalBoundingRange.colStart + 1
	const rowMin = store.data.metadata.rowStart
	const colMin = store.data.metadata.colStart
	const rowMax = store.data.metadata.rowEnd - height + 1
	const colMax = store.data.metadata.colEnd - width + 1
	const rowStart = Math.min(rowMax, Math.max(rowMin, Math.round(pointerGridRow - move.pointerOffsetRow)))
	const colStart = Math.min(colMax, Math.max(colMin, Math.round(pointerGridCol - move.pointerOffsetCol)))

	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.rowDelta = rowStart - move.originalBoundingRange.rowStart
	move.colDelta = colStart - move.originalBoundingRange.colStart
	move.candidateBoundingRange = {
		rowStart,
		rowEnd: rowStart + height - 1,
		colStart,
		colEnd: colStart + width - 1,
	}
	move.isDropValid = true
}

export function commitSelectMoveDrag(store: PrefectureSelectorStore) {
	const move = store.selectState.move
	if (!move.isDragging || !move.isDropValid || !move.candidateBoundingRange) {
		clearSelectMoveDrag(store)
		return { code: -1, message: 'Invalid selected-block move position' }
	}

	for (const [componentId, originalRange] of move.originalRanges) {
		const component = store.componentById.get(componentId)
		if (!component) continue
		component.range = shiftRange(originalRange, move.rowDelta, move.colDelta)
	}

	store.commitGeometryChange()
	clearSelectMoveDrag(store)
	return { code: 0 }
}

export function cancelSelectMoveDrag(store: PrefectureSelectorStore) {
	clearSelectMoveDrag(store)
}

export function clearSelectMoveDrag(store: PrefectureSelectorStore) {
	const move = store.selectState.move
	move.isDragging = false
	move.pointerGridRow = null
	move.pointerGridCol = null
	move.pointerOffsetRow = null
	move.pointerOffsetCol = null
	move.originalRanges.clear()
	move.originalBoundingRange = null
	move.candidateBoundingRange = null
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
}

export function updateEditMultiMoveDrag(store: PrefectureSelectorStore, pointerGridRow: number, pointerGridCol: number) {
	const move = store.editMultiSelectionState.move
	if (!move.isDragging || !move.originalBoundingRange) return
	if (move.pointerOffsetRow === null || move.pointerOffsetCol === null) return

	const height = move.originalBoundingRange.rowEnd - move.originalBoundingRange.rowStart + 1
	const width = move.originalBoundingRange.colEnd - move.originalBoundingRange.colStart + 1
	const rowMin = store.data.metadata.rowStart
	const colMin = store.data.metadata.colStart
	const rowMax = store.data.metadata.rowEnd - height + 1
	const colMax = store.data.metadata.colEnd - width + 1
	const rowStart = Math.min(rowMax, Math.max(rowMin, Math.round(pointerGridRow - move.pointerOffsetRow)))
	const colStart = Math.min(colMax, Math.max(colMin, Math.round(pointerGridCol - move.pointerOffsetCol)))

	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.rowDelta = rowStart - move.originalBoundingRange.rowStart
	move.colDelta = colStart - move.originalBoundingRange.colStart
	move.candidateBoundingRange = {
		rowStart,
		rowEnd: rowStart + height - 1,
		colStart,
		colEnd: colStart + width - 1,
	}
	move.isDropValid = true
}

export function commitEditMultiMoveDrag(store: PrefectureSelectorStore) {
	const move = store.editMultiSelectionState.move
	if (!move.isDragging || !move.isDropValid || !move.candidateBoundingRange) {
		clearEditMultiMoveDrag(store)
		return { code: -1, message: 'Invalid multi move position' }
	}

	for (const [componentId, originalRange] of move.originalRanges) {
		const component = store.componentById.get(componentId)
		if (!component) continue
		component.range = shiftRange(originalRange, move.rowDelta, move.colDelta)
	}

	store.commitGeometryChange()
	clearEditMultiMoveDrag(store)
	return { code: 0 }
}

export function cancelEditMultiMoveDrag(store: PrefectureSelectorStore) {
	clearEditMultiMoveDrag(store)
}

export function clearEditMultiMoveDrag(store: PrefectureSelectorStore) {
	const move = store.editMultiSelectionState.move
	move.isDragging = false
	move.pointerGridRow = null
	move.pointerGridCol = null
	move.pointerOffsetRow = null
	move.pointerOffsetCol = null
	move.originalRanges.clear()
	move.originalBoundingRange = null
	move.candidateBoundingRange = null
	move.rowDelta = 0
	move.colDelta = 0
	move.isDropValid = true
}

export function beginMoveDrag(store: PrefectureSelectorStore, componentId: string, pointerGridRow: number, pointerGridCol: number) {
	const component = store.componentById.get(componentId)
	if (!component || component.type !== 'rect' || !isRectRange(component.range)) return

	const range = normalizeRect(component.range)
	store.editState.selectedComponentId = componentId
	store.editState.selectionMode = 'single'
	store.clearEditMultiSelection()
	store.editState.drag.isDragging = true
	store.editState.drag.dragType = 'move'
	store.editState.drag.move.componentId = componentId
	store.editState.drag.move.pointerOffsetRow = pointerGridRow - range.rowStart
	store.editState.drag.move.pointerOffsetCol = pointerGridCol - range.colStart
	store.editState.drag.move.originalRange = { ...range }
	updateMoveDrag(store, pointerGridRow, pointerGridCol)
}

export function updateMoveDrag(store: PrefectureSelectorStore, pointerGridRow: number, pointerGridCol: number) {
	const move = store.editState.drag.move
	if (!store.editState.drag.isDragging || store.editState.drag.dragType !== 'move' || !move.originalRange) return
	if (move.pointerOffsetRow === null || move.pointerOffsetCol === null) return

	const height = move.originalRange.rowEnd - move.originalRange.rowStart + 1
	const width = move.originalRange.colEnd - move.originalRange.colStart + 1
	const rowMin = store.data.metadata.rowStart
	const colMin = store.data.metadata.colStart
	const rowMax = store.data.metadata.rowEnd - height + 1
	const colMax = store.data.metadata.colEnd - width + 1
	const rowStart = Math.min(rowMax, Math.max(rowMin, Math.round(pointerGridRow - move.pointerOffsetRow)))
	const colStart = Math.min(colMax, Math.max(colMin, Math.round(pointerGridCol - move.pointerOffsetCol)))

	move.pointerGridRow = pointerGridRow
	move.pointerGridCol = pointerGridCol
	move.candidateRange = {
		rowStart,
		rowEnd: rowStart + height - 1,
		colStart,
		colEnd: colStart + width - 1,
	}
	move.isDropValid = true
}

export function commitMoveDrag(store: PrefectureSelectorStore) {
	const { componentId, candidateRange, isDropValid } = store.editState.drag.move
	if (!componentId || !candidateRange || !isDropValid) {
		clearMoveDrag(store)
		return { code: -1, message: 'Invalid move position' }
	}

	const component = store.componentById.get(componentId)
	if (!component || component.type !== 'rect' || !isRectRange(component.range)) {
		clearMoveDrag(store)
		return { code: -1, message: 'Selected component is not a rectangular component' }
	}

	component.range = { ...candidateRange }
	store.commitGeometryChange()
	clearMoveDrag(store)
	return { code: 0 }
}

export function cancelMoveDrag(store: PrefectureSelectorStore) {
	clearMoveDrag(store)
}

export function clearMoveDrag(store: PrefectureSelectorStore) {
	if (store.editState.drag.dragType === 'move') {
		store.editState.drag.isDragging = false
		store.editState.drag.dragType = null
	}
	store.editState.drag.move.componentId = null
	store.editState.drag.move.pointerGridRow = null
	store.editState.drag.move.pointerGridCol = null
	store.editState.drag.move.pointerOffsetRow = null
	store.editState.drag.move.pointerOffsetCol = null
	store.editState.drag.move.originalRange = null
	store.editState.drag.move.candidateRange = null
	store.editState.drag.move.isDropValid = true
}
