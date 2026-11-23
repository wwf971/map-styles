var e=`---
title: Block maps
description: Maps of blocks on a grid, shown, selected in and edited in place
---

# Block maps

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65ikqwco79
mode: editor
param:
  map: shapes
\`\`\`

A block map is a grid of cells with blocks on it, rectangles or polygons, gathered in groups. A document places one with the entry block of frontend objects, \`ObjectFrontend\`, naming an object of the type \`map-block.map-set\` (or a type extending it) and one of its modes. The design is in [map-block.md](../../doc/map-block.md); the format of a map in [map-block-data.md](../../doc/map-block-data.md).

## The editor

The editor above is the mode \`editor\`: it shows the maps of a partition of the object, and the one chosen in the editor. Read, it shows and selects (the map modes **Display** and **Select**). Switch the page to **Edit**: the map mode **Edit** then draws and reshapes the blocks ([the editor](../../doc/map-block-edit.md)), and **Save** writes the map. The maps here are the package's own (partition Example, tracked by git): to try things without changing them, use the **Playground** of the side panel (a document git ignores, made from a template on its first visit).

\`\`\`\`markdown
<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65ikqwco79      # an object of the type map-block.map-set
mode: editor
param:
  partition: playground           # optional: the partition shown first (else the default, example)
  map: shapes                     # optional: the map shown first, an asset reference (key, path, name:…)
\`\`\`
\`\`\`\`

The map *Shapes* (shown first) has the kinds of shapes a map can hold: rectangles (*West*, *East*, *Tower*), polygons along the grid lines (*L shape*, *U shape*) and across them (*Slanted*), and two groups, *North* and *South*, whose blocks take their color. In the map mode Select, a click on *North* selects its three blocks; a box dragged downward selects what it touches, upward what it holds whole. A box over the empty corner of the *L shape* does not touch it.

The map *日本都道府県タイルマップ* (\`jp-prefecture\`, its chip above) is a larger example: the 47 prefectures in six region groups. It is a copy of the map of the object *Japanese areas*, which the [Japanese area selector](../shikuchoson/comp-shikuchoson.md) reads; editing this copy does not change the selector.

## One map in the text

The mode \`view\` shows one map without the editor around it, for a reader to look at or to select in. Nothing is written: the selection is the reader's while the page is open.

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65ikqwco79
mode: view
param:
  map: shapes
\`\`\`

\`\`\`\`markdown
<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65ikqwco79
mode: view
param:
  map: shapes                     # the map: an asset reference; absent, the first map
  interaction: display            # optional: display (the map only) or select (default)
\`\`\`
\`\`\`\`

Any object whose type extends \`map-block.map-set\` has these modes. The tile map of the Japanese prefectures, a map of the object *Japanese areas*, shown only:

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65il1ops1t
mode: view
param:
  map: jp-prefecture
  interaction: display
\`\`\`

## A new object

**Frontend Object…** of the insert menu (in edit mode) makes a new object of the type *Block maps* in the doc page, or the **Frontend objects** tab of the settings. Its maps go to its partitions: \`example\` (tracked by git) and \`playground\` (kept out of git; the \`.gitignore\` of the repository needs \`**/.doc-page/object-frontend/*/item/playground/\`). The editor's **+ New map** makes a map at once, with a group and two blocks on it, in the partition shown.

Outside a document, the components are plain React: \`MapBlockEditor\` edits a \`MapBlockStore\`, \`MapBlockSelect\` makes a map a selector whose selection a parent keeps ([map-block-select.md](../../doc/map-block-select.md#the-selection-a-parent-approves)).
`;export{e as default};