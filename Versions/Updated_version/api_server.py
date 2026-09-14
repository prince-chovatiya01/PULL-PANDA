import os
import sys
from typing import Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Ensure current directory is in sys.path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from selector import IterativePromptSelector, process_pr_with_selector
from config import GITHUB_TOKEN, OWNER, REPO

app = FastAPI(
    title="Pull Panda AI Engine API",
    description="Bridge API exposing the Python AI PR Review engine, RAG, and Iterative Prompt Selector.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global selector instance
selector_instance = IterativePromptSelector(min_samples_for_training=3)
state_file_path = os.path.join(CURRENT_DIR, "selector_state.json")
selector_instance.load_state(state_file_path)

class ReviewRequest(BaseModel):
    owner: Optional[str] = None
    repo: Optional[str] = None
    pr_number: int
    token: Optional[str] = None
    post_to_github: bool = True

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "Pull Panda AI Review Engine",
        "is_trained": selector_instance.is_trained,
        "sample_count": len(selector_instance.feature_history)
    }

@app.get("/api/ai/intelligence")
def get_intelligence():
    """
    Returns real metrics from IterativePromptSelector state.
    """
    prompt_names = selector_instance.prompt_names
    prompt_history = selector_instance.prompt_history
    score_history = selector_instance.score_history

    stats_by_prompt: Dict[str, Dict[str, Any]] = {}
    for idx, name in enumerate(prompt_names):
        stats_by_prompt[name] = {
            "index": idx,
            "name": name,
            "times_selected": 0,
            "scores": [],
            "average_score": 0.0,
            "best_score": 0.0
        }

    for p_idx, score in zip(prompt_history, score_history):
        if 0 <= p_idx < len(prompt_names):
            p_name = prompt_names[p_idx]
            stats_by_prompt[p_name]["times_selected"] += 1
            stats_by_prompt[p_name]["scores"].append(score)

    for name, data in stats_by_prompt.items():
        if data["scores"]:
            data["average_score"] = round(sum(data["scores"]) / len(data["scores"]), 2)
            data["best_score"] = round(max(data["scores"]), 2)

    return {
        "is_trained": selector_instance.is_trained,
        "total_reviews": len(score_history),
        "prompt_names": prompt_names,
        "strategies": list(stats_by_prompt.values()),
        "score_history": score_history[-20:] if score_history else [],
        "min_samples_for_training": selector_instance.min_samples_for_training
    }

@app.post("/api/ai/review")
def review_pull_request(payload: ReviewRequest):
    """
    Trigger end-to-end AI review pipeline on a GitHub PR:
    - Fetches diff
    - Computes static analysis (Bandit, Flake8, Radon)
    - Retrieves Pinecone RAG context
    - Selects optimal prompt strategy via ML/Multi-armed bandit
    - Generates structured AI review
    - Evaluates 5-dimension review quality (Clarity, Usefulness, Depth, Actionability, Positivity)
    - Updates selector model
    - Posts review comment to GitHub PR
    """
    owner = payload.owner or OWNER
    repo = payload.repo or REPO
    token = payload.token or GITHUB_TOKEN or os.getenv("GITHUB_TOKEN")

    if not token:
        raise HTTPException(status_code=400, detail="GitHub Token is required for fetching and posting reviews.")

    try:
        # Run selector pipeline
        diff_text = fetch_diff_safe(owner, repo, payload.pr_number, token)
        features = selector_instance.extract_pr_features(diff_text)
        features_vector = selector_instance.features_to_vector(features)
        chosen_prompt = selector_instance.select_best_prompt(features_vector)

        review_text, static_output, elapsed, context = selector_instance.generate_review(diff_text, chosen_prompt)
        score, heur, meta_parsed = selector_instance.evaluate_review(diff_text, review_text, static_output, context)

        # Update and persist selector state
        selector_instance.update_model(features_vector, chosen_prompt, score)
        selector_instance.save_results(
            payload.pr_number, features, chosen_prompt, review_text, score, heur, meta_parsed, static_output, context
        )
        selector_instance.save_state(state_file_path)

        # Post to GitHub if enabled
        github_comment_id = None
        if payload.post_to_github:
            from core import post_review_comment
            github_body = (
                f"## 🐼 Pull Panda AI Review\n\n"
                f"**Strategy Selected:** `{chosen_prompt}` | **Quality Score:** **{score}/10** | **Time:** `{elapsed:.2f}s`\n\n"
                f"---\n\n"
                f"{review_text}\n\n"
                f"---\n"
                f"<details>\n"
                f"<summary>🔍 Technical Details & Static Analysis</summary>\n\n"
                f"**Static Analysis:**\n```\n{static_output.strip() or 'No issues detected'}\n```\n\n"
                f"**Meta-Evaluation (1-10):**\n"
                f"- Clarity: {meta_parsed.get('clarity', 'N/A')}\n"
                f"- Usefulness: {meta_parsed.get('usefulness', 'N/A')}\n"
                f"- Depth: {meta_parsed.get('depth', 'N/A')}\n"
                f"- Actionability: {meta_parsed.get('actionability', 'N/A')}\n"
                f"- Positivity: {meta_parsed.get('positivity', 'N/A')}\n"
                f"</details>"
            )
            comment_res = post_review_comment(owner, repo, payload.pr_number, github_body, token)
            github_comment_id = comment_res.get("id")

        return {
            "success": True,
            "pr_number": payload.pr_number,
            "owner": owner,
            "repo": repo,
            "chosen_prompt": chosen_prompt,
            "score": score,
            "review": review_text,
            "static_output": static_output,
            "meta_evaluation": meta_parsed,
            "heuristics": heur,
            "features": features,
            "elapsed_seconds": round(elapsed, 2),
            "github_comment_id": github_comment_id
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AI Review pipeline failed: {str(e)}")

def fetch_diff_safe(owner: str, repo: str, pr_number: int, token: str) -> str:
    from core import fetch_pr_diff
    return fetch_pr_diff(owner, repo, pr_number, token)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PYTHON_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port)
