import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { PropEditor as PropertyEditor } from 'ui-common';
import { chooseAnchoredPopupPos, rectFromViewportSize } from '../map-block/utils/popupPlacement';

const popupMargin = 8;
const popupInitialTop = 72;

function clampPanelPos(pos, size) {
  const width = Math.max(0, Number(size.width) || 0);
  const height = Math.max(0, Number(size.height) || 0);
  const xMax = Math.max(popupMargin, window.innerWidth - width - popupMargin);
  const yMax = Math.max(popupMargin, window.innerHeight - height - popupMargin);
  return {
    x: Math.min(xMax, Math.max(popupMargin, pos.x)),
    y: Math.min(yMax, Math.max(popupMargin, pos.y)),
  };
}

const ShikuchosonConfigPopup = observer(function ShikuchosonConfigPopup({ store }) {
  const panelRef = useRef(null);
  const dragRef = useRef(null);
  const [popupPos, setPopupPos] = useState(null);
  const colorPopupPlacement = useCallback((triggerRect, popupSize) => {
    const anchorRect = panelRef.current?.getBoundingClientRect() ?? triggerRect;
    const boundaryRect = rectFromViewportSize({ width: window.innerWidth, height: window.innerHeight });
    return chooseAnchoredPopupPos(anchorRect, popupSize, boundaryRect, 8);
  }, []);

  useLayoutEffect(() => {
    if (!store.isRegionColorEditorOpen) {
      setPopupPos(null);
      return;
    }
    const panelRect = panelRef.current?.getBoundingClientRect();
    const size = {
      width: panelRect?.width ?? 360,
      height: panelRect?.height ?? 540,
    };
    setPopupPos((posCurrent) => clampPanelPos(
      posCurrent ?? { x: (window.innerWidth - size.width) / 2, y: popupInitialTop },
      size,
    ));
  }, [store.isRegionColorEditorOpen]);

  useEffect(() => {
    if (!store.isRegionColorEditorOpen) return undefined;
    const handleResize = () => {
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (!panelRect) return;
      setPopupPos((posCurrent) => (posCurrent ? clampPanelPos(posCurrent, panelRect) : posCurrent));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [store.isRegionColorEditorOpen]);

  const beginDrag = (event) => {
    if (event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest('button')) return;
    const panelRect = panelRef.current?.getBoundingClientRect();
    if (!panelRect) return;
    event.preventDefault();
    const drag = {
      pointerId: event.pointerId,
      xStart: event.clientX,
      yStart: event.clientY,
      leftStart: panelRect.left,
      topStart: panelRect.top,
      width: panelRect.width,
      height: panelRect.height,
    };
    dragRef.current = drag;

    const dragMove = (moveEvent) => {
      if (!dragRef.current || drag.pointerId !== moveEvent.pointerId) return;
      setPopupPos(clampPanelPos({
        x: drag.leftStart + moveEvent.clientX - drag.xStart,
        y: drag.topStart + moveEvent.clientY - drag.yStart,
      }, drag));
    };

    const dragEnd = (upEvent) => {
      if (!dragRef.current || drag.pointerId !== upEvent.pointerId) return;
      dragRef.current = null;
      document.removeEventListener('pointermove', dragMove, true);
      document.removeEventListener('pointerup', dragEnd, true);
      document.removeEventListener('pointercancel', dragEnd, true);
    };

    document.addEventListener('pointermove', dragMove, true);
    document.addEventListener('pointerup', dragEnd, true);
    document.addEventListener('pointercancel', dragEnd, true);
  };

  if (!store.isRegionColorEditorOpen) return null;

  const popupStyle = popupPos
    ? { left: `${popupPos.x}px`, top: `${popupPos.y}px` }
    : { left: '50%', top: `${popupInitialTop}px`, transform: 'translateX(-50%)' };

  return (
    <div
      className="shikuchoson-config-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) store.regionColorEditorOpenSet(false);
      }}
    >
      <section className="shikuchoson-config-popup" ref={panelRef} style={popupStyle} role="dialog" aria-modal="true" aria-label="地域色設定">
        <div className="shikuchoson-config-popup-title" onPointerDown={beginDrag}>
          <span>地域色設定</span>
          <button type="button" className="shikuchoson-config-popup-close" onClick={() => store.regionColorEditorOpenSet(false)}>閉じる</button>
        </div>
        <PropertyEditor
          data={store.propEditorData}
          config={{
            width: '100%',
            isLevelLeftShown: false,
            isLevelTopShown: false,
            keyColWidth: 'min',
            keyColMinWidth: '84px',
            keyColMaxWidth: '120px',
            requestTimeoutMs: 1200,
            valueConfigByType: {
              color: {
                popupSize: { width: 264, height: 480 },
                popupPlacement: colorPopupPlacement,
              },
            },
          }}
          onEvent={store.handlePropEditorEvent}
        />
      </section>
    </div>
  );
});

export default ShikuchosonConfigPopup;
