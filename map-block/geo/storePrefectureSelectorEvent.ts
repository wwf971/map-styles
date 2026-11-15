import type {
	PrefectureSelectorEventData,
	PrefectureSelectorEventType,
	PrefectureSelectorStore,
	SelectionOperation,
} from './storePrefectureSelector'

export function handlePrefectureSelectorEvent(
	store: PrefectureSelectorStore,
	eventType: PrefectureSelectorEventType,
	eventData: PrefectureSelectorEventData,
) {
	if (eventType === 'refreshMapObjData') {
		store.updateMapObjData()
		return { code: 0 }
	}

	if (eventType === 'setMapObjDataFormat') {
		const format = eventData.format
		if (format !== 'tight' && format !== 'pretty') return { code: -1, message: 'Invalid JSON format' }
		store.setMapObjDataFormat(format)
		return { code: 0 }
	}

	if (eventType === 'setMode') {
		const mode = eventData.mode
		if (mode !== 'select' && mode !== 'display' && mode !== 'edit') return { code: -1, message: 'Invalid mode' }
		store.setMode(mode)
		return { code: 0 }
	}

	if (eventType === 'updateGridDisplayRange') {
		const key = eventData.key
		const delta = eventData.delta
		if (key !== 'rowStart' && key !== 'rowEnd' && key !== 'colStart' && key !== 'colEnd') return { code: -1, message: 'Invalid grid display range key' }
		if (typeof delta !== 'number' || !Number.isFinite(delta)) return { code: -1, message: 'delta is required' }
		store.updateGridDisplayRange(key, delta)
		return { code: 0 }
	}

	if (eventType === 'increaseGridDensity') {
		store.increaseGridDensity()
		return { code: 0 }
	}

	if (eventType === 'decreaseGridDensity') {
		store.decreaseGridDensity()
		return { code: 0 }
	}

	if (eventType === 'clearSelection') {
		store.clearSelection()
		return { code: 0 }
	}

	if (eventType === 'cancelSelectRectDrag') {
		store.cancelSelectRectDrag()
		return { code: 0 }
	}

	if (eventType === 'commitSelectRectDrag') return store.commitSelectRectDrag()

	if (eventType === 'cancelSelectMoveDrag') {
		store.cancelSelectMoveDrag()
		return { code: 0 }
	}

	if (eventType === 'commitSelectMoveDrag') return store.commitSelectMoveDrag()

	if (eventType === 'clearEditSelection') {
		store.clearEditSelection()
		return { code: 0 }
	}

	if (eventType === 'cancelRectEdgeDrag') {
		store.cancelRectEdgeDrag()
		return { code: 0 }
	}

	if (eventType === 'commitRectEdgeDrag') return store.commitRectEdgeDrag()

	if (eventType === 'cancelMoveDrag') {
		store.cancelMoveDrag()
		return { code: 0 }
	}

	if (eventType === 'commitMoveDrag') return store.commitMoveDrag()

	if (eventType === 'cancelEditMultiSelectRectDrag') {
		store.cancelEditMultiSelectRectDrag()
		return { code: 0 }
	}

	if (eventType === 'commitEditMultiSelectRectDrag') return store.commitEditMultiSelectRectDrag()

	if (eventType === 'cancelEditMultiMoveDrag') {
		store.cancelEditMultiMoveDrag()
		return { code: 0 }
	}

	if (eventType === 'commitEditMultiMoveDrag') return store.commitEditMultiMoveDrag()

	const componentId = typeof eventData.componentId === 'string' ? eventData.componentId : null
	const opRaw = eventData.operation
	const operation: SelectionOperation = opRaw === 'add' || opRaw === 'toggle' ? opRaw : 'replace'
	if ((eventType === 'toggleBlockSelection' || eventType === 'toggleGroupSelection' || eventType === 'selectEditComponent' || eventType === 'beginRectEdgeDrag' || eventType === 'beginMoveDrag' || eventType === 'beginEditMultiMoveDrag' || eventType === 'beginSelectMoveDrag') && !componentId) {
		return { code: -1, message: 'componentId is required' }
	}

	if (eventType === 'toggleBlockSelection' && componentId) {
		if (operation === 'replace') store.toggleBlockSelection(componentId)
		else store.applySelectComponentOperation(componentId, operation, true)
		return { code: 0 }
	}

	if (eventType === 'toggleGroupSelection' && componentId) {
		if (operation === 'replace') store.toggleGroupSelection(componentId)
		else if (operation === 'toggle') store.applySelectGroupToggleOperation(componentId)
		else store.addSelectGroupBlocks(componentId)
		return { code: 0 }
	}

	if (eventType === 'selectEditComponent' && componentId) {
		store.selectEditComponentWithOperation(componentId, operation)
		return { code: 0 }
	}

	if (eventType === 'beginRectEdgeDrag' && componentId) {
		const edge = eventData.edge
		const gridLine = eventData.gridLine
		if (edge !== 'left' && edge !== 'right' && edge !== 'top' && edge !== 'bottom') return { code: -1, message: 'Invalid edge' }
		if (typeof gridLine !== 'number') return { code: -1, message: 'gridLine is required' }
		store.beginRectEdgeDrag(componentId, edge, gridLine)
		return { code: 0 }
	}

	if (eventType === 'updateRectEdgeDrag') {
		const gridLine = eventData.gridLine
		if (typeof gridLine !== 'number') return { code: -1, message: 'gridLine is required' }
		store.updateRectEdgeDrag(gridLine)
		return { code: 0 }
	}

	if (eventType === 'beginEditMultiSelectRectDrag') {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.beginEditMultiSelectRectDrag(pointerGridRow, pointerGridCol, operation)
		return { code: 0 }
	}

	if (eventType === 'beginSelectRectDrag') {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.beginSelectRectDrag(pointerGridRow, pointerGridCol, operation)
		return { code: 0 }
	}

	if (eventType === 'updateEditMultiSelectRectDrag') {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.updateEditMultiSelectRectDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateSelectRectDrag') {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.updateSelectRectDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'beginSelectMoveDrag' && componentId) {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.beginSelectMoveDrag(componentId, pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateSelectMoveDrag') {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.updateSelectMoveDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'beginMoveDrag' && componentId) {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.beginMoveDrag(componentId, pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateMoveDrag') {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.updateMoveDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'beginEditMultiMoveDrag' && componentId) {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.beginEditMultiMoveDrag(componentId, pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateEditMultiMoveDrag') {
		const pointerGridRow = eventData.pointerGridRow
		const pointerGridCol = eventData.pointerGridCol
		if (typeof pointerGridRow !== 'number' || typeof pointerGridCol !== 'number') return { code: -1, message: 'pointer grid position is required' }
		store.updateEditMultiMoveDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	return { code: -1, message: `Unknown event: ${eventType}` }
}
