import crypto from 'node:crypto';
import { loadV0414Card as loadPreBridgeCard, entryMap } from './qidu-card-v0414-candidate.mjs';

export const EXPECTED_V0414_FINAL_SHA256 = 'da72a142765a9bdd370e1f77901bf5c77ecc236a12867667dd39cd0bb0b83592';

export async function loadV0414FinalCard(workspace = process.env.GITHUB_WORKSPACE || process.cwd()) {
  const { card } = await loadPreBridgeCard(workspace);
  const scripts = card.data.extensions?.regex_scripts || [];
  const button = scripts.find(x => x?.id === 'f7d-choice-button-v0414');
  if (!button) throw new Error('Missing f7d choice button regex');

  // SillyTavern's formatter intentionally strips inline event handlers.
  // Keep the card HTML declarative and let the tiny delegated bridge handle clicks.
  button.replaceString = String(button.replaceString).replace(/\s+onclick="[^"]*"/, '');

  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (compactSha256 !== EXPECTED_V0414_FINAL_SHA256) {
    throw new Error(`v0.4.14 final compact hash mismatch: ${compactSha256}`);
  }
  return { card, raw, compactSha256 };
}

export { entryMap };
