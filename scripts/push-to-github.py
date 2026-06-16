#!/usr/bin/env python3
"""Push TabCraft repo to GitHub using API (bypasses git TLS issues)."""
import base64
import json
import os
import urllib.request

TOKEN_FILE = os.path.expanduser("~/.openclaw/.git_token")
REPO = "alloevil/tabcraft"

def api(method, path, data=None):
    with open(TOKEN_FILE) as f:
        token = f.read().strip()
    url = f"https://api.github.com{path}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    if body:
        req.add_header("Content-Type", "application/json")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"Error {method} {path}: {e.code}")
        print(err[:300])
        raise

def get_repo_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def collect_files(root):
    """Collect all files to upload."""
    files = []
    skip_dirs = {'.git', 'node_modules', '.plasmo', '__pycache__'}
    for dirpath, dirs, filenames in os.walk(root):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for fname in filenames:
            fp = os.path.join(dirpath, fname)
            rel = os.path.relpath(fp, root)
            with open(fp, 'rb') as f:
                content = f.read()
            files.append((rel, content))
    return files

def main():
    root = get_repo_root()
    files = collect_files(root)
    total = len(files)
    print(f"Uploading {total} files to {REPO}...\n")

    # Step 1: Use Contents API for the first file to initialize the repo
    first_path, first_content = files[0]
    print(f"[1/{total}] {first_path} (init)")
    encoded = base64.b64encode(first_content).decode()
    api("PUT", f"/repos/{REPO}/contents/{first_path}", {
        "message": "feat: initial release — TabCraft v0.1.0",
        "content": encoded
    })

    # Step 2: Get the commit SHA from the first file
    ref_data = api("GET", f"/repos/{REPO}/git/refs/heads/main")
    commit_sha = ref_data["object"]["sha"]
    # Get the tree SHA from the commit
    commit_data = api("GET", f"/repos/{REPO}/git/commits/{commit_sha}")
    tree_sha = commit_data["tree"]["sha"]

    # Step 3: Upload remaining files as blobs
    remaining = files[1:]
    items = []
    for i, (path, content) in enumerate(remaining):
        print(f"[{i+2}/{total}] {path}")
        encoded = base64.b64encode(content).decode()
        blob = api("POST", f"/repos/{REPO}/git/blobs", {
            "content": encoded,
            "encoding": "base64"
        })
        mode = "100755" if path.endswith('.py') else "100644"
        items.append({"path": path, "mode": mode, "type": "blob", "sha": blob["sha"]})

    # Step 4: Create tree with all files
    print("\nCreating tree...")
    new_tree = api("POST", f"/repos/{REPO}/git/trees", {
        "base_tree": tree_sha,
        "tree": items
    })
    new_tree_sha = new_tree["sha"]

    # Step 5: Create commit
    print("Creating commit...")
    new_commit = api("POST", f"/repos/{REPO}/git/commits", {
        "message": "feat: complete project scaffold — TabCraft v0.1.0\n\n- Chrome MV3 extension with Plasmo + TypeScript + React\n- AI classification engine (Gemini Nano + rule-based fallback)\n- Tab manager with smart grouping, dedup, hibernation\n- Side Panel UI with glassmorphism design (5 views)\n- 90+ seed domain rules across 15 categories\n- Storage manager with export/import\n- Session auto-save for crash recovery\n- Extension icons (16/48/128px)\n- MIT license, fully open-source",
        "tree": new_tree_sha,
        "parents": [commit_sha]
    })
    new_commit_sha = new_commit["sha"]

    # Step 6: Update ref to point to new commit
    print("Updating ref...")
    api("PATCH", f"/repos/{REPO}/git/refs/heads/main", {"sha": new_commit_sha})

    print(f"\n✅ Done! https://github.com/{REPO}")
    print(f"   Commit: {new_commit_sha[:12]}")
    print(f"   Files: {total}")

if __name__ == "__main__":
    main()
