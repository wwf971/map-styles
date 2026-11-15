import { action, makeObservable, observable } from 'mobx';
import { normalizeSearchBundle } from './storePrefecture.js';
import { prefectureRegionList } from './prefectureRegionConfig.js';

class StoreRegion {
  regionItemById = {};
  regionIdList = [];
  itemSelectedIdList = [];

  constructor() {
    this.loadRegionData(prefectureRegionList);
    this.itemSelectedIdList = [...this.regionIdList];
    makeObservable(this, {
      regionItemById: observable,
      regionIdList: observable,
      itemSelectedIdList: observable,
      loadRegionData: action.bound,
      itemToggle: action.bound,
      itemRemove: action.bound,
      itemReorder: action.bound,
      selectedAll: action.bound,
      selectedClear: action.bound,
      resultIdList: action.bound,
    });
  }

  loadRegionData(itemList) {
    this.regionItemById = {};
    this.regionIdList = [];
    itemList.forEach((item) => {
      const itemPrepared = {
        id: item.id,
        displayName: item.label,
        nameCompact: item.label,
        prefectureLabelList: item.prefectureLabelList || [],
        regionId: item.id,
        regionLabel: item.label,
        regionColorName: item.colorName,
        regionColorValue: item.colorValue,
        searchText: `${item.label} ${item.prefectureLabelList?.join(' ') || ''}`,
        searchTextNormalized: normalizeSearchBundle(`${item.label} ${item.prefectureLabelList?.join(' ') || ''}`),
      };
      this.regionItemById[item.id] = itemPrepared;
      this.regionIdList.push(item.id);
    });
  }

  itemToggle(itemId) {
    if (this.itemSelectedIdList.includes(itemId)) {
      this.itemSelectedIdList = this.itemSelectedIdList.filter((id) => id !== itemId);
    } else {
      this.itemSelectedIdList.push(itemId);
    }
  }

  itemRemove(itemId) {
    this.itemSelectedIdList = this.itemSelectedIdList.filter((id) => id !== itemId);
  }

  itemReorder(itemIdDragged, itemIdTarget, insertPosition = 'before') {
    if (!itemIdDragged || !itemIdTarget || itemIdDragged === itemIdTarget) return;
    const regionIdListNext = this.regionIdList.filter((id) => id !== itemIdDragged);
    const targetIndex = regionIdListNext.indexOf(itemIdTarget);
    if (targetIndex < 0) return;
    const insertIndex = insertPosition === 'after' ? targetIndex + 1 : targetIndex;
    regionIdListNext.splice(insertIndex, 0, itemIdDragged);
    this.regionIdList = regionIdListNext;
  }

  selectedAll() {
    this.itemSelectedIdList = [...this.regionIdList];
  }

  selectedClear() {
    this.itemSelectedIdList = [];
  }

  resultIdList() {
    return [...this.regionIdList];
  }
}

export const storeRegion = new StoreRegion();

export default StoreRegion;
