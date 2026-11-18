import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { MapBlockRender } from './MapBlockRender';
import { createMapBlockStore } from './MapBlockStore';

// A block map used as a selector (doc/map-block-select.md#parent-approved-selection): the map
// draws and lets the user select, but the selection belongs to its parent, which receives every
// change as a list of block ids and gives the approved list back. Around that list the map keeps
// what only it knows, the internal state of the selection model (a block selected directly inside
// a selected group), as long as the approved list is what the map published.
//
//   data.mapData                the map (MapBlockData.ts); a new object makes a new store
//   data.blockSelectedIdList    the blocks selected, as the parent approved them
//   data.blockAvailableIdList   the blocks the parent accepts (null: every block); a selection
//                               is published without the others
//   data.blockDisabledIdList    the blocks drawn greyed and not clickable (default: those not available)
//   config.mode                 select (default) or display
//   config.cellAspectRatio, backgroundColor, mapWidthMax, renderComponentLabel: as MapBlockRender
//   onEvent('blockIdListSet', { blockIdList })   the selection the map proposes

const editDragEmpty = {
  isDragging: false,
  dragType: null,
  resize: {
    componentId: null,
    edge: null,
    gridLine: null,
    isDropValid: true,
  },
  move: {
    componentId: null,
    pointerGridRow: null,
    pointerGridCol: null,
    pointerOffsetRow: null,
    pointerOffsetCol: null,
    originalRange: null,
    candidateRange: null,
    isDropValid: true,
  },
};

const editMultiSelectionEmpty = {
  selectedComponentIds: new Set(),
  rectDrag: {
    isDragging: false,
    candidateBox: null,
    includeMode: null,
  },
  move: {
    isDragging: false,
    candidateBoundingRange: null,
    isDropValid: true,
  },
};

const selectMoveEmpty = {
  isDragging: false,
  candidateBoundingRange: null,
  isDropValid: true,
};

const selectionKeyPublishedByStore = new WeakMap();

function MapBlockSelect({ data = {}, config = {}, onEvent }) {
  const mapData = data.mapData;
  const store = useMemo(() => createMapBlockStore(mapData), [mapData]);
  const blockSelectedIdSet = new Set(data.blockSelectedIdList || []);
  const selectedBlockIds = new Set(store.blockComponents.map((component) => component.id).filter((blockId) => blockSelectedIdSet.has(blockId)));
  const availableBlockIds = Array.isArray(data.blockAvailableIdList) ? new Set(data.blockAvailableIdList) : null;
  const disabledBlockIds = Array.isArray(data.blockDisabledIdList)
    ? new Set(data.blockDisabledIdList)
    : new Set(availableBlockIds ? store.blockComponents.map((component) => component.id).filter((blockId) => !availableBlockIds.has(blockId)) : []);
  const selectedBlockIdKey = buildBlockIdKey(store, selectedBlockIds);

  // the approved list taken into the map, unless it is the one the map has just published: then
  // the map's own state (which may say more than the list) is kept
  useEffect(() => {
    if (selectionKeyPublishedByStore.get(store) === selectedBlockIdKey) {
      selectionKeyPublishedByStore.delete(store);
      return;
    }
    store.setSelectionByBlockIds(selectedBlockIds);
  }, [store, selectedBlockIdKey]);

  const publishSelection = () => {
    const selectedBlockIdsFinalRaw = store.selectedBlockIdsFinal;
    const selectedBlockIdsFinal = new Set(
      Array.from(selectedBlockIdsFinalRaw)
        .filter((blockId) => !availableBlockIds || availableBlockIds.has(blockId)),
    );
    const selectedBlockIdKeyFinal = buildBlockIdKey(store, selectedBlockIdsFinal);
    if (selectedBlockIdKeyFinal === selectedBlockIdKey) return;
    if (selectedBlockIdKeyFinal !== buildBlockIdKey(store, selectedBlockIdsFinalRaw)) {
      store.setSelectionByBlockIds(selectedBlockIdsFinal);
    }
    selectionKeyPublishedByStore.set(store, selectedBlockIdKeyFinal);
    onEvent?.('blockIdListSet', { blockIdList: Array.from(selectedBlockIdsFinal) });
  };

  const handleMapEvent = (eventType, eventData) => {
    store.handleEvent(eventType, eventData);
    if (eventType === 'toggleBlockSelection' || eventType === 'toggleGroupSelection' || eventType === 'commitSelectRectDrag' || eventType === 'clearSelection') {
      publishSelection();
    }
  };

  return (
    <MapBlockRender
      data={store.data}
      config={{
        mode: config.mode === 'display' ? 'display' : 'select',
        selectedBlockIds: store.selectState.selectedBlockIds,
        selectedGroupIds: store.selectState.selectedGroupIds,
        selectedBlockIdsFinal: store.selectedBlockIdsFinal,
        disabledComponentIds: disabledBlockIds,
        cellAspectRatio: config.cellAspectRatio || store.data.grid.cellAspectRatio,
        backgroundColor: config.backgroundColor || store.data.view.backgroundColor,
        mapWidthMax: config.mapWidthMax,
        renderComponentLabel: config.renderComponentLabel,
        selectRectDrag: store.selectState.rectDrag,
        selectMove: selectMoveEmpty,
        isSelectMoveEnabled: false,
        editSelectionMode: 'single',
        editSelectedComponentId: null,
        editDrag: editDragEmpty,
        editMultiSelection: editMultiSelectionEmpty,
      }}
      onEvent={handleMapEvent}
      onComponentContextMenu={() => {}}
      onComponentDoubleClick={() => {}}
    />
  );
}

// the ids of a set of blocks in the order of the map: one text per selection, whatever the order
// the set was made in
function buildBlockIdKey(store, blockIdSet) {
  return store.blockComponents
    .map((component) => component.id)
    .filter((blockId) => blockIdSet.has(blockId))
    .join('|');
}

const MapBlockSelectObserved = observer(MapBlockSelect);
export { MapBlockSelectObserved as MapBlockSelect };
export default MapBlockSelectObserved;
