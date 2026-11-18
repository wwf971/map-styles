import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  polygonArea,
  polygonBoxOverlapArea,
  polygonIsRect,
  polygonLabelPointGet,
  polygonNormalize,
  polygonPointIsInside,
  polygonProblemGet,
  type GridPoint,
} from './MapBlockGeom'

// an L: a 4 x 4 square of cells without its top right 2 x 2 quarter
const shapeL: GridPoint[] = [[3, 7], [3, 9], [5, 9], [5, 11], [7, 11], [7, 7]]

test('the area of a polygon counts its cells', () => {
  assert.equal(polygonArea(shapeL), 12)
  assert.equal(polygonArea([[0, 0], [0, 2], [2, 0]]), 2)
})

test('normalizing drops repeated points and points in the middle of a straight run', () => {
  assert.deepEqual(polygonNormalize([[0, 0], [0, 1], [0, 2], [2, 2], [2, 2], [2, 0], [0, 0]]), [[0, 0], [0, 2], [2, 2], [2, 0]])
})

test('a polygon crossing itself, or without area, is refused with the reason', () => {
  assert.equal(polygonProblemGet(shapeL), '')
  assert.match(polygonProblemGet([[0, 0], [0, 2], [2, 0], [2, 2]]), /crosses itself/)
  assert.match(polygonProblemGet([[0, 0], [0, 2], [0, 4]]), /run over each other|no area/)
  assert.match(polygonProblemGet([[0, 0], [0, 2]]), /three points/)
})

test('a box over the empty corner of an L does not overlap it; a box over its body does', () => {
  assert.equal(polygonBoxOverlapArea(shapeL, { rowStart: 3.2, rowEnd: 4.8, colStart: 9.2, colEnd: 10.8 }), 0)
  assert.ok(polygonBoxOverlapArea(shapeL, { rowStart: 5.5, rowEnd: 6, colStart: 9.5, colEnd: 10 }) > 0)
  // touching the border only is no overlap
  assert.equal(polygonBoxOverlapArea(shapeL, { rowStart: 1, rowEnd: 3, colStart: 7, colEnd: 9 }), 0)
})

test('the label of an L lies inside it', () => {
  const point = polygonLabelPointGet(shapeL)
  assert.ok(polygonPointIsInside(shapeL, point))
})

test('a polygon of four right angles is a rectangle', () => {
  assert.equal(polygonIsRect([[1, 1], [1, 3], [4, 3], [4, 1]]), true)
  assert.equal(polygonIsRect(shapeL), false)
})
