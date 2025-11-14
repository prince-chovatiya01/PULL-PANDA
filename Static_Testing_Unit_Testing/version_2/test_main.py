# Note: This test module uses dynamic imports and extensive monkeypatching to avoid any real network,
# file system, or external-tool side effects. It targets functions in Versions/version_2/main.py.

import importlib.util
import sys
import types
from pathlib import Path
import subprocess
import json
import pytest

# Helper to import the target module with safe stubs for external packages used at import-time.
def import_main_module(tmp_path, monkeypatch):
    """
    Arrange: prepare fake external modules and environment, then import the target main.py module.
    Returns the imported module.
    """
    # Prepare fake external modules to prevent side effects on import
    # 1) dotenv.load_dotenv
    fake_dotenv = types.ModuleType("dotenv")
    fake_dotenv.load_dotenv = lambda *args, **kwargs: None
    sys.modules["dotenv"] = fake_dotenv

    # 2) langchain.prompts.ChatPromptTemplate and chaining support
    fake_langchain = types.ModuleType("langchain")
    fake_prompts = types.ModuleType("langchain.prompts")

    class DummyPrompt:
        def __or__(self, other):
            return DummyChain()

    class DummyChain:
        def __or__(self, other):
            return self
        def invoke(self, kwargs):
            return "DUMMY_REVIEW_TEXT"

    class DummyChatPromptTemplate:
        @staticmethod
        def from_messages(messages):
            return DummyPrompt()

    fake_prompts.ChatPromptTemplate = DummyChatPromptTemplate
    fake_schema = types.ModuleType("langchain.schema")
    fake_output_parser = types.ModuleType("langchain.schema.output_parser")

    class DummyStrOutputParser:
        def parse(self, text):
            return text

    fake_output_parser.StrOutputParser = DummyStrOutputParser

    # Insert into sys.modules
    sys.modules["langchain"] = fake_langchain
    sys.modules["langchain.prompts"] = fake_prompts
    sys.modules["langchain.schema"] = fake_schema
    sys.modules["langchain.schema.output_parser"] = fake_output_parser

    # 3) langchain_groq.ChatGroq - dummy that does not perform network
    fake_langchain_groq = types.ModuleType("langchain_groq")
    class DummyChatGroq:
        def __init__(self, *args, **kwargs):
            # accept parameters but do nothing
            pass
    fake_langchain_groq.ChatGroq = DummyChatGroq
    sys.modules["langchain_groq"] = fake_langchain_groq

    # 4) Ensure environment variables used during import exist to avoid ValueErrors
    monkeypatch.setenv("API_KEY", "DUMMY_GROQ_KEY")
    # GitHub related env vars can be missing; main.py handles that by printing a warning.
    # Now import the module using a path relative to this test file
    project_root = Path(__file__).resolve().parents[2]  # go up to repository root
    target_path = project_root / "Versions" / "version_2" / "main.py"
    spec = importlib.util.spec_from_file_location("target_main", str(target_path))
    module = importlib.util.module_from_spec(spec)
    # Insert into sys.modules so internal imports in the module that reference its name work
    sys.modules["target_main"] = module
    spec.loader.exec_module(module)
    return module


# ===== Tests for fetch_pr_diff() =====

def test_fetch_pr_diff_success_returns_diff(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)

    # Prepare fake responses for two requests.get calls
    class FakeResp1:
        status_code = 200
        def json(self):
            return {"diff_url": "https://example.com/diff/123"}
    class FakeResp2:
        status_code = 200
        text = "+++ b/path/to/file.py\n- old\n+ new\n"

    calls = {"count": 0}
    def fake_get(url, headers=None):
        # Act as first call (PR endpoint) then second call (diff_url)
        calls["count"] += 1
        if calls["count"] == 1:
            return FakeResp1()
        return FakeResp2()

    monkeypatch.setattr("requests.get", fake_get)

    # Act
    diff = module.fetch_pr_diff("owner", "repo", "1", "token")

    # Assert
    assert "+++ b/path/to/file.py" in diff
    assert calls["count"] == 2  # Ensure both requests were made


def test_fetch_pr_diff_non_200_raises_exception(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    class ErrResp:
        status_code = 500
        def json(self):
            return {"message": "server error"}
    monkeypatch.setattr("requests.get", lambda url, headers=None: ErrResp())

    # Act / Assert
    with pytest.raises(Exception) as exc:
        module.fetch_pr_diff("o", "r", "1", "t")
    assert "GitHub API Error" in str(exc.value)
    assert "server error" in str(exc.value)


# ===== Tests for get_changed_files_and_languages() =====

def test_get_changed_files_and_languages_detects_python_and_js_files(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    diff_text = (
        "+++ b/src/app/main.py\n"
        "+++ b/frontend/components/Button.jsx\n"
        "+++ b/README.md\n"
        "+++ b/Makefile\n"
    )

    # Act
    result = module.get_changed_files_and_languages(diff_text)

    # Assert
    assert "python" in result and result["python"] == ["src/app/main.py"]
    assert "javascript" in result and result["javascript"] == ["frontend/components/Button.jsx"]
    # Non-mapped extensions should not be present
    assert all(not k in {"markdown", "makefile"} for k in result.keys())


def test_get_changed_files_and_languages_handles_no_matches(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    diff_text = "no file markers here"

    # Act
    result = module.get_changed_files_and_languages(diff_text)

    # Assert
    assert result == {}


def test_get_changed_files_and_languages_is_case_insensitive_and_handles_duplicates(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    diff_text = (
        "+++ b/Path/To/Script.PY\n"
        "+++ b/another/Script.py\n"
        "+++ b/another/Script.py\n"
    )

    # Act
    result = module.get_changed_files_and_languages(diff_text)

    # Assert
    assert "python" in result
    # All paths preserved (duplicates preserved as per logic)
    assert result["python"].count("Path/To/Script.PY".lower() if False else "Path/To/Script.PY") >= 1
    assert len(result["python"]) == 3


# ===== Tests for run_static_analysis() =====

def test_run_static_analysis_no_recognizable_files_returns_message(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    diff_text = ""  # no files

    # Act
    output = module.run_static_analysis(diff_text)

    # Assert
    assert "No recognizable programming language files found" in output


def test_run_static_analysis_python_analyzers_behavior_and_exceptions(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    # Create a diff that includes a python file
    diff_text = "+++ b/src/app/worker.py\n"
    # We'll inspect the incoming command to vary behavior for each analyzer
    class FakeProc:
        def __init__(self, stdout="", stderr="", returncode=0):
            self.stdout = stdout
            self.stderr = stderr
            self.returncode = returncode

    def fake_run(cmd, capture_output, text, check, timeout):
        # cmd is a list; choose behavior based on first element (the analyzer executable)
        exe = cmd[0]
        if "pylint" in exe:
            return FakeProc(stdout="pylint: issue found\n", stderr="")
        if "flake8" in exe:
            return FakeProc(stdout="", stderr="")  # No output -> "No issues found."
        if "bandit" in exe:
            # Simulate tool not installed
            raise FileNotFoundError()
        if "mypy" in exe:
            # Simulate timeout expired
            raise subprocess.TimeoutExpired(cmd=cmd, timeout=120)
        # Default fallback
        return FakeProc(stdout="ok", stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    # Act
    output = module.run_static_analysis(diff_text)

    # Assert
    # Should contain header for python (case/emoji/formatting tolerant)
    assert "TARGETED STATIC ANALYSIS FOR PYTHON" in output.upper()
    # Pylint output present
    assert "pylint: issue found" in output
    # Flake8 "No issues found." message present
    assert "Flake8" in output
    assert "No issues found." in output
    # Bandit catches FileNotFoundError and reports command not found
    assert "Command not found" in output
    # Mypy timeout case reported
    assert "timed out" in output or "Execution timed out" in output


def test_run_static_analysis_unknown_language_reports_no_analyzer(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    # kt mapped to "kotlin" and ANALYZERS has no "kotlin"
    diff_text = "+++ b/src/app/Main.kt\n"

    # Act
    output = module.run_static_analysis(diff_text)

    # Assert
    assert "No analyzer configured for kotlin" in output


# ===== Tests for post_review_comment() =====

def test_post_review_comment_success_posts_and_returns_json(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)

    class FakeResponse:
        status_code = 201
        def json(self):
            return {"html_url": "https://github.com/owner/repo/pull/1#issuecomment-1"}

    def fake_post(url, headers=None, json=None):
        # Assert inside act: ensure payload shape
        assert "body" in json
        return FakeResponse()

    monkeypatch.setattr("requests.post", fake_post)

    # Act
    resp = module.post_review_comment("owner", "repo", "1", "token", "review body")

    # Assert
    assert resp["html_url"].startswith("https://github.com/")


def test_post_review_comment_failure_raises_exception(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    class BadResp:
        status_code = 400
        def json(self):
            return {"message": "bad request"}
    monkeypatch.setattr("requests.post", lambda url, headers=None, json=None: BadResp())

    # Act / Assert
    with pytest.raises(Exception) as excinfo:
        module.post_review_comment("o", "r", "1", "t", "b")
    assert "Failed to post comment" in str(excinfo.value)
    assert "bad request" in str(excinfo.value)


# ===== Tests for safe_truncate() =====

def test_safe_truncate_returns_same_if_shorter_or_equal(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    s = "short text"

    # Act & Assert
    assert module.safe_truncate(s, max_len=len(s)) == s
    assert module.safe_truncate(s, max_len=len(s) + 10) == s


def test_safe_truncate_truncates_at_last_newline_when_possible(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    long_text = "line1\nline2\nline3\n" + ("x" * 500)
    # Choose max_len that cuts into the middle of the trailing x's so last_newline exists
    max_len = len("line1\nline2\nline3\n") + 10

    # Act
    truncated = module.safe_truncate(long_text, max_len=max_len)

    # Assert
    assert "... (Output truncated)" in truncated
    # truncated must end right after the last included newline (i.e., not break a line)
    assert truncated.endswith("\n\n... (Output truncated)") or truncated.endswith(" ... (Output truncated)")


def test_safe_truncate_appends_marker_when_no_newline_in_truncated_region(monkeypatch, tmp_path):
    # Arrange
    module = import_main_module(tmp_path, monkeypatch)
    long_text = "A" * 5000  # no newline
    max_len = 50

    # Act
    truncated = module.safe_truncate(long_text, max_len=max_len)

    # Assert
    assert truncated.endswith(" ... (Output truncated)")
    assert len(truncated) <= max_len + len(" ... (Output truncated)") + 1


# End of tests