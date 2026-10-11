from __future__ import annotations

import pytest

from app.geo import gcj02_to_wgs84, haversine_km, wgs84_to_gcj02

# Tiananmen (WGS84) — the standard sample for the GCJ-02 offset.
BEIJING = (116.397428, 39.90923)


def test_offset_is_applied_inside_china():
    gcj_lng, gcj_lat = wgs84_to_gcj02(*BEIJING)
    assert gcj_lng != pytest.approx(BEIJING[0], abs=1e-9)
    assert gcj_lat != pytest.approx(BEIJING[1], abs=1e-9)
    # The offset is on the order of hundreds of metres (a few hundredths of a degree at most).
    assert abs(gcj_lng - BEIJING[0]) < 0.02
    assert abs(gcj_lat - BEIJING[1]) < 0.02


def test_round_trip_is_accurate():
    gcj = wgs84_to_gcj02(*BEIJING)
    back = gcj02_to_wgs84(*gcj)
    assert back[0] == pytest.approx(BEIJING[0], abs=1e-5)
    assert back[1] == pytest.approx(BEIJING[1], abs=1e-5)


def test_outside_china_is_unchanged():
    london = (-0.1276, 51.5072)
    assert wgs84_to_gcj02(*london) == london
    assert gcj02_to_wgs84(*london) == london


def test_haversine_distance():
    # Beijing -> Shanghai is roughly 1060 km.
    distance = haversine_km(39.90923, 116.397428, 31.2304, 121.4737)
    assert 1000 < distance < 1150


def test_haversine_zero_for_same_point():
    assert haversine_km(31.2, 121.4, 31.2, 121.4) == pytest.approx(0, abs=1e-9)