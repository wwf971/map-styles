export type PopupRect = {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

export type PopupSize = {
  width: number
  height: number
}

export type PopupPos = {
  x: number
  y: number
}

export function rectFromViewportSize(viewportSize: PopupSize): PopupRect {
  const width = Math.max(0, Number(viewportSize.width) || 0)
  const height = Math.max(0, Number(viewportSize.height) || 0)
  return {
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
  }
}

export function chooseAnchoredPopupPos(anchorRect: PopupRect, popupSize: PopupSize, boundaryRect: PopupRect, gap = 8): PopupPos {
  const candidateList = [
    { x: anchorRect.left - popupSize.width - gap, y: anchorRect.top },
    { x: anchorRect.left - popupSize.width - gap, y: anchorRect.bottom - popupSize.height },
    { x: anchorRect.right + gap, y: anchorRect.top },
    { x: anchorRect.right + gap, y: anchorRect.bottom - popupSize.height },
    { x: anchorRect.left, y: anchorRect.top - popupSize.height - gap },
    { x: anchorRect.right - popupSize.width, y: anchorRect.top - popupSize.height - gap },
    { x: anchorRect.left, y: anchorRect.bottom + gap },
    { x: anchorRect.right - popupSize.width, y: anchorRect.bottom + gap },
  ]

  const depthOf = (pos: PopupPos) => {
    const depthX = Math.max(0, boundaryRect.left - pos.x, pos.x + popupSize.width - boundaryRect.right)
    const depthY = Math.max(0, boundaryRect.top - pos.y, pos.y + popupSize.height - boundaryRect.bottom)
    return Math.max(depthX, depthY)
  }

  let candidateBest = candidateList[0]
  let depthBest = depthOf(candidateBest)
  if (depthBest === 0) return candidateBest

  for (let index = 1; index < candidateList.length; index += 1) {
    const candidate = candidateList[index]
    const depth = depthOf(candidate)
    if (depth === 0) return candidate
    if (depth < depthBest) {
      candidateBest = candidate
      depthBest = depth
    }
  }

  const xMax = Math.max(boundaryRect.left, boundaryRect.right - popupSize.width)
  const yMax = Math.max(boundaryRect.top, boundaryRect.bottom - popupSize.height)

  return {
    x: Math.min(xMax, Math.max(boundaryRect.left, candidateBest.x)),
    y: Math.min(yMax, Math.max(boundaryRect.top, candidateBest.y)),
  }
}
