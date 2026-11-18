import { StoreConfig } from './storeConfig.js';
import { StoreMunicipality } from './storeMunicipality.js';
import { StorePrefecture } from './storePrefecture.js';
import { StoreRegion } from './storeRegion.js';

// The stores of one selector block (doc/shikuchoson.md#stores-and-their-wiring): the region,
// prefecture and municipality selectors and the settings, made together for each block, and the
// wiring between them. Each selector is the truth of its own selection; what one needs of another
// goes through the events below:
//
//   regions selected        -> the prefectures offered (when "絞り込む" is on)
//   prefectures selected    -> the prefecture filter of the municipalities (when on)
//   a filter tag removed or restored in the municipality selector
//                           -> parentItemRemoveRequest / parentItemSelectedEnsureRequest to the prefectures
export class ShikuchosonStore {
  constructor() {
    this.storeConfig = new StoreConfig();
    this.storePrefecture = new StorePrefecture();
    this.storeMunicipality = new StoreMunicipality(this.storePrefecture);
    this.storeRegion = new StoreRegion();
    this.storePrefecture.selectorAvailableItemIdListSet(this.getPrefectureIdListAvailableFromRegion());
    for (const name of [
      'syncMunicipalityFromPrefectureIfNeeded',
      'getPrefectureIdListAvailableFromRegion',
      'syncPrefectureAvailableListFromRegionIfNeeded',
      'handlePrefectureStoreEvent',
      'handleMunicipalityStoreEvent',
      'getSelectorData',
      'handleSelectorEvent',
      'handleRegionSelectorEvent',
      'handleRegionFilterEnabledChange',
      'storeEventHandlerAttach',
    ]) this[name] = this[name].bind(this);
  }

  // the store events of the selectors, listened to while the block is mounted
  storeEventHandlerAttach() {
    this.storePrefecture.selectorEventHandlerSet(this.handlePrefectureStoreEvent);
    this.storeMunicipality.selectorEventHandlerSet(this.handleMunicipalityStoreEvent);
    return () => {
      this.storePrefecture.selectorEventHandlerSet(null);
      this.storeMunicipality.selectorEventHandlerSet(null);
    };
  }

  syncMunicipalityFromPrefectureIfNeeded() {
    const { storeMunicipality, storePrefecture } = this;
    if (storeMunicipality.filterConfig.isPrefectureFilterEnabled) {
      storeMunicipality.prefectureFilterSyncFromPrefectureSelection(storePrefecture.selectorData.itemSelectedIdList);
    }
  }

  getPrefectureIdListAvailableFromRegion() {
    const { storePrefecture, storeRegion } = this;
    const regionSelectedIdList = storeRegion.itemSelectedIdList;
    return storePrefecture.prefectureIdList.filter((prefectureId) => (
      regionSelectedIdList.includes(storePrefecture.prefectureItemById[prefectureId]?.regionId)
    ));
  }

  syncPrefectureAvailableListFromRegionIfNeeded() {
    const { storePrefecture } = this;
    if (storePrefecture.selectorData.availableItemIdList === null) return;
    storePrefecture.selectorAvailableItemIdListSet(this.getPrefectureIdListAvailableFromRegion());
  }

  handlePrefectureStoreEvent(eventType) {
    if (eventType === 'selectionChange') this.syncMunicipalityFromPrefectureIfNeeded();
  }

  handleMunicipalityStoreEvent(eventType, eventData) {
    const { storePrefecture } = this;
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

  getSelectorData(selectorStore, itemById, resultIdListGet, options = {}) {
    const { storeConfig } = this;
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

  handleSelectorEvent(selectorStore, eventType, eventData) {
    const { storeMunicipality, storePrefecture } = this;
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

  handleRegionSelectorEvent(eventType, eventData) {
    const { storeConfig, storeRegion } = this;
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
    this.syncPrefectureAvailableListFromRegionIfNeeded();
    this.syncMunicipalityFromPrefectureIfNeeded();
    return { code: 0 };
  }

  handleRegionFilterEnabledChange(isEnabled) {
    this.storePrefecture.selectorAvailableItemIdListSet(isEnabled ? this.getPrefectureIdListAvailableFromRegion() : null);
    this.syncMunicipalityFromPrefectureIfNeeded();
  }
}

export function shikuchosonStoreCreate() {
  return new ShikuchosonStore();
}
