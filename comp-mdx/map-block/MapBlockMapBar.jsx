import { observer } from 'mobx-react-lite';
import { SegmentedControl } from '@wwf971/react-comp-misc';

// The maps of a frontend object, above the editor (MapBlockObjectEditor.jsx): which partition
// is shown, one chip per map of it, and, while the document is edited, a new map and the removal
// of the one shown. It renders what it is given and reports what is clicked.
//
//   Maps   Partition [Example | Playground]   (Japan prefectures ●) (Map 2)   + New map   Delete
//          a new map goes to item/playground/map/, kept out of git

const MapBlockMapBar = observer(({ data, config = {}, onEvent }) => {
	const {
		partitionList = [],
		partitionId = '',
		mapList = [],
		mapKey = '',
		ask = null,
		placeText = '',
		status = 'idle',
	} = data;
	const isEditing = config.isEditing === true;
	const isEditable = config.isEditable === true;
	const isBusy = status !== 'idle';
	const mapShown = mapList.find((map) => map.key === mapKey);

	return (
		<section className="map-block-map-bar" aria-label="Maps">
			<div className="map-block-map-bar-row">
				<span className="map-block-map-bar-title">Maps</span>
				{partitionList.length > 1 ? (
					<div className="map-block-map-bar-partition" title="The partition of the object the maps lie in">
						<span className="map-block-edit-toolbar-label">Partition</span>
						<SegmentedControl
							data={{ valueSelected: partitionId, options: partitionList.map((one) => ({ value: one.id, label: one.label })) }}
							config={{ color: '#2d579e', widthMode: 'auto' }}
							onEvent={(_eventName, eventData) => {
								if (eventData?.valueSelected) onEvent('partitionSelect', { partitionId: eventData.valueSelected });
							}}
						/>
					</div>
				) : null}
				<div className="map-block-map-chip-list" role="tablist">
					{mapList.length === 0 ? <span className="map-block-map-bar-note">No map in this partition yet.</span> : null}
					{mapList.map((map) => (
						<button
							key={map.key}
							type="button"
							role="tab"
							aria-selected={map.key === mapKey}
							className={`map-block-map-chip ${map.key === mapKey ? 'is-selected' : ''}`}
							title={map.path || map.key}
							onClick={() => onEvent('mapSelect', { mapKey: map.key })}
						>
							<span>{map.name || map.key}</span>
							{map.isDirty ? <span className="map-block-map-chip-dirty" title="Unsaved changes" aria-label="unsaved changes" /> : null}
						</button>
					))}
				</div>
				{isEditing ? (
					<div className="map-block-map-bar-actions">
						<button type="button" className="map-block-header-button" disabled={!isEditable || isBusy} title={isEditable ? `A new map: ${placeText}` : config.editUnavailableReason} onClick={() => onEvent('mapCreate', {})}>
							+ New map
						</button>
						{mapShown ? (
							<button type="button" className="map-block-header-button" disabled={!isEditable || isBusy} title={isEditable ? `Delete ${mapShown.name || mapShown.key}` : config.editUnavailableReason} onClick={() => onEvent('mapRemoveAsk', { mapKey: mapShown.key })}>
								Delete
							</button>
						) : null}
					</div>
				) : null}
			</div>
			{isEditing && placeText ? <div className="map-block-map-bar-note">{`A new map ${placeText}.`}</div> : null}
			{ask?.kind === 'remove' ? (
				<div className="map-block-edit-ask" role="alert">
					<span>{`Delete the map ${ask.name}? Its versions stay in the asset store, out of the object.`}</span>
					<button type="button" className="map-block-header-button" onClick={() => onEvent('mapRemove', { mapKey: ask.mapKey })}>Delete</button>
					<button type="button" className="map-block-header-button" onClick={() => onEvent('askCancel', {})}>Cancel</button>
				</div>
			) : null}
			{ask?.kind === 'switch' ? (
				<div className="map-block-edit-ask" role="alert">
					<span>{`${ask.nameFrom} has unsaved changes.`}</span>
					<button type="button" className="map-block-header-button" onClick={() => onEvent('switchSave', {})}>Save and open {ask.nameTo}</button>
					<button type="button" className="map-block-header-button" onClick={() => onEvent('switchDiscard', {})}>Discard changes</button>
					<button type="button" className="map-block-header-button" onClick={() => onEvent('askCancel', {})}>Cancel</button>
				</div>
			) : null}
		</section>
	);
});

export { MapBlockMapBar };
export default MapBlockMapBar;
