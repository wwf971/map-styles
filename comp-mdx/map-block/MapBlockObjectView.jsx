import { useState } from 'react';
import { makeAutoObservable } from 'mobx';
import { observer } from 'mobx-react-lite';
import { MapBlockSelect } from './MapBlockSelect.jsx';
import { mapBlockAssetListGet, mapBlockAssetRead } from './MapBlockObject.js';

// The mode "view" of a frontend object holding block maps: one map in the flow of the document,
// without the editor around it (doc/map-block.md#the-modes). The selection is the reader's own
// while the page is open; nothing is written.
//
//   param.map           the map: an asset reference (key, path, name:…); absent, the first map
//   param.interaction   select (default): blocks and groups are selected; display: the map only

class MapBlockObjectViewStore {
	blockSelectedIdList = [];

	constructor() {
		makeAutoObservable(this, {}, { autoBind: true });
	}

	blockSelectedIdListSet(blockIdList) {
		this.blockSelectedIdList = [...blockIdList];
	}
}

export const MapBlockObjectView = observer(function MapBlockObjectView({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	const [store] = useState(() => new MapBlockObjectViewStore());
	if (!service) return <p className="doc-error">MapBlockView is a mode of a frontend object (ObjectFrontend).</p>;
	const param = data.param ?? {};
	const mapAsset = param.map ? service.assetGet(param.map) : mapBlockAssetListGet(service)[0];
	if (!mapAsset) return <p className="doc-error">{param.map ? `The object has no map ${param.map}` : 'The object has no map yet'}</p>;
	const read = mapBlockAssetRead(service, mapAsset.key);
	if (read.status === 'error') return <p className="doc-error">{`The map ${mapAsset.name || mapAsset.key} cannot be read: ${read.message}`}</p>;
	if (read.status !== 'done') return <p className="map-block-map-bar-note">Reading the map…</p>;
	const isSelect = param.interaction !== 'display';
	const blockById = new Map(read.data.compList.map((component) => [component.id, component]));
	const labelList = store.blockSelectedIdList.map((blockId) => blockById.get(blockId)?.label).filter(Boolean);
	return (
		<div className="map-block-object-view not-prose">
			<MapBlockSelect
				data={{ mapData: read.data, blockSelectedIdList: store.blockSelectedIdList }}
				config={{ mode: isSelect ? 'select' : 'display', mapWidthMax: read.data.view.mapWidthMax }}
				onEvent={(eventType, eventData) => {
					if (eventType === 'blockIdListSet') store.blockSelectedIdListSet(eventData.blockIdList);
				}}
			/>
			{isSelect ? (
				<div className="map-block-status-row">
					<button type="button" className="map-block-clear" onClick={() => store.blockSelectedIdListSet([])}>Clear</button>
					<div className="map-block-status" aria-live="polite">
						<div>
							<span>Selected</span>
							<strong>{labelList.length ? labelList.join('、') : 'none'}</strong>
						</div>
					</div>
				</div>
			) : null}
		</div>
	);
});

export default MapBlockObjectView;
