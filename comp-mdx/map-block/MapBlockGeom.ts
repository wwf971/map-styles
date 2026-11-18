// The geometry of polygon shapes (doc/map-block-data.md#shapes). A polygon is a closed ring of
// points on the grid lines, [row, col], each consecutive pair one border segment and the last
// joined back to the first. It may be non-convex; it may not cross itself.
//
// The functions here know nothing of blocks or stores: points in, numbers and points out.

export type GridPoint = [number, number]

// the box of a selection drag, in grid-line coordinates (continuous)
export type GridLineBox = {
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

// the signed area by the shoelace formula, col as x and row as y
export function polygonAreaSigned(pointList: readonly GridPoint[]) {
  let sum = 0
  for (let index = 0; index < pointList.length; index += 1) {
    const [rowA, colA] = pointList[index]
    const [rowB, colB] = pointList[(index + 1) % pointList.length]
    sum += colA * rowB - colB * rowA
  }
  return sum / 2
}

export function polygonArea(pointList: readonly GridPoint[]) {
  return Math.abs(polygonAreaSigned(pointList))
}

// the points as they should be kept: no point twice in a row (the ring is closed already, so
// the first is not repeated at the end), and no point in the middle of a straight run, so
// that one border segment is one segment of the data
export function polygonNormalize(pointList: readonly GridPoint[]): GridPoint[] {
  let pointListNext: GridPoint[] = []
  for (const [row, col] of pointList) {
    const pointLast = pointListNext[pointListNext.length - 1]
    if (pointLast && pointLast[0] === row && pointLast[1] === col) continue
    pointListNext.push([row, col])
  }
  // the ring is closed already: a last point repeating the first is dropped
  while (pointListNext.length > 1 && pointEqual(pointListNext[0], pointListNext[pointListNext.length - 1])) pointListNext.pop()
  // a point in the middle of a straight run (or at the tip of a spike, which has no area) goes,
  // until none is left
  let isChanged = true
  while (isChanged && pointListNext.length >= 3) {
    isChanged = false
    for (let index = 0; index < pointListNext.length; index += 1) {
      const pointPrev = pointListNext[(index - 1 + pointListNext.length) % pointListNext.length]
      const pointNext = pointListNext[(index + 1) % pointListNext.length]
      if (cross(pointPrev, pointListNext[index], pointNext) === 0) {
        pointListNext = pointListNext.filter((_point, indexOther) => indexOther !== index)
        isChanged = true
        break
      }
    }
  }
  return pointListNext
}

// why a ring of points is not a polygon a block can have, or '' when it is one: three points
// at least, an area, and no segment touching another than its two neighbours
export function polygonProblemGet(pointList: readonly GridPoint[]) {
  if (pointList.length < 3) return 'a polygon needs three points at least'
  if (pointList.some(([row, col]) => !Number.isFinite(row) || !Number.isFinite(col))) return 'a point is not a number'
  const count = pointList.length
  for (let indexA = 0; indexA < count; indexA += 1) {
    const a1 = pointList[indexA]
    const a2 = pointList[(indexA + 1) % count]
    for (let indexB = indexA + 1; indexB < count; indexB += 1) {
      const b1 = pointList[indexB]
      const b2 = pointList[(indexB + 1) % count]
      const isNeighbour = indexB === indexA + 1 || (indexA === 0 && indexB === count - 1)
      if (isNeighbour) {
        // neighbours share one point; they may not run back over each other
        const pointShared = indexB === indexA + 1 ? a2 : a1
        const pointA = indexB === indexA + 1 ? a1 : a2
        const pointB = indexB === indexA + 1 ? b2 : b1
        if (cross(pointA, pointShared, pointB) === 0 && dot(pointA, pointShared, pointB) > 0) return 'two border segments run over each other'
        continue
      }
      if (segmentIntersect(a1, a2, b1, b2)) return 'the border crosses itself'
    }
  }
  if (polygonArea(pointList) === 0) return 'the polygon has no area'
  return ''
}

// the bounding box of the points in grid lines
export function polygonLineBoxGet(pointList: readonly GridPoint[]): GridLineBox | null {
  if (!pointList.length) return null
  const rowList = pointList.map((point) => point[0])
  const colList = pointList.map((point) => point[1])
  return {
    rowStart: Math.min(...rowList),
    rowEnd: Math.max(...rowList),
    colStart: Math.min(...colList),
    colEnd: Math.max(...colList),
  }
}

// the area of the part of the polygon inside a box: the polygon clipped by the four sides of
// the box (Sutherland-Hodgman, which is exact for any polygon clipped by a convex window)
export function polygonBoxOverlapArea(pointList: readonly GridPoint[], box: GridLineBox) {
  type ClipSide = { isInside: (point: GridPoint) => boolean; cut: (a: GridPoint, b: GridPoint) => GridPoint }
  const sideList: ClipSide[] = [
    { isInside: (point) => point[1] >= box.colStart, cut: (a, b) => cutAtCol(a, b, box.colStart) },
    { isInside: (point) => point[1] <= box.colEnd, cut: (a, b) => cutAtCol(a, b, box.colEnd) },
    { isInside: (point) => point[0] >= box.rowStart, cut: (a, b) => cutAtRow(a, b, box.rowStart) },
    { isInside: (point) => point[0] <= box.rowEnd, cut: (a, b) => cutAtRow(a, b, box.rowEnd) },
  ]
  let output: GridPoint[] = pointList.map(([row, col]) => [row, col])
  for (const side of sideList) {
    const input = output
    output = []
    for (let index = 0; index < input.length; index += 1) {
      const point = input[index]
      const pointPrev = input[(index - 1 + input.length) % input.length]
      const isPointInside = side.isInside(point)
      const isPrevInside = side.isInside(pointPrev)
      if (isPointInside) {
        if (!isPrevInside) output.push(side.cut(pointPrev, point))
        output.push(point)
      } else if (isPrevInside) {
        output.push(side.cut(pointPrev, point))
      }
    }
    if (output.length === 0) return 0
  }
  return polygonArea(output)
}

// whether a point lies inside the polygon (on its border counts as outside)
export function polygonPointIsInside(pointList: readonly GridPoint[], point: GridPoint) {
  const [row, col] = point
  let isInside = false
  for (let index = 0, indexPrev = pointList.length - 1; index < pointList.length; indexPrev = index, index += 1) {
    const [rowA, colA] = pointList[index]
    const [rowB, colB] = pointList[indexPrev]
    if (pointOnSegment(point, pointList[index], pointList[indexPrev])) return false
    const isCrossing = (rowA > row) !== (rowB > row)
      && col < ((colB - colA) * (row - rowA)) / (rowB - rowA) + colA
    if (isCrossing) isInside = !isInside
  }
  return isInside
}

// where the label of a polygon goes: its centroid when that is inside, else the middle of
// the cell inside the polygon that is nearest to the centroid (an L shape has its centroid
// in its corner of nothing)
export function polygonLabelPointGet(pointList: readonly GridPoint[]): GridPoint {
  const box = polygonLineBoxGet(pointList)
  if (!box) return [0, 0]
  const centroid = polygonCentroidGet(pointList)
  if (polygonPointIsInside(pointList, centroid)) return centroid
  let pointBest: GridPoint = [(box.rowStart + box.rowEnd) / 2, (box.colStart + box.colEnd) / 2]
  let distanceBest = Infinity
  for (let row = box.rowStart; row < box.rowEnd; row += 1) {
    for (let col = box.colStart; col < box.colEnd; col += 1) {
      const pointCell: GridPoint = [row + 0.5, col + 0.5]
      if (!polygonPointIsInside(pointList, pointCell)) continue
      const distance = Math.hypot(pointCell[0] - centroid[0], pointCell[1] - centroid[1])
      if (distance < distanceBest) {
        distanceBest = distance
        pointBest = pointCell
      }
    }
  }
  return pointBest
}

export function polygonCentroidGet(pointList: readonly GridPoint[]): GridPoint {
  const areaSigned = polygonAreaSigned(pointList)
  if (areaSigned === 0) {
    const box = polygonLineBoxGet(pointList)!
    return [(box.rowStart + box.rowEnd) / 2, (box.colStart + box.colEnd) / 2]
  }
  let rowSum = 0
  let colSum = 0
  for (let index = 0; index < pointList.length; index += 1) {
    const [rowA, colA] = pointList[index]
    const [rowB, colB] = pointList[(index + 1) % pointList.length]
    const factor = colA * rowB - colB * rowA
    colSum += (colA + colB) * factor
    rowSum += (rowA + rowB) * factor
  }
  return [rowSum / (6 * areaSigned), colSum / (6 * areaSigned)]
}

// whether the points are the four corners of an axis-aligned rectangle
export function polygonIsRect(pointList: readonly GridPoint[]) {
  const pointListNormalized = polygonNormalize(pointList)
  if (pointListNormalized.length !== 4) return false
  const box = polygonLineBoxGet(pointListNormalized)!
  return pointListNormalized.every(([row, col]) => (row === box.rowStart || row === box.rowEnd) && (col === box.colStart || col === box.colEnd))
}

// the grid point nearest to a pointer position in grid lines
export function gridPointRound(pointerRow: number, pointerCol: number): GridPoint {
  return [Math.round(pointerRow), Math.round(pointerCol)]
}

// ---------- helpers ----------

function cross(a: GridPoint, b: GridPoint, c: GridPoint) {
  return (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1])
}

// the dot product of b->a and b->c: positive when a and c lie on the same side of b
function dot(a: GridPoint, b: GridPoint, c: GridPoint) {
  return (a[1] - b[1]) * (c[1] - b[1]) + (a[0] - b[0]) * (c[0] - b[0])
}

function pointEqual(a: GridPoint, b: GridPoint) {
  return a[0] === b[0] && a[1] === b[1]
}

function pointOnSegment(point: GridPoint, a: GridPoint, b: GridPoint) {
  if (cross(a, b, point) !== 0) return false
  return Math.min(a[0], b[0]) <= point[0] && point[0] <= Math.max(a[0], b[0])
    && Math.min(a[1], b[1]) <= point[1] && point[1] <= Math.max(a[1], b[1])
}

// whether two segments share any point (touching counts)
function segmentIntersect(a1: GridPoint, a2: GridPoint, b1: GridPoint, b2: GridPoint) {
  const d1 = Math.sign(cross(b1, b2, a1))
  const d2 = Math.sign(cross(b1, b2, a2))
  const d3 = Math.sign(cross(a1, a2, b1))
  const d4 = Math.sign(cross(a1, a2, b2))
  if (d1 * d2 < 0 && d3 * d4 < 0) return true
  if (d1 === 0 && pointOnSegment(a1, b1, b2)) return true
  if (d2 === 0 && pointOnSegment(a2, b1, b2)) return true
  if (d3 === 0 && pointOnSegment(b1, a1, a2)) return true
  if (d4 === 0 && pointOnSegment(b2, a1, a2)) return true
  return false
}

function cutAtCol(a: GridPoint, b: GridPoint, col: number): GridPoint {
  const ratio = (col - a[1]) / (b[1] - a[1])
  return [a[0] + (b[0] - a[0]) * ratio, col]
}

function cutAtRow(a: GridPoint, b: GridPoint, row: number): GridPoint {
  const ratio = (row - a[0]) / (b[0] - a[0])
  return [row, a[1] + (b[1] - a[1]) * ratio]
}
