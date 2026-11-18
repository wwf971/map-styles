import { mapBlockDataNewBuild, mapBlockDataTextBuild, mapBlockDataTextParse } from './MapBlockData';

// Block maps kept as a frontend object (doc/map-block.md#maps-as-a-frontend-object): every map
// is one asset of kind "map", its text the json of the map (MapBlockData.ts), lying in a
// partition of the object (example: tracked by git; playground: kept out of git). What the
// modes share is here: which maps a partition holds, reading one, and the text of a new one.

export const MAP_BLOCK_KIND_MAP = 'map';

// the partitions a mode offers: those the type declares, then any other holding a map
export function mapBlockPartitionListGet(service) {
	const partitionList = service?.partitionList ?? [];
	const idSet = new Set(partitionList.map((one) => one.id));
	const extraList = (service?.assetList(MAP_BLOCK_KIND_MAP) ?? [])
		.map((asset) => asset.partition)
		.filter((id) => id && !idSet.has(id) && idSet.add(id));
	return [
		...partitionList.map((one) => ({ id: one.id, label: one.label || one.id, isGitIgnored: one.isGitIgnored === true, isDefault: one.isDefault === true })),
		...extraList.map((id) => ({ id, label: id, isGitIgnored: false, isDefault: false })),
	];
}

// the partition shown: the one chosen, else the block's parameter, else the default one
export function mapBlockPartitionChosenGet(service, partitionChosen, partitionParam) {
	const partitionList = mapBlockPartitionListGet(service);
	const idList = partitionList.map((one) => one.id);
	if (partitionChosen && idList.includes(partitionChosen)) return partitionChosen;
	if (partitionParam && idList.includes(partitionParam)) return partitionParam;
	return partitionList.find((one) => one.isDefault)?.id ?? partitionList[0]?.id ?? '';
}

// the maps of a partition ('' for every map), in the order of the object's lists
export function mapBlockAssetListGet(service, partition = '') {
	return (service?.assetList(MAP_BLOCK_KIND_MAP) ?? [])
		.filter((asset) => asset.status !== 'deleted')
		.filter((asset) => !partition || asset.partition === partition);
}

// one map: { status: loading | done | error, data?, text?, message }. the same text gives the
// same data object back, so a component keyed on the data (a store made per map) keeps its state
export function mapBlockAssetRead(service, assetRef) {
	if (!service || !assetRef) return { status: 'error', message: 'No map is named' };
	const read = service.assetTextGet(assetRef);
	if (read.status !== 'done') return { status: read.status, message: read.message ?? '' };
	const parsed = mapBlockTextParseCached(read.text);
	if (parsed.code !== 0) return { status: 'error', message: parsed.message, text: read.text };
	return { status: 'done', data: parsed.data, text: read.text, message: '' };
}

const parsedByText = new Map();
const parsedCountMax = 32;

function mapBlockTextParseCached(text) {
	const parsedKept = parsedByText.get(text);
	if (parsedKept) return parsedKept;
	const parsed = mapBlockDataTextParse(text);
	parsedByText.set(text, parsed);
	if (parsedByText.size > parsedCountMax) parsedByText.delete(parsedByText.keys().next().value);
	return parsed;
}

// where a new map goes, said before it is made: its folder, and whether git keeps it
export function mapBlockPartitionPlaceText(partition) {
	if (!partition) return 'goes to item/map/';
	return `goes to item/${partition.id}/map/, ${partition.isGitIgnored ? 'kept out of git' : 'tracked by git'}`;
}

// the next free name of a new map, and its text: a small grid with a group and two blocks
export function mapBlockNewBuild(service) {
	const nameSet = new Set(mapBlockAssetListGet(service).map((asset) => asset.name));
	let index = 1;
	while (nameSet.has(`Map ${index}`)) index += 1;
	const name = `Map ${index}`;
	return { name, text: mapBlockDataTextBuild(mapBlockDataNewBuild(name), 'tight') };
}

// the key and the path of a new map: a segment of its name, free as a key in the object, and
// the path its partition first, as every path of an object cut into partitions
// (react-doc: main/doc_page_impl_obj_frontend.md#partitions)
export function mapBlockKeyPathBuild(service, partition, name) {
	const assetList = service?.assetList() ?? [];
	const keyTaken = new Set(assetList.map((asset) => asset.key));
	const pathTaken = new Set(assetList.flatMap((asset) => asset.pathList ?? []));
	const segmentBase = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'map';
	for (let index = 1; ; index += 1) {
		const key = index === 1 ? segmentBase : `${segmentBase}-${index}`;
		const path = [partition ? `/${partition}` : '', '/map/', key].join('');
		if (!keyTaken.has(key) && !pathTaken.has(path)) return { key, path };
	}
}
