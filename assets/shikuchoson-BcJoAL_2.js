var e=`---
title: Japanese areas: design
description: The selectors of regions, prefectures and municipalities of Japan, their stores and wiring, the prefecture map, the filters and the data
---

# Municipality Selector

## glossary

region: 地域 (北海道・東北, 関東, …, six of them)

prefecture: 都道府県

municipality: 市区町村

## core concepts

this project provides two selectors, one allowing user to search and select one or many prefectures in japan, the other allowing user to search and select one or many municipalities in japan.

the two selectors can work independently, but can also work together. specifically speaking, municipality selector allows limiting search results within given prefectures, and prefecture selector can be used to provide this prefectures as filter.

A third, the region selector, limits the prefectures in the same way: when its checkbox is on, the prefecture selector offers only the prefectures of the selected regions.

<!--renderComp=DiagramText-->
\`\`\`text
 地域  regions        [北海道・東北][関東][中部]…      selected regions
   │  地域の選択で都道府県候補を絞り込む (checkbox)
   ▼
 都道府県 prefectures  search, tags, dropdown:       selected prefectures
   │                  地図 (the block map) | 地域 | 一覧
   │  都道府県の選択で市区町村候補を絞り込む (checkbox)
   ▼
 市区町村 municipalities  search, tags, filter row:  selected municipalities
                     prefecture tags, 市 区 町 村, 政令指定都市, 県庁所在地
 ─────────────────────────────────────────────────────────────────
 現在の選択  the summary of the three selections
\`\`\`

In a document the three are one block: the mode **selector** of a frontend object of the type \`shikuchoson.jp\` ([the demonstration](../comp-mdx/shikuchoson/comp-shikuchoson.md)). The object holds the **tile map of the prefectures** as one of its block maps ([Block maps](map-block.md)): the type extends \`map-block.map-set\`, so the same object is also shown and edited by the modes of block maps.

## The mode and its parameters

\`\`\`yaml
object: frontend:w65il1ops1t
mode: selector
param:
  map: jp-prefecture        # the map of the prefectures: an asset reference
\`\`\`

The map is \`param.map\`, else \`metadata.mapPrefecture\` of the object, else its first map. The selections are the reader's while the page is open; nothing is written, in reading mode as in edit mode.

## Stores and their wiring

Each block has its own stores, made together by \`ShikuchosonStore\` (\`ShikuchosonStore.js\`), so two blocks on a page select independently:

| store | holds |
| --- | --- |
| \`StoreRegion\` | the regions, their order, the ones selected |
| \`StorePrefecture\` | the 47 prefectures (their names and readings), the state of the prefecture selector: search text, selected ids in order, the prefectures offered (\`availableItemIdList\`, null for all), the dropdown and its display mode, the drag of a tag |
| \`StoreMunicipality\` | the municipalities (\`data/municipalities.json\`), the state of the municipality selector, and its filters (\`filterConfig\`) |
| \`StoreConfig\` | the colors of the regions (a session's own, from \`prefectureRegionConfig.js\`), and the map of the prefectures with those colors (\`prefectureMapData\`) |

Each selector is the truth of its own selection; what one needs of another goes through the wiring of \`ShikuchosonStore\`, never by a store reaching into another one:

\`\`\`text
a region toggled, or "all", or "clear"
  -> the prefectures offered = those of the selected regions (if the region checkbox is on)
  -> the prefecture filter of the municipalities follows the prefectures (if its checkbox is on)
a prefecture selected, removed, reordered
  -> the prefecture filter of the municipalities follows
a prefecture filter tag deactivated in the municipality selector
  -> parentItemRemoveRequest: the prefecture is removed from the prefecture selector
a prefecture filter tag activated, or the tags reordered
  -> parentItemSelectedEnsureRequest: the prefecture selector selects those prefectures, in that order
\`\`\`

The municipality store reads the prefectures of the prefecture store it is given (their names prefix the names of municipalities, and they are its filter tags).

## The map of the prefectures

The dropdown of the prefecture selector has three display modes: 地図 (the map), 地域 (a table of the regions and their prefectures), 一覧 (a list). The map is a block map used as a selector (\`MapBlockSelect\`, [The selection a parent approves](map-block-select.md#the-selection-a-parent-approves)), wrapped by \`PrefectureMapSelectJp.jsx\`, which is what knows prefectures:

- **a block is a prefecture by its label**: the block labelled 北海道 is the prefecture whose short name is 北海道 (the name without 都, 道, 府 or 県). A block whose label names no prefecture is drawn but never published;
- **a group is a region by its id**: \`group-{regionId}\` (\`group-kanto\`) takes the color the region has in the settings (the gear of the region selector), over the color the map gives it;
- the prefectures the selector does not offer are greyed out on the map, and the map never publishes them;
- what the search text matches is marked in the labels of the map, as in the list (a search for 東京都 marks 東京);
- the map is drawn with cells of 1 : 0.7, wider than high, as the dropdown has room for.

Selecting on the map follows [the selection model](map-block-select.md): click, Shift and Ctrl, a click on a region selecting all its prefectures, a range dragged over the map (downward: touched, upward: held whole). The guide above the map says so in short: 下ドラッグ: 接触 / 上ドラッグ: 全含有 / Shift追加 / Ctrl切替.

**The map is data of the object**, not of the code: it is edited with the block map editor (the mode editor of the same object) and saved as its next version; the selector reads the version saved. The maps of the object came from the reference implementation ([The first version](map-block-data.md#the-first-version)): \`jp-prefecture\`, the map the selector used, and \`jp-prefecture-wide\`, the larger one its backend had saved.

## Prefecture Filter Design

The municipality selector can use the selected prefectures as a filter.

There are two related selectors:

- prefecture selector: owns the selected prefecture IDs
- municipality selector: owns the municipality result list and selected municipality IDs

The prefecture selector is the source of truth for which prefectures are selected. The municipality selector keeps a filter row that mirrors those prefectures when prefecture filtering is enabled.

The filter row has its own small state because it supports one extra idea: an inactive prefecture filter tag.

## Active And Inactive Prefecture Tags

A prefecture filter tag can be active or inactive.

An active tag means municipalities in that prefecture are allowed by the prefecture filter.

An inactive tag means the tag is still shown in the filter row, but it does not allow municipalities. It is a recoverable state.

For example:

- Tokyo is selected in the prefecture selector
- Tokyo appears as an active prefecture filter tag
- clicking the cross button once makes Tokyo inactive
- Tokyo is removed from the prefecture selector
- selected municipalities in Tokyo are removed
- the Tokyo filter tag stays visible with inactive style
- clicking the inactive tag body makes Tokyo active again
- clicking the cross button again removes the tag from the filter row

This is why the filter row stores two lists:

- \`prefectureFilterIdList\`: prefectures shown in the filter row
- \`prefectureFilterInactiveIdList\`: prefectures shown but inactive

This state is in \`storeMunicipality.js\` under \`filterConfig\`.

## How Municipality Availability Is Decided

When prefecture filtering is enabled, only active prefecture tags allow municipalities.

The store builds the allowed municipality list from active prefectures. Inactive prefectures are ignored.

The key idea is simple:

\`\`\`text
active prefecture tags -> available municipality IDs
\`\`\`

After the available list changes, selected municipalities are synced to it. If one selected municipality no longer passes the active filters, it is removed from selected municipalities.

The important code path is:

- \`getMunicipalityIdListByPrefectureFilter()\` builds municipality availability from active prefectures
- \`prefectureFilterAvailableListApply()\` applies availability and syncs selected municipalities
- \`selectedSyncToFilterRange()\` removes selected municipalities that no longer pass filters

## Sync With The Prefecture Selector

When the prefecture selector selection changes, the municipality selector updates the prefecture filter row.

Selected prefectures are added as active filter tags.

Inactive tags are preserved if they already exist in the filter row. This matters because an inactive tag is intentionally recoverable. It should not disappear only because it was removed from the prefecture selector.

The sync logic lives in \`prefectureFilterSyncFromPrefectureSelection()\`.

## Cross Button And Recover Behavior

The cross button has two meanings.

When the tag is active, clicking the cross button deactivates the tag:

- the tag becomes inactive
- the prefecture is removed from the prefecture selector
- municipalities from that prefecture become unavailable
- selected municipalities from that prefecture are removed

When the tag is inactive, clicking the cross button removes the tag from the filter row.

Clicking the body of an inactive tag recovers it:

- the tag becomes active
- the municipality filter allows that prefecture again
- the parent prefecture selector is asked to select that prefecture again
- the prefecture selector receives the active tag order, so the restored prefecture keeps the filter-row order

The UI emits these events from \`MunicipalityFilter.tsx\`:

- \`prefectureFilterDeactivate\`
- \`prefectureFilterRemove\`
- \`prefectureFilterActivate\`

The store handles them in \`storeMunicipality.js\`.

The parent-prefecture communication is done by store events:

- \`parentItemRemoveRequest\`
- \`parentItemSelectedEnsureRequest\`

The wiring of the block (\`ShikuchosonStore.js\`, [above](#stores-and-their-wiring)) receives those requests and updates the prefecture selector.

## Reordering Filter Tags

Prefecture filter tags can be reordered by dragging.

The reorder does not change which prefectures are active. It only changes the display order of the filter row.

The drag preview uses shared geometry helpers from \`dragReorderGeometry.js\`. This avoids separate reorder math for each draggable list.

## Special Municipality Filters

The municipality selector has two special filters:

- 政令指定都市
- 県庁所在地

Both filters use the same data-driven design. A filter is not implemented as custom UI logic. It is a JSON data definition loaded by the municipality store. The render component only receives a list of filter buttons and sends toggle events upward.

### Core Design

A special filter is a named set of municipality IDs.

\`\`\`json
{
  "id": "prefectural-capital",
  "label": "県庁所在地",
  "items": [
    {
      "id": "saitama-saitama",
      "label": "さいたま市",
      "prefectureLabel": "埼玉県",
      "municipalityIdList": ["11100", "11101"]
    }
  ]
}
\`\`\`

Each item represents one logical city or place. \`municipalityIdList\` can contain one ID or many IDs.

This matters because some cities are represented by multiple municipality records. For example, a designated city has a root city ID and ward IDs. \`さいたま市\` is the prefectural capital of 埼玉県, and it is stored as \`さいたま市\`, not \`サイタマ市\` or \`埼玉市\`.

### Data Files

The filter data lives next to the municipality master data, in \`data/\`.

- \`data/municipalities.designatedCities.json\`
- \`data/municipalities.prefecturalCapitals.json\`

Both files use the same shape:

- \`id\`: filter id
- \`label\`: button label shown in UI
- \`items\`: grouped municipality ID lists

The store flattens all \`municipalityIdList\` values into a set. A municipality passes the filter when its ID is in this set.

### Store Logic

\`storeMunicipality.js\` loads the enabled special filter definitions.

\`\`\`js
const filterDataList = [
  configShikuchoson.isDesignatedCityFilterEnabled ? designatedCitiesData : null,
  configShikuchoson.isPrefecturalCapitalFilterEnabled ? prefecturalCapitalsData : null,
].filter(Boolean);

this.loadSpecialFilterData(filterDataList);
\`\`\`

\`loadSpecialFilterData\` converts each JSON definition into a filter predicate. The UI does not need to know how the filter is calculated.

\`\`\`js
predicate: (item) => municipalityIdSet.has(item.id)
\`\`\`

This keeps the implementation symmetric. Adding another special filter should usually mean adding another JSON file and enabling it in the same loader path.

### UI Logic

\`MunicipalityFilter\` renders \`specialFilterList\` as buttons. It does not know about 政令指定都市 or 県庁所在地 specifically.

When a user clicks a special filter button, the component emits:

\`\`\`js
onEvent('specialFilterToggle', { filterId: item.id })
\`\`\`

The store receives the event and updates \`activeSpecialFilterIdList\`. Selected municipalities that no longer pass active filters are removed by \`selectedSyncToFilterRange\`.

### Filter Combination

Special filters are OR filters with each other.

If both 政令指定都市 and 県庁所在地 are active, a municipality is shown when it belongs to either set.

Prefecture filters still combine with special filters. In practice:

\`\`\`text
active prefectures AND active special filters
\`\`\`

So selecting 埼玉県 and enabling 県庁所在地 shows the municipality records belonging to 埼玉県's capital, \`さいたま市\`.

### Data Validation

The important part of a special filter is data correctness.

Useful checks:

- every municipality ID in a special filter that exists in \`municipalities.json\`
- \`県庁所在地\` has one item for each of the 47 prefectures
- designated-city capitals include the root city ID and ward IDs
- 東京都 uses \`新宿区\`
- 埼玉県 uses \`さいたま市\` in hiragana

## Data

| file | what | made by |
| --- | --- | --- |
| \`data/municipalities.json\` | the 1917 municipalities: id (the local government code), name with the prefecture, kind (city, ward, town, village), the search text with readings | \`script-data/shikuchoson_extract_chiiki.py\` from the workbook chiiki.xlsx |
| \`data/municipalities.searchEnhancements.json\` | other names a municipality is searched by (陸奥市, 埼玉市) | by hand |
| \`data/municipalities.designatedCities.json\`, \`data/municipalities.prefecturalCapitals.json\` | the special filters ([above](#special-municipality-filters)) | by hand |
| \`storePrefecture.js\` | the 47 prefectures, their readings and icons | in the code |
| \`prefectureRegionConfig.js\` | the six regions, their prefectures and default colors | in the code |
| the map of the prefectures | an asset of the object ([above](#the-map-of-the-prefectures)) | the block map editor |

The workbook is not kept in the repository. To make the municipalities again:

\`\`\`text
python3 script-data/shikuchoson_extract_chiiki.py --input /path/to/chiiki.xlsx [--stats]
\`\`\`

It writes \`comp-mdx/shikuchoson/data/municipalities.json\` (\`--output\` names another file, \`--stats\` prints counts only).

## Files

| file | what |
| --- | --- |
| \`ShikuchosonSelector.jsx\` | the mode: the map read from the object, the panel of the three selectors and the summary |
| \`ShikuchosonStore.js\` | the stores of a block and their wiring |
| \`storeRegion.js\`, \`storePrefecture.js\`, \`storeMunicipality.js\`, \`storeConfig.js\`, \`configShikuchoson.js\` | the stores, the switches of the special filters |
| \`RegionSelector.jsx\` | the region selector |
| \`MunicipalitySelector.jsx\`, \`MunicipalityDropdown.jsx\`, \`MunicipalityFilter.tsx\`, \`MunicipalitySelectedTags.jsx\`, \`MunicipalityTextHighlight.jsx\` | the selector used for prefectures and municipalities alike, its dropdown, its filter row, its tags, the marks of a match |
| \`PrefectureDropdown.jsx\`, \`PrefectureMapSelectJp.jsx\` | the dropdown of the prefectures: map, regions, list |
| \`ShikuchosonConfigPopup.jsx\`, \`SettingsIcon.jsx\` | the colors of the regions |
| \`dragReorderGeometry.js\` | where a dragged tag goes |
| \`MunicipalitySelector.css\` | the styles |
`;export{e as default};