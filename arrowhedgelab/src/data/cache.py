"""Simple in-memory cache keyed by arbitrary string keys.

This repo's src/tools/api.py caches by a composite cache_key
(f"{ticker}_{start}_{end}_...") rather than by ticker, so the cache is a
plain key -> list[dict] store. Restores the missing src.data.cache module.
"""

from __future__ import annotations

from typing import Any


class Cache:
    def __init__(self) -> None:
        self._prices: dict[str, list[dict[str, Any]]] = {}
        self._financial_metrics: dict[str, list[dict[str, Any]]] = {}
        self._line_items: dict[str, list[dict[str, Any]]] = {}
        self._insider_trades: dict[str, list[dict[str, Any]]] = {}
        self._company_news: dict[str, list[dict[str, Any]]] = {}

    def get_prices(self, key: str) -> list[dict[str, Any]] | None:
        return self._prices.get(key)

    def set_prices(self, key: str, data: list[dict[str, Any]]) -> None:
        self._prices[key] = data

    def get_financial_metrics(self, key: str) -> list[dict[str, Any]] | None:
        return self._financial_metrics.get(key)

    def set_financial_metrics(self, key: str, data: list[dict[str, Any]]) -> None:
        self._financial_metrics[key] = data

    def get_line_items(self, key: str) -> list[dict[str, Any]] | None:
        return self._line_items.get(key)

    def set_line_items(self, key: str, data: list[dict[str, Any]]) -> None:
        self._line_items[key] = data

    def get_insider_trades(self, key: str) -> list[dict[str, Any]] | None:
        return self._insider_trades.get(key)

    def set_insider_trades(self, key: str, data: list[dict[str, Any]]) -> None:
        self._insider_trades[key] = data

    def get_company_news(self, key: str) -> list[dict[str, Any]] | None:
        return self._company_news.get(key)

    def set_company_news(self, key: str, data: list[dict[str, Any]]) -> None:
        self._company_news[key] = data


_cache = Cache()


def get_cache() -> Cache:
    return _cache
