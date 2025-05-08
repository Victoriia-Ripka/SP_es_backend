import fs from 'fs';
import path from 'path';

export class KBService {
  constructor() {
    this.paths = {
      "СЕС": 'knowledge_base/pv.json',
      "фотопанелі": 'knowledge_base/panels.json',
      "інвертор": 'knowledge_base/inverters.json',
      "АКБ": 'knowledge_base/charges.json',
      "інсоляція": 'knowledge_base/insolation.json'
    };
  }


  loadKnowledgeBase(field, detail = '') {
    const relativePath = this.paths[field.trim()];

    if (!relativePath) {
      throw new Error(`Knowledge base not found for field: ${field}`);
    } 

    const knowledgePath = path.resolve(relativePath);
    const raw = fs.readFileSync(knowledgePath, 'utf-8');
    const detailInfoJSON = JSON.parse(raw);

    const trimmedField = field.trim();
    const trimmedDetail = detail.trim();

    if (detail) {
      // Якщо є уточнення — беремо конкретну характеристику
      return detailInfoJSON[trimmedField][trimmedDetail];
    } else {
      // Якщо немає — беремо загальну інформацію
      const info = detailInfoJSON[trimmedField];
      return `${info['назва']} ${info['завдання']}`;
    }
  }

  getKnowledge(field, detail = '') {
    try {
      return this.loadKnowledgeBase(field, detail);
    } catch (err) {
      throw new Error(`Не вдалося завантажити базу знань для: ${field}`);
    }
  }

  getContextFromCache(pv_user_data) {
    return pv_user_data?.cache?.history?.at(-1) ?? null;
  }

  getLastField(pv_user_data) {
    const context = this.getContextFromCache(pv_user_data);
    return context?.field ?? null;
  }

}