import type { PrefectureSelectorStore, RectEdge } from './storePrefectureSelector'
import { type GridRectRange, type TileGridMapComponent } from './PrefectureSelectorConfig'
import { isRectRange, normalizeRect } from './storePrefectureSelectorSelection'

export function beginRectEdgeDrag(store: PrefectureSelectorStore, componentId: string, edge: RectEdge, gridLine: number) {
	const component = store.componentById.get(componentId)
	if (!component || component.type !== 'rect' || !isRectRange(component.range)) return

	store.editState.selectedComponentId = componentId
	store.editState.selectionMode = 'single'
	store.clearEditMultiSelection()
	store.editState.drag.isDragging = true
	store.editState.drag.dragType = 'resize'
	store.editState.drag.resize.componentId = componentId
	store.editState.drag.resize.edge = edge
	store.editState.drag.resize.gridLine = gridLine
	store.editState.drag.resize.isDropValid = isGridLineValidForEdge(store, component, edge, gridLine)
}

export function updateRectEdgeDrag(store: PrefectureSelectorStore, gridLine: number) {
	const { componentId, edge } = store.editState.drag.resize
	if (!store.editState.drag.isDragging || store.editState.drag.dragType !== 'resize' || !componentId || !edge) return

	const component = store.componentById.get(componentId)
	if (!component || component.type !== 'rect' || !isRectRange(component.range)) return

	store.editState.drag.resize.gridLine = gridLine
	store.editState.drag.resize.isDropValid = isGridLineValidForEdge(store, component, edge, gridLine)
}

export function commitRectEdgeDrag(store: PrefectureSelectorStore) {
	const { componentId, edge, gridLine, isDropValid } = store.editState.drag.resize
	if (!componentId || !edge || gridLine === null || !isDropValid) {
		clearRectEdgeDrag(store)
		return { code: -1, message: 'Invalid edge position' }
	}

	const component = store.componentById.get(componentId)
	if (!component || component.type !== 'rect' || !isRectRange(component.range)) {
		clearRectEdgeDrag(store)
		return { code: -1, message: 'Selected component is not a rectangular component' }
	}

	component.range = getRangeAfterEdgeDrop(component.range, edge, gridLine)
	store.commitGeometryChange()
	clearRectEdgeDrag(store)
	return { code: 0 }
}

export function cancelRectEdgeDrag(store: PrefectureSelectorStore) {
	clearRectEdgeDrag(store)
}

export function clearRectEdgeDrag(store: PrefectureSelectorStore) {
	if (store.editState.drag.dragType === 'resize') {
		store.editState.drag.isDragging = false
		store.editState.drag.dragType = null
	}
	store.editState.drag.resize.componentId = null
	store.editState.drag.resize.edge = null
	store.editState.drag.resize.gridLine = null
	store.editState.drag.resize.isDropValid = true
}

export function isGridLineValidForEdge(store: PrefectureSelectorStore, component: TileGridMapComponent, edge: RectEdge, gridLine: number) {
	if (component.type !== 'rect' || !isRectRange(component.range)) return false
	const range = normalizeRect(component.range)
	if ((edge === 'left' || edge === 'right') && (gridLine < store.data.metadata.colStart || gridLine > store.data.metadata.colEnd + 1)) return false
	if ((edge === 'top' || edge === 'bottom') && (gridLine < store.data.metadata.rowStart || gridLine > store.data.metadata.rowEnd + 1)) return false

	if (edge === 'left') return gridLine !== range.colEnd + 1
	if (edge === 'right') return gridLine !== range.colStart
	if (edge === 'top') return gridLine !== range.rowEnd + 1
	return gridLine !== range.rowStart
}

export function getRangeAfterEdgeDrop(range: GridRectRange, edge: RectEdge, gridLine: number): GridRectRange {
	const normalizedRange = normalizeRect(range)

	if (edge === 'left' || edge === 'right') {
		const otherLine = edge === 'left' ? normalizedRange.colEnd + 1 : normalizedRange.colStart
		const colLineStart = Math.min(gridLine, otherLine)
		const colLineEnd = Math.max(gridLine, otherLine)
		return { ...normalizedRange, colStart: colLineStart, colEnd: colLineEnd - 1 }
	}

	const otherLine = edge === 'top' ? normalizedRange.rowEnd + 1 : normalizedRange.rowStart
	const rowLineStart = Math.min(gridLine, otherLine)
	const rowLineEnd = Math.max(gridLine, otherLine)
	return { ...normalizedRange, rowStart: rowLineStart, rowEnd: rowLineEnd - 1 }
}
