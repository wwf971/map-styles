import type {
	EditTool,
	MapBlockEventData,
	MapBlockEventType,
	MapBlockStore,
	SelectionOperation,
} from './MapBlockStore'

// The events MapBlockRender and the editor send (doc/map-block.md#events): each checked and
// handed to the store, which answers { code, message? }.
export function handleMapBlockEvent(
	store: MapBlockStore,
	eventType: MapBlockEventType,
	eventData: MapBlockEventData,
) {
	const pointerGridRow = eventData.pointerGridRow as number
	const pointerGridCol = eventData.pointerGridCol as number
	const isPointerGiven = typeof pointerGridRow === 'number' && typeof pointerGridCol === 'number'
		&& Number.isFinite(pointerGridRow) && Number.isFinite(pointerGridCol)

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

	if (eventType === 'decreaseGridDensity') return store.decreaseGridDensity(eventData.isForced === true)

	if (eventType === 'decreaseGridDensityCancel') {
		store.decreaseGridDensityCancel()
		return { code: 0 }
	}

	if (eventType === 'undo') return store.undo()

	if (eventType === 'redo') return store.redo()

	if (eventType === 'setEditTool') {
		const tool = eventData.tool
		if (tool !== 'select' && tool !== 'rect' && tool !== 'polygon') return { code: -1, message: 'Invalid tool' }
		store.setEditTool(tool as EditTool)
		return { code: 0 }
	}

	if (eventType === 'beginRectCreateDrag' || eventType === 'updateRectCreateDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		if (eventType === 'beginRectCreateDrag') store.beginRectCreateDrag(pointerGridRow, pointerGridCol)
		else store.updateRectCreateDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'commitRectCreateDrag') return store.commitRectCreateDrag()

	if (eventType === 'cancelRectCreateDrag') {
		store.cancelRectCreateDrag()
		return { code: 0 }
	}

	if (eventType === 'addPolygonDrawPoint') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		return store.addPolygonDrawPoint(pointerGridRow, pointerGridCol, eventData.isAxisLocked === true)
	}

	if (eventType === 'movePolygonDrawPointer') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.movePolygonDrawPointer(pointerGridRow, pointerGridCol, eventData.isAxisLocked === true)
		return { code: 0 }
	}

	if (eventType === 'removePolygonDrawPointLast') {
		store.removePolygonDrawPointLast()
		return { code: 0 }
	}

	if (eventType === 'commitPolygonDraw') return store.commitPolygonDraw()

	if (eventType === 'cancelPolygonDraw') {
		store.cancelPolygonDraw()
		return { code: 0 }
	}

	if (eventType === 'updatePolygonPointDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.updatePolygonPointDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'commitPolygonPointDrag') return store.commitPolygonPointDrag()

	if (eventType === 'cancelPolygonPointDrag') {
		store.cancelPolygonPointDrag()
		return { code: 0 }
	}

	if (eventType === 'createGroupAt' || eventType === 'createBlockAt') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		return store.createComponentAt(eventType === 'createGroupAt' ? 'group' : 'block', pointerGridRow, pointerGridCol)
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
	if ((eventType === 'toggleBlockSelection' || eventType === 'toggleGroupSelection' || eventType === 'selectEditComponent' || eventType === 'beginRectEdgeDrag' || eventType === 'beginMoveDrag' || eventType === 'beginEditMultiMoveDrag' || eventType === 'beginSelectMoveDrag' || eventType === 'beginPolygonVertexDrag' || eventType === 'beginPolygonSegmentDrag' || eventType === 'deletePolygonVertex') && !componentId) {
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
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.beginEditMultiSelectRectDrag(pointerGridRow, pointerGridCol, operation)
		return { code: 0 }
	}

	if (eventType === 'beginSelectRectDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.beginSelectRectDrag(pointerGridRow, pointerGridCol, operation)
		return { code: 0 }
	}

	if (eventType === 'updateEditMultiSelectRectDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.updateEditMultiSelectRectDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateSelectRectDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.updateSelectRectDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'beginSelectMoveDrag' && componentId) {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.beginSelectMoveDrag(componentId, pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateSelectMoveDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.updateSelectMoveDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'beginMoveDrag' && componentId) {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.beginMoveDrag(componentId, pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateMoveDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.updateMoveDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'beginEditMultiMoveDrag' && componentId) {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.beginEditMultiMoveDrag(componentId, pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if (eventType === 'updateEditMultiMoveDrag') {
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		store.updateEditMultiMoveDrag(pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	if ((eventType === 'beginPolygonVertexDrag' || eventType === 'beginPolygonSegmentDrag' || eventType === 'deletePolygonVertex') && componentId) {
		const index = eventData.index
		if (typeof index !== 'number' || !Number.isInteger(index)) return { code: -1, message: 'index is required' }
		if (eventType === 'deletePolygonVertex') return store.deletePolygonVertex(componentId, index)
		if (!isPointerGiven) return { code: -1, message: 'pointer grid position is required' }
		if (eventType === 'beginPolygonVertexDrag') store.beginPolygonVertexDrag(componentId, index, pointerGridRow, pointerGridCol, eventData.isInserted === true)
		else store.beginPolygonSegmentDrag(componentId, index, pointerGridRow, pointerGridCol)
		return { code: 0 }
	}

	return { code: -1, message: `Unknown event: ${eventType}` }
}
