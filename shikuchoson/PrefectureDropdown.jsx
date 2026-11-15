import React from 'react';
import { observer } from 'mobx-react-lite';
import { MinusIcon, PlusIcon } from 'ui-common';
import { SegmentedControl } from '../map-block/localReactCompMisc';
import PrefectureMapSelectJp from '../map-block/PrefectureMapSelectJp.jsx';
import { storeConfig } from './storeConfig.js';

const dropdownDisplayModeOptions = [
  { value: 'map', label: '地図' },
  { value: 'region', label: '地域' },
  { value: 'list', label: '一覧' },
];

function ColCountControl({ value = 1, onChange }) {
  const valueSafe = Math.min(6, Math.max(1, Number(value) || 1));
  return (
    <div className="dropdown-col-control" aria-label="一覧列数">
      <button
        type="button"
        className="dropdown-col-button"
        disabled={valueSafe <= 1}
        onClick={() => onChange(valueSafe - 1)}
        aria-label="一覧列数を減らす"
      >
        <MinusIcon width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
      <div className="dropdown-col-value">{valueSafe}列</div>
      <button
        type="button"
        className="dropdown-col-button"
        disabled={valueSafe >= 6}
        onClick={() => onChange(valueSafe + 1)}
        aria-label="一覧列数を増やす"
      >
        <PlusIcon width={14} height={14} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

function buildItemByPrefectureLabel(itemList) {
  return Object.fromEntries(
    itemList
      .filter((item) => item?.prefectureLabel)
      .map((item) => [item.prefectureLabel, item]),
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

function PrefectureRegionTable({ itemList = [], itemSelectedIdList = [], itemAvailableIdList = null, searchText = '', onEvent }) {
  const itemByPrefectureLabel = buildItemByPrefectureLabel(itemList);
  const itemSelectedIdSet = new Set(itemSelectedIdList || []);
  const itemAvailableIdSet = Array.isArray(itemAvailableIdList) ? new Set(itemAvailableIdList) : null;

  return (
    <div className="prefecture-region-table" role="list" aria-label="地域別都道府県">
      {storeConfig.regionList.map((region) => (
        <div className="prefecture-region-row" role="listitem" key={region.id}>
          <div
            className="prefecture-region-tag"
            style={{ '--prefecture-region-bg': region.colorValue }}
            title={region.label}
          >
            {region.label}
          </div>
          <div className="prefecture-region-cell-list">
            {region.prefectureLabelList.map((prefectureLabel) => {
              const item = itemByPrefectureLabel[prefectureLabel];
              if (!item) return null;
              const isSelected = itemSelectedIdSet.has(item.id);
              const isAvailable = !itemAvailableIdSet || itemAvailableIdSet.has(item.id);
              return (
                <button
                  className={`prefecture-region-cell${isSelected ? ' is-selected' : ''}${isAvailable ? '' : ' is-disabled'}`}
                  type="button"
                  key={item.id}
                  title={item.displayName}
                  aria-pressed={isSelected}
                  disabled={!isAvailable}
                  onClick={() => onEvent('itemToggle', { itemId: item.id })}
                >
                  <span className="prefecture-region-cell-name">
                    <HighlightText text={item.displayName} searchText={searchText} />
                  </span>
                  {isSelected ? <span className="prefecture-region-cell-selected">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PrefectureDropdown({ data = {}, config = {}, onEvent, renderList }) {
  const displayMode = ['map', 'region', 'list'].includes(data.dropdownDisplayMode) ? data.dropdownDisplayMode : 'map';
  const listColCount = Math.min(6, Math.max(1, Number(data.dropdownListColCount) || 1));

  return (
    <div className="prefecture-dropdown">
      <div className="prefecture-dropdown-header">
        <div className="prefecture-dropdown-title">表示</div>
        {displayMode === 'list' ? (
          <ColCountControl
            value={listColCount}
            onChange={(columnCount) => onEvent('dropdownListColCountSet', { columnCount })}
          />
        ) : displayMode === 'map' ? (
          <div className="selector-guidance-text prefecture-map-selection-guide">下ドラッグ: 接触 / 上ドラッグ: 全含有 / Shift追加 / Ctrl切替</div>
        ) : <div className="dropdown-col-control-spacer" />}
        <SegmentedControl
          data={{ valueSelected: displayMode, segList: dropdownDisplayModeOptions }}
          config={{ colorHighlight: '#2d579e', widthModeSegment: 'auto' }}
          onEvent={(eventType, eventData) => {
            if (eventType === 'valueSelectedChange') {
              onEvent('dropdownDisplayModeSet', { displayMode: eventData.valueSelected });
            }
          }}
        />
      </div>

      {displayMode === 'map' ? (
        <div className="prefecture-dropdown-map-panel">
          <PrefectureMapSelectJp
            data={{
              itemList: data.itemAllList,
              itemSelectedIdList: data.itemSelectedIdList,
              itemAvailableIdList: data.itemAvailableIdList,
              searchText: data.searchText,
            }}
            config={{ ...(config.mapConfig || {}), dataMap: storeConfig.prefectureMapData }}
            onEvent={onEvent}
          />
        </div>
      ) : displayMode === 'region' ? (
        <div className="prefecture-dropdown-region-panel">
          <PrefectureRegionTable
            itemList={data.itemAllList}
            itemSelectedIdList={data.itemSelectedIdList}
            itemAvailableIdList={data.itemAvailableIdList}
            searchText={data.searchText}
            onEvent={onEvent}
          />
        </div>
      ) : (
        <div className="prefecture-dropdown-list-panel">
          {renderList({ columnCount: listColCount })}
        </div>
      )}
    </div>
  );
}

export default observer(PrefectureDropdown);
