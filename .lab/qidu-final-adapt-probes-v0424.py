from pathlib import Path

FILES = [
    '.lab/qidu-card-model-bench-v0418-core.mjs',
    '.lab/qidu-card-model-bench-v0421-encounter.mjs',
    '.lab/qidu-card-model-bench-v0418-preset-conflict.mjs',
    '.lab/qidu-card-model-bench-v0423-info-timeline.mjs',
    '.lab/qidu-card-model-bench-v0423-npc-knowledge.mjs',
    '.lab/qidu-card-model-bench-v0423-offscreen-source.mjs',
    '.lab/qidu-first-chimera-release-v0423.mjs',
]

TARGET = "./qidu-card-v0424-cg-candidate.mjs"

for name in FILES:
    p = Path(name)
    s = p.read_text(encoding='utf-8')
    s = s.replace("process.env.YOUZI_KEY||''", "process.env.MODEL_API_KEY||''")
    s = s.replace("process.env.YOUZI_KEY || ''", "process.env.MODEL_API_KEY||''")
    s = s.replace("const API_BASE='https://youzi.today/v1';", "const API_BASE=process.env.MODEL_API_BASE;")
    s = s.replace("const API='https://youzi.today/v1/chat/completions';", "const API=`${process.env.MODEL_API_BASE}/chat/completions`;")
    for source in [
        './qidu-card-v0423-author-secret-guard.mjs',
        './qidu-card-v0423-release-sanitized.mjs',
        './qidu-card-v0418-info-timeline.mjs',
        './qidu-card-v0421-encounter-focus.mjs',
        './qidu-card-v0423-release-candidate.mjs',
    ]:
        s = s.replace(
            f"import {{ loadQiduOneFileCard, entryMap }} from '{source}';",
            f"import {{ loadQiduReleaseCandidate as loadQiduOneFileCard, entryMap }} from '{TARGET}';",
        )
        s = s.replace(
            f"import {{ loadQiduReleaseCandidate as loadQiduOneFileCard, entryMap }} from '{source}';",
            f"import {{ loadQiduReleaseCandidate as loadQiduOneFileCard, entryMap }} from '{TARGET}';",
        )
    s = s.replace(
        "const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');",
        "const contentOf=d=>{const c=d?.choices?.[0]?.message?.content;if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');return String(c||'')};",
    )
    s = s.replace("process.env.GLM_MODEL", "process.env.RELEASE_MODEL")
    s = s.replace(
        "const pref=['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash',...ids.filter(x=>/(qwen|step)/i.test(x))];",
        "const pref=[process.env.RELEASE_MODEL,'deepseek/deepseek-v4.1-flash','[amd]DeepSeek-V4.1-Flash','zai/glm-5.3-flash',...ids.filter(x=>/(deepseek|qwen|step|glm)/i.test(x))];",
    )
    s = s.replace(
        "for(const m of ['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'])",
        "for(const m of [process.env.RELEASE_MODEL,'deepseek/deepseek-v4.1-flash','[amd]DeepSeek-V4.1-Flash','zai/glm-5.3-flash'].filter(Boolean))",
    )
    s = s.replace(
        '|不能说|如果|假如|要是|难道|是否|是不是|会不会)',
        '|不能说|不能乱说|不敢乱说|如果|假如|要是|难道|是否|是不是|会不会)',
    )
    s = s.replace(
        "!/(依然|仍然|可以|能够).{0,12}战斗|战斗能力/.test(v)",
        "!/(依然|仍然|仍能|还能|可以|能够).{0,12}战斗|战斗能力/.test(v)",
    )
    s = s.replace(
        "(?:没能回来|死亡|死去|死在|牺牲|丧生|遇难|没回来|没了)",
        "(?:没能活下来|没活下来|没能幸存|没能撑过|没能回来|死亡|死去|死在|牺牲|丧生|遇难|没回来|没了)",
    )
    p.write_text(s, encoding='utf-8')
