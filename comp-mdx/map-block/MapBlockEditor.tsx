import React, { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react'
import { observer } from 'mobx-react-lite'
import { Menu, PropEditor as PropertyEditor, RefreshIcon, SegmentedControl } from '@wwf971/react-comp-misc'
import MapBlockPropEditorPopup from './MapBlockPropEditorPopup.jsx'
import { MapBlockRender } from './MapBlockRender'
import { chooseAnchoredPopupPos, rectFromViewportSize } from './popupPlacement'
import {
  createMapBlockStore,
  type EditTool,
  type MapBlockMode,
  type MapBlockStore,
  type MapObjDataFormat,
} from './MapBlockStore'
import { shapeIsPolygon, shapePolygonToRect, type MapBlockComp } from './MapBlockData'
import './MapBlock.css'

// The editor of one block map (doc/map-block-edit.md): the render with its header (the mode),
// the toolbar of the edit mode (tools, undo, density, the json of the map), the map config
// beside it, and the menus and dialogs of the edit mode. It edits the store it is given; who
// keeps the map (a frontend object: MapBlockObjectEditor.jsx) loads it into the store and saves
// it from there, and may put its own controls into the toolbar (toolbarTrailing).

export type MapBlockEditorText = {
  clear: string
  groupSelected: string
  blockSelected: string
  none: string
}

type MapBlockEditorProps = {
  store?: MapBlockStore
  eyebrow?: string
  title?: string
  // whether the edit mode is offered (a document read, not edited, shows the map only)
  isEditAllowed?: boolean
  editUnavailableReason?: string
  textById?: Partial<MapBlockEditorText>
  toolbarTrailing?: ReactNode
}

type ComponentMenuState = {
  kind: 'component' | 'map' | 'vertex'
  componentId: string | null
  label: string
  vertexIndex: number | null
  pointerGridPoint: { pointerGridRow: number; pointerGridCol: number } | null
  x: number
  y: number
}

type RenameState = {
  componentId: string
  labelDraft: string
}

const modeOptionList = [
  { value: 'display', label: 'Display' },
  { value: 'select', label: 'Select' },
  { value: 'edit', label: 'Edit' },
]
const toolOptionList = [
  { value: 'select', label: 'Select' },
  { value: 'rect', label: 'Rectangle' },
  { value: 'polygon', label: 'Polygon' },
]
const mapObjDataFormatOptions = [
  { value: 'tight', label: 'Tight' },
  { value: 'pretty', label: 'Pretty' },
]
// what each tool does with the pointer, said under the toolbar
const toolHintById: Record<EditTool, string> = {
  select: 'Drag empty grid: select (down: touching, up: inside whole) · drag a block: move · double-click: properties · right-click: menu',
  rect: 'Drag over cells: a new rectangular block',
  polygon: 'Click grid points: corners (Shift: straight) · click the first point, double-click or Enter: close · Backspace: last point back · Esc: stop',
}
const textDefault: MapBlockEditorText = {
  clear: 'Clear',
  groupSelected: 'Selected groups',
  blockSelected: 'Selected blocks',
  none: 'none',
}
const densityHalveLabelCountMax = 8
const MapBlockPropEditorPopupTyped = MapBlockPropEditorPopup as ComponentType<{ store: MapBlockStore }>

const MapBlockEditor = observer(({ store: storeProp, eyebrow, title, isEditAllowed = true, editUnavailableReason = '', textById, toolbarTrailing }: MapBlockEditorProps) => {
  const localStore = useMemo(() => createMapBlockStore(), [])
  const store = storeProp ?? localStore
  const rootRef = useRef<HTMLDivElement | null>(null)
  const mapConfigPanelRef = useRef<HTMLElement | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [componentMenu, setComponentMenu] = useState<ComponentMenuState | null>(null)
  const [renameState, setRenameState] = useState<RenameState | null>(null)
  const [isJsonDialogOpen, setIsJsonDialogOpen] = useState(false)
  const text = { ...textDefault, ...(textById ?? {}) }
  const isEditMode = store.config.mode === 'edit'
  const isDisplayMode = store.config.mode === 'display'
  const editState = store.editState
  const mapViewConfig = store.mapViewConfig
  const selectionEmpty = useMemo(() => new Set<string>(), [])
  const colorPopupPlacement = useCallback((triggerRect: DOMRect, popupSize: { width: number; height: number }) => {
    const anchorRect = mapConfigPanelRef.current?.getBoundingClientRect() ?? triggerRect
    const boundaryRect = rectFromViewportSize({ width: window.innerWidth, height: window.innerHeight })
    return chooseAnchoredPopupPos(anchorRect, popupSize, boundaryRect, 8)
  }, [])

  useEffect(() => {
    if (isEditMode) return
    store.closePropEditor()
  }, [isEditMode, store])

  // the edit mode taken away (the document left its edit mode): the map is shown instead
  useEffect(() => {
    if (!isEditAllowed && store.config.mode === 'edit') store.setMode('display')
  }, [isEditAllowed, store, store.config.mode])

  useEffect(() => {
    if (!store.editPropEditorState.drag.isDragging) return undefined
    const handlePointerMove = (event: PointerEvent) => store.movePropEditorDrag(event.clientX, event.clientY)
    const handlePointerUp = () => store.endPropEditorDrag()
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp, { once: true })
    window.addEventListener('pointercancel', handlePointerUp, { once: true })
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [store, store.editPropEditorState.drag.isDragging])

  const openComponentMenu = (component: MapBlockComp, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!isEditMode) return
    event.preventDefault()
    event.stopPropagation()
    setComponentMenu({ kind: 'component', componentId: component.id, label: component.label, vertexIndex: null, pointerGridPoint: null, x: event.clientX, y: event.clientY })
  }

  const openMapMenu = (pointerGridPoint: { pointerGridRow: number; pointerGridCol: number }, event: ReactMouseEvent<HTMLDivElement>) => {
    setComponentMenu({ kind: 'map', componentId: null, label: '', vertexIndex: null, pointerGridPoint, x: event.clientX, y: event.clientY })
  }

  const openVertexMenu = (component: MapBlockComp, index: number, event: ReactMouseEvent<HTMLElement>) => {
    setComponentMenu({ kind: 'vertex', componentId: component.id, label: component.label, vertexIndex: index, pointerGridPoint: null, x: event.clientX, y: event.clientY })
  }

  const toggleBlockPropEditor = (component: MapBlockComp, event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!isEditMode || component.kind !== 'block') return
    event.preventDefault()
    event.stopPropagation()
    const rect = event.currentTarget.getBoundingClientRect()
    store.toggleBlockPropEditor(component.id, {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    }, {
      width: window.innerWidth,
      height: window.innerHeight,
    }, editorBoundaryRectGet())
  }

  // from the left of the editor to the right of the window: the editor stands in a column of a
  // page whose side panel, left of it, would cover a popup put there
  const editorBoundaryRectGet = () => {
    const rootRect = rootRef.current?.getBoundingClientRect()
    const left = Math.max(0, Math.min(rootRect?.left ?? 0, window.innerWidth - 320))
    return { left, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth - left, height: window.innerHeight }
  }

  const componentMenuItemList = () => {
    if (!componentMenu) return []
    if (componentMenu.kind === 'map') {
      return [
        { id: 'createBlock', label: 'New block here' },
        { id: 'createGroup', label: 'New group here' },
      ]
    }
    if (componentMenu.kind === 'vertex') return [{ id: 'vertexDelete', label: 'Remove corner' }]
    const component = componentMenu.componentId ? store.componentById.get(componentMenu.componentId) : null
    const itemList = [{ id: 'rename', label: 'Rename' }]
    if (component && !shapeIsPolygon(component.shape)) itemList.push({ id: 'toPolygon', label: 'Make polygon' })
    if (component && shapeIsPolygon(component.shape) && shapePolygonToRect(component.shape)) itemList.push({ id: 'toRect', label: 'Make rectangle' })
    itemList.push({ id: 'delete', label: 'Delete' })
    return itemList
  }

  const handleComponentMenuEvent = (eventType: string, eventData: Record<string, unknown>) => {
    if (eventType === 'closeRequest' || eventType === 'close' || eventType === 'backdropContextMenu') {
      setComponentMenu(null)
      return
    }
    if (eventType !== 'itemClick' || !componentMenu) return

    const itemId = eventData.itemId
    const menu = componentMenu
    setComponentMenu(null)
    if (itemId === 'createBlock' && menu.pointerGridPoint) return void store.handleEvent('createBlockAt', menu.pointerGridPoint)
    if (itemId === 'createGroup' && menu.pointerGridPoint) return void store.handleEvent('createGroupAt', menu.pointerGridPoint)
    if (!menu.componentId) return
    if (itemId === 'vertexDelete' && menu.vertexIndex !== null) return void store.handleEvent('deletePolygonVertex', { componentId: menu.componentId, index: menu.vertexIndex })
    if (itemId === 'rename') return void setRenameState({ componentId: menu.componentId, labelDraft: menu.label })
    if (itemId === 'toPolygon') return void store.convertComponentShape(menu.componentId, 'polygon')
    if (itemId === 'toRect') return void store.convertComponentShape(menu.componentId, 'rect')
    if (itemId === 'delete') store.deleteComponent(menu.componentId)
  }

  const handleRenameConfirm = () => {
    if (!renameState) return
    const result = store.renameComponent(renameState.componentId, renameState.labelDraft)
    if (result.code === 0) setRenameState(null)
  }

  const copyMapObjData = async () => {
    await navigator.clipboard.writeText(store.config.mapObjData)
    setCopyMessage('Copied')
    window.setTimeout(() => setCopyMessage(''), 1200)
  }

  // the keys of the edit mode, while the editor has the focus: undo and redo, the keys of the
  // polygon being drawn, and Delete for what is selected. a key typed into a field is the field's
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!isEditMode || isTextEntryTarget(event.target)) return
    const isCommand = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()
    if (isCommand && key === 'z') {
      event.preventDefault()
      store.handleEvent(event.shiftKey ? 'redo' : 'undo', {})
      return
    }
    if (isCommand && key === 'y') {
      event.preventDefault()
      store.handleEvent('redo', {})
      return
    }
    if (editState.tool === 'polygon') {
      const isDrawing = editState.polygonDraw.pointList.length > 0
      if (event.key === 'Escape') {
        event.preventDefault()
        if (isDrawing) store.handleEvent('cancelPolygonDraw', {})
        else store.handleEvent('setEditTool', { tool: 'select' })
      } else if (event.key === 'Enter' && isDrawing) {
        event.preventDefault()
        store.handleEvent('commitPolygonDraw', {})
      } else if (event.key === 'Backspace' && isDrawing) {
        event.preventDefault()
        store.handleEvent('removePolygonDrawPointLast', {})
      }
      return
    }
    if (event.key === 'Escape' && editState.tool !== 'select') {
      event.preventDefault()
      store.handleEvent('setEditTool', { tool: 'select' })
      return
    }
    if (event.key === 'Delete' && editState.tool === 'select') {
      const componentIdList = Array.from(store.getEditSelectionIds())
      if (!componentIdList.length) return
      event.preventDefault()
      componentIdList.forEach((componentId) => store.deleteComponent(componentId))
    }
  }

  // a press in the editor gives it the focus, so that its keys work after a click on the map
  // (a browser that does not focus a button on a click, Safari, would leave it with the page)
  const handlePointerDownCapture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isEditMode || isTextEntryTarget(event.target)) return
    if (!rootRef.current?.contains(document.activeElement)) rootRef.current?.focus({ preventScroll: true })
  }

  const selectorRender = (
    <MapBlockRender
      data={store.data}
      config={{
        mode: store.config.mode,
        selectedBlockIds: isDisplayMode ? selectionEmpty : store.selectState.selectedBlockIds,
        selectedGroupIds: isDisplayMode ? selectionEmpty : store.selectState.selectedGroupIds,
        selectedBlockIdsFinal: isDisplayMode ? selectionEmpty : store.selectedBlockIdsFinal,
        disabledComponentIds: store.mapDisabledComponentIds,
        cellAspectRatio: store.data.grid.cellAspectRatio,
        backgroundColor: mapViewConfig.backgroundColor,
        mapWidthMax: mapViewConfig.mapWidthMax,
        selectRectDrag: store.selectState.rectDrag,
        selectMove: store.selectState.move,
        isSelectMoveEnabled: false,
        editTool: editState.tool,
        editSelectionMode: editState.selectionMode,
        editSelectedComponentId: editState.selectedComponentId,
        editDrag: editState.drag,
        editMultiSelection: store.editMultiSelectionState,
        editRectCreate: editState.rectCreate,
        editPolygonDraw: editState.polygonDraw,
      }}
      onEvent={store.handleEvent}
      onComponentContextMenu={openComponentMenu}
      onComponentDoubleClick={toggleBlockPropEditor}
      onMapContextMenu={openMapMenu}
      onVertexContextMenu={openVertexMenu}
    />
  )

  const selectionStatus = store.config.mode !== 'display' ? (
    <div className="map-block-status-row">
      <button type="button" className="map-block-clear" onClick={() => store.handleEvent('clearSelection', {})}>
        {text.clear}
      </button>
      <div className="map-block-status" aria-live="polite">
        <div>
          <span>{text.groupSelected}</span>
          <strong>{store.selectedGroupLabels.length ? store.selectedGroupLabels.join('、') : text.none}</strong>
        </div>
        <div>
          <span>{text.blockSelected}</span>
          <strong>{store.selectedBlockLabelsFinal.length ? store.selectedBlockLabelsFinal.join('、') : text.none}</strong>
        </div>
      </div>
    </div>
  ) : null

  const densityHalveAsk = editState.densityHalve.isAsked ? (
    <div className="map-block-edit-ask" role="alert">
      <span>
        {editState.densityHalve.componentLabelList.length
          ? `Halving moves ${editState.densityHalve.componentLabelList.length} shape${editState.densityHalve.componentLabelList.length > 1 ? 's' : ''} to the coarser lines: ${listTextShort(editState.densityHalve.componentLabelList)}.`
          : 'The grid range does not lie on the coarser lines and grows to them.'}
        {' '}Undo brings them back.
      </span>
      <button type="button" className="map-block-header-button" onClick={() => store.handleEvent('decreaseGridDensity', { isForced: true })}>Halve anyway</button>
      <button type="button" className="map-block-header-button" onClick={() => store.handleEvent('decreaseGridDensityCancel', {})}>Cancel</button>
    </div>
  ) : null

  const editToolbar = isEditMode ? (
    <div className="map-block-edit-toolbar">
      <div className="map-block-edit-toolbar-row">
        <span className="map-block-edit-toolbar-label">Tool</span>
        <SegmentedControl
          data={{ valueSelected: editState.tool, options: toolOptionList }}
          config={{ color: '#2d579e', widthMode: 'auto' }}
          onEvent={(_eventName: string, eventData: { valueSelected?: EditTool }) => {
            if (eventData?.valueSelected) store.handleEvent('setEditTool', { tool: eventData.valueSelected })
          }}
        />
        <span className="map-block-edit-toolbar-gap" />
        <button type="button" className="map-block-header-button" disabled={!store.isUndoAvailable} title="Undo (Ctrl+Z)" onClick={() => store.handleEvent('undo', {})}>
          Undo
        </button>
        <button type="button" className="map-block-header-button" disabled={!store.isRedoAvailable} title="Redo (Ctrl+Shift+Z)" onClick={() => store.handleEvent('redo', {})}>
          Redo
        </button>
        <span className="map-block-edit-toolbar-gap" />
        <button type="button" className="map-block-header-button" title="Merge every 2 x 2 cells into one" onClick={() => store.handleEvent('decreaseGridDensity', {})}>
          Density /2
        </button>
        <button type="button" className="map-block-header-button" title="Split every cell into 2 x 2 cells" onClick={() => store.handleEvent('increaseGridDensity', {})}>
          Density x2
        </button>
        <button type="button" className="map-block-header-button" onClick={() => setIsJsonDialogOpen(true)}>
          JSON
        </button>
        {toolbarTrailing ? <span className="map-block-edit-toolbar-gap" /> : null}
        {toolbarTrailing}
      </div>
      <div className="map-block-edit-hint">{toolHintById[editState.tool]}</div>
      {densityHalveAsk}
      {editState.polygonDraw.problem ? <div className="map-block-edit-message is-error" role="alert">{`Not closed: ${editState.polygonDraw.problem}`}</div> : null}
      {editState.message ? <div className="map-block-edit-message" role="status">{editState.message}</div> : null}
    </div>
  ) : null

  return (
    <div className="map-block-shell" ref={rootRef} tabIndex={-1} onKeyDown={handleKeyDown} onPointerDownCapture={handlePointerDownCapture}>
      <header className="map-block-header">
        <div className="map-block-header-main">
          <div className="map-block-header-title">
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2>{title}</h2> : null}
          </div>
          <div className="map-block-mode-control" title={isEditAllowed ? undefined : editUnavailableReason}>
            <SegmentedControl
              data={{ valueSelected: store.config.mode, options: isEditAllowed ? modeOptionList : modeOptionList.filter((option) => option.value !== 'edit') }}
              config={{ color: '#2d579e', widthMode: 'equal' }}
              onEvent={(_eventName: string, eventData: { valueSelected?: MapBlockMode }) => {
                if (eventData?.valueSelected) store.handleEvent('setMode', { mode: eventData.valueSelected })
              }}
            />
          </div>
        </div>
      </header>

      {editToolbar}

      <div
        className={`map-block-workspace map-block-workspace-${store.config.mode}`}
        style={{ '--map-block-map-width-max': `${mapViewConfig.mapWidthMax}px` } as CSSProperties}
      >
        <div className="map-block-preview-panel">
          {selectorRender}
          {selectionStatus}
        </div>
        <aside className="map-block-config-panel" ref={mapConfigPanelRef} aria-label="Map config">
          <div className="map-block-config-title">Map Config</div>
          <PropertyEditor
            data={store.mapConfigEditorData}
            config={{
              width: '100%',
              isLevelLeftShown: false,
              isLevelTopShown: true,
              isReadOnly: !isEditAllowed,
              groupCollapsedByPath: store.mapConfigEditorState.groupCollapsedByPath,
              keyColWidth: 'min',
              keyColMinWidth: '76px',
              keyColMaxWidth: '112px',
              requestTimeoutMs: 1200,
              valueConfigByType: {
                color: {
                  popupSize: { width: 264, height: 480 },
                  popupPlacement: colorPopupPlacement,
                  modeCommit: 'immediate',
                },
              },
            }}
            onEvent={store.handleMapConfigEditorEvent}
          />
        </aside>
      </div>

      {isEditMode ? <MapBlockPropEditorPopupTyped store={store} /> : null}

      {componentMenu ? (
        <Menu
          data={{ items: componentMenuItemList() }}
          config={{ minWidth: 132, isClickPropagationStopped: true, posOpen: { x: componentMenu.x, y: componentMenu.y } }}
          onEvent={handleComponentMenuEvent}
        />
      ) : null}

      {renameState ? (
        <div className="map-block-dialog-backdrop" role="presentation">
          <div className="map-block-dialog" role="dialog" aria-modal="true" aria-labelledby="map-block-rename-title">
            <h2 id="map-block-rename-title">Rename</h2>
            <input
              className="map-block-dialog-input"
              value={renameState.labelDraft}
              autoFocus
              onChange={(event) => setRenameState({ ...renameState, labelDraft: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleRenameConfirm()
                if (event.key === 'Escape') setRenameState(null)
              }}
            />
            <div className="map-block-dialog-actions">
              <button type="button" className="map-block-version-button" onClick={handleRenameConfirm}>
                Confirm
              </button>
              <button type="button" className="map-block-version-button" onClick={() => setRenameState(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditMode && isJsonDialogOpen ? (
        <div className="map-block-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setIsJsonDialogOpen(false)
        }}>
          <section className="map-block-dialog map-block-json-dialog" role="dialog" aria-modal="true" aria-labelledby="map-block-json-title">
            <div className="map-block-json-toolbar">
              <h2 id="map-block-json-title">Map Data Object</h2>
              <div className="map-block-json-actions">
                {copyMessage ? <span className="map-block-copy-message">{copyMessage}</span> : null}
                <SegmentedControl
                  data={{ valueSelected: store.config.mapObjDataFormat, options: mapObjDataFormatOptions }}
                  config={{ color: '#2d579e', widthMode: 'auto', classNameTrack: 'map-block-json-format-control' }}
                  onEvent={(_eventName: string, eventData: { valueSelected?: MapObjDataFormat }) => {
                    if (eventData?.valueSelected) store.handleEvent('setMapObjDataFormat', { format: eventData.valueSelected })
                  }}
                />
                <button type="button" className="map-block-icon-button" onClick={() => store.handleEvent('refreshMapObjData', {})} aria-label="Refresh map data JSON">
                  <RefreshIcon width={16} height={16} />
                </button>
                <button type="button" className="map-block-copy-button" onClick={copyMapObjData}>
                  Copy
                </button>
                <button type="button" className="map-block-copy-button" onClick={() => setIsJsonDialogOpen(false)}>
                  Close
                </button>
              </div>
            </div>
            <pre className="map-block-json-content">{store.config.mapObjData}</pre>
          </section>
        </div>
      ) : null}
    </div>
  )
})

function isTextEntryTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element) return false
  const tagName = element.tagName
  return tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || element.isContentEditable === true
}

function listTextShort(labelList: readonly string[]) {
  if (labelList.length <= densityHalveLabelCountMax) return labelList.join(', ')
  return `${labelList.slice(0, densityHalveLabelCountMax).join(', ')} and ${labelList.length - densityHalveLabelCountMax} more`
}

export { MapBlockEditor }
export default MapBlockEditor
