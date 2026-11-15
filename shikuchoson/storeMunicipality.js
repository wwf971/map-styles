import { action, computed, makeObservable, observable } from 'mobx';
import { configShikuchoson } from './configShikuchoson.js';
import designatedCitiesData from './municipalities.designatedCities.json';
import prefecturalCapitalsData from './municipalities.prefecturalCapitals.json';
import municipalitiesData from './municipalities.json';
import municipalitySearchEnhancementsData from './municipalities.searchEnhancements.json';
import { normalizeSearchBundle, SelectorStoreBase, storePrefecture } from './storePrefecture.js';

export const kindConfigList = [
  { kind: 'city', label: '市', text: '市', className: 'city' },
  { kind: 'ward', label: '区', text: '区', className: 'ward' },
  { kind: 'town', label: '町', text: '町', className: 'town' },
  { kind: 'village', label: '村', text: '村', className: 'village' },
];

class StoreMunicipality extends SelectorStoreBase {
  municipalityItemById = {};
  municipalityIdList = [];
  specialFilterDefinitionList = [];
  filterConfig = {
    isPrefectureFilterEnabled: true,
    prefectureFilterIdList: [],
    prefectureFilterInactiveIdList: [],
    activeSpecialFilterIdList: [],
    displayMode: configShikuchoson.municipalityFilterDisplayModeDefault === 'wrap' ? 'wrap' : 'single',
  };

  constructor() {
    super();
    this.selectorData.dropdownDisplayMode = 'compact';
    this.loadMunicipalityData(municipalitiesData.items || []);
    const filterDataList = [
      configShikuchoson.isDesignatedCityFilterEnabled ? designatedCitiesData : null,
      configShikuchoson.isPrefecturalCapitalFilterEnabled ? prefecturalCapitalsData : null,
    ].filter(Boolean);
    this.loadSpecialFilterData(filterDataList);
    makeObservable(this, {
      selectorData: observable,
      onEvent: observable.ref,
      municipalityItemById: observable,
      municipalityIdList: observable,
      specialFilterDefinitionList: observable,
      filterConfig: observable,
      selectorEventHandlerSet: action.bound,
      selectorEventEmit: action.bound,
      isSelectorItemAvailable: action.bound,
      selectorAvailableItemIdListSet: action.bound,
      selectorSelectedSyncToAvailableList: action.bound,
      loadMunicipalityData: action.bound,
      loadSpecialFilterData: action.bound,
      getMunicipalityIdListByPrefectureFilter: action.bound,
      prefectureFilterAvailableListApply: action.bound,
      prefectureFilterEnabledSet: action.bound,
      filterDisplayModeToggle: action.bound,
      specialFilterToggle: action.bound,
      specialFilterList: computed,
      prefectureFilterSyncFromPrefectureSelection: action.bound,
      prefectureFilterDeactivate: action.bound,
      prefectureFilterRemove: action.bound,
      prefectureFilterActivate: action.bound,
      prefectureFilterActiveIdListGet: action.bound,
      prefectureFilterReorder: action.bound,
      prefectureFilterList: computed,
      selectedSyncToFilterRange: action.bound,
      isMunicipalityPassPrefectureFilter: action.bound,
      isMunicipalityPassSpecialFilters: action.bound,
      isMunicipalityPassActiveFilters: action.bound,
      resultIdList: action.bound,
      selectorEnsure: action.bound,
      selectorOpenSet: action.bound,
      selectorSearchTextSet: action.bound,
      selectorSearchTextClear: action.bound,
      selectorSelectedClear: action.bound,
      selectorKindToggle: action.bound,
      selectorItemSelect: action.bound,
      selectorItemToggle: action.bound,
      selectorItemIdListToggle: action.bound,
      selectorItemIdListSet: action.bound,
      selectorItemRemove: action.bound,
      selectorItemSelectedEnsure: action.bound,
      selectorLastItemRemove: action.bound,
      selectorTagScrollSet: action.bound,
      selectorScrollToEndRequest: action.bound,
      selectorSearchDisplayModeToggle: action.bound,
      selectorDropdownDisplayModeSet: action.bound,
      selectorDropdownListColCountSet: action.bound,
      selectorDragStateGet: action.bound,
      selectorDragStart: action.bound,
      selectorDragPreviewSingleLine: action.bound,
      selectorDragPreviewWrap: action.bound,
      selectorDragDrop: action.bound,
      selectorDragScrollHoverSet: action.bound,
      selectorDragCancelHoverSet: action.bound,
      selectorDragClear: action.bound,
    });
  }

  loadMunicipalityData(itemList) {
    this.municipalityItemById = {};
    this.municipalityIdList = [];
    const searchEnhancementById = Object.fromEntries(
      (municipalitySearchEnhancementsData.items || []).map((item) => [item.municipalityId, item.searchText || '']),
    );
    itemList.forEach((item) => {
      const prefectureId = String(item.id).slice(0, 2);
      const prefectureItem = storePrefecture.prefectureItemById[prefectureId] || null;
      const displayName = String(item.displayName || '');
      const searchText = [item.searchText, searchEnhancementById[item.id]].filter(Boolean).join(' ');
      const nameCompact = prefectureItem?.displayName && displayName.startsWith(prefectureItem.displayName)
        ? displayName.slice(prefectureItem.displayName.length)
        : displayName;
      const itemPrepared = {
        ...item,
        nameCompact,
        prefectureId,
        prefectureLabel: prefectureItem?.prefectureLabel || '',
        regionId: prefectureItem?.regionId || null,
        regionLabel: prefectureItem?.regionLabel || null,
        regionColorName: prefectureItem?.regionColorName || null,
        regionColorValue: prefectureItem?.regionColorValue || null,
        searchText,
        searchTextNormalized: normalizeSearchBundle(searchText),
      };
      this.municipalityItemById[item.id] = itemPrepared;
      this.municipalityIdList.push(item.id);
    });
  }

  loadSpecialFilterData(filterDataList) {
    this.specialFilterDefinitionList = filterDataList.map((filterData) => {
      const municipalityIdSet = new Set(
        (filterData.items || []).flatMap((group) => group.municipalityIdList || []),
      );
      return {
        id: filterData.id,
        label: filterData.label,
        itemCount: municipalityIdSet.size,
        groupList: filterData.items || [],
        predicate: (item) => municipalityIdSet.has(item.id),
      };
    });
  }

  getMunicipalityIdListByPrefectureFilter() {
    if (!this.filterConfig.isPrefectureFilterEnabled) return null;
    const prefectureFilterActiveIdList = this.filterConfig.prefectureFilterIdList
      .filter((prefectureId) => !this.filterConfig.prefectureFilterInactiveIdList.includes(prefectureId));
    return this.municipalityIdList.filter((itemId) => (
      prefectureFilterActiveIdList.includes(this.municipalityItemById[itemId]?.prefectureId)
    ));
  }

  prefectureFilterAvailableListApply() {
    this.selectorAvailableItemIdListSet(this.getMunicipalityIdListByPrefectureFilter());
    this.selectedSyncToFilterRange();
  }

  prefectureFilterEnabledSet(isEnabled, prefectureIdList = this.filterConfig.prefectureFilterIdList) {
    this.filterConfig.isPrefectureFilterEnabled = Boolean(isEnabled);
    if (this.filterConfig.isPrefectureFilterEnabled) {
      this.prefectureFilterSyncFromPrefectureSelection(prefectureIdList);
    } else {
      this.filterConfig.prefectureFilterIdList = [];
      this.filterConfig.prefectureFilterInactiveIdList = [];
      this.prefectureFilterAvailableListApply();
    }
  }

  filterDisplayModeToggle() {
    this.filterConfig.displayMode = this.filterConfig.displayMode === 'wrap' ? 'single' : 'wrap';
  }

  specialFilterToggle(filterId) {
    if (this.filterConfig.activeSpecialFilterIdList.includes(filterId)) {
      this.filterConfig.activeSpecialFilterIdList = this.filterConfig.activeSpecialFilterIdList
        .filter((itemId) => itemId !== filterId);
    } else {
      this.filterConfig.activeSpecialFilterIdList.push(filterId);
    }
    this.selectedSyncToFilterRange();
  }

  selectorKindToggle(kind) {
    const isEnabledNext = !this.selectorData.kindEnabledByKind[kind];
    this.selectorData.kindEnabledByKind[kind] = isEnabledNext;
    if (!isEnabledNext) {
      const itemSelectedIdListNext = this.selectorData.itemSelectedIdList.filter((itemId) => (
        this.municipalityItemById[itemId]?.kind !== kind
      ));
      if (itemSelectedIdListNext.length !== this.selectorData.itemSelectedIdList.length) {
        this.selectorData.itemSelectedIdList = itemSelectedIdListNext;
        this.selectorDragClear();
        this.selectorScrollToEndRequest();
      }
    }
  }

  get specialFilterList() {
    return this.specialFilterDefinitionList.map((item) => ({
      id: item.id,
      label: item.label,
      itemCount: item.itemCount,
      isActive: this.filterConfig.activeSpecialFilterIdList.includes(item.id),
    }));
  }

  prefectureFilterSyncFromPrefectureSelection(prefectureIdList = []) {
    if (!this.filterConfig.isPrefectureFilterEnabled) return;
    const prefectureIdListSelected = Array.from(new Set((prefectureIdList || []).filter(Boolean)));
    const prefectureIdSelectedSet = new Set(prefectureIdListSelected);
    const prefectureFilterInactiveIdListNext = this.filterConfig.prefectureFilterInactiveIdList
      .filter((prefectureId) => !prefectureIdSelectedSet.has(prefectureId)
        && this.filterConfig.prefectureFilterIdList.includes(prefectureId));
    const prefectureFilterIdListNext = [];
    const prefectureFilterIdNextSet = new Set();
    const appendFilterId = (prefectureId) => {
      if (!prefectureId || prefectureFilterIdNextSet.has(prefectureId)) return;
      prefectureFilterIdNextSet.add(prefectureId);
      prefectureFilterIdListNext.push(prefectureId);
    };
    this.filterConfig.prefectureFilterIdList.forEach((prefectureId) => {
      if (prefectureIdSelectedSet.has(prefectureId) || prefectureFilterInactiveIdListNext.includes(prefectureId)) {
        appendFilterId(prefectureId);
      }
    });
    prefectureIdListSelected.forEach(appendFilterId);
    prefectureFilterInactiveIdListNext.forEach(appendFilterId);
    this.filterConfig.prefectureFilterIdList = prefectureFilterIdListNext;
    this.filterConfig.prefectureFilterInactiveIdList = prefectureFilterInactiveIdListNext;
    this.prefectureFilterAvailableListApply();
  }

  prefectureFilterDeactivate(prefectureId) {
    if (!this.filterConfig.prefectureFilterIdList.includes(prefectureId)) return;
    if (!this.filterConfig.prefectureFilterInactiveIdList.includes(prefectureId)) {
      this.filterConfig.prefectureFilterInactiveIdList.push(prefectureId);
    }
    if (this.filterConfig.isPrefectureFilterEnabled) {
      this.selectorEventEmit('parentItemRemoveRequest', { itemId: prefectureId });
      this.prefectureFilterAvailableListApply();
    }
  }

  prefectureFilterRemove(prefectureId) {
    this.filterConfig.prefectureFilterIdList = this.filterConfig.prefectureFilterIdList
      .filter((itemId) => itemId !== prefectureId);
    this.filterConfig.prefectureFilterInactiveIdList = this.filterConfig.prefectureFilterInactiveIdList
      .filter((itemId) => itemId !== prefectureId);
    if (this.filterConfig.isPrefectureFilterEnabled) {
      this.selectorEventEmit('parentItemRemoveRequest', { itemId: prefectureId });
      this.prefectureFilterAvailableListApply();
    }
  }

  prefectureFilterActivate(prefectureId) {
    if (!prefectureId) return;
    if (!this.filterConfig.prefectureFilterIdList.includes(prefectureId)) {
      this.filterConfig.prefectureFilterIdList.push(prefectureId);
    }
    this.filterConfig.prefectureFilterInactiveIdList = this.filterConfig.prefectureFilterInactiveIdList
      .filter((itemId) => itemId !== prefectureId);
    if (this.filterConfig.isPrefectureFilterEnabled) {
      this.selectorEventEmit('parentItemSelectedEnsureRequest', {
        itemId: prefectureId,
        itemIdList: this.prefectureFilterActiveIdListGet(),
      });
      this.prefectureFilterAvailableListApply();
    }
  }

  prefectureFilterActiveIdListGet() {
    return this.filterConfig.prefectureFilterIdList
      .filter((itemId) => !this.filterConfig.prefectureFilterInactiveIdList.includes(itemId));
  }

  prefectureFilterReorder(prefectureIdDragged, prefectureIdTarget, insertPosition = 'before') {
    if (!prefectureIdDragged || !prefectureIdTarget || prefectureIdDragged === prefectureIdTarget) return;
    const filterIdListWithoutDragged = this.filterConfig.prefectureFilterIdList
      .filter((itemId) => itemId !== prefectureIdDragged);
    const targetIndex = filterIdListWithoutDragged.indexOf(prefectureIdTarget);
    if (targetIndex < 0) return;
    const insertIndex = insertPosition === 'after' ? targetIndex + 1 : targetIndex;
    filterIdListWithoutDragged.splice(insertIndex, 0, prefectureIdDragged);
    this.filterConfig.prefectureFilterIdList = filterIdListWithoutDragged;
    if (this.filterConfig.isPrefectureFilterEnabled) {
      this.selectorEventEmit('parentItemSelectedEnsureRequest', {
        itemIdList: this.prefectureFilterActiveIdListGet(),
        itemIdFocus: prefectureIdDragged,
      });
    }
  }

  get prefectureFilterList() {
    return this.filterConfig.prefectureFilterIdList
      .map((itemId) => {
        const item = storePrefecture.prefectureItemById[itemId];
        if (!item) return null;
        return {
          ...item,
          isActive: this.filterConfig.isPrefectureFilterEnabled
            && !this.filterConfig.prefectureFilterInactiveIdList.includes(itemId),
        };
      })
      .filter(Boolean);
  }

  selectedSyncToFilterRange() {
    this.selectorData.itemSelectedIdList = this.selectorData.itemSelectedIdList.filter((itemId) => (
      this.isMunicipalityPassActiveFilters(itemId)
    ));
    this.selectorDragClear();
    this.selectorScrollToEndRequest();
  }

  isMunicipalityPassPrefectureFilter(itemId) {
    return this.isSelectorItemAvailable(itemId);
  }

  isMunicipalityPassSpecialFilters(itemId) {
    const activeFilterIdList = this.filterConfig.activeSpecialFilterIdList;
    if (activeFilterIdList.length === 0) return true;
    const item = this.municipalityItemById[itemId];
    if (!item) return false;
    return activeFilterIdList.every((filterId) => {
      const filterDefinition = this.specialFilterDefinitionList.find((filter) => filter.id === filterId);
      return filterDefinition?.predicate(item) === true;
    });
  }

  isMunicipalityPassActiveFilters(itemId) {
    return this.isMunicipalityPassPrefectureFilter(itemId)
      && this.isMunicipalityPassSpecialFilters(itemId);
  }

  resultIdList() {
    const queryNormalized = normalizeSearchBundle(this.selectorData.searchText);
    const queryPartList = queryNormalized.split(' ').filter(Boolean);

    if (queryPartList.length === 0) {
      const resultIdList = this.municipalityIdList
        .filter((itemId) => {
          const item = this.municipalityItemById[itemId];
          if (!this.isMunicipalityPassActiveFilters(itemId)) return false;
          return this.selectorData.kindEnabledByKind[item.kind];
        });
      return resultIdList;
    }

    return this.municipalityIdList
      .filter((itemId) => {
        const item = this.municipalityItemById[itemId];
        if (!this.isMunicipalityPassActiveFilters(itemId)) return false;
        if (!this.selectorData.kindEnabledByKind[item.kind]) return false;
        return queryPartList.some((queryPart) => item.searchTextNormalized.includes(queryPart));
      })
      .slice(0, 80);
  }
}

export const storeMunicipality = new StoreMunicipality();

export default StoreMunicipality;