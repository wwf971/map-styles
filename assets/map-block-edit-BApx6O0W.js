var e=`---
title: Block maps: the editor
description: The edit mode of a block map, its tools and gestures, polygons, density, undo and saving
---

# Block maps: the editor

The map mode **edit** changes the map: shapes are made, moved, resized and reshaped, components named, grouped, colored and deleted, the grid grown, split or merged. In a document it is offered while the document is edited ([the modes](map-block.md#the-modes)); everything is done in memory, undo takes back any step, and **Save** writes the map.

## The screen

<!--renderComp=DiagramText-->
\`\`\`text
 Maps  Partition [Example|Playground]  (Shapes)(Map 1)  + New map  Delete
 ─────────────────────────────────────────────────────────────────────────
 Shapes                                         [Display|Select|Edit]
 Tool [Select|Rectangle|Polygon]  Undo Redo  Density /2  Density x2  JSON
                                                   Save Revert  Saved
 what the tool does with the pointer
 ─────────────────────────────────────────────────────────────────────────
     [-] 1 [+] ├────────────────┤ [-] 14 [+]      Map Config
 [-]  ┌──────────────────────────────┐            View | Grey Out
  1   │                              │            Mode, Map Width,
 [+]  │      the map, its grid       │            Cell Width, Height,
  │   │      drawn in edit mode      │            Background
 [-]  └──────────────────────────────┘
 10   Clear  Selected groups, Selected blocks
\`\`\`

- **The bar of maps** (from the mode editor): the partition, the maps of it, a new map, the deletion of the one shown. A map with unsaved changes has a dot on its chip.
- **The header**: the label of the map, and its mode.
- **The toolbar** (edit mode only): the tool, undo and redo, the density, the JSON of the map; Save, Revert and the state of the map come from the mode editor. Under it, what the tool does with the pointer, the question of halving the density, and the last message (why a change was refused).
- **The range of the grid**, the number fields around the map: its first and last column above, its first and last row on the left. Growing them adds cells around the map, shrinking them hides cells (the components stay where they are).
- **The map config** beside the map: the mode, the largest width of the map, the shape of a cell, the background; under **Grey Out**, the groups drawn faded and not clickable.

## Tools

| tool | the pointer on the grid |
| --- | --- |
| **Select** | the ordinary edit mode: select, move, resize, reshape ([below](#gestures)) |
| **Rectangle** | drag over cells: a new block covering them, selected |
| **Polygon** | click grid points one after another: the corners of a new block. Hold Shift for a segment that is horizontal or vertical. Click the first point again, double-click, or press Enter to close it; Backspace takes the last point back; Esc stops |

The tools Rectangle and Polygon start on a block as well as on the empty grid, since a new shape may lie over others. A new block is named after its kind (\`Block 7\`) and gets a random id; it is put in no group (drawn grey) until it is given one. Esc returns to the tool Select.

A polygon is closed only when it is one ([the rules](map-block-data.md#shapes)): a polygon crossing itself is not made, and the toolbar says why ("Not closed: the border crosses itself"); the points stay to be corrected.

## Gestures

With the tool Select:

| on | the pointer | does |
| --- | --- | --- |
| a component | click | selects it (Shift adds a block, Ctrl toggles one) |
| a component | drag | moves it by whole cells, kept inside the grid; a ghost shows where it goes |
| a selected block among several | drag | moves them together; a dashed box shows where they go |
| the empty grid | drag | selects the blocks in the box: downward those it touches, upward those it holds whole ([range selection](map-block-select.md#range-selection)) |
| the empty grid | click | lets the selection go |
| an edge of a selected rectangle | drag | moves that edge to another grid line; a line shows where, red where it cannot go (onto the other edge) |
| a corner of a selected polygon | drag | moves the corner to the nearest crossing of lines |
| a corner | double-click | removes it |
| a segment of a selected polygon | drag | moves its two ends: a horizontal segment up and down, a vertical one left and right, a slanted one both ways |
| the small circle in the middle of a segment | drag | adds a corner there and moves it |
| a block | double-click | opens its properties |
| a component | right-click | its menu |
| the empty grid | right-click | **New block here**, **New group here** |

While a polygon's corner or segment is dragged, its outline follows the pointer, blue, or red when the polygon would cross itself; a red drop is refused and the polygon stays as it was.

## Menus and properties

The menu of a component: **Rename**, **Make polygon** (a rectangle becomes the polygon of its four corners, whose corners then move one by one), **Make rectangle** (a polygon of four right angles), **Delete**. The menu of a corner: **Remove corner**.

The properties of a block (double-click), in a popup beside it that can be dragged by its title:

| tab | property | |
| --- | --- | --- |
| Basic | Label | its text |
| | Color | the color of its group (the color belongs to the group, so it changes every block of the group) |
| | Group | the group it belongs to, or none |
| Layout | Row Start … Col End | of a rectangle: its cells |
| | Corners | of a polygon: how many it has |

A new group is made where the grid is right-clicked (**New group here**: two cells for its label); blocks join it by their property Group.

## Density

**Density x2** splits every cell into 2 x 2 cells: the map looks the same, and shapes can now be moved and drawn by half a cell. **Density /2** merges every 2 x 2 cells into one, which is the inverse:

\`\`\`text
Density x2 then Density /2       the map as it was, exactly
Density /2 on shapes lying on the coarser lines      exact as well
Density /2 on shapes lying between them              asked first:
    "Halving moves 3 shapes to the coarser lines: West, East, L shape. Undo brings them back."
    [Halve anyway]  [Cancel]
\`\`\`

So nothing is lost by halving unless the user agrees, and undo takes it back even then. The computation is on grid lines ([Density](map-block-data.md#density)).

## Undo

Every change of the map is a step: a move, an edge or a corner dragged, a shape made or deleted, a name, a group, a color, a value of the map config, the range of the grid, the density. **Undo** (Ctrl+Z, Cmd+Z) and **Redo** (Ctrl+Shift+Z, Ctrl+Y) walk the steps; a new change drops what could be redone. A drag that ended where it began is no step. Loading another map, or the same map again, starts the history anew.

## Keys

The keys work while the editor has the focus (a click on the map gives it): a key typed into a field is the field's.

| key | |
| --- | --- |
| Ctrl+Z / Cmd+Z | undo |
| Ctrl+Shift+Z, Ctrl+Y | redo |
| Delete | delete the selected components |
| Enter | close the polygon being drawn |
| Backspace | take its last point back |
| Esc | stop drawing; once more, back to the tool Select |

## Saving

The map in the editor is a copy of its asset. **Save** writes it as the next state of the asset (a new version for the maps of the package), **Revert** puts back the map as last saved; the state beside them says **Saved**, **Unsaved changes**, or what went wrong. Opening another map with unsaved changes asks first: save and open, discard, or stay. Details: [Maps as a frontend object](map-block.md#maps-as-a-frontend-object).

The **JSON** dialog shows the map as it is now, tight or pretty ([The text](map-block-data.md#the-text)), to copy.
`;export{e as default};