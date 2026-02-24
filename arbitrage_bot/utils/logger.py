"""
Structured logging module for the arbitrage bot.
Supports both human-readable console output and optional JSON logging
for log aggregators (Loki, Datadog, etc.).
"""
from __future__ import annotations

import logging
import logging.handlers
import os
import sys
from pathlib import Path
from typing import Any

import structlog


def _add_severity(logger: Any, method: str, event_dict: dict) -> dict:
    """Map structlog level names to standard severity strings."""
    event_dict["severity"] = event_dict.get("level", method).upper()
    return event_dict


def configure_logging(
    level: str = "INFO",
    log_file: str = "logs/arb_bot.log",
    max_bytes: int = 10_485_760,
    backup_count: int = 5,
    json_logs: bool = False,
) -> None:
    """
    Call once at startup to configure both stdlib logging (for third-party
    libraries) and structlog (for our own code).
    """
    # Ensure log directory exists
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    log_level = getattr(logging, level.upper(), logging.INFO)

    # --- stdlib root logger (captures hyperliquid-sdk, web3, ccxt logs) ---
    root = logging.getLogger()
    root.setLevel(log_level)

    fmt = "%(asctime)s [%(levelname)s] %(name)s — %(message)s"
    date_fmt = "%Y-%m-%dT%H:%M:%S"

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(logging.Formatter(fmt, datefmt=date_fmt))
    console_handler.setLevel(log_level)

    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding="utf-8",
    )
    file_handler.setFormatter(logging.Formatter(fmt, datefmt=date_fmt))
    file_handler.setLevel(log_level)

    root.addHandler(console_handler)
    root.addHandler(file_handler)

    # Silence overly chatty third-party loggers
    for noisy in ("web3.RequestManager", "web3.providers", "urllib3", "asyncio"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    # --- structlog configuration ---
    shared_processors: list[Any] = [
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        _add_severity,
    ]

    if json_logs:
        renderer: Any = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=sys.stdout.isatty())

    structlog.configure(
        processors=shared_processors
        + [
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
        foreign_pre_chain=shared_processors,
    )

    # Replace existing handlers on root with the structlog-aware formatter
    for handler in [console_handler, file_handler]:
        handler.setFormatter(formatter)


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Return a bound structlog logger for the given module name."""
    return structlog.get_logger(name)
