const defaultDragItemOptions = {
  itemSelector: '.municipality-tag',
  idAttribute: 'selectorTagId',
};

function getDragItemOptions(options = {}) {
  return {
    ...defaultDragItemOptions,
    ...options,
  };
}

export function getSingleLineItemList(containerEl, options = {}) {
  const dragOptions = getDragItemOptions(options);
  return Array.from(containerEl.querySelectorAll(dragOptions.itemSelector)).map((element) => ({
    element,
    id: element.dataset[dragOptions.idAttribute],
    left: element.offsetLeft,
    right: element.offsetLeft + element.offsetWidth,
    top: element.offsetTop,
    height: element.offsetHeight,
    width: element.offsetWidth,
  })).filter((item) => item.id);
}

export function getSlotPreviewFromItemList(itemList, xContent) {
  if (itemList.length === 0) return null;
  const firstItem = itemList[0];
  const lastItem = itemList[itemList.length - 1];

  let slotIndex = itemList.length;
  if (xContent <= firstItem.left) {
    slotIndex = 0;
  } else if (xContent >= lastItem.right) {
    slotIndex = itemList.length;
  } else {
    slotIndex = itemList.findIndex((item) => xContent < item.left + item.width / 2);
    if (slotIndex < 0) slotIndex = itemList.length;
  }

  if (slotIndex <= 0) {
    return {
      itemTargetId: firstItem.id,
      insertPosition: 'before',
      indicatorLeftPx: firstItem.left,
      indicatorTopPx: firstItem.top,
      indicatorHeightPx: firstItem.height,
    };
  }

  if (slotIndex >= itemList.length) {
    return {
      itemTargetId: lastItem.id,
      insertPosition: 'after',
      indicatorLeftPx: lastItem.right,
      indicatorTopPx: lastItem.top,
      indicatorHeightPx: lastItem.height,
    };
  }

  const itemPrevious = itemList[slotIndex - 1];
  const itemNext = itemList[slotIndex];
  return {
    itemTargetId: itemNext.id,
    insertPosition: 'before',
    indicatorLeftPx: (itemPrevious.right + itemNext.left) / 2,
    indicatorTopPx: itemNext.top,
    indicatorHeightPx: itemNext.height,
  };
}

function getWrapItemList(containerEl, options = {}) {
  const dragOptions = getDragItemOptions(options);
  return Array.from(containerEl.querySelectorAll(dragOptions.itemSelector)).map((element) => ({
    element,
    id: element.dataset[dragOptions.idAttribute],
    left: element.offsetLeft,
    right: element.offsetLeft + element.offsetWidth,
    top: element.offsetTop,
    bottom: element.offsetTop + element.offsetHeight,
    width: element.offsetWidth,
    height: element.offsetHeight,
  })).filter((item) => item.id);
}

function getWrapRowList(itemList) {
  const rowList = [];
  const rowTopTolerancePx = 6;
  itemList.forEach((item) => {
    const row = rowList.find((candidate) => Math.abs(candidate.top - item.top) <= rowTopTolerancePx);
    if (row) {
      row.items.push(item);
      row.top = Math.min(row.top, item.top);
      row.bottom = Math.max(row.bottom, item.bottom);
    } else {
      rowList.push({ top: item.top, bottom: item.bottom, items: [item] });
    }
  });

  return rowList
    .sort((rowA, rowB) => rowA.top - rowB.top)
    .map((row) => ({
      ...row,
      items: row.items.sort((itemA, itemB) => itemA.left - itemB.left),
    }));
}

function getClosestWrapRow(rowList, yContent) {
  if (rowList.length === 0) return null;
  const firstRow = rowList[0];
  const lastRow = rowList[rowList.length - 1];
  if (yContent < firstRow.top) return firstRow;
  if (yContent > lastRow.bottom) return lastRow;

  const rowContainingPointer = rowList.find((row) => yContent >= row.top && yContent <= row.bottom);
  if (rowContainingPointer) return rowContainingPointer;

  return rowList.reduce((closestRow, row) => {
    const distanceCurrent = Math.abs(yContent - (row.top + row.bottom) / 2);
    const distanceClosest = Math.abs(yContent - (closestRow.top + closestRow.bottom) / 2);
    return distanceCurrent < distanceClosest ? row : closestRow;
  }, firstRow);
}

export function getSingleLinePreviewFromPoint(containerEl, clientX, options = {}) {
  const itemList = getSingleLineItemList(containerEl, options);
  if (itemList.length === 0) return null;
  const rect = containerEl.getBoundingClientRect();
  const xContent = clientX - rect.left + containerEl.scrollLeft;
  return getSlotPreviewFromItemList(itemList, xContent);
}

export function getWrapPreviewFromRowPoint(containerEl, clientX, clientY, options = {}) {
  const rowList = getWrapRowList(getWrapItemList(containerEl, options));
  if (rowList.length === 0) return null;

  const rect = containerEl.getBoundingClientRect();
  const xContent = clientX - rect.left + containerEl.scrollLeft;
  const yContent = clientY - rect.top + containerEl.scrollTop;
  const row = getClosestWrapRow(rowList, yContent);
  if (!row || row.items.length === 0) return null;

  return getSlotPreviewFromItemList(row.items, xContent);
}
