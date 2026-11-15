# Map Selection Model

This map has two kinds of selectable objects:

- block: one real selectable item, such as one prefecture
- group block: one visual group that contains several blocks, such as one region

The map keeps some selection state inside the map store. The parent selector also keeps the approved selected item list. The map store is useful for map interaction details, such as group selection and direct block selection. The parent selector is the final source of truth for the selected prefecture IDs used by the rest of the application.

## selection state model: self/group/final

A normal block's selection state model consists of: internal selected state(also referred to as self selected state), belonging group's selected state(if belonging group exists)(also referred to as group selected state), and a final selected state, which is a derived state.


### how final selected state is derived from self/group selected state

the final selected state is derived from self and group selected state, basically is it computed in this way:

```text
final selected = internal selected OR belonging group selected
```

so if a block is self unselected, its final selected state follows its group:
    - if its group is selected, the block is finally selected
    - if its group is not selected, the block is finally unselected

This is why a block can look selected even when it is not directly selected. It may be selected because its group is selected.

In code implementation, final state is mainly reflected by `selectedBlockIdsFinal` in `map-block/geo/storePrefectureSelector.ts`. It starts with direct block selections, then adds children of selected groups.

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

This also applies to modifier range selection:

- Shift range selection adds blocks in the range
- Ctrl range selection toggles blocks in the range
- Shift+Ctrl range selection is treated like Ctrl range selection
- group blocks are not selected by any of these range operations

After range selection, the store may passively select a group if all child blocks of that group are selected.

## Parent Approved Selection

The map view is used by a higher-level prefecture selector. The map can attempt a selection change, but the parent selector decides the approved prefecture list.

This matters when some prefectures are unavailable. The map wrapper filters unavailable blocks before publishing the selected prefecture IDs to the parent.

The wrapper should not erase internal map state when the final selected prefecture list does not change. For example, the first click on a child block selected through a group only changes internal state. The parent list is unchanged, but the map still needs to remember the internal state for the next click.

In code, this is handled in `map-block/PrefectureMapSelectJp.jsx`. It publishes final selected prefecture IDs upward, but keeps internal map state when the final selected block list stays the same.
