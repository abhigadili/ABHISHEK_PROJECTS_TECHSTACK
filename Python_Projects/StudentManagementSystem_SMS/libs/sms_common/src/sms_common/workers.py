"""Background task lifecycle for FastAPI lifespans (task management)."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

log = logging.getLogger(__name__)


class BackgroundWorkers:
    """Starts long-running coroutines and stops them cleanly on shutdown.

    Each worker receives the shared ``stop`` event; ``stop_all`` sets it, waits
    briefly for a graceful exit, then cancels stragglers.
    """

    def __init__(self) -> None:
        self.stop = asyncio.Event()
        self._tasks: dict[str, asyncio.Task[None]] = {}

    def start(self, name: str, factory: Callable[[asyncio.Event], Awaitable[None]]) -> None:
        task = asyncio.create_task(factory(self.stop), name=name)
        task.add_done_callback(self._on_done)
        self._tasks[name] = task

    def _on_done(self, task: asyncio.Task[None]) -> None:
        if task.cancelled():
            return
        if exc := task.exception():
            log.error("background task %s died: %r", task.get_name(), exc)

    def status(self) -> dict[str, str]:
        return {n: ("running" if not t.done() else "stopped") for n, t in self._tasks.items()}

    async def stop_all(self, timeout: float = 5.0) -> None:
        self.stop.set()
        if not self._tasks:
            return
        _, pending = await asyncio.wait(self._tasks.values(), timeout=timeout)
        for task in pending:
            task.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)
        self._tasks.clear()
