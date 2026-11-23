var e=`---
title: Japanese areas
description: Regions, prefectures and municipalities of Japan selected together, the prefectures also on a tile map
---

# Japanese areas

The selector of Japanese areas (市区町村検索) is the mode \`selector\` of an object of the type \`shikuchoson.jp\`: a region selector, a prefecture selector and a municipality selector, each limiting the next when its checkbox says so, and the summary of the three. The design is in [shikuchoson.md](../../doc/shikuchoson.md).

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65il1ops1t
mode: selector
\`\`\`

\`\`\`\`markdown
<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65il1ops1t      # an object of the type shikuchoson.jp
mode: selector
param:
  map: jp-prefecture              # optional: the map of the prefectures (else metadata.mapPrefecture, else the first map)
\`\`\`
\`\`\`\`

Things to try:

- Click into **都道府県**: the dropdown shows the map of the prefectures (地図), the regions (地域) or a list (一覧). On the map, click prefectures, click a region to take all of it, or drag a box: downward it takes what it touches, upward what it holds whole; Shift adds, Ctrl toggles.
- Deselect a region above with the checkbox on: its prefectures are greyed out on the map and offered nowhere.
- Select prefectures, then search **市区町村**: the results are limited to them, and the prefectures appear as tags of the filter row. The cross of a tag makes it inactive (the prefecture is deselected above), a click on it brings it back, a second cross removes it.
- 政令指定都市 and 県庁所在地 limit the municipalities to the designated cities or the prefectural capitals.
- The gear beside 地域 changes the colors of the regions, on the tags and on the map.

## Its map

The map of the prefectures is a block map of the same object, so the modes of block maps show it and edit it. With the page in **Edit**, the map mode **Edit** of the editor below changes it, and **Save** writes the version the selector reads. The second map, \`jp-prefecture-wide\`, is the larger one the reference implementation had saved.

<!--renderComp=ObjectFrontend-->
\`\`\`yaml
object: frontend:w65il1ops1t
mode: editor
param:
  map: jp-prefecture
\`\`\`
`;export{e as default};