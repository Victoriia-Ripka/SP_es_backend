import fs from 'fs';
import path from 'path';

const paths = {
  "СЕС": 'knowledge_base/ses.json',
  "контролер заряду": 'knowledge_base/controllers.json',
  "фотобатарея": 'knowledge_base/batteries.json'
};


export function loadKnowledgeBase(entity) {
  if (!entity){
    return
  }
  
  const relativePath = paths[entity];

  if (!relativePath) {
    throw new Error(`Knowledge base not found for entity: ${entity}`);
  }

  const knowledgePath = path.resolve(relativePath);
  const raw = fs.readFileSync(knowledgePath, 'utf-8');
  return JSON.parse(raw);
}