import fs from 'fs';
import path from 'path';

const paths = {
  "CЕС": 'knowledge_base/ses.json',
  "контролер заряду": 'knowledge_base/controllers.json',
  "фотобатарея": 'knowledge_base/batteries.json'
};

export function loadKnowledgeBase(field, detail) {
  const relativePath = paths[field.trim()];

  if (!relativePath) {
    throw new Error(`Knowledge base not found for field: ${field}`);
  }

  const knowledgePath = path.resolve(relativePath);
  const raw = fs.readFileSync(knowledgePath, 'utf-8');
  const detailInfoJSON = JSON.parse(raw)
  const neededDetailInfo = detailInfoJSON[field.trim()][detail.trim()]
  return neededDetailInfo;
}