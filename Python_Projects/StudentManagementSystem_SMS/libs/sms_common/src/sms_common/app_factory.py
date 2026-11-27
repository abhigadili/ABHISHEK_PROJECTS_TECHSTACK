"""Common FastAPI app wiring so every service looks the same."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI

from sms_common.config import BaseServiceSettings
from sms_common.errors import register_exception_handlers
from sms_common.logging import configure_logging
from sms_common.middleware import install_middleware


def create_app(settings: BaseServiceSettings, *, title: str, description: str, lifespan: Any,
               version: str = "1.0.0", tags: list[dict[str, str]] | None = None,
               builtin_docs: bool = True) -> FastAPI:
    """``builtin_docs=False`` lets the gateway serve a *merged* /docs and /openapi.json itself."""
    configure_logging(settings.service_name, settings.log_level, settings.log_format)
    app = FastAPI(
        title=title,
        description=description,
        version=version,
        lifespan=lifespan,
        openapi_tags=tags,
        docs_url="/docs" if builtin_docs else None,
        redoc_url="/redoc" if builtin_docs else None,
        openapi_url="/openapi.json" if builtin_docs else None,
        swagger_ui_parameters={"persistAuthorization": True},
    )
    register_exception_handlers(app)
    install_middleware(app, settings)
    return app
