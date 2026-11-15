from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

from flask import Flask

from routes import app as map_block_blueprint


pathFrontend = Path(__file__).resolve().parents[2]
pathConfig = pathFrontend / "FB" / "doc" / "FB_dataverse.yaml"


def backend_origin_config_get(config_text: str) -> str:
    is_backend = False
    for line in config_text.splitlines():
        line_stripped = line.strip()
        if not line_stripped or line_stripped.startswith("#"):
            continue
        if not line[0].isspace():
            is_backend = line_stripped.split("#", 1)[0].rstrip() == "backend:"
            continue
        if is_backend and line_stripped.startswith("origin:"):
            origin = line_stripped.split(":", 1)[1].strip()
            if len(origin) >= 2 and origin[0] == origin[-1] and origin[0] in {'"', "'"}:
                return origin[1:-1].strip()
            return origin.split(" #", 1)[0].strip()
    return ""


def backend_origin_get() -> str | None:
    try:
        origin = backend_origin_config_get(pathConfig.read_text(encoding="utf-8"))
    except OSError:
        return None

    parsed = urlparse(origin)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def backend_bind_get() -> tuple[str, int]:
    origin = backend_origin_get()
    if not origin:
        return "127.0.0.1", 5000
    parsed = urlparse(origin)
    host = parsed.hostname or "127.0.0.1"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    return host, port


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)
    app.register_blueprint(map_block_blueprint, url_prefix="/map-block")
    return app


app = create_app()


if __name__ == "__main__":
    host, port = backend_bind_get()
    app.run(host=host, port=port, debug=True, use_reloader=False)