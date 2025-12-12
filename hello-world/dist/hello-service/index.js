globalThis.__RAINDROP_GIT_COMMIT_SHA = "unknown"; 

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
