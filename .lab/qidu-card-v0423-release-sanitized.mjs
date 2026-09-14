import crypto from 'node:crypto';
import { loadQiduOneFileCard as loadV0423Card, entryMap } from './qidu-card-v0423-author-secret-guard.mjs';

export const ONEFILE_VERSION = '0.4.23';
export const RELEASE_CREATOR = '叶罹';
export const RELEASE_CREATOR_NOTES = '《永远的7日之都》七日轮回文本互动角色卡。';
export const RELEASE_BOOK_DESCRIPTION = '《永远的7日之都》七日轮回文本互动世界书。';

const FORBIDDEN_RELEASE_PROVENANCE = [
  ['old-author-name', /玲/u],
  ['repo-account', /h675786161(?:-prog)?/i],
  ['github-host', /(?:github\.com|raw\.githubusercontent\.com|api\.github\.com)/i],
  ['private-email-domain', /h675786161\s*@\s*gmail\.com/i],
  ['experiment-tavern-name', /实验酒馆|玲七|玲和七|world-backstage/i],
  ['lab-build-marker', /(?:\bLAB\b|[-_]lab\b|\blab[-_])/i],
  ['branch-marker', /feature\/qidu-card/i],
];

const PRIVATE_METADATA_KEYS = [
  'repo','repository','repository_url','repositoryUrl','git','git_url','gitUrl','branch','commit',
  'source_url','sourceUrl','homepage','homepage_url','homepageUrl','author_url','authorUrl','creator_url','creatorUrl'
];

function deletePrivateMetadataKeys(obj){
  if(!obj || typeof obj!=='object' || Array.isArray(obj)) return;
  for(const key of PRIVATE_METADATA_KEYS) delete obj[key];
}

function sanitizeReleaseMetadata(card){
  card.data = card.data || {};
  card.data.character_version = ONEFILE_VERSION;
  card.data.creator = RELEASE_CREATOR;
  card.data.creator_notes = RELEASE_CREATOR_NOTES;
  card.creatorcomment = `${RELEASE_CREATOR_NOTES}作者：${RELEASE_CREATOR}。`;
  if(Object.prototype.hasOwnProperty.call(card,'creator')) card.creator = RELEASE_CREATOR;

  // Creation timestamps and development provenance are not needed by the distributable card.
  delete card.create_date;
  delete card.data.create_date;
  deletePrivateMetadataKeys(card);
  deletePrivateMetadataKeys(card.data);

  const ext = card.data.extensions || (card.data.extensions={});
  deletePrivateMetadataKeys(ext);
  if(Object.prototype.hasOwnProperty.call(ext,'creator')) ext.creator = RELEASE_CREATOR;
  if(Object.prototype.hasOwnProperty.call(ext,'version') && /lab/i.test(String(ext.version||''))) ext.version = ONEFILE_VERSION;

  const book = card.data.character_book;
  if(book){
    book.description = RELEASE_BOOK_DESCRIPTION;
    deletePrivateMetadataKeys(book);
    book.extensions = book.extensions || {};
    deletePrivateMetadataKeys(book.extensions);
    book.extensions.creator = RELEASE_CREATOR;
    book.extensions.version = ONEFILE_VERSION;
    book.extensions.project = '永远的7日之都｜七日轮回文本互动';
  }
}

function collectPrivacyHits(value,path='$',hits=[]){
  if(typeof value==='string'){
    for(const [id,re] of FORBIDDEN_RELEASE_PROVENANCE){
      const m=value.match(re);
      if(m){
        const idx=m.index||0;
        hits.push({id,path,excerpt:value.slice(Math.max(0,idx-60),idx+120)});
      }
    }
    return hits;
  }
  if(Array.isArray(value)){
    value.forEach((v,i)=>collectPrivacyHits(v,`${path}[${i}]`,hits));
    return hits;
  }
  if(value && typeof value==='object'){
    for(const [k,v] of Object.entries(value)){
      for(const [id,re] of FORBIDDEN_RELEASE_PROVENANCE){
        if(re.test(String(k))) hits.push({id:`key:${id}`,path:`${path}.${k}`,excerpt:String(k)});
        re.lastIndex=0;
      }
      collectPrivacyHits(v,`${path}.${k}`,hits);
    }
  }
  return hits;
}

export function assertReleasePrivacy(card){
  const hits=collectPrivacyHits(card);
  if(hits.length){
    const detail=hits.slice(0,12).map(x=>`${x.id}@${x.path}:${JSON.stringify(x.excerpt)}`).join('\n');
    throw new Error(`release privacy gate failed (${hits.length} hit(s)):\n${detail}`);
  }
  if(card.data?.creator!==RELEASE_CREATOR) throw new Error(`release creator mismatch: ${card.data?.creator}`);
  if(card.data?.creator_notes!==RELEASE_CREATOR_NOTES) throw new Error('release creator notes mismatch');
  if(card.data?.character_book?.extensions?.creator!==RELEASE_CREATOR) throw new Error('release worldbook creator mismatch');
  return true;
}

export async function loadQiduReleaseCard(workspace=process.env.GITHUB_WORKSPACE||process.cwd(), options={}){
  const {card}=await loadV0423Card(workspace,{skipHashCheck:true});
  sanitizeReleaseMetadata(card);
  assertReleasePrivacy(card);
  const raw=Buffer.from(JSON.stringify(card),'utf8');
  const compactSha256=crypto.createHash('sha256').update(raw).digest('hex');
  return {card,raw,compactSha256};
}

export const loadQiduOneFileCard = loadQiduReleaseCard;
export { entryMap };
