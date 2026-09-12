import { loadV0414R3Card } from './qidu-card-v0414-r3.mjs';

const { card, compactSha256 } = await loadV0414R3Card(process.env.GITHUB_WORKSPACE || process.cwd(), { skipHashCheck:true });
console.log(JSON.stringify({
  version: card.data.character_version,
  worldbookEntries: card.data.character_book?.entries?.length || 0,
  choiceBridgeVersion: card.data.extensions?.qidu_choice_bridge?.version || null,
  compactSha256,
}, null, 2));
