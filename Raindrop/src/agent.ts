import { Ai } from "@liquidmetal-ai/raindrop-framework";
const SYSTEM_PROMPT = `
You are a startup perks assistant.

Rules you MUST follow:
- You do NOT invent perks.
- You ONLY reason about information given by the user or provided to you.
- If required information is missing, you ask ONE clear follow-up question.
- Do NOT ask multiple questions at once.
- Do NOT recommend perks unless explicitly told that perk data is available.

Your goal is to:
1. Understand the user's startup.
2. Collect missing required information.
3. When enough information exists, indicate readiness to query perks.

Required information checklist:
- startup_stage
- cloud_or_stack
- primary_goal (credits or discounts)
- startup_type_or_industry

When responding, always output JSON ONLY in this format:

{
  "action": "ask_question" | "ready",
  "question": string | null,
  "extracted": {
    "startup_stage": string | null,
    "cloud_or_stack": string | null,
    "primary_goal": string | null,
    "startup_type_or_industry": string | null
  },
  "reply": string
}

Never hallucinate. Never assume. Ask if unsure.
`;
type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function runAgent(
  input: { messages: ChatMessage[] },
  ai: Ai
): Promise<{
  reply: string;
  action: "ask_question" | "ready";
  extracted: {
    startup_stage: string | null;
    cloud_or_stack: string | null;
    primary_goal: string | null;
    startup_type_or_industry: string | null;
  };
}> {
  const res = await ai.run("llama-3.3-70b", {
    model: "llama-3.3-70b",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...input.messages],
    max_tokens: 400,
    temperature: 0.2,
  });

  const raw = res?.choices?.[0]?.message?.content;

  if (!raw) {
    return {
      reply: "I could not understand your request.",
      action: "ask_question",
      extracted: {
        startup_stage: null,
        cloud_or_stack: null,
        primary_goal: null,
        startup_type_or_industry: null,
      },
    };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      reply: "Let me clarify a bit more about your startup.",
      action: "ask_question",
      extracted: {
        startup_stage: null,
        cloud_or_stack: null,
        primary_goal: null,
        startup_type_or_industry: null,
      },
    };
  }

  return {
    reply: parsed.reply ?? "Let me ask you one more thing.",
    action: parsed.action === "ready" ? "ready" : "ask_question",
    extracted: {
      startup_stage: parsed.extracted?.startup_stage ?? null,
      cloud_or_stack: parsed.extracted?.cloud_or_stack ?? null,
      primary_goal: parsed.extracted?.primary_goal ?? null,
      startup_type_or_industry:
        parsed.extracted?.startup_type_or_industry ?? null,
    },
  };
}

const PERK_ANALYSIS_PROMPT = `
You are a startup perks analyst.

Rules:
- You ONLY analyze perks provided to you.
- You do NOT invent perks.
- You MAY use conservative default assumptions when dollar values are missing.
- You MUST clearly state all assumptions in notes.
- If a perk gives a percentage but no baseline, assume a SMALL startup baseline.
- If AWS credits are mentioned, assume $1,000 unless otherwise stated.
- If a discount percentage is given, assume a $100 to $300 monthly tool spend.
- Always return numeric estimates when perks exist.
- Always include the original perk link exactly as provided.
- Never modify, shorten, or invent links.

Assumption defaults (use unless startup data says otherwise):
- Monthly cloud spend: $300
- Monthly tools spend: $200
- Runway burn: $3,000 per month

You will receive:
1. Startup info
2. A list of perks (JSON)

You must output JSON ONLY in this format:

{
  "summary": {
    "total_estimated_savings_usd": number,
    "estimated_runway_extension_months": number,
    "notes": string
  },
  "perks": [
    {
      "name": string,
      "company": string,
      "benefit": string,
      "estimated_value_usd": number,
      "why_it_matters": string,
      "link": string
    }
  ]
}

Never hallucinate perk names. Never omit numbers when perks exist.
`;

export async function analyzePerksWithAI(
  ai: Ai,
  startupInfo: any,
  perks: any[]
) {
  const res = await ai.run("llama-3.3-70b", {
    model: "llama-3.3-70b",
    messages: [
      { role: "system", content: PERK_ANALYSIS_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          startup: startupInfo,
          perks,
        }),
      },
    ],
    temperature: 0.1,
    max_tokens: 600,
  });

  const raw = res?.choices?.[0]?.message?.content;
  console.log("perks are ", perks);

  if (!raw) return null;

  try {
    const cleaned = raw.trim();

    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1) {
      console.log("INVALID ANALYSIS OUTPUT:", raw);
      return null;
    }

    return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    console.log("ANALYSIS PARSE ERROR:", err);
    console.log("RAW OUTPUT:", raw);
    return null;
  }
}

// export async function buildSmartQuery(
//   extracted: {
//     startup_stage: string | null;
//     cloud_or_stack: string | null;
//     primary_goal: string | null;
//     startup_type_or_industry: string | null;
//   },
//   ai: Ai
// ): Promise<string> {
//   const PROMPT = `
// You output AT MOST 3 product or platform NAMES.

// Rules:
// - Output ONLY names separated by spaces
// - NO adjectives
// - NO categories
// - NO startup stage
// - NO industry words
// - NO punctuation
// - Lowercase only

// Good outputs:
// "aws"
// "github"
// "aws github"
// "notion stripe"
// "vercel supabase"
// `;

//   try {
//     const res = await ai.run("llama-3.3-70b", {
//       model: "llama-3.3-70b",
//       messages: [
//         { role: "system", content: PROMPT },
//         {
//           role: "user",
//           content: JSON.stringify({
//             cloud_or_stack: extracted.cloud_or_stack,
//             primary_goal: extracted.primary_goal,
//           }),
//         },
//       ],
//       temperature: 0,
//       max_tokens: 15,
//     });

//     const text = res?.choices?.[0]?.message?.content;

//     if (text) {
//       const cleaned = text
//         .toLowerCase()
//         .replace(/[^a-z0-9\s]/g, "")
//         .split(/\s+/)
//         .slice(0, 3)
//         .join(" ");

//       if (cleaned.length > 0) return cleaned;
//     }
//   } catch (err) {
//     console.log("Smart query LLM failed, using fallback", err);
//   }

//   // deterministic fallback
//   const tokens: string[] = [];

//   const stack = (extracted.cloud_or_stack || "").toLowerCase();

//   if (stack.includes("aws")) tokens.push("aws");
//   if (stack.includes("gcp")) tokens.push("gcp");
//   if (stack.includes("azure")) tokens.push("azure");
//   if (stack.includes("github")) tokens.push("github");
//   if (stack.includes("notion")) tokens.push("notion");
//   if (stack.includes("vercel")) tokens.push("vercel");
//   if (stack.includes("stripe")) tokens.push("stripe");

//   return tokens.slice(0, 3).join(" ");
// }
export async function buildSmartQuery(
  extracted: {
    startup_stage: string | null;
    cloud_or_stack: string | null;
    primary_goal: string | null;
    startup_type_or_industry: string | null;
  },
  ai: Ai
): Promise<string[]> {
  const PROMPT = `
You extract up to 3 technology or platform names.

Rules:
- Output ONLY a JSON array of strings
- Max 3 items
- Lowercase
- No sentences
- No stages, no industries, no goals
- Examples of valid outputs:
  ["aws"]
  ["aws", "github"]
  ["stripe", "vercel"]
- If unsure, output an empty array []

Input will be structured startup data.
`;

  try {
    const res = await ai.run("llama-3.3-70b", {
      model: "llama-3.3-70b",
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: JSON.stringify(extracted) },
      ],
      temperature: 0,
      max_tokens: 80,
    });

    const raw = res?.choices?.[0]?.message?.content;
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((v) => typeof v === "string")
        .slice(0, 3)
        .map((v) => v.toLowerCase().trim());
    }
  } catch (e) {
    console.log("buildSmartQuery failed", e);
  }

  return [];
}
