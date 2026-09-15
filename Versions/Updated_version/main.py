# main.py
# Standalone and GitHub Actions CLI runner:
# Automatically processes a Pull Request diff, runs prompt selector, and posts AI review.

import sys
import os
from selector_runner import run_selector
from config import PR_NUMBER, GITHUB_TOKEN, OWNER, REPO

if __name__ == "__main__":
    token = GITHUB_TOKEN or os.getenv("GITHUB_TOKEN")
    owner = OWNER or os.getenv("OWNER")
    repo = REPO or os.getenv("REPO")

    if not token:
        print("❌ Error: GITHUB_TOKEN is required for standalone / GitHub Actions execution.")
        sys.exit(1)

    if not owner or not repo:
        print("❌ Error: OWNER and REPO environment variables are required.")
        sys.exit(1)

    try:
        pr_num = int(PR_NUMBER or os.getenv("PR_NUMBER", "0"))
    except (TypeError, ValueError):
        pr_num = 0

    if pr_num <= 0:
        print("❌ Error: PR_NUMBER is missing or invalid in environment.")
        sys.exit(1)

    print(f"🐼 Pull Panda CLI: Processing {owner}/{repo} PR #{pr_num} using iterative selector...")
    run_selector([pr_num], post_to_github=True)
    print("✔ Done! Review generated, posted to GitHub, and selector state updated.")
