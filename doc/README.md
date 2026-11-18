---
title: map-styles
description: Maps drawn in styles of their own, kept as frontend objects
---

# map-styles

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w65il1ops1t
mode: view
param:
  map: jp-prefecture
```

The tile map of the Japanese prefectures above is a block map (`jp-prefecture` of the object *Japanese areas*): click a prefecture, click a region to take all of it, or drag a box (downward it takes what it touches, upward what it holds whole; Shift adds, Ctrl toggles). Its editor is on the page [Block maps](../comp-mdx/map-block/comp-map-block.md), the selector that uses it on [Japanese areas](../comp-mdx/shikuchoson/comp-shikuchoson.md).

A react-doc package of **maps drawn in styles of their own**, not maps of the world at scale. The first style is the **block map**: a grid of cells, and on it blocks (rectangles, or polygons along the grid lines) gathered in groups, like the tile maps that show every prefecture of Japan as a square of the same size. A block map is drawn, selected in and edited in place, and kept as data of a frontend object.

The first application is the selection of **Japanese areas** (`shikuchoson`, 市区町村): regions, prefectures and municipalities chosen together, the prefectures also on a block map of them.

## The concepts

- A **block map** (`map`) is one piece of data: a **grid** (a range of rows and columns of cells, and the shape of a cell), what it shows of itself (a **view**: width, background, groups greyed out), and a list of **components**.
- A **component** is a **block** or a **group**. A block is what is selected, a prefecture for instance. A group holds blocks (a region holds its prefectures), and is drawn too, as a block of its own carrying its name; its color is the color of its blocks.
- Every component has a **shape**: a **rectangle** of cells, or a **polygon**, a closed ring of border segments running between crossings of grid lines, which may be non-convex (an L, a U) and may have slanted segments.
- A map is shown in one of three **map modes**: **display** (looked at), **select** (blocks and groups selected, by click or by dragging a box), **edit** (shapes drawn, moved, reshaped, named, grouped).
- A map is kept as an **asset** (a data item) of a **frontend object** of the type `map-block.map-set`, one asset per map. The items of the object lie in **partitions**: `example` (tracked by git) and `playground` (kept out of git, to try things in).
- A **mode** of the object (react-doc's word, not to be mixed with the map modes) is a way to place it in a document: **editor** (the maps of a partition and one of them in the editor) or **view** (one map in the flow of the text).
- The **Japanese area selector** is an object of the type `shikuchoson.jp`, which extends `map-block.map-set`: its map of the prefectures is one of its maps, edited by the same editor, and its own mode **selector** draws the three selectors.

<!--renderComp=DiagramText-->
```text
 a document            ObjectFrontend { object, mode, param }
     │                   │
     ▼                   ▼
 frontend object  ── type map-block.map-set ──────── type shikuchoson.jp
 (folder in            │  modes: editor, view          │  extends map-block.map-set
  .doc-page/)          │                               │  mode: selector
     │                 ▼                               ▼
     │            MapBlockEditor / MapBlockView     ShikuchosonSelector
     │                 │                               │  regions, prefectures,
     ▼                 ▼                               │  municipalities
 item/example/    MapBlockStore (one map, by mode) ◄───┘  (the prefecture map
 item/playground/      │                                   is a block map)
   map assets ─────────┤ read, saved as the next version
   (json, v2)          ▼
                  MapBlockRender (the grid, the shapes, the pointer)
```

## How it is used

- **Reading**: a document shows a map (`view`), or the selector of Japanese areas (`selector`); selecting changes nothing on disk.
- **Editing**: with the document in edit mode, the `editor` offers the map mode **edit**, **+ New map** and **Save**. A map is edited in memory (with undo), and **Save** writes it as the next version of its asset.
- **Trying out**: the playground document (`doc/map-block.playground.md`, made from a tracked template, ignored by git) works on the partition `playground`, ignored by git as well, so nothing tried there reaches a commit.

## The documents

| document | about |
| --- | --- |
| [Block maps](../comp-mdx/map-block/comp-map-block.md) | the demonstration, and how a document places a map |
| [map-block.md](map-block.md) | the design of block maps: store, render, editor, the frontend object and its modes |
| [map-block-data.md](map-block-data.md) | the format of a map: grid, coordinates, shapes, groups, text; the first version and its conversion |
| [map-block-select.md](map-block-select.md) | the selection model: direct and group selection, clicks, modifier keys, range selection, the selection a parent approves |
| [map-block-edit.md](map-block-edit.md) | the editor: tools, gestures, polygons, density, undo, saving |
| [Japanese areas](../comp-mdx/shikuchoson/comp-shikuchoson.md) | the demonstration of the selector |
| [shikuchoson.md](shikuchoson.md) | the design of the selector: its stores and their wiring, the prefecture map, the filters, the data |

## The package

<!--renderComp=DiagramText-->
```text
main/                               the repository is the package
├── doc-package.yaml                name: map-styles
├── type.yaml                       map-block.map-set, shikuchoson.jp
├── doc/                            this document and the design documents
├── comp-mdx/
│   ├── map-block/                  block maps, general: nothing of Japan in it
│   │   ├── MapBlockData.ts         the format          MapBlockGeom.ts   polygons
│   │   ├── MapBlockStore*.ts       the store           MapBlockRender    the render
│   │   ├── MapBlockEditor.tsx      the editor          MapBlockSelect    a map as a selector
│   │   ├── MapBlockObject*.jsx     the modes           comp-map-block.md demonstration
│   │   └── *.test.ts               tests (npm test)
│   └── shikuchoson/                the Japanese area selector, built on map-block
│       ├── ShikuchosonSelector.jsx the mode            ShikuchosonStore  the stores of a block
│       ├── data/                   municipalities, special filters (json)
│       └── comp-shikuchoson.md     demonstration
├── script-data/                    conversion of the first format; extraction of municipalities
└── .doc-page/                      the doc page of the package, its objects and playground
```

`map-block/` knows nothing of the application: the prefecture map is data of the shikuchoson object, and what links a block to a prefecture (its label) is in `shikuchoson/`. Components import react-doc by `@wwf971/react-doc`, and the controls of the editor (property editor, segmented controls, menus, number fields) from `@wwf971/react-comp-misc`; `package.json` names these and `rbush`, the spatial index of range selection.

## Tests

`npm test` runs the tests of `map-block` (`node --import tsx --test`): polygon geometry, the format and its conversion, and the store, whose selection tests follow [the selection model](map-block-select.md) case by case.

## Where it comes from

The package was rebuilt from a reference implementation (the first commit of the repository, `map-block/` and `shikuchoson/`), a React app with a Flask and sqlite backend keeping versions of one map. What changed:

- **The data lives in frontend objects**: the backend and its database are gone; the map it kept and the map the selector imported from a TypeScript constant became map assets of the object *Japanese areas*, converted to the format of now ([The first version](map-block-data.md#the-first-version)). Versions are the asset store's.
- **map-block is general**: the prefecture map, the item list of prefectures and the Japanese texts moved to `shikuchoson/`; a general selector (`MapBlockSelect`) took the part of the old prefecture map that was not about prefectures.
- **Polygons**: a block may have any shape made of border segments on the grid lines, drawn and reshaped in the editor.
- **Density**: halving the density no longer changes shapes silently, and undo takes back any change ([Density](map-block-edit.md#density)).
- **The selection behaves as before**: the store's selection, moves and resizes were checked against the reference implementation on random sequences of operations, step by step.
