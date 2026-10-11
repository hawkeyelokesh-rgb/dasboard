// Maps a routing-form answer list to named columns by matching the question text,
// so it keeps working if you reorder the questions in Calendly.

export type QA = { question: string; answer: string | string[] | null };

export type MappedAnswers = {
  name: string | null;
  email: string | null;
  whatsapp: string | null;
  location: string | null;
  describes_best: string | null;
  previously_done: string | null;
  investment: string | null;
  goal: string | null;
  income_target: string | null;
  weekly_time: string | null;
  challenges: string | null;
  roadmap: string | null;
  commitment: string | null;
};

const RULES: [keyof MappedAnswers, RegExp][] = [
  ["email", /^\s*e-?mail/i],
  ["name", /^\s*(full\s+)?name\s*\??\s*$/i],
  ["whatsapp", /whats\s?app|phone|mobile/i],
  ["location", /currently located|where are you/i],
  ["describes_best", /describes?\s+you\s+best/i],
  ["previously_done", /previously done|export or import\?/i],
  ["investment", /investment capacity|approximate investment/i],
  ["goal", /primary goal/i],
  ["income_target", /monthly income|income target/i],
  ["weekly_time", /dedicate weekly|time can you dedicate/i],
  ["challenges", /challenges/i],
  ["roadmap", /clear roadmap|willing to take action/i],
  ["commitment", /call will take place|show up for the call/i],
];

function flat(a: QA["answer"]): string | null {
  if (a == null) return null;
  const s = Array.isArray(a) ? a.join(", ") : String(a);
  const t = s.replace(/\s*\n\s*/g, ", ").trim();
  return t === "" ? null : t;
}

export function mapAnswers(qa: QA[] | null | undefined): MappedAnswers {
  const out: MappedAnswers = {
    name: null, email: null, whatsapp: null, location: null, describes_best: null,
    previously_done: null, investment: null, goal: null, income_target: null,
    weekly_time: null, challenges: null, roadmap: null, commitment: null,
  };
  for (const item of qa ?? []) {
    const q = item.question ?? "";
    const rule = RULES.find(([key, re]) => out[key] === null && re.test(q));
    if (rule) out[rule[0]] = flat(item.answer);
  }
  return out;
}
