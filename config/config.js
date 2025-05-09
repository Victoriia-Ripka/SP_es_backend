import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';

dotenv.config();

const OPENAI_API_KEY = process.env['OPENAI_API_KEY'];
const nerExamples = yaml.load(fs.readFileSync(path.resolve('./config/ner_examples.yml'), 'utf8'));

export { OPENAI_API_KEY, nerExamples };


// textcats:
  // {
  //   "text": "Дякую, до побачення!",
  //   "label": "прощання"
  // },
  // {
  //   "text": "Дякую, до побачення!",
  //   "label": "прощання"
  // },
  // {
  //   "text": "На все добре",
  //   "label": "прощання"
  // },
  // {
  //   "text": "Бувай",
  //   "label": "прощання"
  // },
  // {
  //   "text": "Прощавай.",
  //   "label": "прощання"
  // },
  // {
  //   "text": "Допобачення!",
  //   "label": "прощання"
  // },