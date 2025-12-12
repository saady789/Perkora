import { Service } from "@liquidmetal-ai/raindrop-framework";
import { Env } from "./raindrop.gen";
import { runAgent, analyzePerksWithAI, buildSmartQuery } from "../agent";
import { Ai } from "@liquidmetal-ai/raindrop-framework";
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/getallperks" && request.method === "GET") {
      const result = await this.env.PERKS_DB.executeQuery({
        sqlQuery: "SELECT * FROM perks;",
        format: "json",
      });

      return Response.json({
        success: true,
        data: result.results ? JSON.parse(result.results) : [],
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
        format: "json",
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
        format: "json",
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

  private async addPerk(request: Request): Promise<Response> {
    try {
      const perkData = (await request.json()) as {
        name: string;
        company: string;
        description?: string;
        benefit_type?: string;
        discount?: string;
        link: string;
        category?: string;
        eligibility?: string;
      };

      const esc = (v?: string) => (v ? v.replace(/'/g, "''") : null);

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
        format: "json",
      });

      return Response.json({
        success: true,
        message: "Perk added successfully",
        result,
      });
    } catch (error: any) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
  }

  private async handleAgent(request: Request): Promise<Response> {
    try {
      const body: any = await request.json();

      if (!body || !Array.isArray(body.messages)) {
        return Response.json(
          { success: false, error: "messages array required" },
          { status: 400 }
        );
      }

      const result = await runAgent({ messages: body.messages }, this.env.AI);

      // Still collecting info
      if (result.action === "ask_question") {
        return Response.json({
          success: true,
          action: "ask_question",
          reply: result.reply,
        });
      }

      // ===== READY STATE =====

      // buildSmartQuery now returns tokens
      const tokens = await buildSmartQuery(result.extracted, this.env.AI);
      console.log("TOKENS:", tokens);

      let perks: any[] = [];

      if (tokens.length > 0) {
        const likeClauses = tokens
          .map(
            (t) => `
            name LIKE '%${t}%' OR
            company LIKE '%${t}%' OR
            description LIKE '%${t}%' OR
            benefit_type LIKE '%${t}%' OR
            category LIKE '%${t}%'
          `
          )
          .join(" OR ");

        const sql = `
        SELECT *
        FROM perks
        WHERE ${likeClauses}
        ORDER BY created_at DESC;
      `;

        const res = await this.env.PERKS_DB.executeQuery({
          sqlQuery: sql,
          format: "json",
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
        reply:
          perks.length > 0
            ? "Here are relevant perks for your startup."
            : "No matching perks found yet.",
        perks,
        analysis,
      });
    } catch (err: any) {
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

  private async queryPerks(request: Request): Promise<Response> {
    try {
      const body: any = await request.json();

      if (!body || typeof body.text !== "string") {
        return Response.json(
          { success: false, error: "text field required as string" },
          { status: 400 }
        );
      }

      const userText = body.text.trim();

      // First try SmartSQL (semantic search)
      let smartRows: any[] = [];
      try {
        const smart = await this.env.PERKS_DB.executeQuery({
          textQuery: userText,
          format: "json",
        });

        smartRows = smart.results ? JSON.parse(smart.results) : [];
      } catch (_) {
        smartRows = [];
      }

      // If SmartSQL returned results, use them
      if (smartRows.length > 0) {
        return Response.json({
          success: true,
          mode: "smart",
          query: userText,
          count: smartRows.length,
          data: smartRows,
        });
      }

      // Manual SQL fallback
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
        format: "json",
      });

      const rows = fallback.results ? JSON.parse(fallback.results) : [];

      return Response.json({
        success: true,
        mode: "fallback",
        query: userText,
        count: rows.length,
        data: rows,
      });
    } catch (err: any) {
      return Response.json(
        { success: false, error: err.message },
        { status: 500 }
      );
    }
  }

  private async addPerksBatch(request: Request): Promise<Response> {
    try {
      type PerkInput = {
        name: string;
        company: string;
        description?: string;
        benefit_type?: string;
        discount?: string;
        link: string;
        category?: string;
        eligibility?: string;
      };

      const perksData = (await request.json()) as PerkInput[];

      if (!Array.isArray(perksData)) {
        return Response.json(
          { success: false, error: "Data must be an array of perks" },
          { status: 400 }
        );
      }

      const escape = (str: any) =>
        str ? str.toString().replace(/'/g, "''") : null;

      const insertedRows: any[] = [];

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
          format: "json",
        });

        const rows = res.results ? JSON.parse(res.results) : [];
        if (rows.length > 0) {
          insertedRows.push(rows[0]);
        }
      }

      return Response.json({
        success: true,
        message: `${insertedRows.length} perks added successfully`,
        insertedRows,
      });
    } catch (err: any) {
      return Response.json(
        { success: false, error: err.message },
        { status: 400 }
      );
    }
  }

  private async testInsert(): Promise<Response> {
    try {
      // Try simple insert without special characters
      const result = await this.env.PERKS_DB.executeQuery({
        sqlQuery:
          "INSERT INTO perks (name, company, link) VALUES ('Test', 'Test Co', 'test.com')",
        format: "json",
      });

      return Response.json({
        success: true,
        message: "Test insert worked",
        result,
      });
    } catch (error: any) {
      return Response.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }
  }

  private async getStatus(): Promise<Response> {
    return Response.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: "connected",
      version: "1.0.0",
    });
  }
}
