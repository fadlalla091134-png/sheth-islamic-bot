'use strict';

const { GoogleGenAI, Type } = require('@google/genai');

const MODEL_NAME = 'gemini-2.5-flash';

const SHETH_SYSTEM_INSTRUCTION = `
أنت مساعد ذكي اسمك "شيث" (Sheth).
القواعد الأساسية لشخصيتك:
1. تتحدث دائماً باللهجة السودانية الطبيعية المحترمة والودودة (مثل: يا زول، أبشر، تمام التمام، حبابك، ما في مشكلة، ربنا يوفقك) بدون مبالغة أو تصنّع.
2. تكون إجاباتك قصيرة ومختصرة جداً (من جملة واحدة إلى 3 جمل قصيرة كحد أقصى).
3. لا تشرح بالتفصيل إلا إذا طلب المستخدم ذلك صراحةً بعبارات مثل: "وضح أكثر"، "اشرح بالتفصيل"، "أكثر"، "بالتفصيل"، أو "فصّل".
4. لا تستخدم مقدمات طويلة أو حشو غير ضروري، وادخل في صلب الإجابة مباشرة.
`.trim();

let aiClient = null;

function getAiClient() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });
  }
  return aiClient;
}

/**
 * Ask Sheth (شيث) in concise Sudanese Arabic dialect.
 */
async function askSheth(prompt) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: SHETH_SYSTEM_INSTRUCTION,
    },
  });
  return (response.text || '').trim();
}

/**
 * Translate text cleanly (Arabic <-> English or specified target language).
 */
async function translateText(text) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: text,
    config: {
      systemInstruction:
        'أنت مترجم محترف. إذا كان النص بالعربية ترجمه إلى الإنجليزية، وإذا كان بأي لغة أخرى ترجمه إلى العربية الفصحى السليمة. إذا حدد المستخدم لغة هدف فالتزم بها. أعد الترجمة فقط بدون أي مقدمات أو شرح.',
    },
  });
  return (response.text || '').trim();
}

/**
 * Summarize text concisely in Arabic.
 */
async function summarizeText(text) {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: text,
    config: {
      systemInstruction:
        'لخّص النص التالي باللغة العربية الفصحى في نقاط مختصرة جداً وواضحة (3 إلى 5 نقاط كحد أقصى) بدون أي مقدمات أو حشو.',
    },
  });
  return (response.text || '').trim();
}

/**
 * Generate concise Tafsir (2 short lines) and Asbab al-Nuzul (2 short lines)
 * in clean Arabic without filler text.
 */
async function getAyahTafsirAndAsbab(ayahText, surahName, ayahNumber) {
  const ai = getAiClient();
  const prompt = `الآية الكريمة: "${ayahText}" (سورة ${surahName}، الآية ${ayahNumber}).
اكتب بالضبط بهذا التنسيق دون أي مقدمات أو عبارات ترحيب أو حشو:
📖 *التفسير المختصر:*
(سطران قصيران واضحان ودقيقان فقط)

📜 *سبب النزول:*
(سطران قصيران فقط؛ وإن لم يرد سبب نزول خاص صحيح فاذكر ذلك بإيجاز في سطر واحد مع بيان السياق العام لنزولها).`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction:
        'أنت باحث متخصص في التفسير وعلوم القرآن. التزم بالدقة العلمية، العربية الفصحى النقية، والإيجاز الشديد بدون أي حشو أو مقدمات.',
    },
  });
  return (response.text || '').trim();
}

const QUIZ_CATEGORIES = [
  'القرآن الكريم وعلومه',
  'السيرة النبوية الشريفة',
  'قصص الأنبياء والمرسلين',
  'الصحابة والتابعين',
  'التاريخ الإسلامي والغزوات',
];

/**
 * Generates a fresh, accurate, non-repeating Arabic Islamic trivia question in strict JSON.
 *
 * @param {string[]} askedQuestions - Previously asked questions from database.json
 * @returns {Promise<{ question: string, options: string[], correctIndex: number, explanation: string }>}
 */
async function generateIslamicQuizQuestion(askedQuestions = []) {
  const ai = getAiClient();
  const recentHistory = askedQuestions.slice(-150);
  const randomCategory = QUIZ_CATEGORIES[Math.floor(Math.random() * QUIZ_CATEGORIES.length)];

  const historyBlock = recentHistory.length
    ? `\nالأسئلة والمواضيع التي طُرحت سابقاً (يُمنع تكرارها أو إعادة صياغتها تماماً):\n- ${recentHistory.join('\n- ')}`
    : '';

  const prompt = `أنشئ سؤالاً ثقافياً إسلامياً جديداً وممتعاً ودقيقاً علمياً باللغة العربية الفصحى في مجال: "${randomCategory}".
الشروط الصارمة:
1. أن يكون السؤال واضحاً ومحدداً (لا يزيد عن 160 حرفاً ليناسب استطلاعات واتساب).
2. 4 خيارات قصيرة ومميزة ومختلفة عن بعضها تماماً، من بينها إجابة واحدة صحيحة فقط لا لبس فيها.
3. تحديد correctIndex (رقم من 0 إلى 3 يطابق الإجابة الصحيحة بدقة).
4. explanation: شرح مختصر في سطر أو سطرين فقط يؤكد المعلومة الصحيحة بدون حشو.${historyBlock}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction:
        'أنت أستاذ متخصص في الثقافة الإسلامية والتاريخ الإسلامي وعلوم القرآن والسيرة النبوية. أخرج JSON صارماً ودقيقاً علمياً باللغة العربية الفصحى فقط.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          question: {
            type: Type.STRING,
            description: 'نص السؤال الإسلامي باللغة العربية',
          },
          options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'أربعة خيارات مختلفة باللغة العربية',
          },
          correctIndex: {
            type: Type.INTEGER,
            description: 'فهرس الإجابة الصحيحة من 0 إلى 3',
          },
          explanation: {
            type: Type.STRING,
            description: 'شرح مختصر في سطر أو سطرين فقط',
          },
        },
        required: ['question', 'options', 'correctIndex', 'explanation'],
      },
    },
  });

  const rawText = (response.text || '').trim();
  const parsed = JSON.parse(rawText);

  if (
    !parsed ||
    typeof parsed.question !== 'string' ||
    !Array.isArray(parsed.options) ||
    parsed.options.length !== 4 ||
    typeof parsed.correctIndex !== 'number' ||
    parsed.correctIndex < 0 ||
    parsed.correctIndex > 3
  ) {
    throw new Error('Gemini returned malformed quiz JSON payload');
  }

  return {
    question: parsed.question.trim(),
    options: parsed.options.map((opt) => String(opt).trim()),
    correctIndex: parsed.correctIndex,
    explanation: String(parsed.explanation || '').trim(),
  };
}

module.exports = {
  MODEL_NAME,
  SHETH_SYSTEM_INSTRUCTION,
  askSheth,
  translateText,
  summarizeText,
  getAyahTafsirAndAsbab,
  generateIslamicQuizQuestion,
};
