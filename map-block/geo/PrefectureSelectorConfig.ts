export type GridCell = {
    row: number
    col: number
}

export type GridRectRange = {
    rowStart: number
    rowEnd: number
    colStart: number
    colEnd: number
}

export type GridBoxRange = {
    rowStart: number
    rowEnd: number
    colStart: number
    colEnd: number
}

export type TileGridMapMetadata = {
    rowStart: number
    rowEnd: number
    colStart: number
    colEnd: number
    indexDirection: {
        row: 'top-to-bottom'
        col: 'left-to-right'
    }
    cellAspectRatio: {
        width: number
        height: number
    }
    view?: {
        mapWidthMax?: number
        backgroundColor?: string
        regionGreyedIds?: readonly string[]
    }
}

export type TileGridMapRenderableComponentBase = {
    id: string
    label: string
    renderCompName: 'prefectureBlock' | 'groupBlock'
    metadata?: Record<string, unknown>
}

export type TileGridMapRangedComponent = TileGridMapRenderableComponentBase & (
    | { type: 'rect'; range: GridRectRange }
    | { type: 'cells'; range: readonly GridCell[] }
)

export type TileGridMapGroupComponent = TileGridMapRangedComponent & {
    compType: 'group'
    children: readonly string[]
}

export type TileGridMapBlockComponent = TileGridMapRangedComponent & {
    compType: 'block'
}

export type TileGridMapComponent = TileGridMapGroupComponent | TileGridMapBlockComponent

export type TileGridMapData = {
    id: string
    label: string
    metadata: TileGridMapMetadata
    components: readonly TileGridMapComponent[]
}