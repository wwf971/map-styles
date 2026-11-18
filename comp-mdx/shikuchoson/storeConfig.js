import { makeAutoObservable, observable } from 'mobx';
import { prefectureRegionList } from './prefectureRegionConfig.js';

function normalizeColorValue(value, fallback = '#dbeafe') {
  const valueText = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(valueText)) return valueText;
  return fallback;
}

// the settings of one selector block: the colors of the regions, and the tile map of the
// prefectures it draws (an asset of the frontend object, given by the mode: mapDataSet)
export class StoreConfig {
  isRegionColorEditorOpen = false;
  mapData = null;
  regionColorById = Object.fromEntries(
    prefectureRegionList.map((region) => [region.id, region.colorValue]),
  );

  constructor() {
    makeAutoObservable(this, { mapData: observable.ref }, { autoBind: true });
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

  mapDataSet(mapData) {
    this.mapData = mapData || null;
  }

  // the map with the colors of the regions: a group named group-{regionId} takes its region's
  get prefectureMapData() {
    if (!this.mapData) return null;
    return {
      ...this.mapData,
      compList: this.mapData.compList.map((component) => {
        if (component.kind !== 'group' || !String(component.id).startsWith('group-')) return component;
        const regionId = String(component.id).replace(/^group-/, '');
        return {
          ...component,
          color: this.getRegionColorValue(regionId),
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

export default StoreConfig;
 