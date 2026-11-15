import React, { useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { getWrapPreviewFromRowPoint } from './dragReorderGeometry.js';

const regionDragItemOptions = {
  itemSelector: '.region-selector-chip',
  idAttribute: 'regionId',
};

function createRegionDragState() {
  return {
    isDragging: false,
    itemDraggedId: null,
    itemTargetId: null,
    insertPosition: null,
    indicatorLeftPx: null,
    indicatorTopPx: null,
    indicatorHeightPx: null,
  };
}

function RegionSelector({ data = {}, onEvent }) {
  const chipListRef = useRef(null);
  const isClickSuppressedRef = useRef(false);
  const [dragState, setDragState] = useState(createRegionDragState);
  const itemList = Array.isArray(data.itemList) ? data.itemList : [];
  const itemSelectedIdSet = new Set(data.itemSelectedIdList || []);

  const clearDrag = () => {
    setDragState(createRegionDragState());
  };

  const setDragPreview = (clientX, clientY) => {
    const chipListEl = chipListRef.current;
    if (!chipListEl || !dragState.isDragging) return;
    const preview = getWrapPreviewFromRowPoint(chipListEl, clientX, clientY, regionDragItemOptions);
    if (!preview) return;
    setDragState((dragStateCurrent) => {
      if (!dragStateCurrent.isDragging) return dragStateCurrent;
      return {
        ...dragStateCurrent,
        itemTargetId: preview.itemTargetId,
        insertPosition: preview.insertPosition,
        indicatorLeftPx: preview.indicatorLeftPx,
        indicatorTopPx: preview.indicatorTopPx,
        indicatorHeightPx: preview.indicatorHeightPx,
      };
    });
  };

  const handleDrop = () => {
    if (dragState.itemDraggedId && dragState.itemTargetId && dragState.itemDraggedId !== dragState.itemTargetId) {
      onEvent('itemReorder', {
        itemIdDragged: dragState.itemDraggedId,
        itemIdTarget: dragState.itemTargetId,
        insertPosition: dragState.insertPosition || 'before',
      });
    }
    isClickSuppressedRef.current = true;
    window.setTimeout(() => { isClickSuppressedRef.current = false; }, 120);
    clearDrag();
  };

  return (
    <div className="region-selector" aria-label="地域選択">
      <div
        ref={chipListRef}
        className="region-selector-chip-list"
        onDragOver={(event) => {
          if (!dragState.isDragging) return;
          event.preventDefault();
          setDragPreview(event.clientX, event.clientY);
        }}
        onDrop={(event) => {
          if (!dragState.isDragging) return;
          event.preventDefault();
          handleDrop();
        }}
      >
        {dragState.isDragging && dragState.indicatorLeftPx !== null ? (
          <span
            className="municipality-insert-line region-selector-insert-line is-wrap"
            style={{
              left: `${dragState.indicatorLeftPx}px`,
              top: dragState.indicatorTopPx !== null ? `${dragState.indicatorTopPx}px` : undefined,
              height: dragState.indicatorHeightPx !== null ? `${dragState.indicatorHeightPx}px` : undefined,
            }}
          />
        ) : null}
        {itemList.map((item) => {
          const isSelected = itemSelectedIdSet.has(item.id);
          const isDragged = dragState.itemDraggedId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`region-selector-chip ${isSelected ? 'active' : ''} ${isDragged ? 'is-dragged' : ''}`}
              data-region-id={item.id}
              draggable
              style={{ '--region-selector-chip-bg': item.regionColorValue || '#dbeafe' }}
              aria-pressed={isSelected}
              title={item.prefectureLabelList?.join('、') || item.displayName}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', item.id);
                setDragState({
                  ...createRegionDragState(),
                  isDragging: true,
                  itemDraggedId: item.id,
                  itemTargetId: item.id,
                  insertPosition: 'before',
                });
              }}
              onDragOver={(event) => {
                if (!dragState.isDragging) return;
                event.preventDefault();
                setDragPreview(event.clientX, event.clientY);
              }}
              onDrop={(event) => {
                if (!dragState.isDragging) return;
                event.preventDefault();
                handleDrop();
              }}
              onDragEnd={clearDrag}
              onClick={() => {
                if (dragState.isDragging || isClickSuppressedRef.current) return;
                onEvent('itemToggle', { itemId: item.id });
              }}
            >
              <span>{item.displayName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default observer(RegionSelector);
