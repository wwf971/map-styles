import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapBlockDataFromV1,
  mapBlockDataNormalize,
  mapBlockDataTextBuild,
  mapBlockDataTextParse,
  shapeCellRectGet,
  shapeDensityDouble,
  shapeDensityHalve,
  shapeDensityIsHalvable,
  shapeFromCellList,
  shapePointListGet,
  type MapBlockShape,
} from './MapBlockData'

// a map in the format of the first version, as the sqlite backend and the TypeScript constants held it
const dataV1 = {
  id: 'japan-prefecture-tile-grid-map',
  label: 'map',
  metadata: {
    rowStart: 1, rowEnd: 14, colStart: 1, colEnd: 16,
    indexDirection: { row: 'top-to-bottom', col: 'left-to-right' },
    cellAspectRatio: { width: 1, height: 0.7 },
    view: { mapWidthMax: 700, regionGreyedIds: ['group-kanto'] },
  },
  components: [
    { id: 'group-kanto', compType: 'group', renderCompName: 'groupBlock', label: '関東', type: 'rect', range: { rowStart: 3, rowEnd: 3, colStart: 10, colEnd: 11 }, children: ['tokyo'], metadata: { color: '#F3E889FF' } },
    { id: 'tokyo', compType: 'block', renderCompName: 'prefectureBlock', label: '東京', type: 'rect', range: { rowStart: 8, rowEnd: 8, colStart: 13, colEnd: 14 } },
    { id: 'cells', compType: 'block', renderCompName: 'prefectureBlock', label: 'L', type: 'cells', range: [{ row: 1, col: 1 }, { row: 2, col: 1 }, { row: 2, col: 2 }] },
  ],
}

test('a map of the first version is read in the format of now', () => {
  const data = mapBlockDataNormalize(dataV1)
  assert.equal(data.formatVersion, 2)
  assert.deepEqual(data.grid, { rowStart: 1, rowEnd: 14, colStart: 1, colEnd: 16, cellAspectRatio: { width: 1, height: 0.7 } })
  assert.equal(data.view.mapWidthMax, 700)
  assert.deepEqual(data.view.groupGreyedIdList, ['group-kanto'])
  const [group, block, cells] = data.compList
  assert.deepEqual(group, { id: 'group-kanto', kind: 'group', label: '関東', shape: { type: 'rect', rowStart: 3, rowEnd: 3, colStart: 10, colEnd: 11 }, childIdList: ['tokyo'], color: '#F3E889FF' })
  assert.deepEqual(block, { id: 'tokyo', kind: 'block', label: '東京', shape: { type: 'rect', rowStart: 8, rowEnd: 8, colStart: 13, colEnd: 14 } })
  // the cells of an L become its outline
  assert.equal(cells.shape.type, 'polygon')
  assert.deepEqual(shapeCellRectGet(cells.shape), { rowStart: 1, rowEnd: 2, colStart: 1, colEnd: 2 })
})

test('the converter is the same function the script uses', () => {
  assert.deepEqual(mapBlockDataNormalize(mapBlockDataFromV1(dataV1)), mapBlockDataNormalize(dataV1))
})

test('a set of cells filling a rectangle is a rectangle', () => {
  assert.deepEqual(shapeFromCellList([{ row: 2, col: 3 }, { row: 2, col: 4 }, { row: 3, col: 3 }, { row: 3, col: 4 }]), { type: 'rect', rowStart: 2, rowEnd: 3, colStart: 3, colEnd: 4 })
})

test('the tight text has one component per line and reads back to the same map', () => {
  const data = mapBlockDataNormalize(dataV1)
  const text = mapBlockDataTextBuild(data, 'tight')
  assert.equal(text.split('\n').filter((line) => line.startsWith('    {"id"')).length, data.compList.length)
  assert.deepEqual(mapBlockDataTextParse(text).data, data)
  assert.equal(mapBlockDataTextParse('{').code, -1)
})

test('doubling the density and halving it gives every shape back', () => {
  const shapeList: MapBlockShape[] = [
    { type: 'rect', rowStart: 3, rowEnd: 5, colStart: -2, colEnd: 0 },
    { type: 'polygon', pointList: [[3, 7], [3, 9], [5, 9], [5, 11], [7, 11], [7, 7]] },
  ]
  for (const shape of shapeList) {
    const shapeDoubled = shapeDensityDouble(shape)
    assert.equal(shapeDensityIsHalvable(shapeDoubled), true)
    assert.deepEqual(shapeDensityHalve(shapeDoubled), shape)
  }
  // a cell r becomes the cells 2r-1 and 2r
  assert.deepEqual(shapeDensityDouble({ type: 'rect', rowStart: 2, rowEnd: 2, colStart: 1, colEnd: 1 }), { type: 'rect', rowStart: 3, rowEnd: 4, colStart: 1, colEnd: 2 })
})

test('halving a shape off the coarser lines makes a rectangle grow, never shrink', () => {
  const shape: MapBlockShape = { type: 'rect', rowStart: 2, rowEnd: 2, colStart: 2, colEnd: 3 }
  assert.equal(shapeDensityIsHalvable(shape), false)
  assert.deepEqual(shapeDensityHalve(shape), { type: 'rect', rowStart: 1, rowEnd: 1, colStart: 1, colEnd: 2 })
})

test('the corners of a rectangle lie on the lines around its cells', () => {
  assert.deepEqual(shapePointListGet({ type: 'rect', rowStart: 1, rowEnd: 2, colStart: 3, colEnd: 3 }), [[1, 3], [1, 4], [3, 4], [3, 3]])
})
