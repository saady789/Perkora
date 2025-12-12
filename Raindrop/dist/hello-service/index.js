globalThis.__RAINDROP_GIT_COMMIT_SHA = "aa814552ea1f4d62536618e7355ca6c823e5eaec"; 

// node_modules/@liquidmetal-ai/raindrop-framework/dist/core/cors.js
var matchOrigin = (request, env, config) => {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) {
    return null;
  }
  const { origin } = config;
  if (origin === "*") {
    return "*";
  }
  if (typeof origin === "function") {
    return origin(request, env);
  }
  if (typeof origin === "string") {
    return requestOrigin === origin ? origin : null;
  }
  if (Array.isArray(origin)) {
    return origin.includes(requestOrigin) ? requestOrigin : null;
  }
  return null;
};
var addCorsHeaders = (response, request, env, config) => {
  const allowedOrigin = matchOrigin(request, env, config);
  if (!allowedOrigin) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  if (config.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  if (config.exposeHeaders && config.exposeHeaders.length > 0) {
    headers.set("Access-Control-Expose-Headers", config.exposeHeaders.join(", "));
  }
  const vary = headers.get("Vary");
  if (vary) {
    if (!vary.includes("Origin")) {
      headers.set("Vary", `${vary}, Origin`);
    }
  } else {
    headers.set("Vary", "Origin");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
};
var handlePreflight = (request, env, config) => {
  const allowedOrigin = matchOrigin(request, env, config);
  if (!allowedOrigin) {
    return new Response(null, { status: 403 });
  }
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  if (config.credentials) {
    headers.set("Access-Control-Allow-Credentials", "true");
  }
  const allowMethods = config.allowMethods || ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"];
  headers.set("Access-Control-Allow-Methods", allowMethods.join(", "));
  const allowHeaders = config.allowHeaders || ["Content-Type", "Authorization"];
  headers.set("Access-Control-Allow-Headers", allowHeaders.join(", "));
  const maxAge = config.maxAge ?? 86400;
  headers.set("Access-Control-Max-Age", maxAge.toString());
  headers.set("Vary", "Origin");
  return new Response(null, {
    status: 204,
    headers
  });
};
var createCorsHandler = (config) => {
  return (request, env, response) => {
    if (!response) {
      return handlePreflight(request, env, config);
    }
    return addCorsHeaders(response, request, env, config);
  };
};
var corsAllowAll = createCorsHandler({
  origin: "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true
});

// src/_app/cors.ts
var cors = corsAllowAll;

// src/hello-service/index.ts
import { Service } from "./runtime.js";

// src/agent.ts
var SYSTEM_PROMPT = `
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
async function runAgent(input, ai) {
  const res = await ai.run("llama-3.3-70b", {
    model: "llama-3.3-70b",
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...input.messages],
    max_tokens: 400,
    temperature: 0.2
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
        startup_type_or_industry: null
      }
    };
  }
  let parsed;
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
        startup_type_or_industry: null
      }
    };
  }
  return {
    reply: parsed.reply ?? "Let me ask you one more thing.",
    action: parsed.action === "ready" ? "ready" : "ask_question",
    extracted: {
      startup_stage: parsed.extracted?.startup_stage ?? null,
      cloud_or_stack: parsed.extracted?.cloud_or_stack ?? null,
      primary_goal: parsed.extracted?.primary_goal ?? null,
      startup_type_or_industry: parsed.extracted?.startup_type_or_industry ?? null
    }
  };
}
var PERK_ANALYSIS_PROMPT = `
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
async function analyzePerksWithAI(ai, startupInfo, perks) {
  const res = await ai.run("llama-3.3-70b", {
    model: "llama-3.3-70b",
    messages: [
      { role: "system", content: PERK_ANALYSIS_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          startup: startupInfo,
          perks
        })
      }
    ],
    temperature: 0.1,
    max_tokens: 600
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
async function buildSmartQuery(extracted, ai) {
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
        { role: "user", content: JSON.stringify(extracted) }
      ],
      temperature: 0,
      max_tokens: 80
    });
    const raw = res?.choices?.[0]?.message?.content;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((v) => typeof v === "string").slice(0, 3).map((v) => v.toLowerCase().trim());
    }
  } catch (e) {
    console.log("buildSmartQuery failed", e);
  }
  return [];
}

// src/hello-service/index.ts
var hello_service_default = class extends Service {
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === "/api/getallperks" && request.method === "GET") {
      const result = await this.env.PERKS_DB.executeQuery({
        sqlQuery: "SELECT * FROM perks;",
        format: "json"
      });
      return Response.json({
        success: true,
        data: result.results ? JSON.parse(result.results) : []
      });
    }
    if (url.pathname === "/api/perks/query" && request.method === "POST") {
      return this.queryPerks(request);
    }
    if (url.pathname === "/api/agent" && request.method === "POST") {
      return this.handleAgent(request);
    }
    if (url.pathname === "/api/debug-schema") {
      const result = await this.env.PERKS_DB.executeQuery({
        sqlQuery: "PRAGMA table_info(perks);",
        format: "json"
      });
      return Response.json({ result });
    }
    if (url.pathname === "/api/init-perks-db" && request.method === "GET") {
      const result = await this.env.PERKS_DB.executeQuery({
        sqlQuery: `
      CREATE TABLE IF NOT EXISTS perks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          company TEXT NOT NULL,
          description TEXT,
          benefit_type TEXT,
          discount TEXT,
          link TEXT NOT NULL,
          category TEXT,
          eligibility TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_perks_company ON perks(company);
      CREATE INDEX IF NOT EXISTS idx_perks_category ON perks(category);

      CREATE TRIGGER IF NOT EXISTS update_perks_timestamp 
      AFTER UPDATE ON perks
      BEGIN
          UPDATE perks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END;
    `,
        format: "json"
      });
      return Response.json({ success: true, result });
    }
    if (url.pathname === "/test" && request.method === "GET") {
      return this.testInsert();
    }
    if (url.pathname === "/api/perks" && request.method === "POST") {
      return this.addPerk(request);
    }
    if (url.pathname === "/api/perks/batch" && request.method === "POST") {
      return this.addPerksBatch(request);
    }
    if (url.pathname === "/status" && request.method === "GET") {
      return this.getStatus();
    }
    if (url.pathname === "/" && request.method === "GET") {
      return new Response("Startup Perks API running", { status: 200 });
    }
    return new Response("Invalid route");
  }
  async addPerk(request) {
    try {
      const perkData = await request.json();
      const esc = (v) => v ? v.replace(/'/g, "''") : null;
      const sql = `
      INSERT INTO perks
      (name, company, description, benefit_type, discount, link, category, eligibility)
      VALUES (
        '${esc(perkData.name)}',
        '${esc(perkData.company)}',
        '${esc(perkData.description)}',
        '${esc(perkData.benefit_type)}',
        '${esc(perkData.discount)}',
        '${esc(perkData.link)}',
        '${esc(perkData.category)}',
        '${esc(perkData.eligibility)}'
      );
    `;
      const result = await this.env.PERKS_DB.executeQuery({
        sqlQuery: sql,
        format: "json"
      });
      return Response.json({
        success: true,
        message: "Perk added successfully",
        result
      });
    } catch (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
  }
  async handleAgent(request) {
    try {
      const body = await request.json();
      if (!body || !Array.isArray(body.messages)) {
        return Response.json(
          { success: false, error: "messages array required" },
          { status: 400 }
        );
      }
      const result = await runAgent({ messages: body.messages }, this.env.AI);
      if (result.action === "ask_question") {
        return Response.json({
          success: true,
          action: "ask_question",
          reply: result.reply
        });
      }
      const tokens = await buildSmartQuery(result.extracted, this.env.AI);
      console.log("TOKENS:", tokens);
      let perks = [];
      if (tokens.length > 0) {
        const likeClauses = tokens.map(
          (t) => `
            name LIKE '%${t}%' OR
            company LIKE '%${t}%' OR
            description LIKE '%${t}%' OR
            benefit_type LIKE '%${t}%' OR
            category LIKE '%${t}%'
          `
        ).join(" OR ");
        const sql = `
        SELECT *
        FROM perks
        WHERE ${likeClauses}
        ORDER BY created_at DESC;
      `;
        const res = await this.env.PERKS_DB.executeQuery({
          sqlQuery: sql,
          format: "json"
        });
        perks = res.results ? JSON.parse(res.results) : [];
      }
      let analysis = null;
      if (perks.length > 0) {
        analysis = await analyzePerksWithAI(
          this.env.AI,
          result.extracted,
          perks
        );
      }
      return Response.json({
        success: true,
        action: "ready",
        reply: perks.length > 0 ? "Here are relevant perks for your startup." : "No matching perks found yet.",
        perks,
        analysis
      });
    } catch (err) {
      return Response.json(
        { success: false, error: err.message },
        { status: 500 }
      );
    }
  }
  // private buildSmartQuery(extracted: {
  //   startup_stage: string | null;
  //   cloud_or_stack: string | null;
  //   primary_goal: string | null;
  //   startup_type_or_industry: string | null;
  // }) {
  //   const tokens: string[] = [];
  //   if (extracted.startup_type_or_industry)
  //     tokens.push(extracted.startup_type_or_industry);
  //   if (extracted.cloud_or_stack) tokens.push(extracted.cloud_or_stack);
  //   if (extracted.primary_goal) tokens.push(extracted.primary_goal);
  //   if (extracted.startup_stage) tokens.push(extracted.startup_stage);
  //   return tokens
  //     .join(" ")
  //     .replace(/[^a-zA-Z0-9\s]/g, "")
  //     .toLowerCase()
  //     .trim();
  // }
  async queryPerks(request) {
    try {
      const body = await request.json();
      if (!body || typeof body.text !== "string") {
        return Response.json(
          { success: false, error: "text field required as string" },
          { status: 400 }
        );
      }
      const userText = body.text.trim();
      let smartRows = [];
      try {
        const smart = await this.env.PERKS_DB.executeQuery({
          textQuery: userText,
          format: "json"
        });
        smartRows = smart.results ? JSON.parse(smart.results) : [];
      } catch (_) {
        smartRows = [];
      }
      if (smartRows.length > 0) {
        return Response.json({
          success: true,
          mode: "smart",
          query: userText,
          count: smartRows.length,
          data: smartRows
        });
      }
      const esc = userText.replace(/'/g, "''");
      const sql = `
      SELECT *
      FROM perks
      WHERE
        name LIKE '%${esc}%' OR
        company LIKE '%${esc}%' OR
        description LIKE '%${esc}%' OR
        benefit_type LIKE '%${esc}%' OR
        discount LIKE '%${esc}%' OR
        category LIKE '%${esc}%' OR
        eligibility LIKE '%${esc}%'
      ORDER BY created_at DESC;
    `;
      const fallback = await this.env.PERKS_DB.executeQuery({
        sqlQuery: sql,
        format: "json"
      });
      const rows = fallback.results ? JSON.parse(fallback.results) : [];
      return Response.json({
        success: true,
        mode: "fallback",
        query: userText,
        count: rows.length,
        data: rows
      });
    } catch (err) {
      return Response.json(
        { success: false, error: err.message },
        { status: 500 }
      );
    }
  }
  async addPerksBatch(request) {
    try {
      const perksData = await request.json();
      if (!Array.isArray(perksData)) {
        return Response.json(
          { success: false, error: "Data must be an array of perks" },
          { status: 400 }
        );
      }
      const escape = (str) => str ? str.toString().replace(/'/g, "''") : null;
      const insertedRows = [];
      for (const perk of perksData) {
        const res = await this.env.PERKS_DB.executeQuery({
          sqlQuery: `
          INSERT INTO perks 
          (name, company, description, benefit_type, discount, link, category, eligibility)
          VALUES (
            '${escape(perk.name)}',
            '${escape(perk.company)}',
            '${escape(perk.description)}',
            '${escape(perk.benefit_type)}',
            '${escape(perk.discount)}',
            '${escape(perk.link)}',
            '${escape(perk.category)}',
            '${escape(perk.eligibility)}'
          )
          RETURNING *;
        `,
          format: "json"
        });
        const rows = res.results ? JSON.parse(res.results) : [];
        if (rows.length > 0) {
          insertedRows.push(rows[0]);
        }
      }
      return Response.json({
        success: true,
        message: `${insertedRows.length} perks added successfully`,
        insertedRows
      });
    } catch (err) {
      return Response.json(
        { success: false, error: err.message },
        { status: 400 }
      );
    }
  }
  async testInsert() {
    try {
      const result = await this.env.PERKS_DB.executeQuery({
        sqlQuery: "INSERT INTO perks (name, company, link) VALUES ('Test', 'Test Co', 'test.com')",
        format: "json"
      });
      return Response.json({
        success: true,
        message: "Test insert worked",
        result
      });
    } catch (error) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
  }
  async getStatus() {
    return Response.json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      database: "connected",
      version: "1.0.0"
    });
  }
};

// <stdin>
var stdin_default = hello_service_default;
export {
  cors,
  stdin_default as default
};
