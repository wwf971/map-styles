---
title: Block map playground
description: Maps of your own to draw, break and start over, kept out of git
---

This document is yours: git ignores it, and the bar above sets it back to its template. The maps below lie in the partition **Playground** of the object *Block map examples*, which git ignores too ([partitions](map-block.md#partitions)), so nothing done here touches the example maps or reaches a commit.

Switch the page to **Edit** first: the editor then offers its mode **Edit**, **+ New map** and **Save**.

## 1. A map of your own

The partition is empty after a clone. **+ New map** makes a map at once, with a group and two blocks on it, and opens it. Then try:

- the tool **Rectangle**: drag over cells, a new block covers them;
- the tool **Polygon**: click grid points one by one, click the first point again (or press Enter) to close the shape; hold Shift for straight segments;
- a polygon selected with the tool **Select**: drag a corner, drag a segment, drag the small circle in the middle of a segment to add a corner, double-click a corner to remove it;
- right-click a block (**Make polygon**, **Rename**, **Delete**) or the empty grid (**New block here**, **New group here**);
- double-click a block for its properties, its **Group** among them;
- **Density x2**, then **Density /2**: the map comes back as it was; **Undo** (Ctrl+Z) takes back any step.

**Save** writes the map into the partition; **Revert** goes back to what was saved.

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w65ikqwco79
mode: editor
param:
  partition: playground
```

## 2. The map as a reader sees it

The mode **view** shows one map in the flow of a document, to look at or to select in. Name your map in `param.map` (its key, as the editor's chips show on hover, or its path):

<!--renderComp=ObjectFrontend-->
```yaml
object: frontend:w65ikqwco79
mode: view
param:
  map: shapes
```
