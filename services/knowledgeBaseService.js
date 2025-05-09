import fs from 'fs';
import path from 'path';
import { Helpers } from '../helpers/index.js';

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

  getKnowledgeForDesign(field, detail) {
    const fullData = this.loadKnowledgeBase(field);
    const kb = fullData[field];
    return kb[detail];
  }

  getKnowledge(nerEntities, cache) {
    let field = Helpers.entityHelper.identifyMainField(nerEntities); // "фотопанелі", "СЕС"

    // try to find field in cache
    if (!field) {
      for (const pastEntities of cache) {
        field = Helpers.entityHelper.identifyMainField(pastEntities);
        if (field) break;
      }

      if (!field) throw new Error(`Не визначено поля знань`);
    }
    console.log("[INFO] field ", field)

    const fullData = this.loadKnowledgeBase(field);
    const kb = fullData[field];

    const details = Helpers.entityHelper.identifyDetailFromEntities(nerEntities, kb); //"ефективність", "типи"
    console.log("[INFO] details ", details)

    if (details.length === 0) {
      return `${kb?.назва || field}: ${kb?.опис?.join(', ') || 'немає опису.'}`;
    }

    const result = this.findDetailRecursively(kb, details);
    if (!result) throw new Error(`Не знайдено інформації для: ${details}`);

    return Array.isArray(result) ? result.join('\n') : result;
  }

  loadKnowledgeBase(field) {
    const relativePath = this.paths[field.trim()];
    if (!relativePath) {
      throw new Error(`Помилка під час отримання знань (файл не знайдено): ${field}`);
    }

    const knowledgePath = path.resolve(relativePath);
    const raw = fs.readFileSync(knowledgePath, 'utf-8');
    const detailInfoJSON = JSON.parse(raw);
    return detailInfoJSON;
  }

  findDetailRecursively(obj, details, index = 0) {
    if (!Array.isArray(details) || details.length === 0 || typeof obj !== 'object' || obj === null) {
      return null;
    }

    const lowerDetails = details.map(d => d.trim().toLowerCase());

    for (const key of Object.keys(obj)) {
      const normalizedKey = key.trim().toLowerCase();

      if (lowerDetails.includes(normalizedKey)) {
        const value = obj[key];

        // Видаляємо знайдене значення з копії details
        const nextDetails = lowerDetails.filter(d => d !== normalizedKey);

        if (Array.isArray(value)) {
          return value;
        }

        if (typeof value === 'object' && value !== null) {
          if (value['опис'] && nextDetails.length === 0) {
            return value['опис'];
          }

          const result = this.findDetailRecursively(value, nextDetails);
          if (result !== null) return result;
        }

        return value; // рядок або інше значення
      }
    }

    // Якщо нічого не знайдено — пробуємо в кожному об’єкті глибше
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'object' && value !== null) {
        const result = this.findDetailRecursively(value, lowerDetails);
        if (result !== null) return result;
      }
    }

    return null;
  }
}