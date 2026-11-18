import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import MunicipalitySelector from './MunicipalitySelector.jsx';
import RegionSelector from './RegionSelector.jsx';
import ShikuchosonConfigPopup from './ShikuchosonConfigPopup.jsx';
import SettingsIcon from './SettingsIcon.jsx';
import { ShikuchosonStore } from './ShikuchosonStore.js';
import { kindConfigList } from './storeMunicipality.js';
import { prefectureKindConfigList } from './storePrefecture.js';
import { mapBlockAssetListGet, mapBlockAssetRead } from '../map-block/MapBlockObject.js';

// The mode "selector" of a frontend object of the type shikuchoson.jp (doc/shikuchoson.md): the
// selectors of regions, prefectures (with a map of them) and municipalities, working together.
// The map of the prefectures is a block map of the object, edited by its mode "editor":
//
//   param.map    the map of the prefectures: an asset reference; absent, the object's
//                metadata.mapPrefecture, else its first map
//
// The selections are the reader's while the page is open; nothing is written.

const selectorMunicipalityId = 'municipality-main';
const selectorPrefectureId = 'prefecture-main';

export const ShikuchosonSelector = observer(function ShikuchosonSelector({ data = {}, config = {} }) {
  const service = config.objectFrontend;
  const [shikuchoson] = useState(() => new ShikuchosonStore());
  const param = data.param ?? {};
  const mapRef = param.map || service?.object?.metadata?.mapPrefecture || mapBlockAssetListGet(service)[0]?.key || '';
  const read = service && mapRef ? mapBlockAssetRead(service, mapRef) : null;
  const mapData = read?.status === 'done' ? read.data : null;

  useEffect(() => {
    shikuchoson.storeConfig.mapDataSet(mapData);
  }, [shikuchoson, mapData]);

  if (!service) return <p className="doc-error">ShikuchosonSelector is a mode of a frontend object (ObjectFrontend).</p>;
  return (
    <div className="shikuchoson-object not-prose">
      {read?.status === 'error' ? <p className="doc-error">{`The map of the prefectures cannot be read: ${read.message}`}</p> : null}
      {!mapRef ? <p className="doc-error">The object has no map of the prefectures: its mode Editor makes one.</p> : null}
      <ShikuchosonPanelObserved shikuchoson={shikuchoson} />
    </div>
  );
});

// the region, prefecture and municipality selectors of one block, and the summary of what they
// hold. everything it shows and changes is in the stores of the block (ShikuchosonStore.js)
function ShikuchosonPanel({ shikuchoson }) {
  const { storeConfig, storeMunicipality, storePrefecture, storeRegion } = shikuchoson;
  const { getSelectorData, handleRegionFilterEnabledChange, handleRegionSelectorEvent, handleSelectorEvent } = shikuchoson;
  useEffect(() => shikuchoson.storeEventHandlerAttach(), [shikuchoson]);
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
                  prefectureDropdownConfig: {
                    regionList: storeConfig.regionList,
                    mapData: storeConfig.prefectureMapData,
                  },
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

export { ShikuchosonPanelObserved as ShikuchosonPanel };
export default ShikuchosonSelector;
