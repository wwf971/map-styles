import React, { useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { LeftIcon, RightIcon } from '@wwf971/react-comp-misc';
import MunicipalityFilter from './MunicipalityFilter.tsx';
import PrefectureDropdown from './PrefectureDropdown.jsx';
import { MunicipalityDropdownView, MunicipalityResultList } from './MunicipalityDropdown.jsx';
import {
  getSingleLineItemList,
  getSingleLinePreviewFromPoint,
  getSlotPreviewFromItemList,
  getWrapPreviewFromRowPoint,
} from './dragReorderGeometry.js';
import {
  SelectedTag,
} from './MunicipalitySelectedTags.jsx';
import './MunicipalitySelector.css';

function isTargetInsideKeepOpenBoundary(target, boundaryId) {
  if (!boundaryId || !(target instanceof Element)) return false;
  let element = target;
  while (element) {
    const boundaryIdList = (element.getAttribute('data-dropdown-keep-open-boundary') || '').split(/\s+/).filter(Boolean);
    if (boundaryIdList.includes(boundaryId)) return true;
    element = element.parentElement;
  }
  return false;
}

function MunicipalitySelector({ data, config, onEvent }) {
  const selectorRef = useRef(null);
  const tagRowRef = useRef(null);
  const editorRef = useRef(null);
  const kindConfigByKind = Object.fromEntries(config.kindConfigList.map((item) => [item.kind, item]));
  const isKindFilterShown = config.isKindFilterShown !== false;
  const isKindIconShown = config.isKindIconShown !== false;
  const isSelectedPrefectureBadgeShown = config.isSelectedPrefectureBadgeShown === true;
  const isPrefectureFilterShown = config.isPrefectureFilterShown === true;
  const isSpecialFilterShown = (data.specialFilterList || []).length > 0;
  const placeholderText = config.placeholderText || '市区町村を検索';
  const selectedAriaLabel = config.selectedAriaLabel || 'Selected items';
  const isFilterRowShown = isKindFilterShown || isPrefectureFilterShown || isSpecialFilterShown;
  const isPrefectureDropdown = config.dropdownType === 'prefecture';
  const searchDisplayMode = data.searchDisplayMode === 'wrap' ? 'wrap' : 'single';
  const isSearchWrapMode = searchDisplayMode === 'wrap';
  const isTagRowOverflow = data.tagScrollState?.isOverflow === true;
  const isSingleLineDragScrollShown = data.dragState?.isDragging && !isSearchWrapMode && isTagRowOverflow;
  const dropdownDisplayMode = data.dropdownDisplayMode === 'compact' ? 'compact' : 'list';
  const dropdownListColCount = Math.min(6, Math.max(1, Number(data.dropdownListColCount) || 1));
  const dropdownKeepOpenBoundaryId = config.dropdownKeepOpenBoundaryId || null;

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!data.isOpen) return;
      if (selectorRef.current?.contains(event.target)) return;
      if (isTargetInsideKeepOpenBoundary(event.target, dropdownKeepOpenBoundaryId)) return;
      onEvent('openChange', { isOpen: false });
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [data.isOpen, dropdownKeepOpenBoundaryId]);

  useEffect(() => {
    const editorEl = editorRef.current;
    if (!editorEl) return;
    if (!data.searchText && !editorEl.textContent && editorEl.innerHTML) {
      editorEl.textContent = '';
    } else if (editorEl.textContent !== data.searchText) {
      editorEl.textContent = data.searchText;
    }
  }, [data.searchText]);

  useEffect(() => {
    const tagRowEl = tagRowRef.current;
    if (!tagRowEl) return;
    const scrollRequestType = data.tagScrollState?.scrollRequestType || 'end';
    if (scrollRequestType === 'centerItem') {
      const scrollRequestItemId = data.tagScrollState?.scrollRequestItemId;
      const tagEl = Array.from(tagRowEl.querySelectorAll('.municipality-tag'))
        .find((element) => element.getAttribute('data-selector-tag-id') === scrollRequestItemId);
      if (!tagEl) return;
      tagRowEl.scrollLeft = tagEl.offsetLeft + (tagEl.offsetWidth / 2) - (tagRowEl.clientWidth / 2);
    } else {
      const scrollRequestLeft = Math.max(0, tagRowEl.scrollWidth - tagRowEl.clientWidth);
      tagRowEl.scrollLeft = scrollRequestLeft;
    }
    onEvent('tagScrollChange', {
      isOverflow: tagRowEl.scrollWidth > tagRowEl.clientWidth,
      scrollLeft: tagRowEl.scrollLeft,
      scrollWidth: tagRowEl.scrollWidth,
      clientWidth: tagRowEl.clientWidth,
    });
  }, [data.tagScrollState?.scrollRequestId, data.itemSelectedList.length, data.searchText]);

  useEffect(() => {
    const tagRowEl = tagRowRef.current;
    if (!tagRowEl) return;
    onEvent('tagScrollChange', {
      isOverflow: tagRowEl.scrollWidth > tagRowEl.clientWidth,
      scrollLeft: tagRowEl.scrollLeft,
      scrollWidth: tagRowEl.scrollWidth,
      clientWidth: tagRowEl.clientWidth,
    });
  }, [data.itemSelectedList.length, data.searchText]);

  useEffect(() => {
    const tagRowEl = tagRowRef.current;
    if (!tagRowEl) return undefined;
    const handleWheel = (event) => {
      if (isSearchWrapMode || tagRowEl.scrollWidth <= tagRowEl.clientWidth) return;
      event.preventDefault();
      tagRowEl.scrollLeft += event.deltaY + event.deltaX;
      onEvent('tagScrollChange', {
        isOverflow: true,
        scrollLeft: tagRowEl.scrollLeft,
        scrollWidth: tagRowEl.scrollWidth,
        clientWidth: tagRowEl.clientWidth,
      });
    };
    tagRowEl.addEventListener('wheel', handleWheel, { passive: false });
    return () => tagRowEl.removeEventListener('wheel', handleWheel);
  }, [isSearchWrapMode, onEvent]);

  useEffect(() => {
    const dragState = data.dragState;
    if (!isSingleLineDragScrollShown) return undefined;
    if (!dragState?.isDragging || (!dragState.isScrollLeftHover && !dragState.isScrollRightHover)) return undefined;
    const intervalMs = Math.max(16, Number(dragState.scrollIntervalMs) || 80);
    const stepPx = Math.max(1, Number(dragState.scrollStepPx) || 24);
    const intervalId = window.setInterval(() => {
      const tagRowEl = tagRowRef.current;
      if (!tagRowEl) return;
      const directionFactor = dragState.isScrollLeftHover ? -1 : 1;
      tagRowEl.scrollLeft += directionFactor * stepPx;
      onEvent('tagScrollChange', {
        isOverflow: tagRowEl.scrollWidth > tagRowEl.clientWidth,
        scrollLeft: tagRowEl.scrollLeft,
        scrollWidth: tagRowEl.scrollWidth,
        clientWidth: tagRowEl.clientWidth,
      });
    }, intervalMs);
    return () => window.clearInterval(intervalId);
  }, [
    data.dragState?.isDragging,
    data.dragState?.isScrollLeftHover,
    data.dragState?.isScrollRightHover,
    data.dragState?.scrollIntervalMs,
    data.dragState?.scrollStepPx,
    isSingleLineDragScrollShown,
  ]);

  useEffect(() => {
    if (isSingleLineDragScrollShown) return;
    if (data.dragState?.isScrollLeftHover) onEvent('dragScrollHoverChange', { direction: 'left', isHover: false });
    if (data.dragState?.isScrollRightHover) onEvent('dragScrollHoverChange', { direction: 'right', isHover: false });
  }, [
    data.dragState?.isScrollLeftHover,
    data.dragState?.isScrollRightHover,
    isSingleLineDragScrollShown,
  ]);

  const handleSearchInput = (event) => {
    const searchText = event.currentTarget.textContent || '';
    if (!searchText && event.currentTarget.innerHTML) {
      event.currentTarget.textContent = '';
    }
    onEvent('searchTextChange', { searchText });
  };

  const handleSearchKeyDown = (event) => {
    const searchTextCurrent = event.currentTarget.textContent || '';
    if ((event.key === 'Backspace' || event.key === 'Delete') && !searchTextCurrent) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape') {
      onEvent('openChange', { isOpen: false });
    }
  };

  const handleTagRowScroll = (event) => {
    onEvent('tagScrollChange', {
      isOverflow: event.currentTarget.scrollWidth > event.currentTarget.clientWidth,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollWidth: event.currentTarget.scrollWidth,
      clientWidth: event.currentTarget.clientWidth,
    });
  };

  const handleSearchBoxClick = (event) => {
    if (event.target.closest('button')) return;
    onEvent('openChange', { isOpen: true });
    editorRef.current?.focus();
  };

  const emitDragPreviewFromPoint = (clientX, clientY, eventTarget = null) => {
    if (!data.dragState?.isDragging || data.itemSelectedList.length === 0) return;
    const tagRowEl = tagRowRef.current;
    if (!tagRowEl) return;
    const tagElList = Array.from(tagRowEl.querySelectorAll('.municipality-tag'));
    if (tagElList.length === 0) return;
    if (isSearchWrapMode) {
      const preview = getWrapPreviewFromRowPoint(tagRowEl, clientX, clientY);
      if (preview) onEvent('dragPreviewWrap', preview);
      return Boolean(preview);
    }
    if (eventTarget instanceof Element && eventTarget.closest('.municipality-tag')) return false;
    const preview = getSingleLinePreviewFromPoint(tagRowEl, clientX);
    if (preview) onEvent('dragPreviewSingleLine', preview);
    return true;
  };

  const emitDragPreviewFromRowPoint = (event) => {
    if (emitDragPreviewFromPoint(event.clientX, event.clientY, event.target)) {
      event.preventDefault();
    }
  };

  const emitDragPreviewFromEdge = (direction) => {
    if (!data.dragState?.isDragging) return;
    const tagRowEl = tagRowRef.current;
    if (!tagRowEl) return;
    const itemList = getSingleLineItemList(tagRowEl);
    const preview = getSlotPreviewFromItemList(itemList, direction === 'left' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
    if (preview) onEvent('dragPreviewSingleLine', preview);
  };

  useEffect(() => {
    if (!data.dragState?.isDragging) return undefined;
    const isWithinExpandedPreviewArea = (event) => {
      const selectorEl = selectorRef.current;
      const tagRowEl = tagRowRef.current;
      if (!selectorEl || !tagRowEl) return false;
      const selectorRect = selectorEl.getBoundingClientRect();
      const tagRowRect = tagRowEl.getBoundingClientRect();
      const xMarginPx = 120;
      const yMarginPx = isSearchWrapMode ? 80 : 120;
      return event.clientX >= selectorRect.left - xMarginPx
        && event.clientX <= selectorRect.right + xMarginPx
        && event.clientY >= tagRowRect.top - yMarginPx
        && event.clientY <= tagRowRect.bottom + yMarginPx;
    };

    const handleDocumentDragOver = (event) => {
      if (event.target instanceof Element && event.target.closest('.municipality-drag-cancel-drop, .municipality-drag-scroll')) return;
      if (!isWithinExpandedPreviewArea(event)) return;
      if (!emitDragPreviewFromPoint(event.clientX, event.clientY, event.target)) return;
      event.preventDefault();
    };

    const handleDocumentDrop = (event) => {
      if (event.target instanceof Element && event.target.closest('.municipality-tag-row, .municipality-drag-cancel-drop, .municipality-drag-scroll')) return;
      if (!isWithinExpandedPreviewArea(event)) return;
      event.preventDefault();
      onEvent('dragDrop', { dragMode: searchDisplayMode });
    };

    document.addEventListener('dragover', handleDocumentDragOver);
    document.addEventListener('drop', handleDocumentDrop);
    return () => {
      document.removeEventListener('dragover', handleDocumentDragOver);
      document.removeEventListener('drop', handleDocumentDrop);
    };
  }, [data.dragState?.isDragging, data.itemSelectedList.length, isSearchWrapMode, searchDisplayMode]);

  const handleTagRowDrop = (event) => {
    if (!data.dragState?.isDragging) return;
    event.preventDefault();
    onEvent('dragDrop', { dragMode: searchDisplayMode });
  };

  const clearDragScrollHover = () => {
    onEvent('dragScrollHoverChange', { direction: 'left', isHover: false });
    onEvent('dragScrollHoverChange', { direction: 'right', isHover: false });
  };

  const setDragCancelHover = (isHover) => {
    onEvent('dragCancelHoverChange', { dragMode: searchDisplayMode, isHover });
  };

  const handleDragCancelHover = (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearDragScrollHover();
    setDragCancelHover(true);
  };

  const handleDragCancelLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragCancelHover(false);
  };

  const handleDragCancelDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearDragScrollHover();
    setDragCancelHover(false);
    onEvent('dragClear', {});
  };

  const renderResultList = ({ columnCount = dropdownListColCount } = {}) => {
    return (
      <MunicipalityResultList
        itemList={data.itemResultList}
        itemSelectedIdSet={data.itemSelectedIdSet}
        kindConfigByKind={kindConfigByKind}
        isKindIconShown={isKindIconShown}
        isPrefectureBadgeShown={isSelectedPrefectureBadgeShown}
        searchText={data.searchText}
        columnCount={columnCount}
        onEvent={onEvent}
      />
    );
  };

  const renderMunicipalityDropdown = () => {
    const kindEnabledKey = config.kindConfigList
      .map((item) => `${item.kind}:${data.kindEnabledByKind?.[item.kind] ? '1' : '0'}`)
      .join(',');
    const renderKey = [data.isOpen ? 'open' : 'closed', dropdownDisplayMode, data.searchText, data.itemResultList.length, dropdownListColCount, kindEnabledKey].join('|');
    return (
      <MunicipalityDropdownView
        dropdownDisplayMode={dropdownDisplayMode}
        dropdownListColCount={dropdownListColCount}
        renderKey={renderKey}
        itemList={data.itemResultList}
        itemSelectedIdSet={data.itemSelectedIdSet}
        searchText={data.searchText}
        onEvent={onEvent}
        renderList={renderResultList}
      />
    );
  };

  return (
    <div className={`municipality-selector ${isFilterRowShown ? 'has-filter-row' : ''}`} ref={selectorRef}>
      <div className={`municipality-search-box is-${searchDisplayMode}`} onClick={handleSearchBoxClick}>
        <div className="municipality-tag-row-shell">
          {isSingleLineDragScrollShown ? (
            <button
              type="button"
              className="municipality-drag-scroll municipality-drag-scroll-left"
              aria-label="左へスクロール"
              onPointerEnter={() => onEvent('dragScrollHoverChange', { direction: 'left', isHover: true })}
              onPointerLeave={() => onEvent('dragScrollHoverChange', { direction: 'left', isHover: false })}
              onDragOver={(event) => {
                event.preventDefault();
                onEvent('dragScrollHoverChange', { direction: 'left', isHover: true });
                emitDragPreviewFromEdge('left');
              }}
              onDragLeave={() => onEvent('dragScrollHoverChange', { direction: 'left', isHover: false })}
              onDrop={(event) => {
                event.preventDefault();
                onEvent('dragScrollHoverChange', { direction: 'left', isHover: false });
                onEvent('dragDrop', {});
              }}
            >
              <LeftIcon width={18} height={18} />
            </button>
          ) : null}
          <div
            ref={tagRowRef}
            className={`municipality-tag-row is-${searchDisplayMode}`}
            aria-label={selectedAriaLabel}
            data-is-overflow={data.tagScrollState?.isOverflow ? 'true' : 'false'}
            onScroll={handleTagRowScroll}
            onDragOver={emitDragPreviewFromRowPoint}
            onDrop={handleTagRowDrop}
          >
            {data.dragState?.isDragging && data.dragState?.indicatorLeftPx !== null ? (
              <span
                className={`municipality-insert-line is-${searchDisplayMode} ${data.dragState?.isCancelDropHover ? 'is-cancel-drop-hover' : ''}`}
                style={{
                  left: `${data.dragState.indicatorLeftPx}px`,
                  top: isSearchWrapMode && data.dragState.indicatorTopPx !== null ? `${data.dragState.indicatorTopPx}px` : undefined,
                  height: isSearchWrapMode && data.dragState.indicatorHeightPx !== null ? `${data.dragState.indicatorHeightPx}px` : undefined,
                }}
              />
            ) : null}
            {data.itemSelectedList.map((item) => (
              <SelectedTag
                key={item.id}
                item={item}
                kindConfig={kindConfigByKind[item.kind]}
                dragState={data.dragState}
                dragMode={searchDisplayMode}
                isKindIconShown={isKindIconShown}
                isSelectedPrefectureBadgeShown={isSelectedPrefectureBadgeShown}
                onEvent={onEvent}
              />
            ))}
            <span
              ref={editorRef}
              className="municipality-search-editor"
              role="textbox"
              contentEditable
              suppressContentEditableWarning
              aria-label={placeholderText}
              data-placeholder={placeholderText}
              onClick={() => onEvent('openChange', { isOpen: true })}
              onFocus={() => onEvent('openChange', { isOpen: true })}
              onInput={handleSearchInput}
              onKeyDown={handleSearchKeyDown}
            />
          </div>
          {isSingleLineDragScrollShown ? (
            <button
              type="button"
              className="municipality-drag-scroll municipality-drag-scroll-right"
              aria-label="右へスクロール"
              onPointerEnter={() => onEvent('dragScrollHoverChange', { direction: 'right', isHover: true })}
              onPointerLeave={() => onEvent('dragScrollHoverChange', { direction: 'right', isHover: false })}
              onDragOver={(event) => {
                event.preventDefault();
                onEvent('dragScrollHoverChange', { direction: 'right', isHover: true });
                emitDragPreviewFromEdge('right');
              }}
              onDragLeave={() => onEvent('dragScrollHoverChange', { direction: 'right', isHover: false })}
              onDrop={(event) => {
                event.preventDefault();
                onEvent('dragScrollHoverChange', { direction: 'right', isHover: false });
                onEvent('dragDrop', {});
              }}
            >
              <RightIcon width={18} height={18} />
            </button>
          ) : null}
          {data.dragState?.isDragging ? (
            <button
              type="button"
              className={`municipality-drag-cancel-drop is-${searchDisplayMode} ${searchDisplayMode === 'single' && !isSingleLineDragScrollShown ? 'is-without-scroll-zones' : ''}`}
              aria-label="ドラッグをキャンセル"
              title="ドラッグをキャンセル"
              onClick={handleDragCancelDrop}
              onDragEnter={handleDragCancelHover}
              onDragOver={handleDragCancelHover}
              onDragLeave={handleDragCancelLeave}
              onDrop={handleDragCancelDrop}
            >
              ドラッグをキャンセル
            </button>
          ) : null}
        </div>
      </div>

      {isFilterRowShown ? (
        <MunicipalityFilter
          data={{
            kindEnabledByKind: data.kindEnabledByKind,
            prefectureFilterList: data.prefectureFilterList,
            specialFilterList: data.specialFilterList,
            filterDisplayMode: data.filterDisplayMode,
          }}
          config={{
            kindConfigList: config.kindConfigList,
            isKindFilterShown,
            isPrefectureFilterShown,
          }}
          onEvent={onEvent}
        />
      ) : null}

      {data.isOpen && (
        <div className="municipality-dropdown">
          {isPrefectureDropdown ? (
            <PrefectureDropdown
              data={{
                dropdownDisplayMode: data.dropdownDisplayMode,
                dropdownListColCount: data.dropdownListColCount,
                searchText: data.searchText,
                itemAllList: data.itemAllList,
                itemAvailableIdList: data.itemAvailableIdList,
                itemSelectedIdList: data.itemSelectedList.map((item) => item.id),
              }}
              config={config.prefectureDropdownConfig || {}}
              onEvent={onEvent}
              renderList={renderResultList}
            />
          ) : renderMunicipalityDropdown()}
        </div>
      )}
    </div>
  );
}

export default observer(MunicipalitySelector);