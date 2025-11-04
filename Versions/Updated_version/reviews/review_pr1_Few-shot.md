# Review (prompt=Few-shot)

- Bug: `fahrenheit_to_celsius` function lacks input validation and type hints.
- Suggestion: Add type hints for function parameters and return types, and include input validation similar to `celsius_to_fahrenheit`. As per our coding standards, ensure all functions have type hints.

- Code style: Inconsistent function documentation. `celsius_to_fahrenheit` has a docstring, but `fahrenheit_to_celsius` does not.
- Suggestion: Add a docstring to `fahrenheit_to_celsius` explaining its parameters, return value, and any raised exceptions, as per our coding standards for public functions.

- Code quality: The `celsius_to_fahrenheit` function now rounds the result to 2 decimal places, but this behavior is not documented.
- Suggestion: Update the docstring for `celsius_to_fahrenheit` to mention the rounding behavior.

- Static analysis: Pylint, Flake8, and Mypy report issues related to file paths, which may indicate a configuration problem.
- Suggestion: Verify that the linter configurations are correct and that the files are properly included in the project structure. Ensure that the tools are installed and accessible in the PATH.

- Test coverage: No new unit tests are included for the updated `celsius_to_fahrenheit` function or the existing `fahrenheit_to_celsius` function.
- Suggestion: Add unit tests to cover both functions, including validation and conversion scenarios, as per our standards for new logic.

---
## Static Analysis Output:
=== 🔍 Targeted Static Analysis for PYTHON (1 files changed) ===

| 🧩 Pylint:
```
************* Module Weatherly/utils/temp_converter.py
Weatherly/utils/temp_converter.py:1:0: F0001: No module named Weatherly/utils/temp_converter.py (fatal)
```

| 🎯 Flake8:
```
Weatherly/utils/temp_converter.py:0:1: E902 FileNotFoundError: [Errno 2] No such file or directory: 'Weatherly/utils/temp_converter.py'
```

| 🔒 Bandit: ❌ Command not found. Is the tool installed locally and in PATH?

| 🧠 Mypy:
```
mypy: can't read file 'Weatherly\utils\temp_converter.py': No such file or directory
```

---
## Retrieved Context:
# Our Engineering Coding Standards

## Python
- All functions must have type hints.
- Use `black` for formatting.
- All public functions must have a docstring explaining args, returns, and raises.
- Avoid global variables. Pass state explicitly.

## General
- PRs should be small and focused.
- Always include unit tests for new logic.
- Do not commit secrets. Use .env files.
