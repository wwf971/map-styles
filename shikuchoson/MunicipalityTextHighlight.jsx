import React from 'react';

export function normalizeVisibleMatchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\s\u3000\-ー]/g, '');
}

export function getTextMatchRange(text, searchText) {
  const textRaw = String(text || '');
  const queryNormalized = normalizeVisibleMatchText(searchText);
  if (!textRaw || !queryNormalized) return null;

  let textNormalized = '';
  const indexRawByNormalized = [];
  Array.from(textRaw).forEach((char, indexRaw) => {
    const charNormalized = normalizeVisibleMatchText(char);
    Array.from(charNormalized).forEach(() => {
      indexRawByNormalized.push(indexRaw);
    });
    textNormalized += charNormalized;
  });

  const indexNormalized = textNormalized.indexOf(queryNormalized);
  if (indexNormalized < 0) return null;
  const indexStart = indexRawByNormalized[indexNormalized];
  const indexEnd = indexRawByNormalized[indexNormalized + queryNormalized.length - 1] + 1;
  return { indexStart, indexEnd };
}

export function getRangePart(range, indexStart, indexEnd) {
  if (!range) return null;
  const indexStartNext = Math.max(range.indexStart, indexStart);
  const indexEndNext = Math.min(range.indexEnd, indexEnd);
  if (indexStartNext >= indexEndNext) return null;
  return {
    indexStart: indexStartNext - indexStart,
    indexEnd: indexEndNext - indexStart,
  };
}

export function HighlightText({ text, range, className = 'municipality-match-highlight' }) {
  const textRaw = String(text || '');
  if (!range || range.indexStart >= range.indexEnd) return textRaw;
  return (
    <>
      {textRaw.slice(0, range.indexStart)}
      <mark className={className}>{textRaw.slice(range.indexStart, range.indexEnd)}</mark>
      {textRaw.slice(range.indexEnd)}
    </>
  );
}

export function getItemDisplayData(item, isPrefectureBadgeShown, searchText) {
  const badgeText = isPrefectureBadgeShown ? (item.prefectureLabel || '') : '';
  const mainText = isPrefectureBadgeShown ? (item.nameCompact || item.displayName) : item.displayName;
  const textFull = `${badgeText}${mainText}`;
  const rangeFull = getTextMatchRange(textFull, searchText);
  const rangeBadge = getRangePart(rangeFull, 0, badgeText.length);
  const rangeMain = getRangePart(rangeFull, badgeText.length, badgeText.length + String(mainText || '').length);
  return { badgeText, mainText, rangeBadge, rangeMain };
}