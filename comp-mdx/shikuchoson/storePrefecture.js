import { action, makeObservable, observable } from 'mobx';
import { prefectureRegionByLabel } from './prefectureRegionConfig.js';

const prefectureSourceList = [
  ['01', '北海道', 'ほっかいどう', '道'],
  ['02', '青森県', 'あおもりけん', '県'],
  ['03', '岩手県', 'いわてけん', '県'],
  ['04', '宮城県', 'みやぎけん', '県'],
  ['05', '秋田県', 'あきたけん', '県'],
  ['06', '山形県', 'やまがたけん', '県'],
  ['07', '福島県', 'ふくしまけん', '県'],
  ['08', '茨城県', 'いばらきけん', '県'],
  ['09', '栃木県', 'とちぎけん', '県'],
  ['10', '群馬県', 'ぐんまけん', '県'],
  ['11', '埼玉県', 'さいたまけん', '県'],
  ['12', '千葉県', 'ちばけん', '県'],
  ['13', '東京都', 'とうきょうと', '都'],
  ['14', '神奈川県', 'かながわけん', '県'],
  ['15', '新潟県', 'にいがたけん', '県'],
  ['16', '富山県', 'とやまけん', '県'],
  ['17', '石川県', 'いしかわけん', '県'],
  ['18', '福井県', 'ふくいけん', '県'],
  ['19', '山梨県', 'やまなしけん', '県'],
  ['20', '長野県', 'ながのけん', '県'],
  ['21', '岐阜県', 'ぎふけん', '県'],
  ['22', '静岡県', 'しずおかけん', '県'],
  ['23', '愛知県', 'あいちけん', '県'],
  ['24', '三重県', 'みえけん', '県'],
  ['25', '滋賀県', 'しがけん', '県'],
  ['26', '京都府', 'きょうとふ', '府'],
  ['27', '大阪府', 'おおさかふ', '府'],
  ['28', '兵庫県', 'ひょうごけん', '県'],
  ['29', '奈良県', 'ならけん', '県'],
  ['30', '和歌山県', 'わかやまけん', '県'],
  ['31', '鳥取県', 'とっとりけん', '県'],
  ['32', '島根県', 'しまねけん', '県'],
  ['33', '岡山県', 'おかやまけん', '県'],
  ['34', '広島県', 'ひろしまけん', '県'],
  ['35', '山口県', 'やまぐちけん', '県'],
  ['36', '徳島県', 'とくしまけん', '県'],
  ['37', '香川県', 'かがわけん', '県'],
  ['38', '愛媛県', 'えひめけん', '県'],
  ['39', '高知県', 'こうちけん', '県'],
  ['40', '福岡県', 'ふくおかけん', '県'],
  ['41', '佐賀県', 'さがけん', '県'],
  ['42', '長崎県', 'ながさきけん', '県'],
  ['43', '熊本県', 'くまもとけん', '県'],
  ['44', '大分県', 'おおいたけん', '県'],
  ['45', '宮崎県', 'みやざきけん', '県'],
  ['46', '鹿児島県', 'かごしまけん', '県'],
  ['47', '沖縄県', 'おきなわけん', '県'],
];

export const prefectureKindConfigList = [
  { kind: 'prefecture', label: '都道府県', text: '県', className: 'prefecture' },
];

function hiraganaToKatakana(value) {
  return Array.from(value || '').map((char) => {
    const codePoint = char.charCodeAt(0);
    if (codePoint >= 0x3041 && codePoint <= 0x3096) {
      return String.fromCharCode(codePoint + 0x60);
    }
    return char;
  }).join('');
}

export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\u3000\-ー]/g, '');
}

export function normalizeSearchBundle(value) {
  const textNormalized = normalizeSearchText(value);
  const textKatakana = normalizeSearchText(hiraganaToKatakana(value));
  return textNormalized === textKatakana ? textNormalized : `${textNormalized} ${textKatakana}`;
}

function getPrefectureLabelShort(displayName) {
  if (displayName === '北海道') return displayName;
  return String(displayName || '').replace(/[都道府県]$/, '');
}

function createDragStateBase() {
  return {
    isDragging: false,
    itemDraggedId: null,
    itemTargetId: null,
    insertPosition: null,
    isCancelDropHover: false,
  };
}

function createSingleLineDragState() {
  return {
    ...createDragStateBase(),
    indicatorLeftPx: null,
    isScrollLeftHover: false,
    isScrollRightHover: false,
    scrollStepPx: 24,
    scrollIntervalMs: 80,
  };
}

function createWrapDragState() {
  return {
    ...createDragStateBase(),
    indicatorLeftPx: null,
    indicatorTopPx: null,
    indicatorHeightPx: null,
  };
}

function createSelectorData() {
  return {
    searchText: '',
    itemSelectedIdList: [],
    isOpen: false,
    dropdownDisplayMode: 'list',
    dropdownListColCount: 1,
    searchDisplayMode: 'single',
    tagScrollState: {
      isOverflow: false,
      scrollLeft: 0,
      scrollWidth: 0,
      clientWidth: 0,
      scrollRequestId: 0,
      scrollRequestType: 'end',
      scrollRequestLeft: 0,
      scrollRequestItemId: null,
    },
    dragStateByMode: {
      single: createSingleLineDragState(),
      wrap: createWrapDragState(),
    },
    kindEnabledByKind: {
      city: true,
      ward: true,
      town: true,
      village: true,
    },
    availableItemIdList: null,
  };
}

function resetSingleLineDragState(dragState) {
  dragState.isDragging = false;
  dragState.itemDraggedId = null;
  dragState.itemTargetId = null;
  dragState.insertPosition = null;
  dragState.isCancelDropHover = false;
  dragState.indicatorLeftPx = null;
  dragState.isScrollLeftHover = false;
  dragState.isScrollRightHover = false;
}

function resetWrapDragState(dragState) {
  dragState.isDragging = false;
  dragState.itemDraggedId = null;
  dragState.itemTargetId = null;
  dragState.insertPosition = null;
  dragState.isCancelDropHover = false;
  dragState.indicatorLeftPx = null;
  dragState.indicatorTopPx = null;
  dragState.indicatorHeightPx = null;
}

function getDragModeSafe(dragMode) {
  return dragMode === 'wrap' ? 'wrap' : 'single';
}

export class SelectorStoreBase {
  selectorData = createSelectorData();
  onEvent = null;

  selectorEventHandlerSet(onEvent) {
    this.onEvent = typeof onEvent === 'function' ? onEvent : null;
  }

  selectorEventEmit(eventType, eventData = {}) {
    if (this.onEvent) this.onEvent(eventType, eventData);
  }

  isSelectorItemAvailable(itemId) {
    if (this.selectorData.availableItemIdList === null) return true;
    return this.selectorData.availableItemIdList.includes(itemId);
  }

  selectorAvailableItemIdListSet(itemIdList) {
    this.selectorData.availableItemIdList = Array.isArray(itemIdList)
      ? Array.from(new Set(itemIdList.filter(Boolean)))
      : null;
    this.selectorSelectedSyncToAvailableList();
  }

  selectorSelectedSyncToAvailableList() {
    const itemSelectedIdListNext = this.selectorData.itemSelectedIdList.filter((itemId) => this.isSelectorItemAvailable(itemId));
    if (itemSelectedIdListNext.length !== this.selectorData.itemSelectedIdList.length) {
      this.selectorData.itemSelectedIdList = itemSelectedIdListNext;
      this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
    }
    this.selectorDragClear();
    this.selectorScrollToEndRequest();
  }

  selectorEnsure() {
    return this.selectorData;
  }

  selectorOpenSet(isOpen) {
    this.selectorData.isOpen = Boolean(isOpen);
  }

  selectorSearchTextSet(searchText) {
    this.selectorData.searchText = searchText;
    this.selectorData.isOpen = true;
    this.selectorScrollToEndRequest();
  }

  selectorSearchTextClear() {
    this.selectorData.searchText = '';
    this.selectorScrollToEndRequest();
  }

  selectorSelectedClear() {
    if (this.selectorData.itemSelectedIdList.length === 0) return;
    this.selectorData.itemSelectedIdList = [];
    this.selectorDragClear();
    this.selectorEventEmit('selectionChange', { itemSelectedIdList: [] });
  }

  selectorKindToggle(kind) {
    this.selectorData.kindEnabledByKind[kind] = !this.selectorData.kindEnabledByKind[kind];
  }

  selectorItemSelect(itemId) {
    if (!this.isSelectorItemAvailable(itemId)) return;
    if (!this.selectorData.itemSelectedIdList.includes(itemId)) {
      this.selectorData.itemSelectedIdList.push(itemId);
      this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
    }
    this.selectorData.isOpen = true;
    this.selectorScrollToEndRequest();
  }

  selectorItemToggle(itemId) {
    if (this.selectorData.itemSelectedIdList.includes(itemId)) {
      this.selectorData.itemSelectedIdList = this.selectorData.itemSelectedIdList.filter((id) => id !== itemId);
      this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
    } else {
      if (!this.isSelectorItemAvailable(itemId)) return;
      this.selectorData.itemSelectedIdList.push(itemId);
      this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
    }
    this.selectorData.isOpen = true;
    this.selectorScrollToEndRequest();
  }

  selectorItemIdListToggle(itemIdList) {
    const itemIdListSafe = Array.isArray(itemIdList) ? itemIdList.filter((itemId) => itemId && this.isSelectorItemAvailable(itemId)) : [];
    if (itemIdListSafe.length === 0) return;
    const itemSelectedIdSet = new Set(this.selectorData.itemSelectedIdList);
    const isAllSelected = itemIdListSafe.every((itemId) => itemSelectedIdSet.has(itemId));

    if (isAllSelected) {
      const itemIdRemoveSet = new Set(itemIdListSafe);
      this.selectorData.itemSelectedIdList = this.selectorData.itemSelectedIdList.filter((itemId) => !itemIdRemoveSet.has(itemId));
    } else {
      itemIdListSafe.forEach((itemId) => {
        if (!this.selectorData.itemSelectedIdList.includes(itemId)) {
          this.selectorData.itemSelectedIdList.push(itemId);
        }
      });
    }
    this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
    this.selectorData.isOpen = true;
    this.selectorScrollToEndRequest();
  }

  selectorItemIdListSet(itemIdList) {
    const itemIdListSafe = Array.isArray(itemIdList) ? itemIdList.filter((itemId) => itemId && this.isSelectorItemAvailable(itemId)) : [];
    this.selectorData.itemSelectedIdList = Array.from(new Set(itemIdListSafe));
    this.selectorData.isOpen = true;
    this.selectorScrollToEndRequest();
    this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
  }

  selectorItemRemove(itemId) {
    if (!this.selectorData.itemSelectedIdList.includes(itemId)) return;
    this.selectorData.itemSelectedIdList = this.selectorData.itemSelectedIdList.filter((id) => id !== itemId);
    this.selectorScrollToEndRequest();
    this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
  }

  selectorItemSelectedEnsure(itemId) {
    if (!this.isSelectorItemAvailable(itemId)) return;
    if (!this.selectorData.itemSelectedIdList.includes(itemId)) {
      this.selectorData.itemSelectedIdList.push(itemId);
      this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
    }
    this.selectorScrollToEndRequest();
  }

  selectorLastItemRemove() {
    if (this.selectorData.itemSelectedIdList.length === 0) return;
    this.selectorData.itemSelectedIdList.pop();
    this.selectorScrollToEndRequest();
    this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
  }

  selectorTagScrollSet(dataScroll) {
    const scrollState = this.selectorData.tagScrollState;
    scrollState.isOverflow = Boolean(dataScroll.isOverflow);
    scrollState.scrollLeft = Math.max(0, Number(dataScroll.scrollLeft) || 0);
    scrollState.scrollWidth = Math.max(0, Number(dataScroll.scrollWidth) || 0);
    scrollState.clientWidth = Math.max(0, Number(dataScroll.clientWidth) || 0);
  }

  selectorScrollToEndRequest() {
    const scrollState = this.selectorData.tagScrollState;
    const scrollLeftMax = Math.max(0, scrollState.scrollWidth - scrollState.clientWidth);
    scrollState.scrollRequestId += 1;
    scrollState.scrollRequestType = 'end';
    scrollState.scrollRequestLeft = scrollLeftMax;
    scrollState.scrollRequestItemId = null;
  }

  selectorSelectedItemCenterFocusRequest(itemId) {
    if (this.selectorData.searchDisplayMode !== 'single') return;
    if (!this.selectorData.itemSelectedIdList.includes(itemId)) return;
    const scrollState = this.selectorData.tagScrollState;
    scrollState.scrollRequestId += 1;
    scrollState.scrollRequestType = 'centerItem';
    scrollState.scrollRequestItemId = itemId;
  }

  selectorSearchDisplayModeToggle() {
    this.selectorDragClear();
    this.selectorData.searchDisplayMode = this.selectorData.searchDisplayMode === 'wrap' ? 'single' : 'wrap';
    this.selectorScrollToEndRequest();
  }

  selectorDropdownDisplayModeSet(displayMode) {
    this.selectorData.dropdownDisplayMode = ['map', 'region', 'compact', 'list'].includes(displayMode) ? displayMode : 'list';
  }

  selectorDropdownListColCountSet(columnCount) {
    this.selectorData.dropdownListColCount = Math.min(6, Math.max(1, Number(columnCount) || 1));
  }

  selectorDragStateGet(dragMode = null) {
    const mode = getDragModeSafe(dragMode || this.selectorData.searchDisplayMode);
    return this.selectorData.dragStateByMode[mode];
  }

  selectorDragStart(itemId, dragMode = null) {
    const dragState = this.selectorDragStateGet(dragMode);
    dragState.isDragging = true;
    dragState.itemDraggedId = itemId;
    dragState.itemTargetId = itemId;
    dragState.insertPosition = 'before';
    dragState.isCancelDropHover = false;
  }

  selectorDragPreviewSingleLine(itemTargetId, insertPosition, indicatorLeftPx = null) {
    const dragState = this.selectorDragStateGet('single');
    if (!dragState.isDragging) return;
    dragState.itemTargetId = itemTargetId;
    dragState.insertPosition = insertPosition === 'after' ? 'after' : 'before';
    dragState.isCancelDropHover = false;
    dragState.indicatorLeftPx = Number.isFinite(Number(indicatorLeftPx)) ? Number(indicatorLeftPx) : null;
  }

  selectorDragPreviewWrap(itemTargetId, insertPosition, indicatorLeftPx = null, indicatorTopPx = null, indicatorHeightPx = null) {
    const dragState = this.selectorDragStateGet('wrap');
    if (!dragState.isDragging) return;
    dragState.itemTargetId = itemTargetId;
    dragState.insertPosition = insertPosition === 'after' ? 'after' : 'before';
    dragState.isCancelDropHover = false;
    dragState.indicatorLeftPx = Number.isFinite(Number(indicatorLeftPx)) ? Number(indicatorLeftPx) : null;
    dragState.indicatorTopPx = Number.isFinite(Number(indicatorTopPx)) ? Number(indicatorTopPx) : null;
    dragState.indicatorHeightPx = Number.isFinite(Number(indicatorHeightPx)) ? Number(indicatorHeightPx) : null;
  }

  selectorDragDrop(dragMode = null) {
    const { itemDraggedId, itemTargetId, insertPosition } = this.selectorDragStateGet(dragMode);
    if (!itemDraggedId || !itemTargetId || itemDraggedId === itemTargetId) {
      this.selectorDragClear();
      return;
    }

    const itemIdListWithoutDragged = this.selectorData.itemSelectedIdList.filter((itemId) => itemId !== itemDraggedId);
    const targetIndex = itemIdListWithoutDragged.indexOf(itemTargetId);
    if (targetIndex < 0) {
      this.selectorDragClear();
      return;
    }

    const insertIndex = insertPosition === 'after' ? targetIndex + 1 : targetIndex;
    itemIdListWithoutDragged.splice(insertIndex, 0, itemDraggedId);
    this.selectorData.itemSelectedIdList = itemIdListWithoutDragged;
    this.selectorDragClear();
    this.selectorEventEmit('selectionChange', { itemSelectedIdList: [...this.selectorData.itemSelectedIdList] });
  }

  selectorDragScrollHoverSet(direction, isHover) {
    const dragState = this.selectorDragStateGet('single');
    if (direction === 'left') {
      dragState.isScrollLeftHover = Boolean(isHover) && dragState.isDragging;
      if (isHover) dragState.isScrollRightHover = false;
    } else if (direction === 'right') {
      dragState.isScrollRightHover = Boolean(isHover) && dragState.isDragging;
      if (isHover) dragState.isScrollLeftHover = false;
    }
    if (isHover) dragState.isCancelDropHover = false;
  }

  selectorDragCancelHoverSet(dragMode = null, isHover = false) {
    const mode = getDragModeSafe(dragMode || this.selectorData.searchDisplayMode);
    const dragState = this.selectorDragStateGet(mode);
    dragState.isCancelDropHover = Boolean(isHover) && dragState.isDragging;
    if (dragState.isCancelDropHover && mode === 'single') {
      dragState.isScrollLeftHover = false;
      dragState.isScrollRightHover = false;
    }
  }

  selectorDragClear() {
    resetSingleLineDragState(this.selectorData.dragStateByMode.single);
    resetWrapDragState(this.selectorData.dragStateByMode.wrap);
  }
}

export class StorePrefecture extends SelectorStoreBase {
  prefectureItemById = {};
  prefectureIdList = [];

  constructor() {
    super();
    this.selectorData.dropdownDisplayMode = 'map';
    this.loadPrefectureData(prefectureSourceList);
    makeObservable(this, {
      selectorData: observable,
      onEvent: observable.ref,
      prefectureItemById: observable,
      prefectureIdList: observable,
      selectorEventHandlerSet: action.bound,
      selectorEventEmit: action.bound,
      isSelectorItemAvailable: action.bound,
      selectorAvailableItemIdListSet: action.bound,
      selectorSelectedSyncToAvailableList: action.bound,
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
      selectorSelectedItemCenterFocusRequest: action.bound,
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
      loadPrefectureData: action.bound,
      resultIdList: action.bound,
    });
  }

  loadPrefectureData(itemList) {
    this.prefectureItemById = {};
    this.prefectureIdList = [];
    itemList.forEach(([id, displayName, reading, iconText]) => {
      const prefectureLabel = getPrefectureLabelShort(displayName);
      const region = prefectureRegionByLabel[prefectureLabel] || null;
      const itemPrepared = {
        id,
        displayName,
        nameCompact: displayName,
        prefectureLabel,
        regionId: region?.id || null,
        regionLabel: region?.label || null,
        regionColorName: region?.colorName || null,
        regionColorValue: region?.colorValue || null,
        kind: 'prefecture',
        iconText,
        searchText: `${displayName} ${reading}`,
        searchTextNormalized: normalizeSearchBundle(`${displayName} ${reading}`),
      };
      this.prefectureItemById[id] = itemPrepared;
      this.prefectureIdList.push(id);
    });
  }

  resultIdList() {
    const queryNormalized = normalizeSearchBundle(this.selectorData.searchText);
    const queryPartList = queryNormalized.split(' ').filter(Boolean);

    return this.prefectureIdList
      .filter((itemId) => {
        const item = this.prefectureItemById[itemId];
        if (!this.isSelectorItemAvailable(itemId)) return false;
        if (queryPartList.length === 0) return true;
        return queryPartList.some((queryPart) => item.searchTextNormalized.includes(queryPart));
      })
      .slice(0, 47);
  }
}

export default StorePrefecture;