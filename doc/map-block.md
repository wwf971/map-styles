---
title: Block maps: design
description: The store, the render, the editor of block maps, and the frontend object keeping them
---

# Block maps: design

A block map is one piece of data ([the format](map-block-data.md)), drawn by one render and changed through one store. Around them sit the editor, which adds the controls of the edit mode, and the modes of a frontend object, which read a map from its asset and write it back. Everything in `comp-mdx/map-block/` is general: a map of Japanese prefectures is one map among others, and nothing in this folder knows it.

## The layers

<!--renderComp=DiagramText-->
```text
 frontend object  (react-doc: config.objectFrontend, the api of a mode)
   │  assets of kind map, each the json of one map, in a partition
   ▼
 the modes       MapBlockObjectEditor  "editor"   the maps of a partition, one loaded
                 MapBlockObjectView    "view"     one map, selected in, never written
   │
   ▼
 MapBlockEditor   header (map mode), toolbar of the edit mode, map config,
   │              menus, dialogs, keys                 (or MapBlockSelect)
   ▼
 MapBlockStore    the map, and the state of every interaction    ◄── events
   │                                                                  │
   ▼                                                                  │
 MapBlockRender   the grid, the shapes, the overlays; the pointer ────┘
```

**The store is the truth.** The render draws what the store holds and reports what the pointer did as events; it keeps no state of its own beyond a gesture in progress (the press that is not yet a drag). The editor holds only what belongs to its own dialogs (an open menu, the draft of a rename). The mode holds which map is loaded and its text as last read; the asset store holds the map itself.

## The store

`MapBlockStore` (`MapBlockStore.ts`, with its parts in `MapBlockStore*.ts`) holds one map in `data` and, in `config`, the state of every interaction, one branch per map mode:

```text
config
├── mode                         display | select | edit
├── modeState.select             the selection (map-block-select.md): selectedBlockIds,
│                                selectedGroupIds, the box being dragged (rectDrag)
├── modeState.edit               tool (select | rect | polygon), the selection of the edit mode
│                                (one component, or several), the drag in progress (move,
│                                resize, the point of a polygon), the rectangle or polygon
│                                being made, the property popup, the question of halving,
│                                the last message
├── mapConfigEditor              the tab and the folded groups of the map config panel
└── mapObjData, mapObjDataFormat the text shown by the JSON dialog
history                          the map before each change (undo) and after each undone one
dataTextSaved                    the map as last loaded or saved: isDirty compares with it
```

Its derived values are getters (MobX computed): the blocks, the groups, the group of each block, `selectedBlockIdsFinal`, the data of the property editors, `isDirty`, whether halving the density is exact.

**Every change of the map goes through `dataChange`** (or, for a change of one value, `historyCheckpoint` before it): the map before the change is kept for undo, the text of the JSON dialog and the spatial index are rebuilt. A change that changes nothing (a drag that ended where it began) leaves no step to undo. `setData` loads a map: the selections end, the history starts again, and the map counts as saved.

The files of the store, by subject:

| file | what |
| --- | --- |
| `MapBlockStore.ts` | the state, the derived values, changes of the data, undo, density, the selection of the mode select, the property editors |
| `MapBlockStoreEvent.ts` | the events: each checked and handed to the store, answered `{ code, message? }` |
| `MapBlockStoreSelection.ts` | range selection in the modes select and edit: touching or holding whole, rectangles by their cells, polygons by their outline |
| `MapBlockStoreSpatialIndex.ts` | the blocks a box may touch, by their bounding boxes in an R-tree (`rbush`) |
| `MapBlockStoreMove.ts` | moving one component, several, or the selected blocks; the drag of the property popup |
| `MapBlockStoreResize.ts` | dragging an edge of a rectangle to another grid line |
| `MapBlockStorePolygon.ts` | the tools rect and polygon, and the corners and segments of a polygon |

## Events

The render and the editor speak to the store in events, `store.handleEvent(eventType, eventData)`, never by calling its methods for what the pointer did. An event names what happened, by the life of a gesture:

```text
a click            toggleBlockSelection, toggleGroupSelection, selectEditComponent { componentId, operation }
a drag             begin…Drag { pointerGridRow, pointerGridCol, … } -> update…Drag -> commit…Drag | cancel…Drag
                   (SelectRect, SelectMove, EditMultiSelectRect, EditMultiMove, Move, RectEdge,
                   RectCreate, PolygonVertex / PolygonSegment -> updatePolygonPointDrag)
the polygon tool   addPolygonDrawPoint, movePolygonDrawPointer, removePolygonDrawPointLast,
                   commitPolygonDraw, cancelPolygonDraw
the editor         setMode, setEditTool, undo, redo, increaseGridDensity, decreaseGridDensity { isForced },
                   updateGridDisplayRange, createBlockAt, createGroupAt, deletePolygonVertex, …
```

A pointer position is given in grid coordinates (`pointerGridRow`, `pointerGridCol`, continuous: 3.5 is the middle of row 3), so the store never deals with pixels. `operation` is what the modifier keys say: `replace`, `add` (Shift), `toggle` (Ctrl or Cmd, which wins over Shift).

## The render

`MapBlockRender` draws the map in a box whose aspect ratio is that of the grid (columns times the cell width, rows times the cell height), up to `mapWidthMax`. Each component is a button positioned in percent of the map:

- a **rectangle** covers its cells, its border and its selection marks drawn by CSS;
- a **polygon** is the button of its bounding box, cut to the polygon by `clip-path`, which also keeps the pointer inside the polygon: a click in the empty corner of an L reaches what lies below. Its border is an SVG ring over the fill, its label at a point inside it ([MapBlockGeom.ts](map-block-data.md#shapes)).

The colors come from the group of a block: its `color`, else a color of a palette by the order of the groups; a block in no group is a neutral grey. Over the components lie the overlays of the mode: the selection box, the ghost of a moved shape, the edges of a selected rectangle, the corners and segments of a selected polygon, the shape being made.

The gestures and their timings (a press becomes a drag after 4px; the click ending a drag is swallowed for 350ms) were tuned by hand in the reference implementation and are kept as they were ([map-block-select.md](map-block-select.md), [map-block-edit.md](map-block-edit.md)).

## The editor

`MapBlockEditor` is the render with what the edit mode needs: the map mode (a segmented control), the toolbar (tools, undo, redo, density, the JSON of the map), the hint of the tool, the map config panel beside the map (map width, the shape of a cell, the background, the groups greyed out), the property popup of a block (double-click), the menus (right-click) and the rename dialog. It is given a store, and who gives it decides what it may do: `isEditAllowed` offers the map mode edit or not, `toolbarTrailing` adds controls of the owner (Save and Revert, from the mode editor). Its texts can be given in another language (`textById`). Details: [map-block-edit.md](map-block-edit.md).

`MapBlockSelect` is the other way to use a map: as a selector whose selection belongs to a parent ([the selection a parent approves](map-block-select.md#the-selection-a-parent-approves)). The prefecture map of the Japanese area selector is one.

## Maps as a frontend object

Maps are kept as assets of a react-doc frontend object (react-doc: `main/doc_page_impl_obj_frontend.md`), whose type `map-block.map-set` is declared in `type.yaml` at the top of the package:

```yaml
- id: map-block.map-set
  kindList:                 # the kind map-block.map-set.map: a data item, json, its shape (MapBlockData) a schema
    - { id: map, label: Map, content: { form: data, langList: [json], schema: … }, groupPath: map }   # react-doc: main/doc_page_impl_type.md#kinds-of-data-items
  partitionList:
    - { id: example, label: Example, isDefault: true }
    - { id: playground, label: Playground, isGitIgnored: true }
  modeList:
    - { id: editor, comp: MapBlockEditor, isDefault: true }
    - { id: view, comp: MapBlockView, pathParam: map }
```

- **One map, one asset**, of kind `map`, language `json`, its text the map in the tight form ([The text](map-block-data.md#the-text)). Its key and its path come from its name (`/playground/map/map-1`), its path starting with its partition.
- **The asset's name** is how the map is listed (the chips of the editor); **the map's label** is what the map says of itself (its title, the label of its box for a screen reader). Each is changed on its own.
- **Saving writes the head of the asset** by its save mode: the maps of the package are made with `saveMode: newVersion`, so each Save is a version, as each save of the former backend was; a map made from the page saves in place, with a backup of the bytes it replaced (react-doc's `assetCreate` of a mode takes no save mode; the asset panel of the item changes it).
- **A map changed elsewhere** (another block saved it) is loaded again when it has no unsaved changes here; with unsaved changes, the editor keeps them and says so, and Save writes them over it.

### Partitions

The items of an object are split by where they come from, not by what they are (react-doc: `#partitions` of the frontend object design):

```text
.doc-page/object-frontend/{id}--Block map examples/
├── object.yaml
└── item/
    ├── {entryId}/            the entry: name, type, metadata                    tracked
    ├── example/              the maps of the package and its demonstrations     tracked
    │   ├── item-list.yaml
    │   └── map/{itemId}/     item.yaml, {versionId}.json
    └── playground/           what is tried out                                  ignored by git
        ├── item-list.yaml
        └── map/{itemId}/
```

The `.gitignore` of the repository keeps `**/.doc-page/object-frontend/*/item/playground/` out whole, the items and the list naming them, so nothing of a playground reaches a commit and a clone has an object without it. A new map goes to the partition shown, and the editor says where before it is made ("goes to item/playground/map/, kept out of git").

### The modes

| mode | component | what it shows | parameters |
| --- | --- | --- | --- |
| `editor` | `MapBlockObjectEditor.jsx` | the partitions, the maps of the one shown (chips), the map chosen in the editor | `partition`: shown first; `map`: an asset reference shown first |
| `view` | `MapBlockObjectView.jsx` | one map in the flow of the document, select or display only, the reader's selection below | `map`: the map (else the first); `interaction`: `select` (default) or `display` |

Both follow react-doc's reading and editing rule: in reading mode a mode shows its object without the controls that change it. The editor offers the map mode **edit**, **+ New map**, **Delete** and **Save** while the document is edited, enabled when the object can be written (`service.isEditable`); switching the map shown or the map mode is not a change of the object and works in both. The editor is a block-like box (`BlockPopupSurface`): it opens in react-doc's block popup without losing the map, its unsaved changes or its selection.

A switch of map asks first when the map shown has unsaved changes: save it and go on, discard them, or stay. Delete asks in place, and takes the asset out of the object (deleted softly: its files and versions stay in the asset store).

## Files

| file | what |
| --- | --- |
| `MapBlockData.ts` | the format: types, reading (`mapBlockDataNormalize`), the text, shapes, density, the first version |
| `MapBlockGeom.ts` | polygons: area, normalizing, validity, overlap with a box, a point inside for the label |
| `MapBlockStore*.ts` | the store ([above](#the-store)) |
| `MapBlockRender.tsx` | the render |
| `MapBlockEditor.tsx`, `MapBlockPropEditorPopup.jsx` | the editor, the property popup of a block |
| `MapBlockSelect.jsx` | a map as a selector of a parent |
| `MapBlockObject.js` | what the modes share: the maps of a partition, reading one, the key, path and text of a new one |
| `MapBlockObjectEditor.jsx`, `MapBlockMapBar.jsx` | the mode editor and its bar of maps |
| `MapBlockObjectView.jsx` | the mode view |
| `map-block-comp.js`, `comp.yaml` | the components of the modes, for react-doc |
| `popupPlacement.ts` | where a popup goes beside what it is about (used by shikuchoson too) |
| `MapBlock.css` | the styles, every class starting `map-block-` |
