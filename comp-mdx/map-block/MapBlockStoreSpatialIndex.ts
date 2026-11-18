import RBush from 'rbush'
import type { MapBlockStore } from './MapBlockStore'
import { shapeCellRectGet, type GridBoxRange, type MapBlockComp } from './MapBlockData'

// The blocks a selection box may touch, found by their bounding boxes in an R-tree (rbush) and
// then tested one by one (MapBlockStoreSelection.ts); "linear" tests every block instead.

export type SpatialIndexItem = {
	minX: number
	minY: number
	maxX: number
	maxY: number
	componentId: string
}

type SelectionSpatialIndex = {
	tree: RBush<SpatialIndexItem>
	size: number
}

const spatialIndexByStore = new WeakMap<MapBlockStore, SelectionSpatialIndex>()

const componentToSpatialItem = (component: MapBlockComp): SpatialIndexItem | null => {
	const rect = shapeCellRectGet(component.shape)
	if (!rect) return null
	return {
		minX: rect.colStart,
		minY: rect.rowStart,
		maxX: rect.colEnd + 1,
		maxY: rect.rowEnd + 1,
		componentId: component.id,
	}
}

const boxToSpatialItem = (box: GridBoxRange): Omit<SpatialIndexItem, 'componentId'> => ({
	minX: box.colStart,
	minY: box.rowStart,
	maxX: box.colEnd,
	maxY: box.rowEnd,
})

export function rebuildSelectionSpatialIndex(store: MapBlockStore) {
	const items = store.blockComponents.map(componentToSpatialItem).filter((item): item is SpatialIndexItem => item !== null)
	const tree = new RBush<SpatialIndexItem>()
	tree.load(items)
	const index = { tree, size: items.length }
	spatialIndexByStore.set(store, index)
}

export function getSelectionCandidateBlockComponents(store: MapBlockStore, box: GridBoxRange) {
	if (store.config.selectionSpatialIndexMode === 'linear') return store.blockComponents

	let index = spatialIndexByStore.get(store)
	if (!index) {
		rebuildSelectionSpatialIndex(store)
		index = spatialIndexByStore.get(store)
	}
	if (!index || index.size === 0) return store.blockComponents

	return index
		.tree.search(boxToSpatialItem(box))
		.map((item) => store.componentById.get(item.componentId))
		.filter((component): component is MapBlockComp => component?.kind === 'block')
}
