---
title: Block maps: the format
description: The data of one block map, its coordinates and shapes, its text, and the format of the first version
---

# Block maps: the format

One map is one json object (`MapBlockData.ts`). It is what a map asset holds, what the store edits and what the JSON dialog of the editor shows.

```json
{
  "formatVersion": 2,
  "label": "日本都道府県タイルマップ",
  "grid": { "rowStart": 1, "rowEnd": 14, "colStart": 1, "colEnd": 16, "cellAspectRatio": { "width": 1, "height": 1 } },
  "view": { "mapWidthMax": 620, "backgroundColor": "#eaf5ff", "groupGreyedIdList": [] },
  "compList": [
    { "id": "group-kanto", "kind": "group", "label": "関東", "shape": { "type": "rect", "rowStart": 3, "rowEnd": 3, "colStart": 10, "colEnd": 11 }, "childIdList": ["ibaraki", "tochigi"], "color": "#F3E889FF" },
    { "id": "tokyo", "kind": "block", "label": "東京", "shape": { "type": "rect", "rowStart": 8, "rowEnd": 8, "colStart": 13, "colEnd": 13 } },
    { "id": "l-shape", "kind": "block", "label": "L shape", "shape": { "type": "polygon", "pointList": [[3, 7], [3, 9], [5, 9], [5, 11], [7, 11], [7, 7]] } }
  ]
}
```

| key | what |
| --- | --- |
| `formatVersion` | 2. A map without it, in the shape of the first version, is converted when read ([below](#the-first-version)) |
| `label` | what the map says of itself: the title of the editor, the label of its box for a screen reader |
| `grid` | the cells shown: rows `rowStart`..`rowEnd`, columns `colStart`..`colEnd` (both ends included), and the shape of one cell (`cellAspectRatio`, its width and height relative to each other) |
| `view` | how the map is shown: the largest width of its box in px (`mapWidthMax`, 360 to 980), its background, the groups greyed out (`groupGreyedIdList`: drawn faded and not clickable, with their blocks) |
| `compList` | the components, in the order they are drawn (a later one lies over an earlier one) |

A component:

| key | what |
| --- | --- |
| `id` | unique in the map; what a selection names. A component made in the editor gets random letters and digits; the maps of the package keep the ids they had (`tokyo`, `group-kanto`) |
| `kind` | `block` (what is selected) or `group` (holds blocks) |
| `label` | the text drawn in the shape |
| `shape` | a rectangle or a polygon ([Shapes](#shapes)) |
| `childIdList` | of a group: its blocks. A block belongs to one group at most |
| `color` | of a group: the color of its blocks (`#rrggbb` or `#rrggbbaa`); absent, a color of the palette by the order of the groups |
| `metadata` | optional, free: what an application keeps on a component, which the map never reads |

## Coordinates

A map counts two things, and keeping them apart is what makes every computation exact:

- **cells**, by index: row `r` is the r-th row of cells. A rectangle names its first and last cell, both included (`rowStart: 3, rowEnd: 4` is two rows). The grid's range is in cells too.
- **grid lines**, between the cells: line `r` is the top edge of row `r`, so row `r` lies between lines `r` and `r + 1`. A polygon's points, the edge of a rectangle being dragged, and a selection box are on grid lines (a box is continuous: a pointer is at line 3.5 in the middle of row 3).

<!--renderComp=DiagramText-->
```text
 lines   1     2     3     4            a rectangle  rowStart 1, rowEnd 2,
       1 ┌─────┬─────┬─────┐                         colStart 1, colEnd 2
         │ 1,1 │ 1,2 │ 1,3 │ row 1      has the corners [1,1] [1,3] [3,3] [3,1]
       2 ├─────┼─────┼─────┤            on the lines
         │ 2,1 │ 2,2 │ 2,3 │ row 2
       3 └─────┴─────┴─────┘            a pointer in the middle of cell 2,3 is
          col 1 col 2 col 3             at row 2.5, col 3.5
```

Indices may be zero or negative: the grid's range can grow on every side.

## Shapes

```json
{ "type": "rect", "rowStart": 3, "rowEnd": 4, "colStart": 1, "colEnd": 3 }
{ "type": "polygon", "pointList": [[3, 7], [3, 9], [5, 9], [5, 11], [7, 11], [7, 7]] }
```

A **rectangle** covers whole cells. A **polygon** is a closed ring of points on the grid lines, `[row, col]`, each two consecutive points one border segment and the last joined back to the first. Its segments may run along the lines or across them (a diamond), and the polygon may be non-convex (an L, a U). Rules, checked by the editor before a polygon is written (`polygonProblemGet` of `MapBlockGeom.ts`):

- three points at least, and an area;
- no segment touches another than its two neighbours: the border never crosses or touches itself, and two segments never run back over each other;
- kept normalized: no point twice in a row, no point in the middle of a straight run, the first point not repeated at the end (`polygonNormalize`). A polygon has one ring: no holes, no separate pieces.

What the rest of the map needs of a shape is the same for both kinds:

| question | a rectangle | a polygon |
| --- | --- | --- |
| where it is drawn, moved, kept inside the grid | its cells | the cells of its bounding box (`shapeCellRectGet`) |
| what a click reaches | its box | its outline (`clip-path`) |
| whether a selection box touches it | the box overlaps a cell | the box overlaps its area (the polygon clipped by the box has an area) |
| whether a selection box holds it whole | its cells are inside | its points are inside |
| where its label is | the middle | its centroid when inside, else the middle of the nearest cell inside |

A polygon that is an axis-aligned rectangle can become a rectangle again (the menu's **Make rectangle**), and a rectangle a polygon of its four corners (**Make polygon**).

## The text

A map asset holds the map as **tight** json: the map's own keys one per line, then one line per component. It reads well in a diff, where a moved block is one changed line:

```text
{
  "formatVersion": 2,
  "label": "Shapes",
  "grid": {"rowStart":1,"rowEnd":10,"colStart":1,"colEnd":14,"cellAspectRatio":{"width":1,"height":1}},
  "view": {"mapWidthMax":620,"backgroundColor":"#eaf5ff","groupGreyedIdList":[]},
  "compList": [
    {"id":"west","kind":"block","label":"West","shape":{"type":"rect","rowStart":3,"rowEnd":4,"colStart":1,"colEnd":3}},
    ...
  ]
}
```

The keys of a component are written in the order `id`, `kind`, `label`, `shape`, then those of a group. The JSON dialog of the editor also shows the **pretty** form, indented. `mapBlockDataTextBuild` writes both, `mapBlockDataTextParse` reads either.

**Reading is forgiving** (`mapBlockDataNormalize`): missing values get their defaults (a cell of 1 x 1, a width of 620, the background `#eaf5ff`), a width outside 360..980 is clamped, a component without an id or a valid shape is left out. A map is always normalized when read, so a store never holds a map that breaks these rules.

## Density

The density of a grid is changed by whole factors of two, and the change is computed on grid lines, where it is exact:

```text
doubling   every cell becomes 2 x 2 cells     line l   -> 2l - 1      cell r -> cells 2r-1, 2r
halving    every 2 x 2 cells become one       line l   -> (l + 1) / 2
```

Doubling is always exact, and halving after doubling gives the map back as it was. Halving is exact only for odd lines: a shape lying on even lines (a block moved by one fine cell) cannot keep its shape on the coarser grid. Such a halving is not done silently: the editor names the shapes it would change and halves only when asked to; a rectangle then grows outward to the coarser lines (it never shrinks to nothing), a polygon's points go to the nearest coarser lines, and a polygon left without area keeps the cells of its bounding box as a rectangle. Undo takes it back ([Density](map-block-edit.md#density)).

## The first version

The reference implementation (the first commit of the repository) kept maps in another shape. It is read by the same functions (`mapBlockDataIsV1`, `mapBlockDataFromV1`), so a map of the first version can be pasted or loaded anywhere a map is read:

| first version | now |
| --- | --- |
| `id` of the map | the key of its asset |
| `metadata.rowStart` … `colEnd`, `metadata.cellAspectRatio` | `grid` |
| `metadata.indexDirection` (always top to bottom, left to right) | dropped: it is the one convention ([Coordinates](#coordinates)) |
| `metadata.view` | `view` |
| `view.regionGreyedIds` | `view.groupGreyedIdList` |
| `components` | `compList` |
| `compType: block / group` | `kind` |
| `renderCompName: prefectureBlock / groupBlock` | dropped: it only repeated the kind |
| `type: rect` and `range: { rowStart, … }` | `shape: { type: rect, rowStart, … }` |
| `type: cells` and `range: [{ row, col }]` | `shape`: a rectangle when the cells fill one, else the polygon of their outline |
| `children` | `childIdList` |
| `metadata.color` of a group | `color` |

The data of the reference implementation was converted this way by `script-data/map_block_v1_convert.ts`, which prints a map of the first version in the format of now (from a json file, a TypeScript constant, or the sqlite file of the former backend):

```text
npx tsx script-data/map_block_v1_convert.ts <input.json | input.ts | input.sqlite> [--label <label>]
```

| was | is now an asset of the object *Japanese areas*, partition example |
| --- | --- |
| `map-block/config/prefectureTileGridMapJp.ts`, the map the prefecture selector imported (14 x 16) | `jp-prefecture`, its name 日本都道府県タイルマップ |
| version 1 of `japan-prefecture-tile-grid-map` in the sqlite backend (16 x 20), equal to `prefectureTileGridMapBakJp.ts` | `jp-prefecture-wide`, its name 日本都道府県タイルマップ (16×20, 2026-06-22) |

The note of each first version says where it came from.
