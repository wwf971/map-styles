---
title: Block maps: selection
description: The selection model of a block map, the clicks, the modifier keys, range selection, and the selection a parent approves
---

# Map Selection Model

This map has two kinds of selectable objects:

- block: one real selectable item, such as one prefecture
- group block: one visual group that contains several blocks, such as one region

The map keeps some selection state inside the map store. The parent selector also keeps the approved selected item list. The map store is useful for map interaction details, such as group selection and direct block selection. The parent selector is the final source of truth for the selected prefecture IDs used by the rest of the application.

All of this is the map mode **select** (in the mode **display** nothing is selected; the mode **edit** has a selection of its own, [below](#the-selection-of-the-edit-mode)). Its code is the selection part of `MapBlockStore.ts` and `MapBlockStoreSelection.ts`; the tests in `MapBlockStore.test.ts` follow the sections of this document.

## selection state model: self/group/final

A normal block's selection state model consists of: internal selected state(also referred to as self selected state), belonging group's selected state(if belonging group exists)(also referred to as group selected state), and a final selected state, which is a derived state.

<!--renderComp=DiagramText-->
```text
 selectedBlockIds   (self)    the blocks selected directly
 selectedGroupIds   (group)   the groups selected
        │
        ▼
 selectedBlockIdsFinal        self, plus the blocks of every selected group
 (final, derived)             what the map shows as selected, and publishes
```

### how final selected state is derived from self/group selected state

the final selected state is derived from self and group selected state, basically is it computed in this way:

```text
final selected = internal selected OR belonging group selected
```

so if a block is self unselected, its final selected state follows its group:
    - if its group is selected, the block is finally selected
    - if its group is not selected, the block is finally unselected

This is why a block can look selected even when it is not directly selected. It may be selected because its group is selected. A block selected directly carries a small dot in its corner, besides the frame every finally selected block has.

In code implementation, final state is mainly reflected by `selectedBlockIdsFinal` in `MapBlockStore.ts`. It starts with direct block selections, then adds children of selected groups.

## Active And Passive Group Selection

how the self/group state should change in different situations are listed below. there might be many detailed situation here. the purpose is to realize natural user behavior.

A group can become selected in two ways.

Active group selection means the user directly toggles the group block on.

Passive group selection means all child blocks become internally selected, so the store collapses them into one selected group.

For example:

- clicking a region group block can actively select that region
- selecting every prefecture block in a region can passively select that region

Passive group selection keeps the state smaller and easier to render. Instead of storing every child block, the store can store the group selection.

## Single Click On A Block

Without modifier keys, clicking a block uses replace/toggle-style behavior for that block.

When a group is selected and a child block is only selected through the group, the first click on that child block marks the child as internally selected. The final selection does not change yet, because the group is still selected.

When the same child block is clicked again, the group is split:

- the group becomes unselected
- sibling blocks become internally selected
- the clicked block becomes internally unselected
- the clicked block is finally unselected

This gives a two-step behavior. The first click marks the child as direct/internal selection. The second click removes it from the final selection.

## Shift And Ctrl Click On A Block

Modifier keys decide the selection operation:

- Shift means add
- Ctrl or Cmd means toggle
- Ctrl or Cmd wins when Shift is also pressed

Shift-click on an internally unselected block marks it as internally selected. If the block was already finally selected through its group, this does not change the final selected list. It only records that the block is directly selected.

Ctrl-click on a block toggles that block in the final selection set. If needed, the store converts the result back into internal block and group state.

Shift+Ctrl-click is treated like Ctrl-click, because Ctrl/Cmd has priority.

## Click On A Group Block

Clicking a group block toggles the group itself.

If the group is off, clicking it turns the group on. All child blocks become finally selected through the group.

If the group is on, clicking it turns the group off. Child blocks that are only selected through the group become finally unselected.

Shift-click on a group adds all child blocks to the final selected set. The store may collapse this into a selected group.

Ctrl-click on a group toggles the group child set in the final selected set. If the group was selected, its child blocks are removed from the final selected set. If it was not selected, its child blocks are added.

Shift+Ctrl-click on a group is treated like Ctrl-click.

## Range Selection

Range selection selects block components only. A group block cannot be range selected.

A range is a box dragged over the map from a press on the empty grid (or, in the mode select, on a block). A press becomes a drag once the pointer has moved 4px; until then it is a click. **The direction of the drag decides what the box takes**, and the box is drawn in the color of what it takes:

```text
dragged downward (or level)   partial   every block the box touches          blue box
dragged upward                full      every block the box holds whole      green box
```

"Touches" means the box and the block overlap with an area: a box ending exactly on the edge of a block does not take it. A polygon is touched by its own outline, not by its bounding box, so a box over the empty corner of an L does not take the L; it is held whole when all its points are inside the box.

This also applies to modifier range selection:

- Shift range selection adds blocks in the range
- Ctrl range selection toggles blocks in the range
- Shift+Ctrl range selection is treated like Ctrl range selection
- group blocks are not selected by any of these range operations

The modifier keys are read when the button is pressed.

After range selection, the store may passively select a group if all child blocks of that group are selected.

The click that ends a drag (the browser sends one on release) is swallowed for 350ms, so that a range never also toggles the block it ended on, nor clears the selection when it ended on the empty grid.

Clicking the empty grid without dragging clears the selection.

## The selection of the edit mode

The map mode **edit** selects what is edited, not what is chosen, and keeps it apart from the selection above:

- a click selects one component (a block or a group): its edges (a rectangle) or its corners and segments (a polygon) appear, ready to be dragged; a click on the empty grid lets it go;
- Shift-click adds a block, Ctrl-click toggles one; a range over the grid takes blocks the same way as above (partial downward, full upward, Shift and Ctrl as above). Several selected blocks move together;
- groups are selected by a click only, as in the mode select.

## The Selection A Parent Approves

The map view is used by a higher-level prefecture selector. The map can attempt a selection change, but the parent selector decides the approved prefecture list.

This matters when some prefectures are unavailable. The map wrapper filters unavailable blocks before publishing the selected prefecture IDs to the parent.

The wrapper should not erase internal map state when the final selected prefecture list does not change. For example, the first click on a child block selected through a group only changes internal state. The parent list is unchanged, but the map still needs to remember the internal state for the next click.

In code, this is handled by `MapBlockSelect.jsx` (`comp-mdx/map-block/`), which knows blocks only; the prefecture selector wraps it in `PrefectureMapSelectJp.jsx` (`comp-mdx/shikuchoson/`), which turns prefectures into blocks and back ([shikuchoson.md](shikuchoson.md#the-map-of-the-prefectures)). `MapBlockSelect` publishes final selected block IDs upward (`blockIdListSet`), but keeps internal map state when the final selected block list stays the same:

```text
a click or a range on the map
  -> the store changes its selection
  -> final = the final blocks the parent accepts (blockAvailableIdList)
  -> final is what the parent holds already?        nothing is published, the store keeps its state
  -> else: the store drops what the parent refuses, and publishes final
     (remembering it as published)
the parent gives its approved list back
  -> it is what the map published?                  the store keeps its state (which may say more)
  -> else (the parent changed it itself):           the store takes the list
```

| `MapBlockSelect` | |
| --- | --- |
| `data.mapData` | the map; a new object makes a new store |
| `data.blockSelectedIdList` | the blocks selected, as the parent approved them |
| `data.blockAvailableIdList` | the blocks the parent accepts (null: every block) |
| `data.blockDisabledIdList` | the blocks drawn greyed and not clickable (default: those not available) |
| `config.mode` | `select` (default) or `display` |
| `config.cellAspectRatio`, `backgroundColor`, `mapWidthMax`, `renderComponentLabel` | how the map is drawn; the label of a component may be drawn by the parent (a match of a search marked) |
| `onEvent('blockIdListSet', { blockIdList })` | the selection the map proposes |
