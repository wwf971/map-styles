import React, { useEffect, useState } from 'react';
import { MinusIcon, PlusIcon, SegmentedControl } from '@wwf971/react-comp-misc';
import { HighlightText, getItemDisplayData, getTextMatchRange, normalizeVisibleMatchText } from './MunicipalityTextHighlight.jsx';
import { KindIcon, PrefectureBadge, getItemIconText } from './MunicipalitySelectedTags.jsx';

export const municipalityDropdownDisplayModeOptions = [
  { value: 'list', label: '一覧' },
  { value: 'compact', label: '地域' },
];

export function ColCountControl({ value = 1, onChange }) {
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

export function DeferredDropdownBody({ renderKey, children }) {
  const [readyRenderKey, setReadyRenderKey] = useState(null);
  const isReady = readyRenderKey === renderKey;

  useEffect(() => {
    let frameId = 0;
    let timeoutId = 0;
    setReadyRenderKey(null);
    frameId = window.requestAnimationFrame(() => {
      timeoutId = window.setTimeout(() => setReadyRenderKey(renderKey), 90);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [renderKey]);

  if (!isReady) {
    return (
      <div className="municipality-dropdown-loading" role="status" aria-live="polite" aria-label="候補を読み込み中">
        <span className="municipality-dropdown-loading-spinner" aria-hidden />
        <span className="municipality-dropdown-loading-text">候補を準備中</span>
      </div>
    );
  }

  return children;
}

export function ResultItemContent({ item, kindConfig, isKindIconShown, isPrefectureBadgeShown, searchText, isSelected }) {
  const itemDisplayData = getItemDisplayData(item, isPrefectureBadgeShown, searchText);

  if (isPrefectureBadgeShown) {
    return (
      <>
        <PrefectureBadge item={item} rangeHighlight={itemDisplayData.rangeBadge} />
        <span className="municipality-result-name">
          <HighlightText text={itemDisplayData.mainText} range={itemDisplayData.rangeMain} />
        </span>
        {isSelected ? <span className="municipality-result-selected-badge">選択済み</span> : null}
      </>
    );
  }

  return (
    <>
      <KindIcon kind={item.kind} text={getItemIconText(item, kindConfig)} isShown={isKindIconShown} />
      <span className="municipality-result-name">
        <HighlightText text={item.displayName} range={getTextMatchRange(item.displayName, searchText)} />
      </span>
      {isSelected ? <span className="municipality-result-selected-badge">選択済み</span> : null}
    </>
  );
}

export function MunicipalityResultList({ itemList, itemSelectedIdSet, kindConfigByKind, isKindIconShown, isPrefectureBadgeShown, searchText, columnCount = 1, onEvent }) {
  const columnCountSafe = Math.min(6, Math.max(1, Number(columnCount) || 1));
  return (
    <div
      className={`municipality-result-list ${columnCountSafe > 1 ? 'is-col-grid' : ''}`}
      role="listbox"
      style={{ '--dropdown-list-col-count': columnCountSafe }}
    >
      {itemList.length === 0 ? (
        <div className="municipality-empty">候補なし</div>
      ) : itemList.map((item) => {
        const kindConfig = kindConfigByKind[item.kind];
        const isSelected = itemSelectedIdSet?.has(item.id) === true;
        return (
          <button
            key={item.id}
            type="button"
            className={`municipality-result-item ${isSelected ? 'is-selected' : ''}`}
            role="option"
            aria-selected={isSelected ? 'true' : 'false'}
            onClick={() => onEvent('itemToggle', { itemId: item.id })}
          >
            <ResultItemContent
              item={item}
              kindConfig={kindConfig}
              isKindIconShown={isKindIconShown}
              isPrefectureBadgeShown={isPrefectureBadgeShown}
              searchText={searchText}
              isSelected={isSelected}
            />
          </button>
        );
      })}
    </div>
  );
}

function buildMunicipalityCompactRows(itemList) {
  const regionRowList = [];
  const regionById = new Map();

  itemList.forEach((item) => {
    const regionId = item.regionId || 'unknown-region';
    let region = regionById.get(regionId);
    if (!region) {
      region = {
        id: regionId,
        label: item.regionLabel || '',
        colorValue: item.regionColorValue || '#dbeafe',
        prefectureRowList: [],
        prefectureById: new Map(),
      };
      regionById.set(regionId, region);
      regionRowList.push(region);
    }

    const prefectureId = item.prefectureId || 'unknown-prefecture';
    let prefecture = region.prefectureById.get(prefectureId);
    if (!prefecture) {
      prefecture = {
        id: prefectureId,
        label: item.prefectureLabel || '',
        itemList: [],
      };
      region.prefectureById.set(prefectureId, prefecture);
      region.prefectureRowList.push(prefecture);
    }
    prefecture.itemList.push(item);
  });

  return regionRowList;
}

function getCompactCellMatchRange(text, searchText) {
  const range = getTextMatchRange(text, searchText);
  if (range) return range;

  const textRaw = String(text || '');
  const textNormalized = normalizeVisibleMatchText(textRaw);
  const searchNormalized = normalizeVisibleMatchText(searchText);
  if (textRaw && textNormalized && searchNormalized.includes(textNormalized)) {
    return { indexStart: 0, indexEnd: textRaw.length };
  }
  return null;
}

function getCompactNameClassName(text) {
  const length = Array.from(String(text || '')).length;
  if (length >= 8) return 'municipality-compact-item-name is-very-long';
  if (length >= 6) return 'municipality-compact-item-name is-long';
  return 'municipality-compact-item-name';
}

function getRangePart(range, indexStart, indexEnd) {
  if (!range) return null;
  const indexStartNext = Math.max(range.indexStart, indexStart);
  const indexEndNext = Math.min(range.indexEnd, indexEnd);
  if (indexStartNext >= indexEndNext) return null;
  return {
    indexStart: indexStartNext - indexStart,
    indexEnd: indexEndNext - indexStart,
  };
}

function getCompactNameBreakIndex(text) {
  const textRaw = String(text || '');
  const districtIndex = textRaw.indexOf('郡');
  if (districtIndex >= 0 && districtIndex < textRaw.length - 1) return districtIndex + 1;

  const cityIndex = textRaw.indexOf('市');
  const wardIndex = cityIndex >= 0 ? textRaw.indexOf('区', cityIndex + 1) : -1;
  if (cityIndex >= 0 && wardIndex > cityIndex && cityIndex < textRaw.length - 1) return cityIndex + 1;

  return -1;
}

function CompactMunicipalityName({ text, searchText }) {
  const textRaw = String(text || '');
  const range = getCompactCellMatchRange(textRaw, searchText);
  const breakIndex = getCompactNameBreakIndex(textRaw);
  if (breakIndex < 0) {
    return <HighlightText text={textRaw} range={range} />;
  }

  const lineFirst = textRaw.slice(0, breakIndex);
  const lineSecond = textRaw.slice(breakIndex);
  return (
    <>
      <span className="municipality-compact-item-name-line">
        <HighlightText text={lineFirst} range={getRangePart(range, 0, lineFirst.length)} />
      </span>
      <span className="municipality-compact-item-name-line">
        <HighlightText text={lineSecond} range={getRangePart(range, lineFirst.length, textRaw.length)} />
      </span>
    </>
  );
}

export function MunicipalityCompactResultTable({ itemList = [], itemSelectedIdSet, searchText = '', onEvent }) {
  const regionRowList = buildMunicipalityCompactRows(itemList);

  if (itemList.length === 0) {
    return <div className="municipality-empty">候補なし</div>;
  }

  return (
    <div className="municipality-compact-table" role="listbox" aria-label="地域別市区町村候補">
      {regionRowList.map((region) => (
        <div className="municipality-compact-region-row" key={region.id}>
          <div
            className="municipality-compact-region-cell"
            style={{ '--municipality-compact-region-bg': region.colorValue }}
            title={region.label}
          >
            <HighlightText text={region.label} range={getCompactCellMatchRange(region.label, searchText)} />
          </div>
          <div className="municipality-compact-prefecture-row-list">
            {region.prefectureRowList.map((prefecture) => (
              <div className="municipality-compact-prefecture-row" key={prefecture.id}>
                <div className="municipality-compact-prefecture-cell" title={prefecture.label}>
                  <HighlightText text={prefecture.label} range={getCompactCellMatchRange(prefecture.label, searchText)} />
                </div>
                <div className="municipality-compact-item-list">
                  {prefecture.itemList.map((item) => {
                    const itemName = item.nameCompact || item.displayName;
                    const isSelected = itemSelectedIdSet?.has(item.id) === true;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`municipality-compact-item${isSelected ? ' is-selected' : ''}`}
                        role="option"
                        aria-selected={isSelected ? 'true' : 'false'}
                        title={item.displayName}
                        onClick={() => onEvent('itemToggle', { itemId: item.id })}
                      >
                        <span className={getCompactNameClassName(itemName)}>
                          <CompactMunicipalityName text={itemName} searchText={searchText} />
                        </span>
                        {isSelected ? <span className="municipality-compact-selected-mark">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function MunicipalityDropdownView({ dropdownDisplayMode, dropdownListColCount, renderKey, itemList, itemSelectedIdSet, searchText, onEvent, renderList }) {
  return (
    <div className="municipality-dropdown-view">
      <div className="municipality-dropdown-header">
        <div className="municipality-dropdown-title">表示</div>
        {dropdownDisplayMode === 'list' ? (
          <ColCountControl
            value={dropdownListColCount}
            onChange={(columnCount) => onEvent('dropdownListColCountSet', { columnCount })}
          />
        ) : <div className="dropdown-col-control-spacer" />}
        <SegmentedControl
          data={{ valueSelected: dropdownDisplayMode, segList: municipalityDropdownDisplayModeOptions }}
          config={{ colorHighlight: '#2d579e', widthModeSegment: 'auto' }}
          onEvent={(eventType, eventData) => {
            if (eventType === 'valueSelectedChange') {
              onEvent('dropdownDisplayModeSet', { displayMode: eventData.valueSelected });
            }
          }}
        />
      </div>
      <DeferredDropdownBody renderKey={renderKey}>
        {dropdownDisplayMode === 'compact' ? (
          <MunicipalityCompactResultTable itemList={itemList} itemSelectedIdSet={itemSelectedIdSet} searchText={searchText} onEvent={onEvent} />
        ) : renderList()}
      </DeferredDropdownBody>
    </div>
  );
}