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

for name in FILES:
    p = Path(name)
    s = p.read_text(encoding='utf-8')
    s = s.replace("process.env.YOUZI_KEY||''", "process.env.MODEL_API_KEY||''")
    s = s.replace("process.env.YOUZI_KEY || ''", "process.env.MODEL_API_KEY||''")
    s = s.replace("const API_BASE='https://youzi.today/v1';", "const API_BASE=process.env.MODEL_API_BASE;")
    s = s.replace("const API='https://youzi.today/v1/chat/completions';", "const API=`${process.env.MODEL_API_BASE}/chat/completions`;")
    s = s.replace(
        "import { loadQiduOneFileCard, entryMap } from './qidu-card-v0423-author-secret-guard.mjs';",
        "import { loadQiduReleaseCandidate as loadQiduOneFileCard, entryMap } from './qidu-card-v0423-release-candidate.mjs';",
    )
    s = s.replace(
        "import { loadQiduOneFileCard, entryMap } from './qidu-card-v0423-release-sanitized.mjs';",
        "import { loadQiduReleaseCandidate as loadQiduOneFileCard, entryMap } from './qidu-card-v0423-release-candidate.mjs';",
    )
    s = s.replace(
        "import { loadQiduOneFileCard, entryMap } from './qidu-card-v0418-info-timeline.mjs';",
        "import { loadQiduReleaseCandidate as loadQiduOneFileCard, entryMap } from './qidu-card-v0423-release-candidate.mjs';",
    )
    s = s.replace(
        "import { loadQiduOneFileCard, entryMap } from './qidu-card-v0421-encounter-focus.mjs';",
        "import { loadQiduReleaseCandidate as loadQiduOneFileCard, entryMap } from './qidu-card-v0423-release-candidate.mjs';",
    )
    s = s.replace(
        "const contentOf=d=>String(d?.choices?.[0]?.message?.content||'');",
        "const contentOf=d=>{const c=d?.choices?.[0]?.message?.content;if(Array.isArray(c))return c.map(x=>typeof x==='string'?x:(x?.text||x?.content||'')).join('');return String(c||'')};",
    )
    s = s.replace("process.env.GLM_MODEL", "process.env.RELEASE_MODEL")
    s = s.replace(
        "const pref=['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash',...ids.filter(x=>/(qwen|step)/i.test(x))];",
        "const pref=[process.env.RELEASE_MODEL,'[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash',...ids.filter(x=>/(deepseek|qwen|step|glm)/i.test(x))];",
    )
    s = s.replace(
        "for(const m of ['[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'])",
        "for(const m of [process.env.RELEASE_MODEL,'[B]qwen3.8-flash','qwen3.8-flash','step-3.5-flash'].filter(Boolean))",
    )
    # “不能乱说”是明确拒绝该断言，不应被‘必然论’检测器误判为模型采纳了该断言。
    s = s.replace(
        '|不能说|如果|假如|要是|难道|是否|是不是|会不会)',
        '|不能说|不能乱说|不敢乱说|如果|假如|要是|难道|是否|是不是|会不会)',
    )
    p.write_text(s, encoding='utf-8')
