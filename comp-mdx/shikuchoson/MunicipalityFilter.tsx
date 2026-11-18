// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { LeftIcon, RightIcon } from '@wwf971/react-comp-misc';
import {
  getSingleLineItemList,
  getSingleLinePreviewFromPoint,
  getSlotPreviewFromItemList,
  getWrapPreviewFromRowPoint,
} from './dragReorderGeometry.js';

type KindConfig = {
  kind: string;
  label: string;
  text: string;
};

type PrefectureFilterItem = {
  id: string;
  prefectureLabel: string;
  regionLabel?: string | null;
  regionColorValue?: string | null;
  isActive: boolean;
};

type SpecialFilterItem = {
  id: string;
  label: string;
  itemCount?: number;
  isActive: boolean;
};

type MunicipalityFilterData = {
  kindEnabledByKind: Record<string, boolean>;
  prefectureFilterList?: PrefectureFilterItem[];
  specialFilterList?: SpecialFilterItem[];
  filterDisplayMode?: 'single' | 'wrap';
};

type MunicipalityFilterConfig = {
  kindConfigList: KindConfig[];
  isKindFilterShown?: boolean;
  isPrefectureFilterShown?: boolean;
};

type MunicipalityFilterProps = {
  data: MunicipalityFilterData;
  config: MunicipalityFilterConfig;
  onEvent: (eventType: string, eventData: Record<string, unknown>) => void;
};

type DragMode = 'single' | 'wrap';

type FilterDragState = {
  isDragging: boolean;
  itemDraggedId: string | null;
  itemTargetId: string | null;
  insertPosition: 'before' | 'after' | null;
  indicatorLeftPx: number | null;
  indicatorTopPx: number | null;
  indicatorHeightPx: number | null;
  isScrollLeftHover: boolean;
  isScrollRightHover: boolean;
  isCancelDropHover: boolean;
};

const filterDragItemOptions = {
  itemSelector: '.municipality-filter-prefecture-tag',
  idAttribute: 'selectorTagId',
};

function createFilterDragState(): FilterDragState {
  return {
    isDragging: false,
    itemDraggedId: null,
    itemTargetId: null,
    insertPosition: null,
    indicatorLeftPx: null,
    indicatorTopPx: null,
    indicatorHeightPx: null,
    isScrollLeftHover: false,
    isScrollRightHover: false,
    isCancelDropHover: false,
  };
}

function resetFilterDragStateByMode() {
  return {
    single: createFilterDragState(),
    wrap: createFilterDragState(),
  };
}

function getDragModeSafe(dragMode: string | null | undefined): DragMode {
  return dragMode === 'wrap' ? 'wrap' : 'single';
}

function MunicipalityFilterPrefectureTag({ item, dragState, dragMode, onDragPreview, onDragStart, onDragDrop, onDragClear, onEvent }: {
  item: PrefectureFilterItem;
  dragState: FilterDragState;
  dragMode: DragMode;
  onDragPreview: (clientX: number, clientY: number) => void;
  onDragStart: (itemId: string, dragMode: DragMode) => void;
  onDragDrop: (dragMode: DragMode) => void;
  onDragClear: () => void;
  onEvent: MunicipalityFilterProps['onEvent'];
}) {
  const isDragged = dragState.itemDraggedId === item.id;
  const className = [
    'municipality-filter-prefecture-tag',
    item.isActive ? 'is-active' : 'is-inactive',
    isDragged ? 'is-dragged' : '',
  ].join(' ');

  return (
    <span
      role="button"
      tabIndex={item.isActive ? -1 : 0}
      className={className}
      data-selector-tag-id={item.id}
      draggable
      style={{ '--prefecture-filter-bg': item.isActive ? (item.regionColorValue || '#dbeafe') : '#eef2f6' } as React.CSSProperties}
      title={item.regionLabel ? `${item.prefectureLabel} / ${item.regionLabel}` : item.prefectureLabel}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id);
        onDragStart(item.id, dragMode);
      }}
      onDragOver={(event) => {
        if (!dragState.isDragging) return;
        event.preventDefault();
        onDragPreview(event.clientX, event.clientY);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDragDrop(dragMode);
      }}
      onDragEnd={onDragClear}
      onClick={() => {
        if (dragState.isDragging) return;
        if (!item.isActive) {
          onEvent('prefectureFilterActivate', { prefectureId: item.id });
        }
      }}
      onKeyDown={(event) => {
        if (item.isActive || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onEvent('prefectureFilterActivate', { prefectureId: item.id });
      }}
    >
      <span className="municipality-filter-prefecture-name">{item.prefectureLabel}</span>
      <button
        type="button"
        className="municipality-filter-prefecture-remove"
        aria-label={`${item.prefectureLabel} をフィルターから外す`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onEvent(item.isActive ? 'prefectureFilterDeactivate' : 'prefectureFilterRemove', { prefectureId: item.id });
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          event.stopPropagation();
          onEvent(item.isActive ? 'prefectureFilterDeactivate' : 'prefectureFilterRemove', { prefectureId: item.id });
        }}
      >
        ÁE
      </button>
    </span>
  );
}

function MunicipalityFilter({ data, config, onEvent }: MunicipalityFilterProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const prefectureFilterList = config.isPrefectureFilterShown === true ? (data.prefectureFilterList || []) : [];
  const specialFilterList = data.specialFilterList || [];
  const isKindFilterShown = config.isKindFilterShown !== false;
  const displayMode = data.filterDisplayMode === 'wrap' ? 'wrap' : 'single';
  const isWrapMode = displayMode === 'wrap';
  const [scrollState, setScrollState] = useState({ isOverflow: false, scrollLeft: 0, scrollWidth: 0, clientWidth: 0 });
  const [dragStateByMode, setDragStateByMode] = useState(resetFilterDragStateByMode);
  const dragState = dragStateByMode[displayMode];
  const isSingleLineDragScrollShown = dragState.isDragging && !isWrapMode && scrollState.isOverflow;

  const updateScrollState = (target: HTMLDivElement | null) => {
    if (!target) return;
    setScrollState({
      isOverflow: target.scrollWidth > target.clientWidth,
      scrollLeft: target.scrollLeft,
      scrollWidth: target.scrollWidth,
      clientWidth: target.clientWidth,
    });
  };

  useEffect(() => {
    updateScrollState(contentRef.current);
  }, [prefectureFilterList.length, displayMode]);

  const setDragStateForMode = (dragMode: DragMode, updater: (dragStateCurrent: FilterDragState) => FilterDragState) => {
    setDragStateByMode((stateCurrent) => ({
      ...stateCurrent,
      [dragMode]: updater(stateCurrent[dragMode]),
    }));
  };

  const handleDragClear = () => {
    setDragStateByMode(resetFilterDragStateByMode());
  };

  const handleDragStart = (itemId: string, dragMode: DragMode) => {
    setDragStateByMode({
      ...resetFilterDragStateByMode(),
      [dragMode]: {
        ...createFilterDragState(),
        isDragging: true,
        itemDraggedId: itemId,
        itemTargetId: itemId,
        insertPosition: 'before',
      },
    });
  };

  const setDragPreview = (preview: Record<string, unknown> | null, dragMode: DragMode) => {
    if (!preview) return;
    setDragStateForMode(dragMode, (dragStateCurrent) => {
      if (!dragStateCurrent.isDragging) return dragStateCurrent;
      return {
        ...dragStateCurrent,
        itemTargetId: String(preview.itemTargetId || ''),
        insertPosition: preview.insertPosition === 'after' ? 'after' : 'before',
        indicatorLeftPx: Number.isFinite(Number(preview.indicatorLeftPx)) ? Number(preview.indicatorLeftPx) : null,
        indicatorTopPx: Number.isFinite(Number(preview.indicatorTopPx)) ? Number(preview.indicatorTopPx) : null,
        indicatorHeightPx: Number.isFinite(Number(preview.indicatorHeightPx)) ? Number(preview.indicatorHeightPx) : null,
        isCancelDropHover: false,
      };
    });
  };

  const emitDragPreviewFromPoint = (clientX: number, clientY: number, dragMode: DragMode = displayMode) => {
    const contentEl = contentRef.current;
    if (!contentEl || !dragStateByMode[dragMode].isDragging) return false;
    const preview = dragMode === 'wrap'
      ? getWrapPreviewFromRowPoint(contentEl, clientX, clientY, filterDragItemOptions)
      : getSingleLinePreviewFromPoint(contentEl, clientX, filterDragItemOptions);
    setDragPreview(preview, dragMode);
    return Boolean(preview);
  };

  const emitDragPreviewFromEdge = (direction: 'left' | 'right') => {
    const contentEl = contentRef.current;
    if (!contentEl || !dragStateByMode.single.isDragging) return;
    const itemList = getSingleLineItemList(contentEl, filterDragItemOptions);
    const preview = getSlotPreviewFromItemList(itemList, direction === 'left' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY);
    setDragPreview(preview, 'single');
  };

  const handleDragDrop = (dragModeRaw: DragMode = displayMode) => {
    const dragMode = getDragModeSafe(dragModeRaw);
    const dragStateCurrent = dragStateByMode[dragMode];
    if (dragStateCurrent.itemDraggedId && dragStateCurrent.itemTargetId && dragStateCurrent.itemDraggedId !== dragStateCurrent.itemTargetId) {
      onEvent('prefectureFilterReorder', {
        prefectureIdDragged: dragStateCurrent.itemDraggedId,
        prefectureIdTarget: dragStateCurrent.itemTargetId,
        insertPosition: dragStateCurrent.insertPosition || 'before',
      });
    }
    handleDragClear();
  };

  useEffect(() => {
    if (!isSingleLineDragScrollShown || (!dragState.isScrollLeftHover && !dragState.isScrollRightHover)) return undefined;
    const intervalId = window.setInterval(() => {
      const contentEl = contentRef.current;
      if (!contentEl) return;
      contentEl.scrollLeft += dragState.isScrollLeftHover ? -24 : 24;
      updateScrollState(contentEl);
      emitDragPreviewFromEdge(dragState.isScrollLeftHover ? 'left' : 'right');
    }, 80);
    return () => window.clearInterval(intervalId);
  }, [isSingleLineDragScrollShown, dragState.isScrollLeftHover, dragState.isScrollRightHover]);

  useEffect(() => {
    if (!isSingleLineDragScrollShown) return undefined;
    const handleDocumentDragOver = (event: DragEvent) => {
      if (event.target instanceof Element && event.target.closest('.municipality-filter-drag-scroll')) return;
      setDragStateForMode('single', (dragStateCurrent) => (
        dragStateCurrent.isScrollLeftHover || dragStateCurrent.isScrollRightHover
          ? { ...dragStateCurrent, isScrollLeftHover: false, isScrollRightHover: false }
          : dragStateCurrent
      ));
    };
    document.addEventListener('dragover', handleDocumentDragOver);
    return () => document.removeEventListener('dragover', handleDocumentDragOver);
  }, [isSingleLineDragScrollShown]);

  const handleContentWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (displayMode !== 'single') return;
    const target = event.currentTarget;
    if (target.scrollWidth <= target.clientWidth) return;
    event.preventDefault();
    target.scrollLeft += event.deltaY + event.deltaX;
    updateScrollState(target);
  };

  if (prefectureFilterList.length === 0 && specialFilterList.length === 0 && !isKindFilterShown) return null;

  return (
    <div className={`municipality-filter-row is-${displayMode} ${dragState.isDragging ? 'is-dragging' : ''}`} aria-label="検索対象フィルター">
      <div className="municipality-filter-control-list">
        {isKindFilterShown ? (
          <div className="municipality-kind-filter-list" aria-label="市区町村種別フィルター">
            {config.kindConfigList.map((item) => {
              const isEnabled = data.kindEnabledByKind[item.kind];
              return (
                <button
                  key={item.kind}
                  type="button"
                  className={`municipality-kind-toggle ${isEnabled ? 'active' : ''}`}
                  onClick={() => onEvent('kindToggle', { kind: item.kind })}
                >
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        {specialFilterList.length > 0 ? (
          <div className="municipality-special-filter-list" aria-label="特別フィルター">
            {specialFilterList.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`municipality-special-filter-toggle ${item.isActive ? 'active' : ''}`}
                title={item.itemCount ? `${item.label}: ${item.itemCount}件` : item.label}
                onClick={() => onEvent('specialFilterToggle', { filterId: item.id })}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="municipality-filter-mode-toggle"
          aria-label="フィルター表示を切り替え"
          onClick={() => onEvent('filterDisplayModeToggle', {})}
        >
          {displayMode === 'single' ? '1行' : '折返'}
        </button>
      </div>
      <div className="municipality-filter-content-shell">
        <div
          ref={contentRef}
          className="municipality-filter-content"
          onWheel={handleContentWheel}
          onScroll={(event) => updateScrollState(event.currentTarget)}
          onDragOver={(event) => {
            if (!dragState.isDragging) return;
            event.preventDefault();
            emitDragPreviewFromPoint(event.clientX, event.clientY, displayMode);
          }}
          onDrop={(event) => {
            if (!dragState.isDragging) return;
            event.preventDefault();
            handleDragDrop(displayMode);
          }}
        >
          {dragState.isDragging && dragState.indicatorLeftPx !== null ? (
            <span
              className={`municipality-insert-line municipality-filter-insert-line is-${displayMode} ${dragState.isCancelDropHover ? 'is-cancel-drop-hover' : ''}`}
              style={{
                left: `${dragState.indicatorLeftPx}px`,
                top: isWrapMode && dragState.indicatorTopPx !== null ? `${dragState.indicatorTopPx}px` : undefined,
                height: isWrapMode && dragState.indicatorHeightPx !== null ? `${dragState.indicatorHeightPx}px` : undefined,
              }}
            />
          ) : null}
          {prefectureFilterList.map((item) => (
            <MunicipalityFilterPrefectureTag
              key={item.id}
              item={item}
              dragState={dragState}
              dragMode={displayMode}
              onDragPreview={(clientX, clientY) => emitDragPreviewFromPoint(clientX, clientY, displayMode)}
              onDragStart={handleDragStart}
              onDragDrop={handleDragDrop}
              onDragClear={handleDragClear}
              onEvent={onEvent}
            />
          ))}
        </div>
      </div>
      {isSingleLineDragScrollShown ? (
        <button
          type="button"
          className="municipality-drag-scroll municipality-drag-scroll-left municipality-filter-drag-scroll"
          aria-label="左へスクロール"
          onPointerEnter={() => setDragStateForMode('single', (dragStateCurrent) => ({ ...dragStateCurrent, isScrollLeftHover: dragStateCurrent.isDragging, isScrollRightHover: false, isCancelDropHover: false }))}
          onPointerLeave={() => setDragStateForMode('single', (dragStateCurrent) => ({ ...dragStateCurrent, isScrollLeftHover: false }))}
          onDragOver={(event) => {
            event.preventDefault();
            setDragStateForMode('single', (dragStateCurrent) => ({ ...dragStateCurrent, isScrollLeftHover: dragStateCurrent.isDragging, isScrollRightHover: false, isCancelDropHover: false }));
            emitDragPreviewFromEdge('left');
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleDragDrop('single');
          }}
        >
          <LeftIcon width={18} height={18} />
        </button>
      ) : null}
      {isSingleLineDragScrollShown ? (
        <button
          type="button"
          className="municipality-drag-scroll municipality-drag-scroll-right municipality-filter-drag-scroll"
          aria-label="右へスクロール"
          onPointerEnter={() => setDragStateForMode('single', (dragStateCurrent) => ({ ...dragStateCurrent, isScrollRightHover: dragStateCurrent.isDragging, isScrollLeftHover: false, isCancelDropHover: false }))}
          onPointerLeave={() => setDragStateForMode('single', (dragStateCurrent) => ({ ...dragStateCurrent, isScrollRightHover: false }))}
          onDragOver={(event) => {
            event.preventDefault();
            setDragStateForMode('single', (dragStateCurrent) => ({ ...dragStateCurrent, isScrollRightHover: dragStateCurrent.isDragging, isScrollLeftHover: false, isCancelDropHover: false }));
            emitDragPreviewFromEdge('right');
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleDragDrop('single');
          }}
        >
          <RightIcon width={18} height={18} />
        </button>
      ) : null}
      {dragState.isDragging ? (
        <button
          type="button"
          className={`municipality-drag-cancel-drop municipality-filter-drag-cancel-drop is-${displayMode} ${displayMode === 'single' && !isSingleLineDragScrollShown ? 'is-without-scroll-zones' : ''}`}
          aria-label="ドラッグをキャンセル"
          title="ドラッグをキャンセル"
          onDragEnter={(event) => {
            event.preventDefault();
            setDragStateForMode(displayMode, (dragStateCurrent) => ({ ...dragStateCurrent, isCancelDropHover: dragStateCurrent.isDragging, isScrollLeftHover: false, isScrollRightHover: false }));
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragStateForMode(displayMode, (dragStateCurrent) => ({ ...dragStateCurrent, isCancelDropHover: dragStateCurrent.isDragging, isScrollLeftHover: false, isScrollRightHover: false }));
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragStateForMode(displayMode, (dragStateCurrent) => ({ ...dragStateCurrent, isCancelDropHover: false }));
          }}
          onDrop={(event) => {
            event.preventDefault();
            handleDragClear();
          }}
          onClick={handleDragClear}
        >
          ドラッグをキャンセル
        </button>
      ) : null}
    </div>
  );
}

export default observer(MunicipalityFilter);