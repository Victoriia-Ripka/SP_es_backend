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

    // console.log(cache)
    if (!field) {
      // get field from cache

      if (!field) throw new Error(`Не визначено поля знань`);
    }
    console.log("[INFO] field ", field)

    const fullData = this.loadKnowledgeBase(field);
    const kb = fullData[field];

    const details = Helpers.entityHelper.identifyDetailFromEntities(nerEntities, kb); //"ефективність", "типи"
    console.log("[INFO] details ", details)

    if (!details) {
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

  // тільки одний можливий "нюанс"
  // findDetailRecursively(obj, detail) {
  //   if (typeof obj !== 'object' || obj === null) return null;

  //   for (const key in obj) {
  //     // console.log("[INFO]", key, detail, key.trim().toLowerCase() === detail.trim().toLowerCase())
  //     if (key.trim().toLowerCase() === detail.trim().toLowerCase()) {
  //       const value = obj[key];

  //       console.log(value)

  //       // Якщо знайдений ключ містить опис — повертаємо опис
  //       if (typeof value === 'object' && value['опис']) {
  //         return value['опис'];
  //       }

  //       // Якщо це просто текст/масив — повертаємо значення
  //       if (typeof value === 'string' || Array.isArray(value)) {
  //         return value;
  //       }
  //     }

  //     // Рекурсивно проходимо вкладені об'єкти
  //     const nested = this.findDetailRecursively(obj[key], detail);
  //     if (nested !== null) return nested;
  //   }

  //   return null;
  // }

  findDetailRecursively(obj, details) {
    if (!Array.isArray(details) || details.length === 0 || typeof obj !== 'object' || obj === null) {
      return null;
    }

    let current = obj;

    for (const detail of details) {
      let found = false;

      for (const key of Object.keys(current)) {
        if (key.trim().toLowerCase() === detail.trim().toLowerCase()) {
          current = current[key];
          found = true;
          break;
        }
      }

      if (!found) {
        // Try going deeper into nested objects even if key doesn't match at this level
        for (const key of Object.keys(current)) {
          if (typeof current[key] === 'object') {
            const result = this.findDetailRecursively(current[key], [detail, ...details.slice(details.indexOf(detail) + 1)]);
            if (result !== null) return result;
          }
        }
        return null;
      }
    }

    // Return the found value or its 'опис' if it exists
    if (typeof current === 'object' && current['опис']) {
      return current['опис'];
    }

    return current;
  }

}