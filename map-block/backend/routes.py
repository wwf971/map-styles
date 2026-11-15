from __future__ import annotations

import json
import shutil
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from flask import Blueprint, jsonify, request, send_from_directory

pathMapBlockBackend = Path(__file__).resolve().parent
pathFrontend = pathMapBlockBackend.parents[1]
pathData = pathMapBlockBackend / "data"
pathDb = pathData / "block-map.sqlite"
pathFrontendDist = pathFrontend / "dist"


def time_now_parts() -> tuple[str, int]:
    timeNow = datetime.now().astimezone()
    offsetValue = timeNow.utcoffset()
    timezoneMinute = int(offsetValue.total_seconds() // 60) if offsetValue else 0
    timezoneHour = int(round(timezoneMinute / 60))
    centisecond = timeNow.microsecond // 10000
    stamp = f"{timeNow:%Y%m%d_%H%M%S}{centisecond:02d}{timezoneHour:+03d}"
    return stamp, timezoneMinute


def response_ok(data: Any | None = None, message: str | None = None):
    body: dict[str, Any] = {"code": 0}
    if data is not None:
        body["data"] = data
    if message:
        body["message"] = message
    return jsonify(body)


def response_fail(message: str, code: int = -1, status: int = 400):
    return jsonify({"code": code, "message": message}), status


def connect_db() -> sqlite3.Connection:
    connection = sqlite3.connect(pathDb)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def backup_db() -> Path:
    stamp, _timezoneMinute = time_now_parts()
    pathBackup = pathData / f"block-map_{stamp}.sqlite.bak"
    shutil.copy2(pathDb, pathBackup)
    return pathBackup


def table_columns_get(connection: sqlite3.Connection, tableName: str) -> list[sqlite3.Row]:
    return connection.execute(f"PRAGMA table_info({tableName})").fetchall()


def is_schema_old(connection: sqlite3.Connection) -> bool:
    columns = table_columns_get(connection, "config_version")
    if not columns:
        return False
    versionCol = next((column for column in columns if column["name"] == "version"), None)
    idColumn = next((column for column in columns if column["name"] == "id"), None)
    return bool(versionCol and versionCol["pk"] == 1 and idColumn and idColumn["pk"] == 0)


def create_tables(connection: sqlite3.Connection) -> None:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS config_version (
            id TEXT NOT NULL,
            version INTEGER NOT NULL,
            versionPrev INTEGER NULL,
            createAt TEXT NOT NULL,
            createAtTimezone INTEGER NOT NULL,
            updateAt TEXT NOT NULL,
            updateAtTimezone INTEGER NOT NULL,
            contentJson TEXT NOT NULL,
            PRIMARY KEY (id, version),
            FOREIGN KEY (id, versionPrev) REFERENCES config_version(id, version)
        )
        """
    )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS config_checkout (
            id TEXT PRIMARY KEY,
            versionCheckout INTEGER NOT NULL,
            updateAt TEXT NOT NULL,
            updateAtTimezone INTEGER NOT NULL,
            FOREIGN KEY (id, versionCheckout) REFERENCES config_version(id, version)
        )
        """
    )
    connection.execute("CREATE INDEX IF NOT EXISTS idx_config_version_id ON config_version(id)")
    connection.execute("CREATE INDEX IF NOT EXISTS idx_config_version_prev ON config_version(id, versionPrev)")


def migrate_old_schema(connection: sqlite3.Connection) -> None:
    connection.execute("ALTER TABLE config_version RENAME TO config_version_old")
    create_tables(connection)
    connection.execute(
        """
        INSERT INTO config_version (
            id, version, versionPrev, createAt, createAtTimezone,
            updateAt, updateAtTimezone, contentJson
        )
        SELECT id, version, versionPrev, createAt, createAtTimezone,
               updateAt, updateAtTimezone, contentJson
        FROM config_version_old
        """
    )
    rows = connection.execute(
        """
        SELECT cv.*
        FROM config_version cv
        JOIN (
            SELECT id, MAX(version) AS versionMax
            FROM config_version
            GROUP BY id
        ) latest ON latest.id = cv.id AND latest.versionMax = cv.version
        """
    ).fetchall()
    for row in rows:
        connection.execute(
            """
            INSERT OR REPLACE INTO config_checkout (id, versionCheckout, updateAt, updateAtTimezone)
            VALUES (?, ?, ?, ?)
            """,
            (row["id"], row["version"], row["updateAt"], row["updateAtTimezone"]),
        )
    connection.execute("DROP TABLE config_version_old")


def init_db() -> None:
    pathData.mkdir(parents=True, exist_ok=True)
    with connect_db() as connection:
        if is_schema_old(connection):
            migrate_old_schema(connection)
        else:
            create_tables(connection)


def row_to_data(row: sqlite3.Row, is_content_included: bool = False) -> dict[str, Any]:
    data = {
        "id": row["id"],
        "version": row["version"],
        "versionPrev": row["versionPrev"],
        "createAt": row["createAt"],
        "createAtTimezone": row["createAtTimezone"],
        "updateAt": row["updateAt"],
        "updateAtTimezone": row["updateAtTimezone"],
    }
    if is_content_included:
        data["contentJson"] = row["contentJson"]
    return data


def row_to_config_data(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "version": row["versionCheckout"],
        "versionPrev": row["versionPrev"],
        "updateAt": row["updateAt"],
        "updateAtTimezone": row["updateAtTimezone"],
    }


def content_json_normalized(contentRaw: Any) -> str:
    if isinstance(contentRaw, str):
        try:
            contentRaw = json.loads(contentRaw)
        except json.JSONDecodeError as error:
            raise ValueError(f"contentJson is not valid JSON: {error.msg}") from error
    try:
        return json.dumps(contentRaw, ensure_ascii=False, separators=(",", ":"))
    except TypeError as error:
        raise ValueError("contentJson must be JSON serializable") from error


def version_next_get(connection: sqlite3.Connection, idValue: str) -> int:
    row = connection.execute("SELECT COALESCE(MAX(version), 0) + 1 AS versionNext FROM config_version WHERE id = ?", (idValue,)).fetchone()
    return int(row["versionNext"])


def config_version_insert(connection: sqlite3.Connection, dataRequest: dict[str, Any], versionPrev: int | None) -> dict[str, Any]:
    idValue = str(dataRequest.get("id") or "japan-prefecture-tile-grid-map")
    contentRaw = dataRequest.get("contentJson", dataRequest.get("content"))
    if contentRaw is None:
        raise ValueError("contentJson is required")

    versionRaw = dataRequest.get("version")
    version = version_next_get(connection, idValue) if versionRaw is None else int(versionRaw)
    contentJson = content_json_normalized(contentRaw)
    timeNow, timezoneMinute = time_now_parts()

    connection.execute(
        """
        INSERT INTO config_version (
            id, version, versionPrev, createAt, createAtTimezone,
            updateAt, updateAtTimezone, contentJson
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (idValue, version, versionPrev, timeNow, timezoneMinute, timeNow, timezoneMinute, contentJson),
    )
    row = connection.execute("SELECT * FROM config_version WHERE id = ? AND version = ?", (idValue, version)).fetchone()
    timeNow, timezoneMinute = time_now_parts()
    connection.execute(
        """
        INSERT OR REPLACE INTO config_checkout (id, versionCheckout, updateAt, updateAtTimezone)
        VALUES (?, ?, ?, ?)
        """,
        (idValue, version, timeNow, timezoneMinute),
    )
    return row_to_data(row, is_content_included=True)


pathData.mkdir(parents=True, exist_ok=True)
isDbExisting = pathDb.exists()
if isDbExisting:
    backup_db()
init_db()
if not isDbExisting:
    backup_db()

app = Blueprint("map_block", __name__)


@app.get("/api/health")
def api_health():
    return response_ok({"databasePath": str(pathDb)})


@app.get("/api/config-versions")
def api_config_versions_list():
    idFilter = request.args.get("id")
    with connect_db() as connection:
        if idFilter:
            rows = connection.execute(
                """
                SELECT * FROM config_version
                WHERE id = ?
                ORDER BY version DESC
                """,
                (idFilter,),
            ).fetchall()
        else:
            rows = connection.execute("SELECT * FROM config_version ORDER BY version DESC").fetchall()
    return response_ok([row_to_data(row) for row in rows])


@app.get("/api/configs")
def api_configs_list():
    with connect_db() as connection:
        rows = connection.execute(
            """
            SELECT cc.id, cc.versionCheckout, cc.updateAt, cc.updateAtTimezone, cv.versionPrev
            FROM config_checkout cc
            JOIN config_version cv ON cv.id = cc.id AND cv.version = cc.versionCheckout
            ORDER BY cc.id
            """
        ).fetchall()
    return response_ok([row_to_config_data(row) for row in rows])


@app.get("/api/configs/<path:idValue>/versions")
def api_config_versions_list_by_id(idValue: str):
    with connect_db() as connection:
        rows = connection.execute(
            """
            SELECT * FROM config_version
            WHERE id = ?
            ORDER BY version DESC
            """,
            (idValue,),
        ).fetchall()
    return response_ok([row_to_data(row) for row in rows])


@app.get("/api/configs/<path:idValue>/versions/<int:version>")
def api_config_version_get_by_id(idValue: str, version: int):
    with connect_db() as connection:
        row = connection.execute("SELECT * FROM config_version WHERE id = ? AND version = ?", (idValue, version)).fetchone()
    if not row:
        return response_fail("Version not found", code=-404, status=404)
    return response_ok(row_to_data(row, is_content_included=True))


@app.post("/api/configs/<path:idValue>/versions")
def api_config_version_create_root_by_id(idValue: str):
    dataRequest = request.get_json(silent=True) or {}
    dataRequest["id"] = idValue
    if dataRequest.get("versionPrev") is not None:
        return response_fail("Use /map-block/api/configs/{id}/versions/{versionPrev}/children to create a child version")
    try:
        with connect_db() as connection:
            data = config_version_insert(connection, dataRequest, versionPrev=None)
    except (ValueError, sqlite3.IntegrityError) as error:
        return response_fail(str(error))
    return response_ok(data)


@app.post("/api/configs/<path:idValue>/versions/<int:versionPrev>/children")
def api_config_version_create_child_by_id(idValue: str, versionPrev: int):
    dataRequest = request.get_json(silent=True) or {}
    dataRequest["id"] = idValue
    try:
        with connect_db() as connection:
            rowPrev = connection.execute("SELECT version FROM config_version WHERE id = ? AND version = ?", (idValue, versionPrev)).fetchone()
            if not rowPrev:
                return response_fail("versionPrev does not exist", code=-404, status=404)
            data = config_version_insert(connection, dataRequest, versionPrev=versionPrev)
    except (ValueError, sqlite3.IntegrityError) as error:
        return response_fail(str(error))
    return response_ok(data)


@app.delete("/api/configs/<path:idValue>/versions/<int:version>")
def api_config_version_delete_by_id(idValue: str, version: int):
    isForce = request.args.get("force") == "true"
    with connect_db() as connection:
        row = connection.execute("SELECT version FROM config_version WHERE id = ? AND version = ?", (idValue, version)).fetchone()
        if not row:
            return response_fail("Version not found", code=-404, status=404)
        rowCheckout = connection.execute("SELECT id FROM config_checkout WHERE id = ? AND versionCheckout = ?", (idValue, version)).fetchone()
        if rowCheckout:
            return response_fail("Cannot delete currently checked out version")
        rowChild = connection.execute("SELECT version FROM config_version WHERE id = ? AND versionPrev = ? LIMIT 1", (idValue, version)).fetchone()
        if rowChild and not isForce:
            return response_fail("Version has child versions; pass force=true to delete anyway")
        if rowChild and isForce:
            connection.execute("UPDATE config_version SET versionPrev = NULL WHERE id = ? AND versionPrev = ?", (idValue, version))
        connection.execute("DELETE FROM config_version WHERE id = ? AND version = ?", (idValue, version))
    return response_ok()


@app.get("/api/config-versions/<int:version>")
def api_config_version_get(version: int):
    with connect_db() as connection:
        row = connection.execute("SELECT * FROM config_version WHERE version = ?", (version,)).fetchone()
    if not row:
        return response_fail("Version not found", code=-404, status=404)
    return response_ok(row_to_data(row, is_content_included=True))


@app.post("/api/config-versions")
def api_config_version_create_root():
    dataRequest = request.get_json(silent=True) or {}
    if dataRequest.get("versionPrev") is not None:
        return response_fail("Use /map-block/api/config-versions/<versionPrev>/children to create a child version")
    try:
        with connect_db() as connection:
            data = config_version_insert(connection, dataRequest, versionPrev=None)
    except (ValueError, sqlite3.IntegrityError) as error:
        return response_fail(str(error))
    return response_ok(data)


@app.post("/api/config-versions/<int:versionPrev>/children")
def api_config_version_create_child(versionPrev: int):
    dataRequest = request.get_json(silent=True) or {}
    try:
        with connect_db() as connection:
            idValue = str(dataRequest.get("id") or "")
            if not idValue:
                return response_fail("id is required")
            rowPrev = connection.execute("SELECT version FROM config_version WHERE id = ? AND version = ?", (idValue, versionPrev)).fetchone()
            if not rowPrev:
                return response_fail("versionPrev does not exist", code=-404, status=404)
            data = config_version_insert(connection, dataRequest, versionPrev=versionPrev)
    except (ValueError, sqlite3.IntegrityError) as error:
        return response_fail(str(error))
    return response_ok(data)


@app.delete("/api/config-versions/<int:version>")
def api_config_version_delete(version: int):
    isForce = request.args.get("force") == "true"
    with connect_db() as connection:
        row = connection.execute("SELECT version FROM config_version WHERE version = ?", (version,)).fetchone()
        if not row:
            return response_fail("Version not found", code=-404, status=404)
        rowChild = connection.execute("SELECT version FROM config_version WHERE versionPrev = ? LIMIT 1", (version,)).fetchone()
        if rowChild and not isForce:
            return response_fail("Version has child versions; pass force=true to delete anyway")
        if rowChild and isForce:
            connection.execute("UPDATE config_version SET versionPrev = NULL WHERE versionPrev = ?", (version,))
        connection.execute("DELETE FROM config_version WHERE version = ?", (version,))
    return response_ok()


@app.post("/api/configs/<path:idValue>/checkout/<int:version>")
def api_config_checkout_set(idValue: str, version: int):
    timeNow, timezoneMinute = time_now_parts()
    with connect_db() as connection:
        row = connection.execute("SELECT version FROM config_version WHERE id = ? AND version = ?", (idValue, version)).fetchone()
        if not row:
            return response_fail("Version not found", code=-404, status=404)
        connection.execute(
            """
            INSERT OR REPLACE INTO config_checkout (id, versionCheckout, updateAt, updateAtTimezone)
            VALUES (?, ?, ?, ?)
            """,
            (idValue, version, timeNow, timezoneMinute),
        )
    return response_ok()


@app.get("/")
def page_index():
    if pathFrontendDist.exists():
        return send_from_directory(pathFrontendDist, "index.html")
    return response_fail("Frontend build not found. Run npm run build in frontend-misc.", status=404)


@app.get("/<path:pathStatic>")
def page_static(pathStatic: str):
    if pathFrontendDist.exists() and (pathFrontendDist / pathStatic).exists():
        return send_from_directory(pathFrontendDist, pathStatic)
    if pathFrontendDist.exists():
        return send_from_directory(pathFrontendDist, "index.html")
    return response_fail("Frontend build not found. Run npm run build in frontend-misc.", status=404)


