// Converts block maps of the first version (doc/map-block-data.md#the-first-version) to the
// format of now, with the converter of the package (comp-mdx/map-block/MapBlockData.ts), and
// prints the map as text (the tight form, one component per line), as a map asset holds it.
//
//   npx tsx script-data/map_block_v1_convert.ts <input> [--label <label>]
//
//   <input>   a .json file of one map; a .ts or .js module exporting it (its export
//             japanPrefectureTileGridMap, else its default); or the .sqlite file of the former
//             backend, of which the version checked out of every config is printed, one after
//             another, each after a line "# {id} version {n}"
//
// The maps of the package were made this way from the reference implementation (the first commit
// of the repository): map-block/config/prefectureTileGridMapJp.ts and the sqlite backend's
// map-block/backend/data/block-map.sqlite, whose one version equals prefectureTileGridMapBakJp.ts.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { mapBlockDataFromV1, mapBlockDataNormalize, mapBlockDataTextBuild } from '../comp-mdx/map-block/MapBlockData'

async function main() {
  const argList = process.argv.slice(2)
  const input = argList.find((arg) => !arg.startsWith('--'))
  const labelIndex = argList.indexOf('--label')
  const label = labelIndex >= 0 ? argList[labelIndex + 1] : undefined
  if (!input) {
    console.error('usage: tsx script-data/map_block_v1_convert.ts <input.json | input.ts | input.sqlite> [--label <label>]')
    process.exit(1)
  }
  for (const { title, dataV1 } of await mapListRead(path.resolve(input))) {
    const data = mapBlockDataNormalize(mapBlockDataFromV1(dataV1))
    if (label) data.label = label
    if (title) console.log(`# ${title}`)
    console.log(mapBlockDataTextBuild(data, 'tight'))
  }
}

async function mapListRead(file: string): Promise<{ title: string; dataV1: any }[]> {
  if (file.endsWith('.json')) return [{ title: '', dataV1: JSON.parse(readFileSync(file, 'utf8')) }]
  if (file.endsWith('.sqlite')) {
    const { DatabaseSync } = await import('node:sqlite')
    const db = new DatabaseSync(file, { readOnly: true })
    const rowList = db.prepare(`
      SELECT cv.id, cv.version, cv.contentJson FROM config_checkout cc
      JOIN config_version cv ON cv.id = cc.id AND cv.version = cc.versionCheckout
      ORDER BY cv.id`).all() as any[]
    return rowList.map((row) => ({ title: `${row.id} version ${row.version}`, dataV1: JSON.parse(row.contentJson) }))
  }
  const module = await import(pathToFileURL(file).href)
  return [{ title: '', dataV1: module.japanPrefectureTileGridMap ?? module.default }]
}

void main()
