import { useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { PropEditor as PropertyEditor } from 'ui-common';
import { chooseAnchoredPopupPos, rectFromViewportSize } from '../utils/popupPlacement';

const MapBlockPropEditorPopup = observer(function MapBlockPropEditorPopup({ store }) {
  const panelRef = useRef(null);
  const editorState = store.editPropEditorState;
  const editorData = store.propEditorData;
  const colorPopupPlacement = useCallback((triggerRect, popupSize) => {
    const anchorRect = panelRef.current?.getBoundingClientRect() ?? triggerRect;
    const boundaryRect = rectFromViewportSize({ width: window.innerWidth, height: window.innerHeight });
    return chooseAnchoredPopupPos(anchorRect, popupSize, boundaryRect, 8);
  }, []);
  if (!editorState.isShown || !editorData) return null;

  const editorConfig = {
    ...store.propEditorConfig,
    width: '300px',
    isLevelLeftShown: false,
    isLevelTopShown: true,
    keyColWidth: 'min',
    keyColMinWidth: '54px',
    keyColMaxWidth: '86px',
    requestTimeoutMs: 1600,
    valueConfigByType: {
      color: {
        popupSize: { width: 264, height: 480 },
        popupPlacement: colorPopupPlacement,
      },
    },
  };

  return (
    <section
      className="map-block-prop-editor-popup"
      ref={panelRef}
      style={{ left: `${editorState.pos.x}px`, top: `${editorState.pos.y}px`, width: editorConfig.width }}
      role="dialog"
      aria-label={editorConfig.titleText}
    >
      <div
        className="map-block-prop-editor-title"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          store.beginPropEditorDrag(event.clientX, event.clientY);
        }}
      >
        <span className="map-block-prop-editor-title-text">{editorConfig.titleText}</span>
        <button type="button" className="map-block-prop-editor-close" onClick={store.closePropEditor}>Close</button>
      </div>
      <PropertyEditor data={editorData} config={editorConfig} onEvent={store.handlePropEditorEvent} />
    </section>
  );
});

export default MapBlockPropEditorPopup;
