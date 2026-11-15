import React, { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { TabsOnTop } from 'ui-common';
import DemoMapBlock from '../map-block/demo-map-block.jsx';
import MunicipalitySelector from './MunicipalitySelector.jsx';
import RegionSelector from './RegionSelector.jsx';
import ShikuchosonConfigPopup from './ShikuchosonConfigPopup.jsx';
import SettingsIcon from './SettingsIcon.jsx';
import { kindConfigList, storeMunicipality } from './storeMunicipality.js';
import { prefectureKindConfigList, storePrefecture } from './storePrefecture.js';
import { storeConfig } from './storeConfig.js';
import { storeRegion } from './storeRegion.js';

const selectorMunicipalityId = 'municipality-main';
const selectorPrefectureId = 'prefecture-main';

function syncMunicipalityFromPrefectureIfNeeded() {
  if (storeMunicipality.filterConfig.isPrefectureFilterEnabled) {
    storeMunicipality.prefectureFilterSyncFromPrefectureSelection(storePrefecture.selectorData.itemSelectedIdList);
  }
}

function getPrefectureIdListAvailableFromRegion() {
  const regionSelectedIdList = storeRegion.itemSelectedIdList;
  return storePrefecture.prefectureIdList.filter((prefectureId) => (
    regionSelectedIdList.includes(storePrefecture.prefectureItemById[prefectureId]?.regionId)
  ));
}

function syncPrefectureAvailableListFromRegionIfNeeded() {
  if (storePrefecture.selectorData.availableItemIdList === null) return;
  storePrefecture.selectorAvailableItemIdListSet(getPrefectureIdListAvailableFromRegion());
}

function handlePrefectureStoreEvent(eventType) {
  if (eventType === 'selectionChange') syncMunicipalityFromPrefectureIfNeeded();
}

function handleMunicipalityStoreEvent(eventType, eventData) {
  if (eventType === 'parentItemRemoveRequest') {
    storePrefecture.selectorItemRemove(eventData.itemId);
  } else if (eventType === 'parentItemSelectedEnsureRequest') {
    const isPrefectureSelectorOpen = storePrefecture.selectorData.isOpen;
    if (Array.isArray(eventData.itemIdList)) {
      storePrefecture.selectorItemIdListSet(eventData.itemIdList);
    } else {
      storePrefecture.selectorItemSelectedEnsure(eventData.itemId);
    }
    storePrefecture.selectorOpenSet(isPrefectureSelectorOpen);
    if (eventData.itemIdFocus) {
      storePrefecture.selectorSelectedItemCenterFocusRequest(eventData.itemIdFocus);
    }
  }
}

function getSelectorData(selectorStore, itemById, resultIdListGet, options = {}) {
  const selectorData = selectorStore.selectorEnsure();
  const includeResultList = options.includeResultList === true;
  const includeAllList = options.includeAllList === true;
  const itemSelectedIdSet = new Set(selectorData.itemSelectedIdList);
  const itemSelectedList = selectorData.itemSelectedIdList
    .map((itemId) => itemById[itemId])
    .filter(Boolean)
    .map((item) => storeConfig.regionColorApplyToItem(item));
  const itemResultList = includeResultList ? resultIdListGet()
    .map((itemId) => itemById[itemId])
    .filter(Boolean)
    .map((item) => storeConfig.regionColorApplyToItem(item)) : [];
  const itemAllList = includeAllList ? Object.values(itemById).map((item) => storeConfig.regionColorApplyToItem(item)) : [];
  const itemAvailableIdList = selectorData.availableItemIdList === null ? null : [...selectorData.availableItemIdList];

  return { selectorData, itemSelectedIdSet, itemSelectedList, itemResultList, itemAllList, itemAvailableIdList };
}

function handleSelectorEvent(selectorStore, eventType, eventData) {
    if (eventType === 'searchTextChange') {
      selectorStore.selectorSearchTextSet(eventData.searchText);
    } else if (eventType === 'openChange') {
      selectorStore.selectorOpenSet(eventData.isOpen);
    } else if (eventType === 'kindToggle') {
      selectorStore.selectorKindToggle(eventData.kind);
    } else if (eventType === 'itemSelect') {
      selectorStore.selectorItemSelect(eventData.itemId);
    } else if (eventType === 'itemToggle') {
      selectorStore.selectorItemToggle(eventData.itemId);
    } else if (eventType === 'itemIdListToggle') {
      selectorStore.selectorItemIdListToggle(eventData.itemIdList);
    } else if (eventType === 'itemIdListSet') {
      selectorStore.selectorItemIdListSet(eventData.itemIdList);
    } else if (eventType === 'itemRemove') {
      selectorStore.selectorItemRemove(eventData.itemId);
    } else if (eventType === 'itemLastRemove') {
      selectorStore.selectorLastItemRemove();
    } else if (eventType === 'selectedClear') {
      selectorStore.selectorSelectedClear();
    } else if (eventType === 'searchTextClear') {
      selectorStore.selectorSearchTextClear();
    } else if (eventType === 'searchDisplayModeToggle') {
      selectorStore.selectorSearchDisplayModeToggle();
    } else if (eventType === 'dropdownDisplayModeSet') {
      selectorStore.selectorDropdownDisplayModeSet(eventData.displayMode);
    } else if (eventType === 'dropdownListColCountSet') {
      selectorStore.selectorDropdownListColCountSet(eventData.columnCount);
    } else if (eventType === 'dragStart') {
      selectorStore.selectorDragStart(eventData.itemId, eventData.dragMode);
    } else if (eventType === 'dragPreviewSingleLine') {
      selectorStore.selectorDragPreviewSingleLine(
        eventData.itemTargetId,
        eventData.insertPosition,
        eventData.indicatorLeftPx,
      );
    } else if (eventType === 'dragPreviewWrap') {
      selectorStore.selectorDragPreviewWrap(
        eventData.itemTargetId,
        eventData.insertPosition,
        eventData.indicatorLeftPx,
        eventData.indicatorTopPx,
        eventData.indicatorHeightPx,
      );
    } else if (eventType === 'dragDrop') {
      selectorStore.selectorDragDrop(eventData.dragMode);
    } else if (eventType === 'dragClear') {
      selectorStore.selectorDragClear();
    } else if (eventType === 'dragScrollHoverChange') {
      selectorStore.selectorDragScrollHoverSet(eventData.direction, eventData.isHover);
    } else if (eventType === 'dragCancelHoverChange') {
      selectorStore.selectorDragCancelHoverSet(eventData.dragMode, eventData.isHover);
    } else if (eventType === 'tagScrollChange') {
      selectorStore.selectorTagScrollSet(eventData);
    } else if (eventType === 'prefectureFilterDeactivate') {
      storeMunicipality.prefectureFilterDeactivate(eventData.prefectureId);
    } else if (eventType === 'prefectureFilterRemove') {
      storeMunicipality.prefectureFilterRemove(eventData.prefectureId);
    } else if (eventType === 'prefectureFilterActivate') {
      storeMunicipality.prefectureFilterActivate(eventData.prefectureId);
    } else if (eventType === 'prefectureFilterReorder') {
      storeMunicipality.prefectureFilterReorder(
        eventData.prefectureIdDragged,
        eventData.prefectureIdTarget,
        eventData.insertPosition,
      );
    } else if (eventType === 'filterDisplayModeToggle') {
      storeMunicipality.filterDisplayModeToggle();
    } else if (eventType === 'specialFilterToggle') {
      storeMunicipality.specialFilterToggle(eventData.filterId);
    }
    if (selectorStore === storePrefecture && [
      'itemSelect',
      'itemToggle',
      'itemIdListToggle',
      'itemIdListSet',
      'itemRemove',
      'itemLastRemove',
      'selectedClear',
      'dragDrop',
    ].includes(eventType)) {
      storeMunicipality.prefectureFilterSyncFromPrefectureSelection(storePrefecture.selectorData.itemSelectedIdList);
    }
    return { code: 0 };
}

function handleRegionSelectorEvent(eventType, eventData) {
  if (eventType === 'itemToggle') {
    storeRegion.itemToggle(eventData.itemId);
  } else if (eventType === 'itemRemove') {
    storeRegion.itemRemove(eventData.itemId);
  } else if (eventType === 'itemReorder') {
    storeRegion.itemReorder(eventData.itemIdDragged, eventData.itemIdTarget, eventData.insertPosition);
  } else if (eventType === 'selectedAll') {
    storeRegion.selectedAll();
  } else if (eventType === 'selectedClear') {
    storeRegion.selectedClear();
  } else if (eventType === 'colorEditorOpenChange') {
    storeConfig.regionColorEditorOpenSet(eventData.isOpen);
  }
  syncPrefectureAvailableListFromRegionIfNeeded();
  syncMunicipalityFromPrefectureIfNeeded();
  return { code: 0 };
}

function handleRegionFilterEnabledChange(isEnabled) {
  storePrefecture.selectorAvailableItemIdListSet(isEnabled ? getPrefectureIdListAvailableFromRegion() : null);
  syncMunicipalityFromPrefectureIfNeeded();
}

storePrefecture.selectorAvailableItemIdListSet(getPrefectureIdListAvailableFromRegion());

function ShikuchosonPanel() {
  useEffect(() => {
    storePrefecture.selectorEventHandlerSet(handlePrefectureStoreEvent);
    storeMunicipality.selectorEventHandlerSet(handleMunicipalityStoreEvent);
    return () => {
      storePrefecture.selectorEventHandlerSet(null);
      storeMunicipality.selectorEventHandlerSet(null);
    };
  }, []);
  const regionViewData = {
    itemList: storeRegion.resultIdList()
      .map((itemId) => storeRegion.regionItemById[itemId])
      .map((item) => storeConfig.regionColorApplyToItem(item))
      .filter(Boolean),
    itemSelectedIdList: storeRegion.itemSelectedIdList,
  };
  const regionSelectedList = storeRegion.resultIdList()
    .filter((itemId) => storeRegion.itemSelectedIdList.includes(itemId))
    .map((itemId) => storeRegion.regionItemById[itemId])
    .map((item) => storeConfig.regionColorApplyToItem(item))
    .filter(Boolean);
  const prefectureViewData = getSelectorData(
    storePrefecture,
    storePrefecture.prefectureItemById,
    () => storePrefecture.resultIdList(),
    {
      includeResultList: storePrefecture.selectorData.isOpen,
      includeAllList: storePrefecture.selectorData.isOpen,
    },
  );
  const municipalityViewData = getSelectorData(
    storeMunicipality,
    storeMunicipality.municipalityItemById,
    () => storeMunicipality.resultIdList(),
    {
      includeResultList: storeMunicipality.selectorData.isOpen,
    },
  );

  const renderSelectorTitleHints = (viewData) => {
    const isReorderHintShown = viewData.itemSelectedList.length > 1;
    const isWheelScrollHintShown = viewData.selectorData.searchDisplayMode === 'single'
      && viewData.selectorData.tagScrollState?.isOverflow === true;
    return (
      <>
        {isReorderHintShown ? <span className="selector-guidance-text">ドラッグで並べ替え</span> : null}
        {isWheelScrollHintShown ? <span className="selector-guidance-text">ホイールで横スクロール</span> : null}
      </>
    );
  };

  const renderSelectorTitleControls = (selectorStore, viewData, config) => (
    <div className="selector-title-controls">
      <button
        type="button"
        className="municipality-text-button municipality-title-button"
        aria-label="検索欄表示を切り替え"
        onClick={() => handleSelectorEvent(selectorStore, 'searchDisplayModeToggle', {})}
      >
        {viewData.selectorData.searchDisplayMode === 'wrap' ? '折返' : '1行'}
      </button>
      <button
        type="button"
        className="municipality-text-button municipality-title-button"
        onClick={() => handleSelectorEvent(selectorStore, 'selectedClear', {})}
      >
        {config.clearSelectedText || 'クリア'}
      </button>
      <button
        type="button"
        className="municipality-text-button municipality-title-button"
        onClick={() => handleSelectorEvent(selectorStore, 'searchTextClear', {})}
      >
        {config.clearSearchText || '入力クリア'}
      </button>
    </div>
  );

  const renderRegionTitleControls = () => (
    <div className="selector-title-controls">
      <button
        type="button"
        className="municipality-text-button municipality-title-button"
        onClick={() => handleRegionSelectorEvent('selectedAll', {})}
      >
        全選択
      </button>
      <button
        type="button"
        className="municipality-text-button municipality-title-button"
        onClick={() => handleRegionSelectorEvent('selectedClear', {})}
      >
        クリア
      </button>
      <button
        type="button"
        className="region-selector-settings-button"
        aria-label="地域色設定を開く"
        title="地域色設定"
        onClick={() => handleRegionSelectorEvent('colorEditorOpenChange', { isOpen: true })}
      >
        <SettingsIcon width={16} height={16} />
      </button>
    </div>
  );

  const renderSelectedSummaryGroup = ({ label, itemList, textGet, isRegionColorShown = true }) => (
    <section className="selected-summary-group" aria-label={`選択中${label}`}>
      <div className="selected-summary-group-title">
        <span>{label}</span>
        <span className="selected-summary-count">{itemList.length}</span>
      </div>
      <div className="selected-summary-chip-list">
        {itemList.length > 0 ? itemList.map((item) => (
          <span
            key={item.id}
            className={`selected-summary-chip ${isRegionColorShown && item.regionColorValue ? 'is-region-colored' : ''}`}
            style={isRegionColorShown && item.regionColorValue ? { '--selected-summary-chip-bg': item.regionColorValue } : undefined}
            title={textGet(item)}
          >
            {textGet(item)}
          </span>
        )) : <span className="selected-summary-empty">未選択</span>}
      </div>
    </section>
  );

  const renderSelectedSummaryPanel = () => (
    <section className="selected-summary-section" aria-label="現在の選択">
      <div className="selected-summary-divider" aria-hidden="true">
        <span>現在の選択</span>
      </div>
      <div className="selected-summary-panel">
        <div className="selected-summary-grid">
          {renderSelectedSummaryGroup({
            label: '地域',
            itemList: regionSelectedList,
            textGet: (item) => item.displayName,
          })}
          {renderSelectedSummaryGroup({
            label: '都道府県',
            itemList: prefectureViewData.itemSelectedList,
            textGet: (item) => item.displayName,
          })}
          {renderSelectedSummaryGroup({
            label: '市区町村',
            itemList: municipalityViewData.itemSelectedList,
            textGet: (item) => item.displayName,
            isRegionColorShown: false,
          })}
        </div>
      </div>
    </section>
  );

  const renderSelector = ({ selectorId, selectorStore, viewData, config }) => (
    <MunicipalitySelector
      data={{
        searchText: viewData.selectorData.searchText,
        itemSelectedIdSet: viewData.itemSelectedIdSet,
        itemSelectedList: viewData.itemSelectedList,
        itemResultList: viewData.itemResultList,
        itemAllList: viewData.itemAllList,
        itemAvailableIdList: viewData.itemAvailableIdList,
        isOpen: viewData.selectorData.isOpen,
        dropdownDisplayMode: viewData.selectorData.dropdownDisplayMode,
        dropdownListColCount: viewData.selectorData.dropdownListColCount,
        searchDisplayMode: viewData.selectorData.searchDisplayMode,
        tagScrollState: viewData.selectorData.tagScrollState,
        dragState: selectorStore.selectorDragStateGet(viewData.selectorData.searchDisplayMode),
        kindEnabledByKind: viewData.selectorData.kindEnabledByKind,
        prefectureFilterList: selectorId === selectorMunicipalityId ? storeMunicipality.prefectureFilterList : [],
        specialFilterList: selectorId === selectorMunicipalityId ? storeMunicipality.specialFilterList : [],
        filterDisplayMode: selectorId === selectorMunicipalityId ? storeMunicipality.filterConfig.displayMode : 'single',
      }}
      config={config}
      onEvent={(eventType, eventData) => handleSelectorEvent(selectorStore, eventType, eventData)}
    />
  );

  return (
    <section className="shikuchoson-panel" aria-label="Municipality selector demo">
      <div className="feature-header">
        <div>
          <p className="eyebrow">SHIKUCHONSON SEARCH</p>
          <h2>市区町村検索</h2>
        </div>
      </div>
      <div className="shikuchoson-body">
        <ShikuchosonConfigPopup store={storeConfig} />
        <div className="shikuchoson-selector-stack">
          <div className="selector-keep-open-boundary">
            <section className="selector-block" data-dropdown-keep-open-boundary={`${selectorPrefectureId} ${selectorMunicipalityId}`}>
              <div className="selector-block-title">
                <span className="selector-block-title-label">地域</span>
                {renderRegionTitleControls()}
              </div>
              <RegionSelector
                data={regionViewData}
                onEvent={handleRegionSelectorEvent}
              />
            </section>

            <label className="prefecture-filter-toggle" data-dropdown-keep-open-boundary={`${selectorPrefectureId} ${selectorMunicipalityId}`}>
              <input
                type="checkbox"
                checked={storePrefecture.selectorData.availableItemIdList !== null}
                onChange={(event) => handleRegionFilterEnabledChange(event.target.checked)}
              />
              <span>地域の選択で都道府県候補を絞り込む</span>
            </label>

            <section className="selector-block" data-dropdown-keep-open-boundary={selectorPrefectureId}>
              <div className="selector-block-title">
                <span className="selector-block-title-label">都道府県</span>
                {renderSelectorTitleControls(storePrefecture, prefectureViewData, {
                  clearSelectedText: 'クリア',
                  clearSearchText: '入力クリア',
                })}
                {renderSelectorTitleHints(prefectureViewData)}
              </div>
              {renderSelector({
                selectorId: selectorPrefectureId,
                selectorStore: storePrefecture,
                viewData: prefectureViewData,
                config: {
                  kindConfigList: prefectureKindConfigList,
                  isKindFilterShown: false,
                  isKindIconShown: false,
                  placeholderText: '都道府県を検索',
                  selectedAriaLabel: '選択済み都道府県',
                  clearSelectedText: 'クリア',
                  clearSearchText: '入力クリア',
                  dropdownType: 'prefecture',
                  dropdownKeepOpenBoundaryId: selectorPrefectureId,
                },
              })}
            </section>
          </div>

          <label className="prefecture-filter-toggle" data-dropdown-keep-open-boundary={selectorMunicipalityId}>
            <input
              type="checkbox"
              checked={storeMunicipality.filterConfig.isPrefectureFilterEnabled}
              onChange={(event) => storeMunicipality.prefectureFilterEnabledSet(
                event.target.checked,
                storePrefecture.selectorData.itemSelectedIdList,
              )}
            />
            <span>都道府県の選択で市区町村候補を絞り込む</span>
          </label>

          <section className="selector-block" data-dropdown-keep-open-boundary={selectorMunicipalityId}>
            <div className="selector-block-title">
              <span className="selector-block-title-label">市区町村</span>
              {renderSelectorTitleControls(storeMunicipality, municipalityViewData, {
                clearSelectedText: 'クリア',
                clearSearchText: '入力クリア',
              })}
              {renderSelectorTitleHints(municipalityViewData)}
            </div>
            {renderSelector({
              selectorId: selectorMunicipalityId,
              selectorStore: storeMunicipality,
              viewData: municipalityViewData,
              config: {
                kindConfigList,
                isKindFilterShown: true,
                isKindIconShown: true,
                isPrefectureFilterShown: storeMunicipality.filterConfig.isPrefectureFilterEnabled
                  || storeMunicipality.prefectureFilterList.length > 0,
                isSelectedPrefectureBadgeShown: true,
                placeholderText: '市区町村を検索',
                selectedAriaLabel: '選択済み市区町村',
                clearSelectedText: 'クリア',
                clearSearchText: '入力クリア',
                dropdownKeepOpenBoundaryId: selectorMunicipalityId,
              },
            })}
          </section>

          {renderSelectedSummaryPanel()}
        </div>
      </div>
    </section>
  );
}

const ShikuchosonPanelObserved = observer(ShikuchosonPanel);

function DemoShikuchoson() {
  return (
    <section className="feature-panel shikuchoson-tabs-panel">
      <TabsOnTop
        defaultTab="shikuchoson"
        defaultKeepMounted={false}
        autoSwitchToNewTab={false}
        defaultLineMode="single"
        allowLineModeSwitch={true}
      >
        <TabsOnTop.Tab tabKey="shikuchoson" label="市区町村検索" keepMounted>
          <ShikuchosonPanelObserved />
        </TabsOnTop.Tab>
        <TabsOnTop.Tab tabKey="tile-map" label="Tile Map" keepMounted={false}>
          <DemoMapBlock />
        </TabsOnTop.Tab>
      </TabsOnTop>
    </section>
  );
}

export default DemoShikuchoson;