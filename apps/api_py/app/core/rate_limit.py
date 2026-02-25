from collections import defaultdict, deque
from threading import Lock
from time import time

from app.core.config import get_settings


_WINDOWS: dict[str, deque[float]] = defaultdict(deque)
_LOCK = Lock()


def check_rate_limit(key: str, *, limit: int, window_seconds: int) -> bool:
    settings = get_settings()
    if settings.APP_ENV.strip().lower() == "test":
        return True

    now = time()
    threshold = now - window_seconds

    with _LOCK:
        queue = _WINDOWS[key]
        while queue and queue[0] < threshold:
            queue.popleft()

        if len(queue) >= limit:
            return False

        queue.append(now)
        return True
