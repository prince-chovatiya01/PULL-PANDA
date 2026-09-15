# config.py

import os
from dotenv import load_dotenv

# Ensure .env is loaded from directory of config.py if present
_env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path)
else:
    load_dotenv()

# Optional repository context (used for CLI/GitHub Actions fallback)
OWNER = os.getenv("OWNER")
REPO = os.getenv("REPO")

try:
    PR_NUMBER = int(os.getenv("PR_NUMBER", "0"))
except (TypeError, ValueError):
    PR_NUMBER = 0

# GITHUB_TOKEN is optional at module load:
# - Web API reviews supply ephemeral per-user OAuth tokens in request payloads
# - CLI/GitHub Actions supply GITHUB_TOKEN in the environment
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")

# LLM and Vector DB credentials (Required for AI operations)
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

if not GROQ_API_KEY:
    raise SystemExit("❌ Missing required GROQ_API_KEY in environment.")

if not all([PINECONE_API_KEY, PINECONE_INDEX_NAME]):
    raise SystemExit("❌ Missing PINECONE_API_KEY or PINECONE_INDEX_NAME in environment.")
