import React from 'react';
import { observer } from 'mobx-react-lite';
import { MapBlockSelect } from '../map-block/MapBlockSelect.jsx';

// The prefecture map of the prefecture selector (doc/shikuchoson.md#the-map-of-the-prefectures):
// the general selector of block maps (map-block/MapBlockSelect.jsx) over the tile map of the
// prefectures, a block standing for the prefecture whose short name is its label (北海道, 青森).
// It turns the items of the selector into blocks and back, greys the prefectures the selector
// does not offer, and marks in each label what the search text matched.
//
//   data.itemList, itemSelectedIdList, itemAvailableIdList, searchText: of the selector
//   config.dataMap: the tile map (MapBlockData.ts); config.cellAspectRatio, backgroundColor
//   onEvent('itemIdListSet', { itemIdList })

function PrefectureMapSelectJp({ data = {}, config = {}, onEvent }) {
  const dataMap = config.dataMap;
  if (!dataMap) return null;
  const itemList = Array.isArray(data.itemList) ? data.itemList : [];
  const itemById = Object.fromEntries(itemList.map((item) => [item.id, item]));
  const itemSelectedIdSet = new Set(data.itemSelectedIdList || []);
  const itemAvailableIdList = Array.isArray(data.itemAvailableIdList) ? data.itemAvailableIdList : null;
  const searchText = data.searchText || '';
  const cellAspectRatio = config.cellAspectRatio || { width: 1, height: 0.7 };
  const backgroundColor = config.backgroundColor || '#eaf5ff';
  const blockByLabel = buildBlockByLabel(dataMap);
  const itemIdByBlockId = buildItemIdByBlockId(itemList, blockByLabel);
  const selectedBlockIds = buildSelectedBlockIds(dataMap, itemIdByBlockId, itemSelectedIdSet);
  const availableBlockIds = buildAvailableBlockIds(dataMap, itemIdByBlockId, itemAvailableIdList);
  const disabledBlockIds = buildDisabledBlockIds(dataMap, itemIdByBlockId, availableBlockIds);

  return (
    <div className="prefecture-map-select-jp">
      <MapBlockSelect
        data={{
          mapData: dataMap,
          blockSelectedIdList: Array.from(selectedBlockIds),
          blockAvailableIdList: availableBlockIds ? Array.from(availableBlockIds) : null,
          blockDisabledIdList: Array.from(disabledBlockIds),
        }}
        config={{
          cellAspectRatio,
          backgroundColor,
          renderComponentLabel: (component) => (
            <HighlightText text={component.label} searchText={getMapLabelSearchText(component, itemIdByBlockId, itemById, searchText)} />
          ),
        }}
        onEvent={(eventType, eventData) => {
          if (eventType !== 'blockIdListSet') return;
          const itemIdList = eventData.blockIdList
            .map((blockId) => itemIdByBlockId[blockId])
            .filter(Boolean);
          onEvent?.('itemIdListSet', { itemIdList });
        }}
      />
    </div>
  );
}

function blockListGet(dataMap) {
  return dataMap.compList.filter((component) => component.kind === 'block');
}

function buildBlockByLabel(dataMap) {
  return Object.fromEntries(blockListGet(dataMap).map((component) => [component.label, component]));
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
    blockListGet(dataMap)
      .filter((component) => itemSelectedIdSet.has(itemIdByBlockId[component.id]))
      .map((component) => component.id),
  );
}

function buildAvailableBlockIds(dataMap, itemIdByBlockId, itemAvailableIdList) {
  if (!Array.isArray(itemAvailableIdList)) return null;
  const itemAvailableIdSet = new Set(itemAvailableIdList);
  return new Set(
    blockListGet(dataMap)
      .filter((component) => itemAvailableIdSet.has(itemIdByBlockId[component.id]))
      .map((component) => component.id),
  );
}

function buildDisabledBlockIds(dataMap, itemIdByBlockId, availableBlockIds) {
  if (!availableBlockIds) return new Set();
  return new Set(
    blockListGet(dataMap)
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
  if (component.kind !== 'block') return searchTextRaw;
  const item = itemById[itemIdByBlockId[component.id]];
  const textSuffixTrimmed = searchTextRaw.replace(/[都道府県]$/, '');
  if (item?.displayName && normalizeVisibleMatchText(item.displayName).includes(normalizeVisibleMatchText(searchTextRaw))) {
    return textSuffixTrimmed || searchTextRaw;
  }
  return searchTextRaw;
}

export default observer(PrefectureMapSelectJp);
