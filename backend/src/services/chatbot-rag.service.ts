import knowledgeData from "../data/chatbot-knowledge.json";

export type KnowledgeRole =
  | "public"
  | "applicant"
  | "student"
  | "faculty"
  | "admin";

export type QueryLanguage = "en" | "tl" | "taglish";

export interface RelatedRoute {
  label: string;
  href: string;
}

export interface KnowledgeChunk {
  id: string;
  category: string;
  section: string;
  title: string;
  roles: KnowledgeRole[];
  keywords: string[];
  commonInquiries: string[];
  answerEn: string;
  answerTl: string;
  relatedRoutes: RelatedRoute[];
}

export interface UserLiveStateContext {
  userName?: string;
  program?: string;
  pageTitle?: string;
  activeStatusSummary?: string;
  liveDetailsSummary?: string;
}

export interface RetrievalHit {
  chunk: KnowledgeChunk;
  score: number;
  vectorScore: number;
  lexicalScore: number;
  inquiryScore: number;
}

export interface RetrievalResult {
  query: string;
  language: QueryLanguage;
  isGreeting: boolean;
  isConversational: boolean;
  isIdentityQuery: boolean;
  isOutOfScope: boolean;
  isExplicitOutOfScope: boolean;
  conversationalReply?: string;
  topScore: number;
  hits: RetrievalHit[];
}

const KNOWLEDGE_CHUNKS = knowledgeData as KnowledgeChunk[];

/**
 * Confidence threshold for the RAG Scope Boundary Gate.
 * Queries below this hybrid similarity score trigger the human-readable fallback.
 */
export const RAG_CONFIDENCE_THRESHOLD = 0.16;

export const CANONICAL_GS_EMAIL = "gs@earist.edu.ph";
export const CANONICAL_GS_PHONE = "(02) 8534-8267";

const TAGALOG_MARKERS = new Set([
  "ako",
  "ang",
  "ano",
  "anong",
  "ba",
  "bago",
  "bakit",
  "bagsak",
  "bayad",
  "beses",
  "bawal",
  "buwan",
  "daan",
  "dapat",
  "di",
  "dito",
  "diyan",
  "doon",
  "gagamit",
  "gawa",
  "gawin",
  "grumadweyt",
  "gumamit",
  "gumawa",
  "gumraduate",
  "hanggang",
  "hawakan",
  "hindi",
  "ho",
  "ibig",
  "ikaw",
  "ilan",
  "ilang",
  "ipapasa",
  "ipasa",
  "ito",
  "iyan",
  "iyon",
  "kailangan",
  "kailangang",
  "kailan",
  "kami",
  "kamusta",
  "kapag",
  "kayo",
  "ko",
  "kulay",
  "kumusta",
  "kung",
  "kurso",
  "lang",
  "lamang",
  "linggo",
  "lipat",
  "lilipat",
  "maaari",
  "magapply",
  "magbayad",
  "magenroll",
  "magpasa",
  "magsumite",
  "magtanong",
  "magtapos",
  "magkano",
  "maging",
  "makakuha",
  "makapag",
  "makapagtapos",
  "makapasa",
  "makapasok",
  "makukuha",
  "marka",
  "matapos",
  "may",
  "mayroon",
  "meron",
  "mga",
  "mo",
  "mula",
  "muna",
  "na",
  "nagbayad",
  "nagpasa",
  "naman",
  "namin",
  "nang",
  "nasa",
  "natin",
  "ng",
  "ngunit",
  "ni",
  "nila",
  "niya",
  "noong",
  "ninyo",
  "oo",
  "opo",
  "pa",
  "paano",
  "pag",
  "pagbayad",
  "pagkatapos",
  "pagkuha",
  "pagpasa",
  "pagsusulit",
  "pagtatapos",
  "pala",
  "palit",
  "para",
  "pasado",
  "pero",
  "pili",
  "po",
  "pumasa",
  "puwede",
  "pwede",
  "pwedeng",
  "sa",
  "saan",
  "sabay",
  "sagot",
  "sakop",
  "salamat",
  "sino",
  "siya",
  "taon",
  "tapos",
  "tanong",
  "tayo",
  "toga",
  "tulong",
  "tungkol",
  "ung",
  "wala",
  "walang",
  "yung",
]);

const ENGLISH_CONTENT_MARKERS = new Set([
  "academic",
  "admission",
  "adviser",
  "alignment",
  "and",
  "applicant",
  "apply",
  "are",
  "bridging",
  "certificate",
  "comprehensive",
  "cor",
  "costume",
  "course",
  "courses",
  "credits",
  "curriculum",
  "dashboard",
  "dba",
  "deadline",
  "defense",
  "degree",
  "diploma",
  "dissertation",
  "doctoral",
  "documents",
  "dpa",
  "drop",
  "dropping",
  "edd",
  "email",
  "enroll",
  "enrollment",
  "entrance",
  "essay",
  "evaluation",
  "exam",
  "examination",
  "faculty",
  "fees",
  "final",
  "for",
  "forecast",
  "grade",
  "grades",
  "grading",
  "graduate",
  "graduation",
  "gown",
  "gwa",
  "history",
  "how",
  "id",
  "incentive",
  "incomplete",
  "is",
  "journal",
  "load",
  "login",
  "maed",
  "maie",
  "major",
  "manuscript",
  "masters",
  "mat",
  "mba",
  "modalities",
  "mpa",
  "mrr",
  "online",
  "osh",
  "panelist",
  "passing",
  "phd",
  "pinnacle",
  "plagiarism",
  "portal",
  "program",
  "programs",
  "proposal",
  "publication",
  "pwd",
  "rap",
  "register",
  "registration",
  "repository",
  "requirements",
  "residency",
  "results",
  "schedule",
  "scholarship",
  "score",
  "settings",
  "shift",
  "shifting",
  "signature",
  "similarity",
  "slots",
  "strike",
  "student",
  "subjects",
  "submit",
  "system",
  "the",
  "thesis",
  "title",
  "tomorrow",
  "transcript",
  "tuition",
  "under",
  "units",
  "upload",
  "waiver",
  "weather",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "with",
]);

const STOPWORDS = new Set([
  // English stopwords
  "a",
  "about",
  "all",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "get",
  "had",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "make",
  "me",
  "more",
  "my",
  "need",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "tell",
  "that",
  "the",
  "their",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "use",
  "want",
  "was",
  "we",
  "were",
  "what",
  "when",
  "where",
  "which",
  "who",
  "whom",
  "whose",
  "why",
  "will",
  "with",
  "would",
  "yes",
  "you",
  "your",
  // Tagalog stopwords
  "ako",
  "alin",
  "alinman",
  "ang",
  "ano",
  "anong",
  "at",
  "ay",
  "ba",
  "bago",
  "bakit",
  "dahil",
  "daw",
  "di",
  "din",
  "dito",
  "diyan",
  "doon",
  "hanggang",
  "hindi",
  "ho",
  "ikaw",
  "ito",
  "iyan",
  "iyon",
  "kailangan",
  "kailangang",
  "kailan",
  "kami",
  "kapag",
  "kasi",
  "kay",
  "kayo",
  "kina",
  "ko",
  "kung",
  "lamang",
  "lang",
  "mag",
  "may",
  "mayroon",
  "mayroong",
  "meron",
  "mga",
  "mo",
  "mula",
  "muna",
  "na",
  "nag",
  "naman",
  "namin",
  "nang",
  "nasa",
  "natin",
  "ng",
  "ngunit",
  "ni",
  "nila",
  "ninyo",
  "niya",
  "o",
  "oo",
  "opo",
  "pa",
  "paano",
  "pag",
  "pagkatapos",
  "pala",
  "para",
  "pero",
  "po",
  "puwede",
  "pwede",
  "pwedeng",
  "raw",
  "rin",
  "sa",
  "saan",
  "si",
  "sila",
  "sino",
  "siya",
  "subalit",
  "tayo",
  "tungkol",
  "ung",
  "wala",
  "walang",
  "yata",
  "yung",
]);

/**
 * Bilingual synonym & concept expansion table for English, Tagalog, and Taglish queries.
 */
const SYNONYM_EXPANSIONS: Array<{ pattern: RegExp; tokens: string[] }> = [
  {
    pattern: /\b(toga|sablay|gown|costume|attire|suot)\b/i,
    tokens: ["academic", "costume", "gown", "toga", "color"],
  },
  {
    pattern: /\b(compre|comprehensive)\b/i,
    tokens: ["written", "comprehensive", "examination", "75", "percent"],
  },
  {
    pattern: /\b(shift|shifting|lipat|lilipat|palit)\b/i,
    tokens: ["change", "program", "shifting", "form"],
  },
  {
    pattern: /\b(absent|absences|liban|attendance)\b/i,
    tokens: ["class", "attendance", "unexcused", "20", "percent", "dropped"],
  },
  {
    pattern: /\b(drop|dropping|mag-?drop)\b/i,
    tokens: ["dropping", "courses", "midterm", "registrar"],
  },
  {
    pattern: /\b(grade|grades|grading|marka|grado|pasado|bagsak)\b/i,
    tokens: ["grading", "system", "scale", "passed", "failed"],
  },
  {
    pattern: /\b(inc|incomplete)\b/i,
    tokens: ["incomplete", "inc", "removal", "1", "year"],
  },
  {
    pattern:
      /\b(tuition|matrikula|bayad|fees?|miscellaneous|augmentation|matriculation|magkano|how\s+much|fms)\b/i,
    tokens: ["school", "fees", "tuition", "miscellaneous", "fms", "augmentation"],
  },
  {
    pattern:
      /\b(f2f|face[- ]to[- ]face|online class|blended|modality|modalities|synchronous|asynchronous)\b/i,
    tokens: ["learning", "modalities", "face-to-face", "blended", "online"],
  },
  {
    pattern: /\b(ai|chatgpt|grammarly|generative|llm)\b/i,
    tokens: [
      "research",
      "ethics",
      "ai",
      "policy",
      "chatgpt",
      "grammarly",
      "disclosure",
    ],
  },
  {
    pattern: /\b(plagiarism|similarity|strike|turnitin)\b/i,
    tokens: ["strike", "plagiarism", "similarity", "20", "percent", "clearance"],
  },
  {
    pattern: /\b(rap|rapporteur)\b/i,
    tokens: ["rapporteur", "report", "proposal", "final", "defense"],
  },
  {
    pattern: /\b(gs-?0?20|adviser|advisor|tagapayo)\b/i,
    tokens: ["adviser", "request", "1:5", "ratio", "panel"],
  },
  {
    pattern: /\b(egat|ecat|entrance exam|pagsusulit)\b/i,
    tokens: ["entrance", "examination", "egat", "exam"],
  },
  {
    pattern: /\b(cor|certificate of registration|ocr)\b/i,
    tokens: ["cor", "certificate", "registration", "upload", "ocr", "5mb"],
  },
  {
    pattern: /\b(aligned|misaligned|alignment|unrelated|bridging|profed)\b/i,
    tokens: ["bridging", "9", "units", "unrelated", "field", "profed", "18"],
  },
  {
    pattern: /\b(mrr|maximum residence|length of study|ilang taon)\b/i,
    tokens: ["maximum", "residence", "rule", "4", "years", "6", "years"],
  },
  {
    pattern: /\b(loa|leave of absence|mag-?loa|pahinga)\b/i,
    tokens: ["leave", "absence", "loa", "1", "academic", "year"],
  },
  {
    pattern: /\b(scholarship|discount|exemption|exempt|fegssc|personnel|cna)\b/i,
    tokens: ["scholarship", "exemption", "fegssc", "personnel", "refund"],
  },
  {
    pattern:
      /\b(incentive|incentives|honoraria|honorarium|creative work|software|copyrighted)\b/i,
    tokens: ["creative", "work", "incentives", "honoraria", "software"],
  },
  {
    pattern: /\b(osh|safety|drill|drills|ppe|ert|first aid|mental health)\b/i,
    tokens: ["occupational", "safety", "health", "osh", "drills", "ppe"],
  },
  {
    pattern: /\b(diploma|credentials|transcript|tor|claim)\b/i,
    tokens: ["academic", "credentials", "diploma", "transcript", "clearance"],
  },
  {
    pattern:
      /\b(grumadweyt|makapagtapos|graduation|graduating|to\s+graduate|how\s+to\s+graduate|requirements\s+to\s+graduate|bago\s+grumadweyt)\b/i,
    tokens: ["graduation", "requirements", "publication", "output"],
  },
  {
    pattern: /\b(journal|publish|publication|apa|peer review|call for papers)\b/i,
    tokens: ["journal", "publication", "apa", "7th", "peer", "review"],
  },
  {
    pattern:
      /\b(history|founded|established|kasaysayan|itinatag|presidents|presidente)\b/i,
    tokens: ["history", "earist", "presidents"],
  },
  {
    pattern:
      /\b(contact|address|email|phone|telephone|number|location|nagtahan)\b/i,
    tokens: ["contact", "email", "phone", "address", "nagtahan", "manila"],
  },
  {
    pattern:
      /\b(pinnacle|apply|mag-?apply|register|magparehistro|mag-?register|sign up)\b/i,
    tokens: ["apply", "register", "registration", "pinnacle", "applicant", "id"],
  },
  {
    pattern:
      /\b(workspace|annotate|annotation|rubric|essay evaluation|grade essay)\b/i,
    tokens: [
      "faculty",
      "defense",
      "workspace",
      "essay",
      "evaluations",
      "rubric",
    ],
  },
  {
    pattern: /\b(maed|maie|mat|mba|mpa|maip|msm|master|masteral|masters)\b/i,
    tokens: ["masters", "programs", "pqf", "level", "7"],
  },
  {
    pattern: /\b(edd|ed\.d|phd|ph\.d|dpa|dba|doctoral|doctorate)\b/i,
    tokens: ["doctoral", "programs", "pqf", "level", "8"],
  },
  {
    pattern: /\b(international|foreign|visa|embassy)\b/i,
    tokens: [
      "international",
      "student",
      "visa",
      "embassy",
      "english",
      "proficiency",
    ],
  },
  {
    pattern: /\b(gad|safe spaces|harassment|pwd|disability|special needs)\b/i,
    tokens: ["gad", "safe", "spaces", "pwd", "special", "needs"],
  },
  {
    pattern: /\b(audit|auditing)\b/i,
    tokens: ["class", "audit", "no", "credit"],
  },
  {
    pattern: /\b(dual registration|two programs|dalawang course|sabay)\b/i,
    tokens: ["dual", "registration", "prohibited", "simultaneous"],
  },
  {
    pattern: /\b(transfer|transferee|credit|pa-?credit)\b/i,
    tokens: ["transfer", "credits", "6", "units", "5", "years"],
  },
  {
    pattern: /\b(re-?defense|redefense|panelists fee)\b/i,
    tokens: ["oral", "defense", "re-defense", "panelists", "fee"],
  },
  {
    pattern: /\b(admin|administrator)\b/i,
    tokens: [
      "admin",
      "administrator",
      "cor",
      "verification",
      "slots",
      "email",
      "manager",
      "settings",
    ],
  },
  {
    pattern:
      /\b(email\s+manager|email\s+logs|email\s+templates|smtp|institutional\s+officials|term\s+transition)\b/i,
    tokens: [
      "admin",
      "settings",
      "email",
      "manager",
      "logs",
      "templates",
      "institutional",
      "officials",
    ],
  },
  {
    pattern:
      /\b(process|proseso|steps|hakbang|journey|flow)\b.*\b(thesis|tesis|dissertation|disertation|disertasyon)\b|\b(thesis|tesis|dissertation|disertation|disertasyon)\b.*\b(process|proseso|steps|hakbang|journey|flow)\b/i,
    tokens: [
      "thesis",
      "dissertation",
      "process",
      "title",
      "defense",
      "proposal",
      "final",
      "5",
      "steps",
      "journey",
    ],
  },
  {
    pattern:
      /\b(programs?\s+offered|offered\s+programs?|graduate\s+programs?|curricular\s+programs?|courses?\s+offered|what\s+programs?|anong\s+(?:mga\s+)?(?:graduate\s+)?programs?|mga\s+kurso)\b/i,
    tokens: [
      "graduate",
      "programs",
      "offered",
      "curricular",
      "doctoral",
      "masters",
      "all",
      "overview",
    ],
  },
  {
    pattern:
      /\b(eligible|eligibility|qualified|who\s+can\s+(?:apply|enroll)|who\s+is\s+eligible|sino\s+ang\s+(?:pwedeng|maaaring)\s+(?:mag-?apply|mag-?enroll))\b/i,
    tokens: [
      "eligible",
      "eligibility",
      "qualifications",
      "gwa",
      "bachelors",
      "masters",
      "doctoral",
      "work",
      "experience",
    ],
  },
  {
    pattern:
      /\b(enroll|enrollment|enrolling|mag-?enroll|pag-?enroll|continuing\s+student|old\s+student|enrollment\s+status)\b/i,
    tokens: [
      "enroll",
      "enrollment",
      "requirements",
      "continuing",
      "status",
      "pinnacle",
      "cor",
    ],
  },
];

/**
 * Off-topic guard patterns for queries clearly outside the EARIST GS domain.
 */
const EXPLICIT_OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  /\b(weather|forecast|typhoon|bagyo|temperature|rain)\b/i,
  /\b(nba|pba|basketball|football|soccer|boxing|olympics|esports|valorant|mlbb)\b/i,
  /\b(recipe|cook|ulams?|adobo|sinigang|baking|restaurant|menu)\b/i,
  /\b(bitcoin|crypto|ethereum|stock market|forex|trading)\b/i,
  /\b(movie|netflix|k-?drama|anime|spotify|song|lyrics|concert)\b/i,
  /\b(horoscope|zodiac|lotto|lottery|suwertres)\b/i,
  /\b(presidente ng pilipinas|president of the philippines|president of the usa|us president)\b/i,
  /\b(python script|bubble sort|react native|flutter|laravel|php tutorial)\b/i,
  /\b(capital of|tallest mountain|distance to the moon|solar system)\b/i,
];

const GREETING_PATTERN =
  /^(hi+|hello+|hey+|good\s*(morning|afternoon|evening)|magandang\s*(umaga|hapon|gabi)|kamusta|kumusta|help|tulong|patulong|start|menu)([!.,?\s]*)$/i;

const IDENTITY_QUERY_PATTERN =
  /\b(?:what|which|anong?|ano)\s+(?:ai\s+|language\s+)?(?:model|llm)\b.*\b(?:you|ka|mo|this|chatbot|assistant|ito|gamit)\b|\b(?:are\s+you|ikaw\s+ba(?:\s+ay|\s+si)?|is\s+this|powered\s+by)\s+(?:an?\s+)?(?:deepseek(?:\s*[-\s]?(?:v\d+(?:\.\d+)?|r\d+|flash|chat|reasoner))?|gemini|chatgpt|gpt(?:\s*-?\d+(?:\.\d+)?)?|claude|openai|anthropic|google\s+ai)\b|\b(?:deepseek|gemini|chatgpt|gpt|claude)\s+ka\s+ba\b|\b(?:who\s+(?:made|built|created|trained|are)\s+you|sino\s+(?:ka|gumawa\s+sayo|nagprogram)|what\s+ai\s+are\s+you|ano\s+pangalan\s+mo|what\s+is\s+your\s+name)\b/i;

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/ph\.d/g, "phd")
    .replace(/ed\.d/g, "edd")
    .replace(/(\d+)\s*%/g, "$1 percent")
    .replace(/1\s*:\s*5/g, "1 to 5 ratio 5 students")
    .replace(/\b(disertation|disertasyon|dissertasyon)\b/g, "dissertation")
    .replace(/\b(tesis)\b/g, "thesis")
    .replace(/\b(proseso)\b/g, "process")
    .replace(/\b(re-?defence)\b/g, "re-defense")
    .replace(/\b(defence)\b/g, "defense")
    .replace(/\b(adriser|advicer)\b/g, "adviser")
    .replace(/\b(plagarism)\b/g, "plagiarism")
    .replace(/\b(rikwayrments|requirments)\b/g, "requirements")
    .replace(/\b(skedyul|iskedyul)\b/g, "schedule")
    .replace(/\b(kurikulum)\b/g, "curriculum")
    .replace(/[^a-z0-9\s\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string, expandSynonyms = false): string[] {
  const normalized = normalizeText(text);
  const rawTokens = normalized.split(" ").filter(Boolean);
  const result: string[] = [];

  for (const token of rawTokens) {
    if (token.includes("-")) {
      const parts = token.split("-").filter(Boolean);
      for (const part of parts) {
        if (!STOPWORDS.has(part) && part.length > 1) {
          result.push(part);
        }
      }
    }
    if (!STOPWORDS.has(token) && (token.length > 1 || /^\d+$/.test(token))) {
      result.push(token);
    }
  }

  if (expandSynonyms) {
    for (const rule of SYNONYM_EXPANSIONS) {
      if (rule.pattern.test(text)) {
        result.push(...rule.tokens);
      }
    }
  }

  return result;
}

/**
 * Detects whether the user inquiry is English, Tagalog, or Taglish.
 */
export function detectQueryLanguage(query: string): QueryLanguage {
  const lower = query.toLowerCase();
  const words = lower.replace(/[^a-z0-9\s\-]/g, " ").split(/\s+/).filter(Boolean);

  let tagalogHits = 0;
  let englishHits = 0;

  for (const word of words) {
    if (
      TAGALOG_MARKERS.has(word) ||
      /^(mag|nag|pag|nakapag|pinag|ipapa|ipa|ma|na|pa)-[a-z]{2,}$/.test(word)
    ) {
      tagalogHits++;
    }
    if (ENGLISH_CONTENT_MARKERS.has(word)) {
      englishHits++;
    }
  }

  if (tagalogHits === 0) {
    return "en";
  }
  if (englishHits >= 1) {
    return "taglish";
  }
  return "tl";
}

interface IndexedChunk {
  chunk: KnowledgeChunk;
  vector: Map<string, number>;
  norm: number;
  keywordSet: Set<string>;
  normalizedInquiries: string[];
  normalizedTitle: string;
}

// Build inverted index & TF-IDF vectors once on module initialization
const { indexedChunks, idfMap, maxIdf } = (() => {
  const docCount = KNOWLEDGE_CHUNKS.length;
  const docFreq = new Map<string, number>();

  const chunkTokenLists = KNOWLEDGE_CHUNKS.map((chunk) => {
    const weightedTokens: string[] = [
      ...tokenize(chunk.title, false),
      ...tokenize(chunk.title, false), // 2x weight for title
      ...tokenize(chunk.section, false),
      ...tokenize(chunk.keywords.join(" "), false),
      ...tokenize(chunk.keywords.join(" "), false), // 2x weight for keywords
      ...tokenize(chunk.commonInquiries.join(" "), false),
      ...tokenize(chunk.answerEn, false),
      ...tokenize(chunk.answerTl, false),
    ];

    const uniqueTokens = new Set(weightedTokens);
    for (const tok of uniqueTokens) {
      docFreq.set(tok, (docFreq.get(tok) ?? 0) + 1);
    }

    return weightedTokens;
  });

  const computedIdf = new Map<string, number>();
  for (const [term, df] of docFreq.entries()) {
    computedIdf.set(term, Math.log((docCount + 1) / (df + 1)) + 1);
  }
  const defaultMaxIdf = Math.log(docCount + 1) + 1;

  const builtChunks: IndexedChunk[] = KNOWLEDGE_CHUNKS.map((chunk, idx) => {
    const tokens = chunkTokenLists[idx];
    const tf = new Map<string, number>();
    for (const tok of tokens) {
      tf.set(tok, (tf.get(tok) ?? 0) + 1);
    }

    const vec = new Map<string, number>();
    let sqSum = 0;
    for (const [term, count] of tf.entries()) {
      const weight = (1 + Math.log(count)) * (computedIdf.get(term) ?? 1);
      vec.set(term, weight);
      sqSum += weight * weight;
    }

    const keywordSet = new Set<string>();
    for (const kw of chunk.keywords) {
      for (const t of tokenize(kw, false)) {
        keywordSet.add(t);
      }
    }

    return {
      chunk,
      vector: vec,
      norm: Math.sqrt(sqSum) || 1,
      keywordSet,
      normalizedInquiries: chunk.commonInquiries.map((q) => normalizeText(q)),
      normalizedTitle: normalizeText(chunk.title),
    };
  });

  return {
    indexedChunks: builtChunks,
    idfMap: computedIdf,
    maxIdf: defaultMaxIdf,
  };
})();

export function normalizeKnowledgeRole(role?: string): KnowledgeRole | undefined {
  if (!role) return undefined;
  const r = role.toLowerCase();
  if (r === "panelist" || r === "faculty") return "faculty";
  if (r === "applicant") return "applicant";
  if (r === "student") return "student";
  if (r === "admin" || r === "administrator") return "admin";
  if (r === "public") return "public";
  return undefined;
}

const QUESTION_OPENER_PREFIX =
  /^(?:may(?:roon)?\s+(?:akong\s+)?(?:i?tatanong|tanong)|magtatanong\s+(?:lang|sana)|(?:pwede|puwede)\s+(?:bang\s+)?magtanong|tanong\s+(?:lang|ko\s+lang)|ask\s+(?:lang(?:\s+ako)?|ko\s+lang)|(?:i\s+have\s+(?:a\s+)?(?:quick\s+)?question|(?:can|may)\s+i\s+ask(?:\s+(?:a\s+)?(?:quick\s+)?question)?|quick\s+question))\b(?:\s+(?:ako|po|lang|sana|ko))*/i;

const INTERROGATIVE_IN_REST =
  /\b(?:ano|anong|paano|saan|kailan|ilan|ilang|magkano|sino|bakit|pwede\s+ba|puwede\s+ba|what|how|where|when|why|who|which|is\s+there|do\s+i|should\s+i|where\s+can)\b/i;

function formatConversationalTopic(topic: string, isTagalog: boolean): string {
  let formatted = topic
    .replace(
      /\bthesis\s+(?:disertation|dissertation|disertasyon)\b/gi,
      isTagalog ? "thesis o dissertation" : "thesis or dissertation",
    )
    .replace(/\b(?:disertation|disertasyon|dissertasyon)\b/gi, "dissertation")
    .replace(/\btesis\b/gi, "thesis")
    .trim();

  if (isTagalog) {
    formatted = formatted.replace(/\bko$/i, "mo");
  } else {
    formatted = formatted.replace(/^my\s+/i, "your ");
  }
  return formatted;
}

function detectConversationalIntent(
  trimmed: string,
  language: QueryLanguage,
  userContext?: UserLiveStateContext,
): string | null {
  const plain = trimmed.replace(/[!.,?]+$/g, "").trim();
  if (!plain) return null;

  const isTl = language === "tl" || language === "taglish";
  const firstName = userContext?.userName?.trim().split(/\s+/)[0];
  const words = plain.split(/\s+/).filter(Boolean);
  const hasInterrogativeOrCommand =
    /\b(ano|anong|paano|pano|saan|kailan|kelan|ilan|ilang|magkano|sino|bakit|explain|tell|show|list|describe|check|about|tungkol|what|how|where|when|why|who|which|can|could|pwede|puwede|meron|may)\b/i.test(
      plain,
    );

  // 1. Gratitude ("Thanks!", "Thanks for the information!", "Salamat sa iyong impormasyon!")
  if (
    words.length <= 12 &&
    !hasInterrogativeOrCommand &&
    /^(?:(?:ok(?:ay)?|sige|ge|noted|got\s+it|alright|ahh?|oh+)[,\s]+)?(?:(?:very\s+|so\s+|many\s+|maraming\s+|super\s+)?(?:thanks?|thank\s+you|tysm|ty|thx|salamat(?:\s+po)?)|(?:i\s+)?appreciate\s+(?:it|that|this|the\s+\w+))(?:\s+.*)?$/i.test(
      plain,
    )
  ) {
    return isTl
      ? "Walang anuman! Sabihin mo lang kung may iba ka pang tanong."
      : "You're welcome! Let me know anytime if you have another question.";
  }

  // 2. Hold / Pause ("Wait", "Wait lang", "Teka lang", "Hold on", "One sec please")
  if (
    words.length <= 8 &&
    !hasInterrogativeOrCommand &&
    /^(?:wait(?:\s+lang)?|teka(?:\s+lang)?|sandali(?:\s+lang)?|saglit(?:\s+lang)?|hold\s+on|give\s+me\s+a\s+(?:sec(?:ond)?|moment|minute)|one\s+(?:sec(?:ond)?|moment)|just\s+a\s+(?:sec(?:ond)?|moment))(?:\s+.*)?$/i.test(
      plain,
    )
  ) {
    return isTl
      ? "Sige lang, take your time! Nandito lang ako kapag handa ka nang magtanong."
      : "Sure, take your time! Just message me whenever you're ready.";
  }

  // 3. Simple Acknowledgments / Closings ("Ok", "Sige", "Noted", "Got it", "Bye")
  if (
    words.length <= 8 &&
    !hasInterrogativeOrCommand &&
    /^(?:ok(?:ay|i)?|sige|ge|cge|noted|copy|got\s+it|gets(?:\s+ko\s+na)?|i\s+see|alright|ahh?|oh+|nice|great|cool|good|makes\s+sense|wala\s+na(?:\s+po)?|none|nothing\s+else|that(?:'s|\s+is)\s+all|bye+|goodbye|paalam)(?:[,\s]+.*)?$/i.test(
      plain,
    )
  ) {
    return isTl
      ? "Sige! Sabihin mo lang kung may iba ka pang gustong itanong."
      : "Got it! Feel free to ask anytime if you need more help.";
  }

  // 4. Question Openers ("May tanong ako", "May tanong ako sa thesis disertation", "I have a question")
  if (QUESTION_OPENER_PREFIX.test(plain) && !/[?.!]\s*\S/.test(trimmed)) {
    const rest = plain.replace(QUESTION_OPENER_PREFIX, "").trim();
    if (!rest) {
      return isTl
        ? `Sige${firstName ? `, ${firstName}` : ""}! Ano ang gusto mong itanong?`
        : `Sure${firstName ? `, ${firstName}` : ""}! What would you like to ask?`;
    }

    if (!INTERROGATIVE_IN_REST.test(rest)) {
      const strippedTopic = rest
        .replace(/^(?:po\s+)?(?:tungkol\s+sa|about|regarding|sa|on|for|re)\s+/i, "")
        .trim();
      const topicWords = strippedTopic.split(/\s+/).filter(Boolean);
      if (strippedTopic && topicWords.length <= 6) {
        const topic = formatConversationalTopic(strippedTopic, isTl);
        return isTl
          ? `Sige${firstName ? `, ${firstName}` : ""}! Ano ang tanong mo tungkol sa ${topic}?`
          : `Sure${firstName ? `, ${firstName}` : ""}! What is your question about ${topic}?`;
      }
    }
  }

  return null;
}

/**
 * Retrieves the top-K relevant knowledge chunks using Hybrid Vector + Lexical scoring
 * and enforces the strict Scope Boundary Gate for out-of-scope queries.
 */
export function retrieveKnowledgeChunks(
  query: string,
  activeRole?: string,
  topK = 4,
  userContext?: UserLiveStateContext,
): RetrievalResult {
  const trimmed = query.trim();
  const language = detectQueryLanguage(trimmed);

  if (GREETING_PATTERN.test(trimmed)) {
    return {
      query: trimmed,
      language,
      isGreeting: true,
      isConversational: false,
      isIdentityQuery: false,
      isOutOfScope: false,
      isExplicitOutOfScope: false,
      topScore: 1,
      hits: [],
    };
  }

  if (IDENTITY_QUERY_PATTERN.test(trimmed)) {
    return {
      query: trimmed,
      language,
      isGreeting: false,
      isConversational: false,
      isIdentityQuery: true,
      isOutOfScope: false,
      isExplicitOutOfScope: false,
      topScore: 1,
      hits: [],
    };
  }

  const conversationalReply = detectConversationalIntent(
    trimmed,
    language,
    userContext,
  );
  if (conversationalReply) {
    return {
      query: trimmed,
      language,
      isGreeting: false,
      isConversational: true,
      isIdentityQuery: false,
      isOutOfScope: false,
      isExplicitOutOfScope: false,
      conversationalReply,
      topScore: 1,
      hits: [],
    };
  }

  // Hard off-topic check unless the user explicitly mentions EARIST or Graduate School
  const mentionsEarist = /\b(earist|graduate school|gs-?is)\b/i.test(trimmed);
  if (
    !mentionsEarist &&
    EXPLICIT_OUT_OF_SCOPE_PATTERNS.some((pat) => pat.test(trimmed))
  ) {
    return {
      query: trimmed,
      language,
      isGreeting: false,
      isConversational: false,
      isIdentityQuery: false,
      isOutOfScope: true,
      isExplicitOutOfScope: true,
      topScore: 0,
      hits: [],
    };
  }

  const rawContentTokens = tokenize(trimmed, false);
  const expandedTokens = tokenize(trimmed, true);

  if (expandedTokens.length === 0) {
    return {
      query: trimmed,
      language,
      isGreeting: false,
      isConversational: false,
      isIdentityQuery: false,
      isOutOfScope: true,
      isExplicitOutOfScope: false,
      topScore: 0,
      hits: [],
    };
  }

  // Build weighted query vector (penalize OOV tokens with maxIdf to prevent generic-word false positives)
  const qTf = new Map<string, number>();
  for (const tok of expandedTokens) {
    qTf.set(tok, (qTf.get(tok) ?? 0) + 1);
  }
  const qVec = new Map<string, number>();
  let qSqSum = 0;
  for (const [term, count] of qTf.entries()) {
    const idf = idfMap.get(term) ?? maxIdf;
    const weight = (1 + Math.log(count)) * idf;
    qVec.set(term, weight);
    qSqSum += weight * weight;
  }
  const qNorm = Math.sqrt(qSqSum) || 1;

  const normalizedQuery = normalizeText(trimmed);
  const roleKey = normalizeKnowledgeRole(activeRole);

  const scored: RetrievalHit[] = indexedChunks.map((entry) => {
    // 1. Cosine Similarity on TF-IDF vector space
    let dot = 0;
    for (const [term, qWeight] of qVec.entries()) {
      const dWeight = entry.vector.get(term);
      if (dWeight) {
        dot += qWeight * dWeight;
      }
    }
    const vectorScore = dot / (qNorm * entry.norm);

    // 2. Lexical / Keyword overlap score
    let keywordMatches = 0;
    const uniqueExpanded = new Set(expandedTokens);
    for (const tok of uniqueExpanded) {
      if (entry.keywordSet.has(tok) || entry.normalizedTitle.includes(tok)) {
        keywordMatches++;
      }
    }
    const phraseMatchBoost = entry.chunk.keywords.some(
      (kw) => kw.length > 3 && normalizedQuery.includes(normalizeText(kw)),
    )
      ? 0.28
      : 0;
    const lexicalScore = Math.min(
      1,
      keywordMatches / Math.max(uniqueExpanded.size, 2) + phraseMatchBoost,
    );

    // 3. Common Inquiry similarity (word overlap with curated FAQ variations)
    let bestInquiryOverlap = 0;
    const rawSet = new Set(rawContentTokens);
    if (rawSet.size > 0) {
      for (const inq of entry.normalizedInquiries) {
        const inqTokens = tokenize(inq, false);
        if (inqTokens.length === 0) continue;
        let overlap = 0;
        for (const t of inqTokens) {
          if (rawSet.has(t)) overlap++;
        }
        const ratio = overlap / Math.max(rawSet.size, inqTokens.length * 0.7);
        if (ratio > bestInquiryOverlap) {
          bestInquiryOverlap = ratio;
        }
      }
    }
    const inquiryScore = Math.min(1, bestInquiryOverlap);

    // 4. Gentle role-context boost (only when content already has a baseline match)
    const baseScore =
      0.48 * vectorScore + 0.34 * lexicalScore + 0.18 * inquiryScore;
    const roleBoost =
      roleKey && entry.chunk.roles.includes(roleKey) && baseScore > 0.12
        ? 0.03
        : 0;

    return {
      chunk: entry.chunk,
      score: baseScore + roleBoost,
      vectorScore,
      lexicalScore,
      inquiryScore,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  const topHits = scored.slice(0, topK);
  const topScore = topHits[0]?.score ?? 0;
  const isOutOfScope = topScore < RAG_CONFIDENCE_THRESHOLD;

  return {
    query: trimmed,
    language,
    isGreeting: false,
    isConversational: false,
    isIdentityQuery: false,
    isOutOfScope,
    isExplicitOutOfScope: false,
    topScore,
    hits: isOutOfScope ? [] : topHits.filter((h) => h.score >= 0.11),
  };
}

export function cleanAssistantReply(text: string): string {
  let cleaned = text.replace(/\r\n/g, "\n");

  // Guard against accidental LLM vendor or model disclosure
  cleaned = cleaned
    .replace(
      /\bDeepSeek(?:[-\s]+(?:V\d+(?:\.\d+)?|R\d+(?:\.\d+)?|Flash|Chat|Reasoner|Pro|Lite|Coder))*\b/gi,
      "EARIST Graduate School Assistant",
    )
    .replace(
      /\bGemini(?:\s+\d+(?:\.\d+)?)?(?:\s+(?:Hydrogen|Pro|Flash|Ultra|Nano|Live|Omni))?\b/gi,
      "EARIST Graduate School Assistant",
    )
    .replace(
      /\b(?:ChatGPT|GPT(?:[-\s]*\d+(?:\.\d+)?[a-z]*)?|Claude(?:\s+\d+(?:\.\d+)?)?(?:\s+(?:Sonnet|Opus|Haiku))?)\b/gi,
      "EARIST Graduate School Assistant",
    )
    .replace(
      /\b(?:OpenAI|Anthropic|Google\s+AI)\b/gi,
      "EARIST Graduate School",
    )
    .replace(
      /\b(?:a\s+)?large\s+language\s+model(?:\s+(?:built|trained|developed|created)\s+by\s+[A-Za-z\s]+?)?(?=[.,;!?\n]|$)/gi,
      "the official EARIST Graduate School virtual assistant",
    );

  // Strip Markdown formatting symbols (*, **, #, ---, `) so replies read as plain text
  cleaned = cleaned
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "")
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]*\*[ \t]+/gm, "- ")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/[`*#]/g, "");

  // Strip internal Manual section / CMO numbers so responses sound like GS Office staff
  cleaned = cleaned
    .replace(
      /\s*\([^)]*(?:\bManual\s+Sec|\bSec(?:tion)?s?\.?\s*\d+|\bCMO\s*No\.?\s*\d+)[^)]*\)/gi,
      "",
    )
    .replace(
      /\b(?:Ayon\s+sa|Under|Sa\s+ilalim\s+ng|According\s+to|Per)\s+(?:the\s+)?(?:EARIST\s+Graduate\s+School\s+)?(?:Manual\s+of\s+Operations\s+)?(?:Manual\s+)?Sec(?:tion)?s?\.?\s*\d+(?:\.\d+)*(?:\s*(?:–|-|,|at|and|to)\s*\d+(?:\.\d+)*)*\s*[:,]?\s*/gi,
      "",
    )
    .replace(
      /\b(?:ayon\s+sa|sa\s+ilalim\s+ng)\s+Manual\s+of\s+Operations\s*[:,]?\s*/gi,
      "",
    )
    .replace(
      /\b(?:Manual\s+)?Sec(?:tion)?s?\.?\s*\d+(?:\.\d+)*(?:\s*(?:–|-|,|at|and|to)\s*\d+(?:\.\d+)*)*\s*[:\-–]?\s*/gi,
      "",
    )
    .replace(/\bCMO\s*No\.?\s*\d+(?:,\s*s\.?\s*\d+)?\s*[:,]?\s*/gi, "");

  cleaned = cleaned
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+([.,:;?])/g, "$1")
    .trim();

  cleaned = cleaned.replace(
    /(^|\n|:\s+)([a-z])/g,
    (_, prefix: string, ch: string) => `${prefix}${ch.toUpperCase()}`,
  );

  return cleaned;
}

export function getIdentityReply(
  language: QueryLanguage,
  activeRole?: string,
  userContext?: UserLiveStateContext,
): string {
  const roleLabel = normalizeKnowledgeRole(activeRole);
  const pageHint = userContext?.pageTitle
    ? ` Kasalukuyan kang nasa ${userContext.pageTitle}.`
    : "";
  const pageHintEn = userContext?.pageTitle
    ? ` You are currently on ${userContext.pageTitle}.`
    : "";

  if (language === "tl" || language === "taglish") {
    return `Ako ang EARIST Graduate School Assistant, ang official virtual guide ng system para sa admissions, academic policies, thesis process, at portal navigation${roleLabel ? ` (${roleLabel} view)` : ""}.${pageHint} Ano ang maitutulong ko sa inquiry mo ngayon?`;
  }
  return `I am the EARIST Graduate School Assistant, your virtual office guide for Graduate School admissions, policies, thesis procedures, and portal navigation${roleLabel ? ` (${roleLabel} view)` : ""}.${pageHintEn} How can I help you today?`;
}

export function getGreetingReply(
  language: QueryLanguage,
  activeRole?: string,
): string {
  const roleLabel = normalizeKnowledgeRole(activeRole);
  if (language === "tl" || language === "taglish") {
    return `Kumusta! Ako ang EARIST Graduate School Assistant${roleLabel ? ` (${roleLabel} view)` : ""}. Maaari kang magtanong sa English, Tagalog, o Taglish tungkol sa admissions, academic policies, thesis process, o paggamit ng portal.`;
  }
  return `Hello! I'm the EARIST Graduate School Assistant${roleLabel ? ` (${roleLabel} view)` : ""}. You can ask me in English, Tagalog, or Taglish about admissions, academic policies, thesis procedures, or navigating the portal.`;
}

export function getOutOfScopeFallbackReply(language: QueryLanguage): string {
  if (language === "tl" || language === "taglish") {
    return `Paumanhin, pero labas sa impormasyon ng EARIST Graduate School at ng portal na ito ang iyong tanong.\n\nMaaari kang magtanong tungkol sa admissions, programs, academic policies, thesis process, o kung paano gamitin ang portal. Para sa iba pang concerns, makipag-ugnayan sa ${CANONICAL_GS_EMAIL} o ${CANONICAL_GS_PHONE}.`;
  }
  return `I'm sorry, but that question is outside the official EARIST Graduate School guidelines and portal information.\n\nPlease ask about Graduate School admissions, programs, academic policies, thesis procedures, or portal navigation. For other inquiries, please contact the Graduate School Office at ${CANONICAL_GS_EMAIL} or ${CANONICAL_GS_PHONE}.`;
}

/**
 * Deterministic RAG fallback synthesizer used when DEEPSEEK_API_KEY is not configured
 * or when the external DeepSeek API times out or hits rate limits.
 */
export function buildGroundedResponseFallback(
  retrieval: RetrievalResult,
  activeRole?: string,
  userContext?: UserLiveStateContext,
): {
  reply: string;
  citations: string[];
  relatedRoutes: RelatedRoute[];
} {
  if (retrieval.isGreeting) {
    return {
      reply: getGreetingReply(retrieval.language, activeRole),
      citations: [],
      relatedRoutes: [],
    };
  }

  if (retrieval.isConversational && retrieval.conversationalReply) {
    return {
      reply: retrieval.conversationalReply,
      citations: [],
      relatedRoutes: [],
    };
  }

  if (retrieval.isIdentityQuery) {
    return {
      reply: getIdentityReply(retrieval.language, activeRole, userContext),
      citations: [],
      relatedRoutes: [],
    };
  }

  if (retrieval.isOutOfScope || retrieval.hits.length === 0) {
    return {
      reply: getOutOfScopeFallbackReply(retrieval.language),
      citations: [],
      relatedRoutes: [{ label: "System FAQ", href: "/faq" }],
    };
  }

  const useTagalog =
    retrieval.language === "tl" || retrieval.language === "taglish";

  const primary = retrieval.hits[0];
  const secondary = retrieval.hits[1];

  // Include secondary hit only if it belongs to the exact same category, clears high confidence, and closely matches primary
  const includeSecondary =
    secondary &&
    secondary.chunk.id !== primary.chunk.id &&
    secondary.chunk.category === primary.chunk.category &&
    secondary.score >= 0.42 &&
    secondary.score >= primary.score * 0.85;

  const primaryAnswer = useTagalog
    ? primary.chunk.answerTl
    : primary.chunk.answerEn;

  const replyParts: string[] = [];

  // Prepend live portal/status note only when a logged-in portal user asks about their own active status or current page
  const portalRole = normalizeKnowledgeRole(activeRole);
  const isPortalRole =
    portalRole === "student" ||
    portalRole === "applicant" ||
    portalRole === "faculty" ||
    portalRole === "admin";
  const isPersonalStatusQuery =
    /\b(my\s+(?:current|thesis|dissertation|defense|adviser|stage|step|progress|status|exam|cor|pending)|status\s+ko|stage\s+ko|step\s+ko|adviser\s+ko|title\s+ko|nasaa?n\s+na\s+ako|anong\s+stage\s+ko|this\s+page|ditong\s+page)\b/i.test(
      retrieval.query,
    );
  if (isPortalRole && isPersonalStatusQuery && userContext?.pageTitle) {
    const statusNote = userContext.activeStatusSummary
      ? ` (${userContext.activeStatusSummary})`
      : "";
    replyParts.push(
      useTagalog
        ? `Base sa kasalukuyan mong account sa ${userContext.pageTitle}${statusNote}:`
        : `Based on your current account on ${userContext.pageTitle}${statusNote}:`,
    );
    if (userContext.liveDetailsSummary) {
      replyParts.push(userContext.liveDetailsSummary);
    }
  }

  replyParts.push(primaryAnswer);
  const routeMap = new Map<string, RelatedRoute>();

  for (const r of primary.chunk.relatedRoutes) {
    routeMap.set(r.href, r);
  }

  if (includeSecondary) {
    const secAnswer = useTagalog
      ? secondary.chunk.answerTl
      : secondary.chunk.answerEn;
    replyParts.push(secAnswer);
    for (const r of secondary.chunk.relatedRoutes) {
      if (!routeMap.has(r.href)) {
        routeMap.set(r.href, r);
      }
    }
  }

  return {
    reply: cleanAssistantReply(replyParts.join("\n\n")),
    citations: [],
    relatedRoutes: Array.from(routeMap.values()).slice(0, 3),
  };
}

export function getKnowledgeBaseStats() {
  return {
    totalChunks: KNOWLEDGE_CHUNKS.length,
    categories: Array.from(new Set(KNOWLEDGE_CHUNKS.map((c) => c.category))),
  };
}
