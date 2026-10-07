import fs from 'node:fs/promises';

const key = process.env.LAB_MODEL_KEY;
if (!key) throw new Error('Existing Youzi credential is missing');
const base = process.env.LAB_MODEL_BASE_URL.replace(/\/+$/, '');
let ids = [];
try {
    const response = await fetch(`${base}/models`, {
        headers: { Authorization: `Bearer ${key}`, Accept: 'application/json',
            'User-Agent': 'SillyTavern/1.18.0' },
        signal: AbortSignal.timeout(45000),
    });
    const raw = await response.text();
    if (response.ok) {
        const data = JSON.parse(raw);
        ids = (Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [])
            .map(item => typeof item === 'string' ? item : item.id || item.name).filter(Boolean);
        console.log(`Youzi current model catalog: ${ids.length} entries`);
        console.log(JSON.stringify({ alternatives: ids.filter(id => /step.*3[.-]5|deepseek.*v4/i.test(id)).slice(0, 25) }));
    } else {
        console.log(JSON.stringify({ catalogStatus: response.status,
            cloudflareChallenge: /just a moment|challenge-platform/i.test(raw) }));
    }
} catch (error) {
    console.log(`Model catalog unavailable: ${error.name}`);
}
// Use an exact advertised ID when available. Step is a previously configured
// alternative if the catalog itself is blocked; the native ST test must verify it.
const selected = ids.find(id => id.toLowerCase() === 'step-3.5-flash')
    || ids.find(id => /deepseek.*v4.*flash/i.test(id))
    || ids.find(id => /step.*3[.-]5.*flash/i.test(id))
    || ids.find(id => /deepseek.*v4.*pro/i.test(id))
    || 'step-3.5-flash';
if (!/^[^\r\n]+$/.test(selected)) throw new Error('Invalid advertised model ID');
await fs.appendFile(process.env.GITHUB_ENV, `LAB_MODEL_ID=${selected}\n`);
console.log(JSON.stringify({ selected, advertised: ids.includes(selected) }));
