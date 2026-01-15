"""
Structured logging configuration for the Ambient Music backend.

Provides JSON-formatted logging with configurable log levels via LOG_LEVEL env var.
"""

import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any


class JsonFormatter(logging.Formatter):
    """Custom formatter that outputs JSON-formatted log records."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "event": record.getMessage(),
        }

        # Add extra fields if present
        if hasattr(record, "extra_data") and record.extra_data:
            log_data.update(record.extra_data)

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_data)


def get_log_level() -> int:
    """Get log level from environment variable."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    level_map = {
        "DEBUG": logging.DEBUG,
        "INFO": logging.INFO,
        "WARNING": logging.WARNING,
        "WARN": logging.WARNING,
        "ERROR": logging.ERROR,
        "CRITICAL": logging.CRITICAL,
    }
    return level_map.get(level_name, logging.INFO)


def setup_logger(name: str = "ambient_music") -> logging.Logger:
    """
    Set up and return a configured logger instance.

    Args:
        name: Logger name (default: "ambient_music")

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)

    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger

    logger.setLevel(get_log_level())

    # Console handler with JSON formatting
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    logger.addHandler(handler)

    # Prevent propagation to root logger
    logger.propagate = False

    return logger


# Create a default logger instance
logger = setup_logger()


def log_event(event: str, level: str = "info", **kwargs: Any) -> None:
    """
    Log a structured event with arbitrary key-value data.

    Args:
        event: Event name/description
        level: Log level (debug, info, warning, error)
        **kwargs: Additional key-value pairs to include in the log
    """
    log_func = getattr(logger, level.lower(), logger.info)

    # Create a LogRecord with extra data
    extra = {"extra_data": kwargs} if kwargs else {}
    log_func(event, extra=extra)


def log_debug(event: str, **kwargs: Any) -> None:
    """Log a debug-level event."""
    log_event(event, level="debug", **kwargs)


def log_info(event: str, **kwargs: Any) -> None:
    """Log an info-level event."""
    log_event(event, level="info", **kwargs)


def log_warning(event: str, **kwargs: Any) -> None:
    """Log a warning-level event."""
    log_event(event, level="warning", **kwargs)


def log_error(event: str, **kwargs: Any) -> None:
    """Log an error-level event."""
    log_event(event, level="error", **kwargs)
