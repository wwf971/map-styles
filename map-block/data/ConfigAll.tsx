import React from 'react'
import { observer } from 'mobx-react-lite'
import { FolderView } from '../localReactCompMisc'

export type ConfigAllRowData = {
  id: string
  version: number
  versionPrev: number | null
  updateAt: string
  updateAtTimezone: number
}

type ConfigAllData = {
  rows: ConfigAllRowData[]
}

type ConfigAllConfig = {
  selectedId: string | null
  isLoading: boolean
  message: string
  versionBase: number | null
}

type ConfigAllEventType = 'refresh' | 'save' | 'load' | 'delete' | 'select'

type ConfigAllProps = {
  data: ConfigAllData
  config: ConfigAllConfig
  onEvent: (eventType: ConfigAllEventType, eventData?: Record<string, unknown>) => unknown
}

const columns = {
  id: { data: 'Config ID' },
  version: { data: 'Version' },
  versionPrev: { data: 'Prev' },
  updateAt: { data: 'Checked Out' },
}

const columnsOrder = ['id', 'version', 'versionPrev', 'updateAt']
const columnsSize = {
  id: { width: 300, minWidth: 180, resizable: true },
  version: { width: 86, minWidth: 70, resizable: true },
  versionPrev: { width: 86, minWidth: 70, resizable: true },
  updateAt: { width: 180, minWidth: 140, resizable: true },
}

const ConfigAll = observer(({ data, config, onEvent }: ConfigAllProps) => {
  const rows = data.rows.map((configRow) => ({
    id: configRow.id,
    data: {
      id: configRow.id,
      version: String(configRow.version),
      versionPrev: configRow.versionPrev === null ? '' : String(configRow.versionPrev),
      updateAt: configRow.updateAt,
    },
  }))
  const isSelected = config.selectedId !== null

  return (
    <section className="prefecture-selector-version-panel">
      <div className="prefecture-selector-version-toolbar">
        <h2>Saved Configs</h2>
        <div className="prefecture-selector-version-actions">
          <button type="button" className="prefecture-selector-version-button" onClick={() => onEvent('refresh')} disabled={config.isLoading}>
            Refresh
          </button>
          <button type="button" className="prefecture-selector-version-button" onClick={() => onEvent('save')} disabled={config.isLoading}>
            {config.versionBase === null ? 'Save Initial' : `Save from ${config.versionBase}`}
          </button>
          <button type="button" className="prefecture-selector-version-button" onClick={() => config.selectedId && onEvent('load', { id: config.selectedId })} disabled={config.isLoading || !isSelected}>
            Load
          </button>
          <button type="button" className="prefecture-selector-version-button" onClick={() => config.selectedId && onEvent('delete', { id: config.selectedId })} disabled={config.isLoading || !isSelected}>
            Delete
          </button>
        </div>
      </div>
      {config.message ? <div className="prefecture-selector-version-message">{config.message}</div> : null}
      <FolderView
        columns={columns}
        columnsOrder={columnsOrder}
        columnsSizeInit={columnsSize}
        rows={rows}
        selectedRowId={config.selectedId ?? undefined}
        onRowClick={(rowId: string) => onEvent('select', { id: rowId })}
        onRowDoubleClick={(rowId: string) => onEvent('load', { id: rowId })}
        bodyHeight={180}
        showStatusBar={false}
        listOnly={true}
        columnResizeDragMode="immediate"
        columnResizeWidthMode="local"
      />
    </section>
  )
})

export default ConfigAll
