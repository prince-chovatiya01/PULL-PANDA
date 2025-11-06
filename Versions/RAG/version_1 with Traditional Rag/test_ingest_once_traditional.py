"""
Pytest tests for ingest_once_traditional.py

Covers:
- Import-time checks for missing GITHUB_TOKEN (raises ValueError)
- CLI argument handling at import time (prints usage and exits)
- Normal flow: calls build_index_for_repo with correct args and prints start/success messages
- Error propagation: build_index_for_repo raising an exception is propagated and starting message printed
- Boundary: owner/repo with special characters still passed through

Notes:
- Tests mock external dependencies (dotenv.load_dotenv and rag_loader_traditional.build_index_for_repo)
- No real network or filesystem calls are performed.
- Module under test is imported by name (no absolute paths) and re-imported cleanly per test.
"""

import importlib
import sys
import types
import os
import pytest

# ===== Helpers =====
def _make_fake_dotenv_module():
    m = types.ModuleType("dotenv")
    def load_dotenv():
        # no-op for tests
        return None
    m.load_dotenv = load_dotenv
    return m

def _make_fake_rag_module(build_index_callable):
    m = types.ModuleType("rag_loader_traditional")
    m.build_index_for_repo = build_index_callable
    return m

def _import_ingest_module_fresh():
    # remove from sys.modules to ensure import-time code runs fresh
    sys.modules.pop("ingest_once_traditional", None)
    return importlib.import_module("ingest_once_traditional")


# ===== Tests for import-time GITHUB_TOKEN presence check =====
def test_import_raises_valueerror_when_github_token_missing(monkeypatch):
    print("TEST SUITE: import-time GITHUB_TOKEN presence check")
    print("TEST CASE: test_import_raises_valueerror_when_github_token_missing - Missing GITHUB_TOKEN raises ValueError")
    # Arrange
    # Ensure no GITHUB_TOKEN in environment
    monkeypatch.delenv("GITHUB_TOKEN", raising=False)
    # Provide a no-op dotenv.load_dotenv so import doesn't try to read real .env
    fake_dotenv = _make_fake_dotenv_module()
    monkeypatch.setitem(sys.modules, "dotenv", fake_dotenv)
    # Provide a dummy rag_loader_traditional module so import of that name succeeds
    dummy_rag = _make_fake_rag_module(lambda *a, **k: None)
    monkeypatch.setitem(sys.modules, "rag_loader_traditional", dummy_rag)
    # Ensure module not already imported
    sys.modules.pop("ingest_once_traditional", None)

    # Act / Assert
    with pytest.raises(ValueError) as exc:
        _import_ingest_module_fresh()

    # Assert message contains information about missing token
    assert "Missing GITHUB_TOKEN" in str(exc.value)


# ===== Tests for CLI arg handling at import time =====
def test_import_exits_with_usage_when_insufficient_args(monkeypatch, capsys):
    print("TEST SUITE: CLI arg handling at import time")
    print("TEST CASE: test_import_exits_with_usage_when_insufficient_args - Insufficient args cause SystemExit and usage print")
    # Arrange
    monkeypatch.setenv("GITHUB_TOKEN", "fake-token")
    # Fake dotenv and rag loader
    monkeypatch.setitem(sys.modules, "dotenv", _make_fake_dotenv_module())
    monkeypatch.setitem(sys.modules, "rag_loader_traditional", _make_fake_rag_module(lambda *a, **k: None))
    # Simulate running script with no owner/repo args
    monkeypatch.setattr(sys, "argv", ["ingest_once_traditional"])
    sys.modules.pop("ingest_once_traditional", None)

    # Act
    with pytest.raises(SystemExit) as se:
        _import_ingest_module_fresh()

    # Assert (AAA)
    # Assert exit code 1 and printed usage message
    assert se.value.code == 1
    captured = capsys.readouterr()
    assert "Usage:" in captured.out
    # The usage should include the script basename
    assert "ingest_once_traditional" in captured.out


# ===== Tests for normal invocation behavior =====
def test_import_calls_build_index_and_prints_success_on_valid_args(monkeypatch, capsys):
    print("TEST SUITE: normal invocation behavior")
    print("TEST CASE: test_import_calls_build_index_and_prints_success_on_valid_args - Valid args call build_index_for_repo and print success")
    # Arrange
    monkeypatch.setenv("GITHUB_TOKEN", "token-xyz")
    monkeypatch.setattr(sys, "argv", ["ingest_once_traditional", "owner123", "repo-abc"])
    monkeypatch.setitem(sys.modules, "dotenv", _make_fake_dotenv_module())

    calls = {}
    def fake_build_index(owner, repo, token, force_rebuild=False):
        # Record calls to assert later
        calls["called"] = True
        calls["owner"] = owner
        calls["repo"] = repo
        calls["token"] = token
        calls["force_rebuild"] = force_rebuild
        # return a sentinel object (not used)
        return "OK"

    monkeypatch.setitem(sys.modules, "rag_loader_traditional", _make_fake_rag_module(fake_build_index))
    sys.modules.pop("ingest_once_traditional", None)

    # Act
    mod = _import_ingest_module_fresh()  # import executes the script top-level code

    # Assert
    assert calls.get("called", False) is True
    assert calls["owner"] == "owner123"
    assert calls["repo"] == "repo-abc"
    assert calls["token"] == "token-xyz"
    assert calls["force_rebuild"] is True

    out = capsys.readouterr().out
    assert "Starting ingestion for repo: owner123/repo-abc" in out
    assert "Index built successfully for owner123/repo-abc" in out


# ===== Tests for build_index exceptions being propagated =====
def test_import_propagates_exception_from_build_index_and_prints_starting_message(monkeypatch, capsys):
    print("TEST SUITE: build_index exception propagation")
    print("TEST CASE: test_import_propagates_exception_from_build_index_and_prints_starting_message - build_index exception propagates and start message printed")
    # Arrange
    monkeypatch.setenv("GITHUB_TOKEN", "token-xyz")
    monkeypatch.setattr(sys, "argv", ["ingest_once_traditional", "ownerX", "repoY"])
    monkeypatch.setitem(sys.modules, "dotenv", _make_fake_dotenv_module())

    def raising_build_index(owner, repo, token, force_rebuild=False):
        # Print something on entry to emulate long-running start
        raise RuntimeError("indexing failed")

    monkeypatch.setitem(sys.modules, "rag_loader_traditional", _make_fake_rag_module(raising_build_index))
    sys.modules.pop("ingest_once_traditional", None)

    # Act / Assert
    with pytest.raises(RuntimeError) as exc:
        _import_ingest_module_fresh()

    # Assert that the raised exception message is the one from the fake build
    assert "indexing failed" in str(exc.value)
    # Starting message should have been printed before the exception
    captured = capsys.readouterr()
    assert "Starting ingestion for repo: ownerX/repoY" in captured.out
    # Because exception happened, success message should not be present
    assert "Index built successfully" not in captured.out


# ===== Tests for boundary/edge inputs passed through to build_index =====
def test_import_with_special_characters_in_owner_and_repo_passes_through(monkeypatch, capsys):
    print("TEST SUITE: boundary/edge inputs")
    print("TEST CASE: test_import_with_special_characters_in_owner_and_repo_passes_through - special characters preserved and passed to build_index")
    # Arrange
    special_owner = "user-name_é"
    special_repo = "repo name with spaces & symbols!*"
    monkeypatch.setenv("GITHUB_TOKEN", "tok-special")
    monkeypatch.setattr(sys, "argv", ["ingest_once_traditional", special_owner, special_repo])
    monkeypatch.setitem(sys.modules, "dotenv", _make_fake_dotenv_module())

    recorded = {}
    def record_build_index(o, r, t, force_rebuild=False):
        recorded["o"] = o
        recorded["r"] = r
        recorded["t"] = t
        recorded["fr"] = force_rebuild
        return None

    monkeypatch.setitem(sys.modules, "rag_loader_traditional", _make_fake_rag_module(record_build_index))
    sys.modules.pop("ingest_once_traditional", None)

    # Act
    _import_ingest_module_fresh()

    # Assert
    assert recorded["o"] == special_owner
    assert recorded["r"] == special_repo
    assert recorded["t"] == "tok-special"
    assert recorded["fr"] is True
    out = capsys.readouterr().out
    assert f"Starting ingestion for repo: {special_owner}/{special_repo}" in out
    assert "Index built successfully for" in out