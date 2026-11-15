import { makeAutoObservable } from 'mobx';
import { prefectureRegionList } from './prefectureRegionConfig.js';
import { japanPrefectureTileGridMap } from '../map-block/config/prefectureTileGridMapJp.ts';

function normalizeColorValue(value, fallback = '#dbeafe') {
  const valueText = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(valueText)) return valueText;
  return fallback;
}

class StoreConfig {
  isRegionColorEditorOpen = false;
  regionColorById = Object.fromEntries(
    prefectureRegionList.map((region) => [region.id, region.colorValue]),
  );

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get regionList() {
    return prefectureRegionList.map((region) => ({
      ...region,
      colorValue: this.getRegionColorValue(region.id),
    }));
  }

  get regionById() {
    return Object.fromEntries(this.regionList.map((region) => [region.id, region]));
  }

  get regionByPrefectureLabel() {
    return Object.fromEntries(
      this.regionList.flatMap((region) => (
        region.prefectureLabelList.map((prefectureLabel) => [prefectureLabel, region])
      )),
    );
  }

  regionColorApplyToItem(item) {
    if (!item?.regionId) return item;
    return {
      ...item,
      regionColorValue: this.getRegionColorValue(item.regionId),
    };
  }

  regionColorApplyToItemList(itemList) {
    return (itemList || []).map((item) => this.regionColorApplyToItem(item));
  }

  get prefectureMapData() {
    return {
      ...japanPrefectureTileGridMap,
      components: japanPrefectureTileGridMap.components.map((component) => {
        if (component.compType !== 'group' || !String(component.id).startsWith('group-')) return component;
        const regionId = String(component.id).replace(/^group-/, '');
        return {
          ...component,
          metadata: {
            ...(component.metadata || {}),
            color: this.getRegionColorValue(regionId),
          },
        };
      }),
    };
  }

  get propEditorData() {
    const propertyById = Object.fromEntries(
      this.regionList.map((region) => [
        `regionColor.${region.id}`,
        {
          id: `regionColor.${region.id}`,
          label: region.label,
          valueType: 'color',
          value: this.getRegionColorValue(region.id),
        },
      ]),
    );
    return {
      propertyById,
      panelList: this.regionList.map((region) => ({
        id: `regionColor.${region.id}`,
        type: 'property',
      })),
    };
  }

  getRegionColorValue(regionId) {
    const regionDefault = prefectureRegionList.find((region) => region.id === regionId);
    return normalizeColorValue(this.regionColorById[regionId], regionDefault?.colorValue || '#dbeafe');
  }

  regionColorSet(regionId, colorValue) {
    if (!this.regionColorById[regionId]) return { code: -1, message: 'Unknown region' };
    this.regionColorById[regionId] = normalizeColorValue(colorValue, this.regionColorById[regionId]);
    return { code: 0 };
  }

  regionColorEditorOpenSet(isOpen) {
    this.isRegionColorEditorOpen = Boolean(isOpen);
  }

  handlePropEditorEvent(eventType, eventData = {}) {
    if (eventType !== 'propertyChangeAttempt') return { code: 0 };
    const propertyPath = String(eventData.propertyPath || '');
    const regionId = propertyPath.replace(/^regionColor\./, '');
    return this.regionColorSet(regionId, eventData.valueNext);
  }
}

export const storeConfig = new StoreConfig();
export default StoreConfig;
 