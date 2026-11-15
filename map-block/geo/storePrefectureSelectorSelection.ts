import type {
	EditMultiSelectIncludeMode,
	PrefectureSelectorStore,
	SelectionOperation,
} from './storePrefectureSelector'
import {
	type GridBoxRange,
	type GridCell,
	type GridRectRange,
	type TileGridMapComponent,
} from './PrefectureSelectorConfig'

export const isRectRange = (range: GridRectRange | readonly GridCell[]): range is GridRectRange => !Array.isArray(range)

export const normalizeRect = (range: GridRectRange): GridRectRange => ({
	rowStart: Math.min(range.rowStart, range.rowEnd),
	rowEnd: Math.max(range.rowStart, range.rowEnd),
	colStart: Math.min(range.colStart, range.colEnd),
	colEnd: Math.max(range.colStart, range.colEnd),
})

const normalizeBox = (rowA: number, colA: number, rowB: number, colB: number): GridBoxRange => ({
	rowStart: Math.min(rowA, rowB),
	rowEnd: Math.max(rowA, rowB),
	colStart: Math.min(colA, colB),
	colEnd: Math.max(colA, colB),
})

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

export function beginSelectRectDrag(store: PrefectureSelectorStore, pointerGridRow: number, pointerGridCol: number, operation: SelectionOperation = 'replace') {
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

export function updateSelectRectDrag(store: PrefectureSelectorStore, pointerGridRow: number, pointerGridCol: number) {
	const rectDrag = store.selectState.rectDrag
	if (!rectDrag.isDragging || rectDrag.pointerStartRow === null || rectDrag.pointerStartCol === null) return

	rectDrag.pointerCurrentRow = pointerGridRow
	rectDrag.pointerCurrentCol = pointerGridCol
	rectDrag.candidateBox = normalizeBox(rectDrag.pointerStartRow, rectDrag.pointerStartCol, pointerGridRow, pointerGridCol)
	rectDrag.includeMode = pointerGridRow >= rectDrag.pointerStartRow ? 'partial' : 'full'
}

export function commitSelectRectDrag(store: PrefectureSelectorStore) {
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

export function cancelSelectRectDrag(store: PrefectureSelectorStore) {
	clearSelectRectDrag(store)
}

export function clearSelectRectDrag(store: PrefectureSelectorStore) {
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

export function beginEditMultiSelectRectDrag(store: PrefectureSelectorStore, pointerGridRow: number, pointerGridCol: number, operation: SelectionOperation = 'replace') {
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

export function updateEditMultiSelectRectDrag(store: PrefectureSelectorStore, pointerGridRow: number, pointerGridCol: number) {
	const rectDrag = store.editMultiSelectionState.rectDrag
	if (!rectDrag.isDragging || rectDrag.pointerStartRow === null || rectDrag.pointerStartCol === null) return

	rectDrag.pointerCurrentRow = pointerGridRow
	rectDrag.pointerCurrentCol = pointerGridCol
	rectDrag.candidateBox = normalizeBox(rectDrag.pointerStartRow, rectDrag.pointerStartCol, pointerGridRow, pointerGridCol)
	rectDrag.includeMode = pointerGridRow >= rectDrag.pointerStartRow ? 'partial' : 'full'
}

export function commitEditMultiSelectRectDrag(store: PrefectureSelectorStore) {
	const rectDrag = store.editMultiSelectionState.rectDrag
	if (!rectDrag.candidateBox || !rectDrag.includeMode) {
		clearEditMultiSelectRectDrag(store)
		return { code: -1, message: 'Invalid selection rectangle' }
	}

	const selectedIds = store.getSelectionCandidateBlockComponents(rectDrag.candidateBox!)
		.filter((component) => isComponentIncludedInEditSelectionBox(store, component, rectDrag.candidateBox!, rectDrag.includeMode!))
		.map((component) => component.id)
	const mergedIds = Array.from(store.mergeSelectionIds(store.getEditSelectionIds(), selectedIds, rectDrag.operation))
		.filter((componentId) => store.componentById.get(componentId)?.compType === 'block')

	clearEditMultiSelectRectDrag(store)
	store.setEditSelectionByComponentIds(mergedIds)
	return { code: 0 }
}

export function cancelEditMultiSelectRectDrag(store: PrefectureSelectorStore) {
	clearEditMultiSelectRectDrag(store)
}

export function clearEditMultiSelectRectDrag(store: PrefectureSelectorStore) {
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

export function isComponentIncludedInSelectionBox(_store: PrefectureSelectorStore, component: TileGridMapComponent, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
	const rect = getComponentRect(component)
	if (!rect) return false
	if (includeMode === 'full') return doesBoxContainRect(box, rect)
	return doesBoxIntersectRect(box, rect)
}

export function isComponentIncludedInEditSelectionBox(store: PrefectureSelectorStore, component: TileGridMapComponent, box: GridBoxRange, includeMode: EditMultiSelectIncludeMode) {
	return isComponentIncludedInSelectionBox(store, component, box, includeMode)
}
