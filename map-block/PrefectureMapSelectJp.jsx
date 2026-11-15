import React, { useEffect, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { japanPrefectureTileGridMap } from './config/prefectureTileGridMapJp';
import { PrefectureSelectorRender } from './geo/PrefectureSelectorEl';
import { createPrefectureSelectorStore } from './geo/storePrefectureSelector';

function buildBlockByLabel(dataMap) {
  return Object.fromEntries(
    dataMap.components
      .filter((component) => component.compType === 'block')
      .map((component) => [component.label, component]),
  );
}

function buildItemIdByBlockId(itemList, blockByLabel) {
  const itemIdByBlockId = {};
  itemList.forEach((item) => {
    const block = blockByLabel[item.prefectureLabel];
    if (block) itemIdByBlockId[block.id] = item.id;
  });
  return itemIdByBlockId;
}

function buildSelectedBlockIds(dataMap, itemIdByBlockId, itemSelectedIdSet) {
  return new Set(
    dataMap.components
      .filter((component) => component.compType === 'block')
      .filter((component) => itemSelectedIdSet.has(itemIdByBlockId[component.id]))
      .map((component) => component.id),
  );
}

function buildAvailableBlockIds(dataMap, itemIdByBlockId, itemAvailableIdList) {
  if (!Array.isArray(itemAvailableIdList)) return null;
  const itemAvailableIdSet = new Set(itemAvailableIdList);
  return new Set(
    dataMap.components
      .filter((component) => component.compType === 'block')
      .filter((component) => itemAvailableIdSet.has(itemIdByBlockId[component.id]))
      .map((component) => component.id),
  );
}

function buildDisabledBlockIds(dataMap, itemIdByBlockId, availableBlockIds) {
  if (!availableBlockIds) return new Set();
  return new Set(
    dataMap.components
      .filter((component) => component.compType === 'block')
      .filter((component) => itemIdByBlockId[component.id])
      .filter((component) => !availableBlockIds.has(component.id))
      .map((component) => component.id),
  );
}

function normalizeVisibleMatchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\u3000\-ー]/g, '');
}

function getTextMatchRange(text, searchText) {
  const textRaw = String(text || '');
  const queryNormalized = normalizeVisibleMatchText(searchText);
  if (!textRaw || !queryNormalized) return null;

  let textNormalized = '';
  const indexRawByNormalized = [];
  Array.from(textRaw).forEach((char, indexRaw) => {
    const charNormalized = normalizeVisibleMatchText(char);
    Array.from(charNormalized).forEach(() => {
      indexRawByNormalized.push(indexRaw);
    });
    textNormalized += charNormalized;
  });

  const indexNormalized = textNormalized.indexOf(queryNormalized);
  if (indexNormalized < 0) return null;
  const indexStart = indexRawByNormalized[indexNormalized];
  const indexEnd = indexRawByNormalized[indexNormalized + queryNormalized.length - 1] + 1;
  return { indexStart, indexEnd };
}

function HighlightText({ text, searchText, className = 'municipality-match-highlight' }) {
  const textRaw = String(text || '');
  const range = getTextMatchRange(textRaw, searchText);
  if (!range || range.indexStart >= range.indexEnd) return textRaw;
  return (
    <>
      {textRaw.slice(0, range.indexStart)}
      <mark className={className}>{textRaw.slice(range.indexStart, range.indexEnd)}</mark>
      {textRaw.slice(range.indexEnd)}
    </>
  );
}

function getMapLabelSearchText(component, itemIdByBlockId, itemById, searchText) {
  const searchTextRaw = String(searchText || '');
  if (component.compType !== 'block') return searchTextRaw;
  const item = itemById[itemIdByBlockId[component.id]];
  const textSuffixTrimmed = searchTextRaw.replace(/[都道府県]$/, '');
  if (item?.displayName && normalizeVisibleMatchText(item.displayName).includes(normalizeVisibleMatchText(searchTextRaw))) {
    return textSuffixTrimmed || searchTextRaw;
  }
  return searchTextRaw;
}

function buildBlockIdKey(dataMap, blockIdSet) {
  return dataMap.components
    .filter((component) => component.compType === 'block')
    .map((component) => component.id)
    .filter((blockId) => blockIdSet.has(blockId))
    .join('|');
}

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

function PrefectureMapSelectJp({ data = {}, config = {}, onEvent }) {
  const store = useMemo(() => createPrefectureSelectorStore(config.dataMap || japanPrefectureTileGridMap), [config.dataMap]);
  const itemList = Array.isArray(data.itemList) ? data.itemList : [];
  const itemById = Object.fromEntries(itemList.map((item) => [item.id, item]));
  const itemSelectedIdSet = new Set(data.itemSelectedIdList || []);
  const itemAvailableIdList = Array.isArray(data.itemAvailableIdList) ? data.itemAvailableIdList : null;
  const searchText = data.searchText || '';
  const dataMap = config.dataMap || japanPrefectureTileGridMap;
  const cellAspectRatio = config.cellAspectRatio || { width: 1, height: 0.7 };
  const backgroundColor = config.backgroundColor || '#eaf5ff';
  const blockByLabel = buildBlockByLabel(dataMap);
  const itemIdByBlockId = buildItemIdByBlockId(itemList, blockByLabel);
  const selectedBlockIds = buildSelectedBlockIds(dataMap, itemIdByBlockId, itemSelectedIdSet);
  const availableBlockIds = buildAvailableBlockIds(dataMap, itemIdByBlockId, itemAvailableIdList);
  const disabledBlockIds = buildDisabledBlockIds(dataMap, itemIdByBlockId, availableBlockIds);
  const selectedBlockIdKey = buildBlockIdKey(dataMap, selectedBlockIds);

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
    const selectedBlockIdKeyFinal = buildBlockIdKey(dataMap, selectedBlockIdsFinal);
    if (selectedBlockIdKeyFinal === selectedBlockIdKey) return;
    if (selectedBlockIdKeyFinal !== buildBlockIdKey(dataMap, selectedBlockIdsFinalRaw)) {
      store.setSelectionByBlockIds(selectedBlockIdsFinal);
    }
    selectionKeyPublishedByStore.set(store, selectedBlockIdKeyFinal);
    const itemIdList = Array.from(selectedBlockIdsFinal)
      .map((blockId) => itemIdByBlockId[blockId])
      .filter(Boolean);
    onEvent?.('itemIdListSet', { itemIdList });
  };

  const handleMapEvent = (eventType, eventData) => {
    store.handleEvent(eventType, eventData);
    if (eventType === 'toggleBlockSelection' || eventType === 'toggleGroupSelection' || eventType === 'commitSelectRectDrag' || eventType === 'clearSelection') {
      publishSelection();
    }
  };

  return (
    <div className="prefecture-map-select-jp">
      <PrefectureSelectorRender
        data={dataMap}
        config={{
          mode: 'select',
          selectedBlockIds: store.selectState.selectedBlockIds,
          selectedGroupIds: store.selectState.selectedGroupIds,
          selectedBlockIdsFinal: store.selectedBlockIdsFinal,
          disabledComponentIds: disabledBlockIds,
          cellAspectRatio,
          backgroundColor,
          renderComponentLabel: (component) => (
            <HighlightText text={component.label} searchText={getMapLabelSearchText(component, itemIdByBlockId, itemById, searchText)} />
          ),
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
    </div>
  );
}

export default observer(PrefectureMapSelectJp);
