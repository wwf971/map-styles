import React from 'react';
import { CrossIcon } from '@wwf971/react-comp-misc';
import { getSingleLinePreviewFromPoint, getWrapPreviewFromRowPoint } from './dragReorderGeometry.js';
import { HighlightText, getItemDisplayData } from './MunicipalityTextHighlight.jsx';

export function KindIcon({ kind, text, isShown = true, isPlain = false }) {
  if (!isShown) return null;
  return <span className={`municipality-kind-icon municipality-kind-icon-${kind} ${isPlain ? 'is-plain' : ''}`}>{text}</span>;
}

export function getItemIconText(item, kindConfig) {
  return item.iconText || kindConfig?.text || '?';
}

export function PrefectureBadge({ item, rangeHighlight = null }) {
  if (!item.prefectureLabel) return null;
  const isLong = item.prefectureLabel.length >= 3;
  return (
    <span
      className={`municipality-prefecture-badge ${isLong ? 'is-long' : ''}`}
      style={{ '--prefecture-badge-bg': item.regionColorValue || '#dbeafe' }}
      title={item.regionLabel ? `${item.prefectureLabel} / ${item.regionLabel}` : item.prefectureLabel}
    >
      <span className="municipality-prefecture-badge-text">
        <HighlightText text={item.prefectureLabel} range={rangeHighlight} className="municipality-match-highlight-badge" />
      </span>
    </span>
  );
}

export function SelectedTag({ item, kindConfig, dragState, dragMode, isKindIconShown, isSelectedPrefectureBadgeShown, onEvent }) {
  const isDragged = dragState?.itemDraggedId === item.id;
  const itemDisplayData = getItemDisplayData(item, isSelectedPrefectureBadgeShown, '');
  const isRegionColoredTag = Boolean(item.regionColorValue);
  const tagStyle = isRegionColoredTag
    ? { '--municipality-tag-region-bg': item.regionColorValue }
    : undefined;

  const handleDragOver = (event) => {
    if (!dragState?.isDragging) return;
    event.preventDefault();
    if (dragMode === 'wrap') {
      const tagRowEl = event.currentTarget.parentElement;
      const preview = tagRowEl ? getWrapPreviewFromRowPoint(tagRowEl, event.clientX, event.clientY) : null;
      if (preview) onEvent('dragPreviewWrap', preview);
      return;
    }
    const tagRowEl = event.currentTarget.parentElement;
    const preview = tagRowEl ? getSingleLinePreviewFromPoint(tagRowEl, event.clientX) : null;
    if (preview) onEvent('dragPreviewSingleLine', preview);
  };

  return (
    <span
      className={[
        'municipality-tag',
        isRegionColoredTag ? 'is-region-colored' : '',
        isDragged ? 'is-dragged' : '',
      ].filter(Boolean).join(' ')}
      style={tagStyle}
      data-selector-tag-id={item.id}
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id);
        onEvent('dragStart', { itemId: item.id, dragMode });
      }}
      onDragOver={handleDragOver}
      onDrop={(event) => {
        event.preventDefault();
        onEvent('dragDrop', { dragMode });
      }}
      onDragEnd={() => onEvent('dragClear', {})}
    >
      {isSelectedPrefectureBadgeShown ? (
        <PrefectureBadge item={item} rangeHighlight={itemDisplayData.rangeBadge} />
      ) : (
        <KindIcon kind={item.kind} text={getItemIconText(item, kindConfig)} isShown={isKindIconShown} />
      )}
      <span className="municipality-tag-text">
        <HighlightText text={itemDisplayData.mainText} range={itemDisplayData.rangeMain} />
      </span>
      <button
        type="button"
        className="municipality-tag-remove"
        aria-label={`${item.displayName} を削除`}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onEvent('itemRemove', { itemId: item.id });
        }}
      >
        <CrossIcon size={12} />
      </button>
    </span>
  );
}