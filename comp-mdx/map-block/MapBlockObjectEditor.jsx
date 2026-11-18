import { useEffect, useState } from 'react';
import { makeAutoObservable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { BlockPopupSurface } from '@wwf971/react-doc';
import { MapBlockEditor } from './MapBlockEditor';
import { MapBlockMapBar } from './MapBlockMapBar.jsx';
import { createMapBlockStore } from './MapBlockStore';
import {
	MAP_BLOCK_KIND_MAP,
	mapBlockAssetListGet,
	mapBlockAssetRead,
	mapBlockNewBuild,
	mapBlockPartitionChosenGet,
	mapBlockPartitionListGet,
	mapBlockPartitionPlaceText,
	mapBlockKeyPathBuild,
} from './MapBlockObject.js';

// The mode "editor" of a frontend object holding block maps (type map-block.map-set,
// doc/map-block.md#maps-as-a-frontend-object): the maps of one partition above, the one shown in
// the editor below. The map is read from its asset into an editor store, edited there (undo
// included), and written back as the asset's next version by Save.
//
//   param.partition   the partition shown first (else the object's default one)
//   param.map         the map shown first: an asset reference (key, path, name:…)
//
// In reading mode the maps are shown and selected, never changed: the edit mode of the map,
// a new map and Save are offered while the document is edited
// (react-doc: main/doc_page_impl_obj_frontend.md#reading-and-editing).

class MapBlockObjectEditorStore {
	editorStore = createMapBlockStore();
	partitionChosen = '';
	mapKeyChosen = '';
	// the map in the editor store, and its text as read when loaded or last saved
	mapKeyLoaded = '';
	textLoaded = '';
	status = 'idle';
	message = '';
	isMessageError = false;
	// a question in place: { kind: 'remove', mapKey, name } | { kind: 'switch', mapKeyTo, nameFrom, nameTo }
	ask = null;

	constructor() {
		makeAutoObservable(this, { editorStore: false }, { autoBind: true });
	}

	messageSet(message, isError = false) {
		this.message = message;
		this.isMessageError = isError;
	}

	partitionSelect(partitionId) {
		this.partitionChosen = partitionId;
		this.mapKeyChosen = '';
		this.ask = null;
	}

	// the map shown: the one chosen, else the block's parameter, else the first of the partition
	mapAssetGet(service, mapList, mapParam) {
		const assetChosen = mapList.find((asset) => asset.key === this.mapKeyChosen);
		if (assetChosen) return assetChosen;
		if (mapParam) {
			const assetParam = service.assetGet(mapParam);
			if (assetParam && mapList.some((asset) => asset.key === assetParam.key)) return assetParam;
		}
		return mapList[0] ?? null;
	}

	// another map chosen; unsaved changes are asked about first
	mapSelect(mapKeyTo, nameFrom, nameTo) {
		if (mapKeyTo === this.mapKeyLoaded) return;
		if (this.editorStore.isDirty) {
			this.ask = { kind: 'switch', mapKeyTo, nameFrom, nameTo };
			return;
		}
		this.mapKeyChosen = mapKeyTo;
		this.ask = null;
	}

	switchDiscard() {
		if (this.ask?.kind !== 'switch') return;
		this.editorStore.markSaved(this.editorStore.dataTextTight);
		this.mapKeyChosen = this.ask.mapKeyTo;
		this.ask = null;
	}

	async switchSave(service) {
		if (this.ask?.kind !== 'switch') return;
		const mapKeyTo = this.ask.mapKeyTo;
		const result = await this.save(service);
		runInAction(() => {
			if (result.code !== 0) return;
			this.mapKeyChosen = mapKeyTo;
			this.ask = null;
		});
	}

	// what the asset says now, taken into the editor: a map read for the first time is loaded;
	// the same map changed elsewhere (another block saved it) is loaded again, unless it has
	// unsaved changes here, which are kept and told about
	sync(mapKey, read) {
		if (!mapKey || read?.status !== 'done') return;
		if (mapKey !== this.mapKeyLoaded) {
			this.editorStore.setData(read.data);
			this.mapKeyLoaded = mapKey;
			this.textLoaded = read.text;
			this.messageSet('');
			return;
		}
		if (read.text === this.textLoaded) return;
		this.textLoaded = read.text;
		if (this.editorStore.isDirty) {
			this.messageSet('The map was saved elsewhere; Save writes your version over it.', true);
			return;
		}
		this.editorStore.setData(read.data);
	}

	// the map written as the next state of its asset (by the asset's save mode). the asset's
	// name is how the map is listed, the map's label what it says of itself: each is its own
	async save(service) {
		const mapKey = this.mapKeyLoaded;
		if (!mapKey) return { code: -1, message: 'No map is loaded' };
		const text = this.editorStore.dataTextTight;
		this.status = 'saving';
		this.messageSet('Saving');
		const result = await service.assetWrite(mapKey, text, 'saved from the block map editor');
		runInAction(() => {
			this.status = 'idle';
			if (result.code !== 0) {
				this.messageSet(result.message || 'The map was not saved', true);
				return;
			}
			this.textLoaded = text;
			this.editorStore.markSaved(text);
			this.messageSet('Saved');
		});
		return result;
	}

	revert() {
		this.editorStore.setData(JSON.parse(this.textLoaded));
		this.messageSet('');
	}

	// a new map at once, with a name of its own and something on it (react-doc: create without
	// a form), in the partition shown, then opened
	async create(service, partitionId) {
		const { name, text } = mapBlockNewBuild(service);
		const { key, path } = mapBlockKeyPathBuild(service, partitionId, name);
		this.status = 'creating';
		const result = await service.assetCreate({
			key,
			kind: MAP_BLOCK_KIND_MAP,
			name,
			pathList: [path],
			lang: 'json',
			text,
			...(partitionId ? { partition: partitionId } : {}),
		});
		runInAction(() => {
			this.status = 'idle';
			if (result.code !== 0) {
				this.messageSet(result.message || 'The map was not made', true);
				return;
			}
			this.mapKeyChosen = result.data?.key ?? '';
			this.messageSet(`${name} made`);
		});
	}

	removeAsk(service, mapKey) {
		const asset = service.assetGet(mapKey);
		this.ask = { kind: 'remove', mapKey, name: asset?.name || mapKey };
	}

	async remove(service, mapKey) {
		this.ask = null;
		this.status = 'removing';
		const result = await service.assetRemove(mapKey);
		runInAction(() => {
			this.status = 'idle';
			if (result.code !== 0) {
				this.messageSet(result.message || 'The map was not deleted', true);
				return;
			}
			if (this.mapKeyChosen === mapKey) this.mapKeyChosen = '';
			if (this.mapKeyLoaded === mapKey) this.mapKeyLoaded = '';
			this.messageSet('Map deleted');
		});
	}

	askCancel() {
		this.ask = null;
	}
}

export const MapBlockObjectEditor = observer(function MapBlockObjectEditor({ data = {}, config = {} }) {
	const service = config.objectFrontend;
	const [store] = useState(() => new MapBlockObjectEditorStore());
	const param = data.param ?? {};
	const partitionList = service ? mapBlockPartitionListGet(service) : [];
	const partitionId = service ? mapBlockPartitionChosenGet(service, store.partitionChosen, param.partition) : '';
	const mapList = service ? mapBlockAssetListGet(service, partitionId) : [];
	const mapAsset = service ? store.mapAssetGet(service, mapList, param.map) : null;
	const read = mapAsset ? mapBlockAssetRead(service, mapAsset.key) : null;

	useEffect(() => {
		store.sync(mapAsset?.key ?? '', read);
	}, [store, mapAsset?.key, read?.status, read?.text]);

	if (!service) return <p className="doc-error">MapBlockEditor is a mode of a frontend object (ObjectFrontend).</p>;

	const isEditing = service.docState?.isEditing === true;
	const isEditable = service.isEditable === true;
	const editorStore = store.editorStore;
	const isLoaded = Boolean(mapAsset) && store.mapKeyLoaded === mapAsset.key;
	const partition = partitionList.find((one) => one.id === partitionId);
	const nameOf = (asset) => asset?.name || asset?.key || '';

	const handleBarEvent = (eventType, eventData = {}) => {
		if (eventType === 'partitionSelect') return store.partitionSelect(eventData.partitionId);
		if (eventType === 'mapSelect') return store.mapSelect(eventData.mapKey, nameOf(mapAsset), nameOf(mapList.find((asset) => asset.key === eventData.mapKey)));
		if (eventType === 'mapCreate') return void store.create(service, partitionId);
		if (eventType === 'mapRemoveAsk') return store.removeAsk(service, eventData.mapKey);
		if (eventType === 'mapRemove') return void store.remove(service, eventData.mapKey);
		if (eventType === 'switchSave') return void store.switchSave(service);
		if (eventType === 'switchDiscard') return store.switchDiscard();
		if (eventType === 'askCancel') return store.askCancel();
		return undefined;
	};

	const saveControls = isEditing && isLoaded ? (
		<>
			<button type="button" className="map-block-header-button is-primary" disabled={!isEditable || !editorStore.isDirty || store.status !== 'idle'} title={isEditable ? 'Write the map as the next version of its asset' : service.editUnavailableReason} onClick={() => store.save(service)}>
				Save
			</button>
			<button type="button" className="map-block-header-button" disabled={!editorStore.isDirty || store.status !== 'idle'} title="Back to the map as last saved" onClick={store.revert}>
				Revert
			</button>
			<span className={`map-block-save-state ${store.isMessageError ? 'is-error' : ''}`} role="status">
				{store.message || (editorStore.isDirty ? 'Unsaved changes' : 'Saved')}
			</span>
		</>
	) : null;

	const title = editorStore.data.label || nameOf(mapAsset) || 'Block map';
	return (
		<BlockPopupSurface config={config} title={title} className="map-block-object-shell">
			{({ isInPopup }) => (
				<div className={`map-block-object-editor not-prose ${isInPopup ? 'is-popup' : ''}`}>
					<MapBlockMapBar
						data={{
							partitionList,
							partitionId,
							mapList: mapList.map((asset) => ({
								key: asset.key,
								name: asset.name,
								path: asset.pathList?.[0] ?? '',
								isDirty: asset.key === store.mapKeyLoaded && editorStore.isDirty,
							})),
							mapKey: mapAsset?.key ?? '',
							ask: store.ask,
							placeText: mapBlockPartitionPlaceText(partition),
							status: store.status,
						}}
						config={{ isEditing, isEditable, editUnavailableReason: service.editUnavailableReason }}
						onEvent={handleBarEvent}
					/>
					{!isEditing && store.message && store.isMessageError ? <div className="map-block-edit-message is-error">{store.message}</div> : null}
					{!mapAsset ? null : read?.status === 'error' ? (
						<p className="doc-error">{`The map ${nameOf(mapAsset)} cannot be read: ${read.message}`}</p>
					) : !isLoaded ? (
						<p className="map-block-map-bar-note">Reading the map…</p>
					) : (
						<MapBlockEditor
							store={editorStore}
							title={title}
							isEditAllowed={isEditing}
							editUnavailableReason="Switch the document to Edit to change the map"
							toolbarTrailing={saveControls}
						/>
					)}
				</div>
			)}
		</BlockPopupSurface>
	);
});

export default MapBlockObjectEditor;
