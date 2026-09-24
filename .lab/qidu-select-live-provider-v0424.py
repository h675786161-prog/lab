import json
import os
import time
import urllib.error
import urllib.request

TIMEOUT = 25
PROBE_TOKENS = 128

providers = [
    {
        "name": "GG",
        "base": "https://gcli.ggchan.dev/v1",
        "key": os.environ.get("GG_KEY") or os.environ.get("MODEL_API_KEY", ""),
        "preferred": [
            "gemini-3-flash-preview",
            "gemini-3.1-pro-preview-nothinking",
            "gemini-2.5-flash-lite",
            "gemini-2.5-pro-nothinking",
            "gemini-2.5-pro",
        ],
    },
    {
        "name": "PIAOMIAO",
        "base": "https://claudeapi.cc.cd/v1",
        "key": os.environ.get("PIAOMIAO_KEY", ""),
        "preferred": [],
    },
    {
        "name": "YOUZI",
        "base": "https://youzi.today/v1",
        "key": os.environ.get("YOUZI_KEY", ""),
        "preferred": [
            "[B]glm-5.3-flash",
            "[B]qwen3.8-flash",
            "qwen3.8-flash",
            "step-3.5-flash",
            "[iao]MiniMaxAI/MiniMax-M2.7",
            "[ok]mimo-v2-5",
            "[ok]hy3",
            "[ov]moonshotai/kimi-k3",
            "[ma]gpt-6-astra",
            "[ma]gpt-5.6-sol",
        ],
    },
]

def request_json(url, key, payload=None):
    headers = {
        "Authorization": "Bearer " + key,
        "Accept": "application/json",
        "User-Agent": "Qidu-v0424-Release-Selector/1.0",
    }
    data = None
    method = "GET"
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        method = "POST"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        raw = resp.read(2_000_000).decode("utf-8", "replace")
        return resp.status, json.loads(raw)

def content_of(body):
    try:
        content = body.get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception:
        return ""
    if isinstance(content, list):
        chunks = []
        for item in content:
            if isinstance(item, dict):
                chunks.append(str(item.get("text") or item.get("content") or ""))
            else:
                chunks.append(str(item))
        content = "".join(chunks)
    return str(content or "")

def model_ids(base, key):
    status, body = request_json(base.rstrip("/") + "/models", key)
    seq = body.get("data") or body.get("models") or []
    ids = []
    for item in seq if isinstance(seq, list) else []:
        if isinstance(item, dict):
            mid = item.get("id") or item.get("name") or item.get("model")
        else:
            mid = str(item)
        if mid:
            ids.append(str(mid))
    return status, ids

def priority_models(provider, ids):
    chosen = []
    for model in provider["preferred"] + ids:
        if ids and model not in ids:
            continue
        low = model.lower()
        if provider["name"] != "GG":
            if not any(k in low for k in ("glm", "qwen", "gemini", "claude", "gpt", "grok", "deepseek", "step", "minimax", "mimo", "hy3", "kimi", "moonshot")):
                continue
            if any(k in low for k in ("vision", "image", "embedding", "search")):
                continue
        if model not in chosen:
            chosen.append(model)
    return chosen[:12]

rows = []
selected = None

for provider in providers:
    row = {"provider": provider["name"], "base": provider["base"], "models_status": None, "probes": []}
    key = provider["key"]
    if not key:
        row["models_status"] = "missing_secret"
        rows.append(row)
        continue

    try:
        status, ids = model_ids(provider["base"], key)
        row["models_status"] = status
        row["model_count"] = len(ids)
    except urllib.error.HTTPError as exc:
        row["models_status"] = exc.code
        row["models_error"] = exc.read(700).decode("utf-8", "replace")[:400]
        rows.append(row)
        continue
    except Exception as exc:
        row["models_status"] = "error"
        row["models_error"] = type(exc).__name__ + ": " + str(exc)[:300]
        rows.append(row)
        continue

    for model in priority_models(provider, ids):
        payload = {
            "model": model,
            "max_tokens": PROBE_TOKENS,
            "temperature": 0,
            "messages": [{"role": "user", "content": "只回答：测试通过"}],
        }
        probe = {"model": model}
        for attempt in range(2):
            try:
                status, body = request_json(provider["base"].rstrip("/") + "/chat/completions", key, payload)
                text = content_of(body)
                probe.update({"status": status, "usable": status == 200 and bool(text.strip()), "content_len": len(text)})
                if probe["usable"]:
                    selected = {"provider": provider["name"], "base": provider["base"], "key": key, "model": model}
                break
            except urllib.error.HTTPError as exc:
                body = exc.read(900).decode("utf-8", "replace")
                hard_quota = any(token in body.lower() for token in ("insufficient_quota", "quota_exceeded", "配额已用尽"))
                probe.update({"status": exc.code, "usable": False, "hard_quota": hard_quota, "error": body[:500]})
                if exc.code == 429 and not hard_quota and attempt == 0:
                    time.sleep(20)
                    continue
                break
            except Exception as exc:
                probe.update({"status": "error", "usable": False, "error": type(exc).__name__ + ": " + str(exc)[:300]})
                break
        row["probes"].append(probe)
        if selected:
            break
        time.sleep(2)

    rows.append(row)
    if selected:
        break
    time.sleep(5)

safe_rows = rows
print(json.dumps({
    "selector": "qidu-v0424",
    "selected": None if not selected else {
        "provider": selected["provider"],
        "base": selected["base"],
        "model": selected["model"],
    },
    "results": safe_rows,
}, ensure_ascii=False))

if not selected:
    raise SystemExit("no live completion provider/model available for narrative acceptance")

env_path = os.environ.get("GITHUB_ENV")
if not env_path:
    raise SystemExit("GITHUB_ENV missing")
with open(env_path, "a", encoding="utf-8") as handle:
    handle.write("MODEL_API_BASE=" + selected["base"] + "\n")
    handle.write("MODEL_API_KEY=" + selected["key"] + "\n")
    handle.write("RELEASE_MODEL=" + selected["model"] + "\n")
    handle.write("BEHAVIOR_PROVIDER_SELECTED=" + selected["provider"] + "\n")
    handle.write("BEHAVIOR_MODEL_SELECTED=" + selected["model"] + "\n")
