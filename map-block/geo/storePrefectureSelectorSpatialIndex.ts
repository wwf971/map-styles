import RBush from 'rbush'
import type { PrefectureSelectorStore } from './storePrefectureSelector'
import {
	type GridBoxRange,
	type GridCell,
	type GridRectRange,
	type TileGridMapComponent,
} from './PrefectureSelectorConfig'

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

const spatialIndexByStore = new WeakMap<PrefectureSelectorStore, SelectionSpatialIndex>()

const isRectRange = (range: GridRectRange | readonly GridCell[]): range is GridRectRange => !Array.isArray(range)

const getComponentRect = (component: TileGridMapComponent): GridRectRange | null => {
	if (component.type === 'rect' && isRectRange(component.range)) {
		return {
			rowStart: Math.min(component.range.rowStart, component.range.rowEnd),
			rowEnd: Math.max(component.range.rowStart, component.range.rowEnd),
			colStart: Math.min(component.range.colStart, component.range.colEnd),
			colEnd: Math.max(component.range.colStart, component.range.colEnd),
		}
	}

	const cells = component.range as readonly GridCell[]
	if (!cells.length) return null
	const rows = cells.map((cell) => cell.row)
	const cols = cells.map((cell) => cell.col)
	return {
		rowStart: Math.min(...rows),
		rowEnd: Math.max(...rows),
		colStart: Math.min(...cols),
		colEnd: Math.max(...cols),
	}
}

const componentToSpatialItem = (component: TileGridMapComponent): SpatialIndexItem | null => {
	const rect = getComponentRect(component)
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

export function rebuildSelectionSpatialIndex(store: PrefectureSelectorStore) {
	const items = store.blockComponents.map(componentToSpatialItem).filter((item): item is SpatialIndexItem => item !== null)
	const tree = new RBush<SpatialIndexItem>()
	tree.load(items)
	const index = { tree, size: items.length }
	spatialIndexByStore.set(store, index)
}

export function getSelectionCandidateBlockComponents(store: PrefectureSelectorStore, box: GridBoxRange) {
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
		.filter((component): component is TileGridMapComponent => component?.compType === 'block')
}
