# Municipality Selector

## glossary

prefecture: 都道府県

municipality: 市区町村

## core concepts

this project provides two selectors, one allowing user to search and select one or many prefectures in japan, the other allowing user to search and select one or many municipalities in japan.

the two selectors can work independently, but can also work together. specifically speaking, municipality selector allows limiting search results within given prefectures, and prefecture selector can be used to provide this prefectures as filter.

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

- `prefectureFilterIdList`: prefectures shown in the filter row
- `prefectureFilterInactiveIdList`: prefectures shown but inactive

This state is in `shikuchoson/storeMunicipality.js` under `filterConfig`.

## How Municipality Availability Is Decided

When prefecture filtering is enabled, only active prefecture tags allow municipalities.

The store builds the allowed municipality list from active prefectures. Inactive prefectures are ignored.

The key idea is simple:

```text
active prefecture tags -> available municipality IDs
```

After the available list changes, selected municipalities are synced to it. If one selected municipality no longer passes the active filters, it is removed from selected municipalities.

The important code path is:

- `getMunicipalityIdListByPrefectureFilter()` builds municipality availability from active prefectures
- `prefectureFilterAvailableListApply()` applies availability and syncs selected municipalities
- `selectedSyncToFilterRange()` removes selected municipalities that no longer pass filters

## Sync With The Prefecture Selector

When the prefecture selector selection changes, the municipality selector updates the prefecture filter row.

Selected prefectures are added as active filter tags.

Inactive tags are preserved if they already exist in the filter row. This matters because an inactive tag is intentionally recoverable. It should not disappear only because it was removed from the prefecture selector.

The sync logic lives in `prefectureFilterSyncFromPrefectureSelection()`.

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

The UI emits these events from `shikuchoson/MunicipalityFilter.tsx`:

- `prefectureFilterDeactivate`
- `prefectureFilterRemove`
- `prefectureFilterActivate`

The store handles them in `shikuchoson/storeMunicipality.js`.

The parent-prefecture communication is done by store events:

- `parentItemRemoveRequest`
- `parentItemSelectedEnsureRequest`

The demo wiring in `shikuchoson/demo-shikuchoson.jsx` receives those requests and updates the prefecture selector.

## Reordering Filter Tags

Prefecture filter tags can be reordered by dragging.

The reorder does not change which prefectures are active. It only changes the display order of the filter row.

The drag preview uses shared geometry helpers from `shikuchoson/dragReorderGeometry.js`. This avoids separate reorder math for each draggable list.



## Special Municipality Filters

The municipality selector has two special filters:

- 政令指定都市
- 県庁所在地

Both filters use the same data-driven design. A filter is not implemented as custom UI logic. It is a JSON data definition loaded by the municipality store. The render component only receives a list of filter buttons and sends toggle events upward.

### Core Design

A special filter is a named set of municipality IDs.

```json
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
```

Each item represents one logical city or place. `municipalityIdList` can contain one ID or many IDs.

This matters because some cities are represented by multiple municipality records. For example, a designated city has a root city ID and ward IDs. `さいたま市` is the prefectural capital of 埼玉県, and it is stored as `さいたま市`, not `サイタマ市` or `埼玉市`.

### Data Files

The filter data lives next to the municipality master data.

- `shikuchoson/municipalities.designatedCities.json`
- `shikuchoson/municipalities.prefecturalCapitals.json`

Both files use the same shape:

- `id`: filter id
- `label`: button label shown in UI
- `items`: grouped municipality ID lists

The store flattens all `municipalityIdList` values into a set. A municipality passes the filter when its ID is in this set.

### Store Logic

`storeMunicipality.js` loads the enabled special filter definitions.

```js
const filterDataList = [
  configShikuchoson.isDesignatedCityFilterEnabled ? designatedCitiesData : null,
  configShikuchoson.isPrefecturalCapitalFilterEnabled ? prefecturalCapitalsData : null,
].filter(Boolean);

this.loadSpecialFilterData(filterDataList);
```

`loadSpecialFilterData` converts each JSON definition into a filter predicate. The UI does not need to know how the filter is calculated.

```js
predicate: (item) => municipalityIdSet.has(item.id)
```

This keeps the implementation symmetric. Adding another special filter should usually mean adding another JSON file and enabling it in the same loader path.

### UI Logic

`MunicipalityFilter` renders `specialFilterList` as buttons. It does not know about 政令指定都市 or 県庁所在地 specifically.

When a user clicks a special filter button, the component emits:

```js
onEvent('specialFilterToggle', { filterId: item.id })
```

The store receives the event and updates `activeSpecialFilterIdList`. Selected municipalities that no longer pass active filters are removed by `selectedSyncToFilterRange`.

### Filter Combination

Special filters are OR filters with each other.

If both 政令指定都市 and 県庁所在地 are active, a municipality is shown when it belongs to either set.

Prefecture filters still combine with special filters. In practice:

```text
active prefectures AND active special filters
```

So selecting 埼玉県 and enabling 県庁所在地 shows the municipality records belonging to 埼玉県's capital, `さいたま市`.

### Data Validation

The important part of a special filter is data correctness.

Useful checks:

- every municipality ID in a special filter that exists in `municipalities.json`
- `県庁所在地` has one item for each of the 47 prefectures
- designated-city capitals include the root city ID and ward IDs
- 東京都 uses `新宿区`
- 埼玉県 uses `さいたま市` in hiragana
