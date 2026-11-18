import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createMapBlockStore } from './MapBlockStore'
import { mapBlockDataNormalize } from './MapBlockData'

// a small map: a group of three blocks, a block in no group, and an L-shaped polygon
const mapData = () => mapBlockDataNormalize({
  formatVersion: 2,
  label: 'test',
  grid: { rowStart: 1, rowEnd: 10, colStart: 1, colEnd: 12, cellAspectRatio: { width: 1, height: 1 } },
  view: {},
  compList: [
    { id: 'g', kind: 'group', label: 'G', shape: { type: 'rect', rowStart: 1, rowEnd: 1, colStart: 1, colEnd: 2 }, childIdList: ['a', 'b', 'c'] },
    { id: 'a', kind: 'block', label: 'A', shape: { type: 'rect', rowStart: 3, rowEnd: 3, colStart: 1, colEnd: 1 } },
    { id: 'b', kind: 'block', label: 'B', shape: { type: 'rect', rowStart: 3, rowEnd: 3, colStart: 2, colEnd: 2 } },
    { id: 'c', kind: 'block', label: 'C', shape: { type: 'rect', rowStart: 3, rowEnd: 3, colStart: 3, colEnd: 3 } },
    { id: 'd', kind: 'block', label: 'D', shape: { type: 'rect', rowStart: 6, rowEnd: 6, colStart: 1, colEnd: 1 } },
    { id: 'l', kind: 'block', label: 'L', shape: { type: 'polygon', pointList: [[3, 7], [3, 9], [5, 9], [5, 11], [7, 11], [7, 7]] } },
  ],
})

const selection = (store: any) => ({
  self: [...store.selectState.selectedBlockIds].sort().join(','),
  group: [...store.selectState.selectedGroupIds].sort().join(','),
  final: [...store.selectedBlockIdsFinal].sort().join(','),
})

const rangeSelect = (store: any, from: [number, number], to: [number, number], operation = 'replace') => {
  store.handleEvent('beginSelectRectDrag', { pointerGridRow: from[0], pointerGridCol: from[1], operation })
  store.handleEvent('updateSelectRectDrag', { pointerGridRow: to[0], pointerGridCol: to[1] })
  store.handleEvent('commitSelectRectDrag', {})
}

test('selecting every block of a group selects the group (passive group selection)', () => {
  const store = createMapBlockStore(mapData())
  for (const id of ['a', 'b', 'c']) store.handleEvent('toggleBlockSelection', { componentId: id })
  assert.equal(selection(store).group, 'g')
  assert.equal(selection(store).final, 'a,b,c')
})

test('a block selected through its group: the first click marks it, the second splits the group', () => {
  const store = createMapBlockStore(mapData())
  store.handleEvent('toggleGroupSelection', { componentId: 'g' })
  assert.deepEqual(selection(store), { self: '', group: 'g', final: 'a,b,c' })
  store.handleEvent('toggleBlockSelection', { componentId: 'b' })
  assert.deepEqual(selection(store), { self: 'b', group: 'g', final: 'a,b,c' })
  store.handleEvent('toggleBlockSelection', { componentId: 'b' })
  assert.deepEqual(selection(store), { self: 'a,c', group: '', final: 'a,c' })
})

test('Shift adds, Ctrl toggles, and Ctrl wins over Shift', () => {
  const store = createMapBlockStore(mapData())
  store.handleEvent('toggleBlockSelection', { componentId: 'd', operation: 'add' })
  store.handleEvent('toggleBlockSelection', { componentId: 'a', operation: 'add' })
  assert.equal(selection(store).final, 'a,d')
  store.handleEvent('toggleBlockSelection', { componentId: 'a', operation: 'toggle' })
  assert.equal(selection(store).final, 'd')
})

test('a range dragged downward selects what it touches, upward what it holds whole', () => {
  const store = createMapBlockStore(mapData())
  rangeSelect(store, [3.5, 1.5], [3.6, 2.4])
  assert.equal(selection(store).final, 'a,b')
  rangeSelect(store, [3.6, 2.4], [3.5, 1.5])
  assert.equal(selection(store).final, '')
  rangeSelect(store, [4, 4], [2.9, 0.9])
  // the three blocks of the group, held whole: the group is selected passively
  assert.deepEqual(selection(store), { self: '', group: 'g', final: 'a,b,c' })
})

test('a range never selects a group block', () => {
  const store = createMapBlockStore(mapData())
  rangeSelect(store, [1.2, 1.2], [1.4, 2.5])
  assert.equal(selection(store).final, '')
})

test('a polygon is touched by its outline, not by its bounding box', () => {
  const store = createMapBlockStore(mapData())
  rangeSelect(store, [3.2, 9.2], [4.8, 10.8])
  assert.equal(selection(store).final, '')
  rangeSelect(store, [5.2, 9.2], [6.8, 10.8])
  assert.equal(selection(store).final, 'l')
  rangeSelect(store, [7.5, 11.5], [2.5, 6.5])
  assert.equal(selection(store).final, 'l')
})

test('density: x2 then /2 is exact; /2 off the coarser lines asks first and undo takes it back', () => {
  const store = createMapBlockStore(mapData())
  const textStart = store.dataTextTight
  store.handleEvent('increaseGridDensity', {})
  store.handleEvent('decreaseGridDensity', {})
  assert.equal(store.dataTextTight, textStart)
  const result = store.handleEvent('decreaseGridDensity', {}) as any
  assert.equal(result.code, -2)
  assert.equal(store.editState.densityHalve.isAsked, true)
  assert.equal(store.dataTextTight, textStart)
  store.handleEvent('decreaseGridDensity', { isForced: true })
  assert.notEqual(store.dataTextTight, textStart)
  store.handleEvent('undo', {})
  assert.equal(store.dataTextTight, textStart)
  store.handleEvent('redo', {})
  assert.notEqual(store.dataTextTight, textStart)
})

test('a drag that goes nowhere leaves no step to undo', () => {
  const store = createMapBlockStore(mapData())
  store.handleEvent('beginMoveDrag', { componentId: 'a', pointerGridRow: 3.5, pointerGridCol: 1.5 })
  store.handleEvent('commitMoveDrag', {})
  assert.equal(store.isUndoAvailable, false)
  store.handleEvent('beginMoveDrag', { componentId: 'l', pointerGridRow: 6, pointerGridCol: 8 })
  store.handleEvent('updateMoveDrag', { pointerGridRow: 7, pointerGridCol: 8 })
  store.handleEvent('commitMoveDrag', {})
  assert.deepEqual((store.componentById.get('l') as any).shape.pointList[0], [4, 7])
  assert.equal(store.isUndoAvailable, true)
  assert.equal(store.isDirty, true)
})

test('a polygon is drawn point by point and closed on its first point', () => {
  const store = createMapBlockStore(mapData())
  store.handleEvent('setEditTool', { tool: 'polygon' })
  for (const [row, col] of [[8, 2], [8, 6], [10, 6]]) store.handleEvent('addPolygonDrawPoint', { pointerGridRow: row + 0.2, pointerGridCol: col - 0.3 })
  const result = store.handleEvent('addPolygonDrawPoint', { pointerGridRow: 8, pointerGridCol: 2 }) as any
  assert.equal(result.code, 0)
  const component = store.componentById.get(result.data.componentId) as any
  assert.deepEqual(component.shape, { type: 'polygon', pointList: [[8, 2], [8, 6], [10, 6]] })
  assert.equal(store.editState.selectedComponentId, component.id)
})

test('a corner dragged so that the border crosses itself is refused', () => {
  const store = createMapBlockStore(mapData())
  const pointListBefore = JSON.stringify((store.componentById.get('l') as any).shape.pointList)
  store.handleEvent('beginPolygonVertexDrag', { componentId: 'l', index: 3, pointerGridRow: 5, pointerGridCol: 11 })
  store.handleEvent('updatePolygonPointDrag', { pointerGridRow: 5, pointerGridCol: 6 })
  assert.equal(store.editState.drag.point.isDropValid, false)
  store.handleEvent('commitPolygonPointDrag', {})
  assert.equal(JSON.stringify((store.componentById.get('l') as any).shape.pointList), pointListBefore)
  assert.match(store.editState.message, /crosses itself/)
})

test('a horizontal segment dragged moves up and down only', () => {
  const store = createMapBlockStore(mapData())
  // the bottom segment of the L, from [7, 11] to [7, 7]
  store.handleEvent('beginPolygonSegmentDrag', { componentId: 'l', index: 4, pointerGridRow: 7, pointerGridCol: 9 })
  store.handleEvent('updatePolygonPointDrag', { pointerGridRow: 9, pointerGridCol: 10 })
  store.handleEvent('commitPolygonPointDrag', {})
  assert.deepEqual((store.componentById.get('l') as any).shape.pointList, [[3, 7], [3, 9], [5, 9], [5, 11], [9, 11], [9, 7]])
})

test('a block changes its group, and a rectangle becomes a polygon and back', () => {
  const store = createMapBlockStore(mapData())
  store.setComponentGroup('d', 'g')
  assert.deepEqual((store.componentById.get('g') as any).childIdList, ['a', 'b', 'c', 'd'])
  store.setComponentGroup('a', '')
  assert.deepEqual((store.componentById.get('g') as any).childIdList, ['b', 'c', 'd'])
  store.convertComponentShape('d', 'polygon')
  assert.equal((store.componentById.get('d') as any).shape.type, 'polygon')
  store.convertComponentShape('d', 'rect')
  assert.deepEqual((store.componentById.get('d') as any).shape, { type: 'rect', rowStart: 6, rowEnd: 6, colStart: 1, colEnd: 1 })
  assert.equal(store.convertComponentShape('l', 'rect').code, -1)
})
