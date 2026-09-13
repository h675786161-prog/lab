import crypto from 'node:crypto';
import { loadV0414R3Card, entryMap } from './qidu-card-v0414-r3.mjs';

export const ONEFILE_VERSION = '0.4.15-lab-onefile';
export const EXPECTED_ONEFILE_SHA256 = '';

export async function loadQiduOneFileCard(workspace = process.env.GITHUB_WORKSPACE || process.cwd(), options = {}) {
  const { card } = await loadV0414R3Card(workspace, { skipHashCheck: true });
  card.data.character_version = ONEFILE_VERSION;

  const ext = card.data.extensions || (card.data.extensions = {});
  delete ext.qidu_choice_bridge;
  ext.qidu_frontend = {
    mode: 'embedded-regex-only',
    external_extension_required: false,
    choice_behavior: 'tap option focuses #send_textarea; player still sends their own input',
    responsive: true,
  };

  const scripts = ext.regex_scripts || (ext.regex_scripts = []);
  const get = id => scripts.find(x => x?.id === id);
  const terminal = get('f7d-terminal-v040');
  const stateHide = get('f7d-state-hide-v040');
  const choices = get('f7d-choices-wrap-v0414');
  const choice = get('f7d-choice-button-v0414');
  if (!terminal || !stateHide || !choices || !choice) throw new Error('missing embedded frontend regex scripts');

  terminal.findRegex = '/<\\s*f7d_terminal\\s*>([\\s\\S]*?)<\\s*\\/\\s*f7d_terminal\\s*>/gi';
  terminal.replaceString = '<div data-f7d-terminal="1" style="box-sizing:border-box;width:100%;max-width:100%;overflow-wrap:anywhere;margin:.65em 0;padding:.78em .9em;border:1px solid rgba(145,190,255,.42);border-radius:12px;background:linear-gradient(135deg,rgba(12,22,38,.94),rgba(18,35,55,.90));box-shadow:0 7px 20px rgba(0,0,0,.18);color:#e8f2ff;font:500 13px/1.65 system-ui,-apple-system,\'Microsoft YaHei\',sans-serif;white-space:pre-wrap"><div style="font-size:11px;letter-spacing:.14em;color:#8ecbff;margin-bottom:.35em">CENTRAL COURT // TACTICAL TERMINAL</div>$1</div>';

  stateHide.findRegex = '/<\\s*f7d_state\\s*>[\\s\\S]*?<\\s*\\/\\s*f7d_state\\s*>/gi';
  stateHide.replaceString = '';

  choices.findRegex = '/<\\s*f7d_choices\\s*>([\\s\\S]*?)<\\s*\\/\\s*f7d_choices\\s*>/gi';
  choices.replaceString = '<div data-f7d-choice-grid="1" style="box-sizing:border-box;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:.55em;width:100%;max-width:100%;margin:.8em 0;padding:.7em;border:1px solid rgba(116,174,231,.28);border-radius:14px;background:linear-gradient(145deg,rgba(13,23,37,.78),rgba(24,39,56,.72));box-shadow:0 8px 24px rgba(0,0,0,.14);">$1</div>';

  choice.findRegex = '/<\\s*f7d_choice\\s*>([\\s\\S]*?)<\\s*\\/\\s*f7d_choice\\s*>/gi';
  choice.replaceString = '<label for="send_textarea" data-f7d-choice="1" tabindex="0" style="box-sizing:border-box;display:block;width:100%;min-height:44px;padding:.68em .86em;border:1px solid rgba(133,194,255,.52);border-radius:10px;background:linear-gradient(135deg,rgba(32,60,88,.88),rgba(24,45,67,.94));box-shadow:0 4px 12px rgba(0,0,0,.16);color:#eef7ff;font:600 13px/1.45 system-ui,-apple-system,\'Microsoft YaHei\',sans-serif;text-align:left;cursor:text;user-select:text;overflow-wrap:anywhere;">$1</label>';

  const raw = Buffer.from(JSON.stringify(card), 'utf8');
  const compactSha256 = crypto.createHash('sha256').update(raw).digest('hex');
  if (!options.skipHashCheck && EXPECTED_ONEFILE_SHA256 && compactSha256 !== EXPECTED_ONEFILE_SHA256) {
    throw new Error(`one-file hash mismatch: ${compactSha256}`);
  }
  return { card, raw, compactSha256 };
}

export { entryMap };
