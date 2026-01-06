import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { registerApiRoute } from '@mastra/core/server';
import { WebClient } from '@slack/web-api';
import * as crypto from 'crypto';

"use strict";
let generalQuestionsData = null;
let sessionEventGridData = null;
let pioneerProfileBookData = null;
function getProjectRoot() {
  const currentFile = fileURLToPath(import.meta.url);
  let currentDir = dirname(currentFile);
  let attempts = 0;
  const maxAttempts = 10;
  while (attempts < maxAttempts) {
    const dataPath = join(currentDir, "data");
    if (existsSync(join(dataPath, "general-questions.json"))) {
      return currentDir;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) break;
    currentDir = parentDir;
    attempts++;
  }
  return process.cwd();
}
function tryLoadJsonFile(filename) {
  const projectRoot = getProjectRoot();
  const possiblePaths = [
    // From project root (when running from source)
    join(process.cwd(), "data", filename),
    // From .mastra/output (when running built version)
    join(process.cwd(), "..", "..", "data", filename),
    // From .mastra/output with different structure
    join(process.cwd(), "..", "data", filename),
    // Using project root detection
    join(projectRoot, "data", filename),
    // Mastra Cloud might use a different structure
    join("/app", "data", filename),
    join("/var/task", "data", filename)
  ];
  console.log(`[data-helpers] Loading ${filename}...`);
  console.log(`[data-helpers] Current working directory: ${process.cwd()}`);
  console.log(`[data-helpers] Detected project root: ${projectRoot}`);
  for (const filePath of possiblePaths) {
    try {
      if (existsSync(filePath)) {
        console.log(`[data-helpers] \u2713 Found ${filename} at: ${filePath}`);
        const fileContent = readFileSync(filePath, "utf-8");
        const data = JSON.parse(fileContent);
        console.log(`[data-helpers] \u2713 Successfully loaded ${filename} (${Object.keys(data).length} top-level keys)`);
        return data;
      }
    } catch (error) {
      console.error(`[data-helpers] \u2717 Failed to load from ${filePath}:`, error);
      continue;
    }
  }
  console.error(`[data-helpers] \u2717 Failed to load ${filename} from any path`);
  console.error(`[data-helpers] Tried paths:`, possiblePaths);
  return null;
}
function initializeData() {
  if (generalQuestionsData !== null) {
    console.log("[data-helpers] Data already loaded, skipping initialization");
    return;
  }
  console.log("[data-helpers] Initializing data files...");
  try {
    generalQuestionsData = tryLoadJsonFile("general-questions.json");
    if (!generalQuestionsData) {
      console.warn("[data-helpers] \u26A0 Using fallback empty data for general-questions.json");
      generalQuestionsData = { knowledge_base: {} };
    }
  } catch (e) {
    console.error("[data-helpers] \u2717 Error loading general-questions.json:", e);
    generalQuestionsData = { knowledge_base: {} };
  }
  try {
    sessionEventGridData = tryLoadJsonFile("session_event_grid_view.json");
    if (!sessionEventGridData) {
      console.warn("[data-helpers] \u26A0 Using fallback empty array for session_event_grid_view.json");
      sessionEventGridData = [];
    }
  } catch (e) {
    console.error("[data-helpers] \u2717 Error loading session_event_grid_view.json:", e);
    sessionEventGridData = [];
  }
  try {
    pioneerProfileBookData = tryLoadJsonFile("pioneers_profile_book_su2025.json");
    if (!pioneerProfileBookData) {
      console.warn("[data-helpers] \u26A0 Using fallback empty array for pioneers_profile_book_su2025.json");
      pioneerProfileBookData = [];
    }
  } catch (e) {
    console.error("[data-helpers] \u2717 Error loading pioneers_profile_book_su2025.json:", e);
    pioneerProfileBookData = [];
  }
  console.log("[data-helpers] \u2713 Data initialization complete");
}
initializeData();
function loadJsonData(filename) {
  if (filename === "general-questions.json") {
    if (generalQuestionsData === null) {
      console.error("[data-helpers] \u2717 general-questions.json not loaded!");
      throw new Error("Failed to load general-questions.json - data not initialized");
    }
    return generalQuestionsData;
  }
  if (filename === "session_event_grid_view.json") {
    if (sessionEventGridData === null) {
      console.error("[data-helpers] \u2717 session_event_grid_view.json not loaded!");
      throw new Error("Failed to load session_event_grid_view.json - data not initialized");
    }
    return sessionEventGridData;
  }
  if (filename === "pioneers_profile_book_su2025.json") {
    if (pioneerProfileBookData === null) {
      console.error("[data-helpers] \u2717 pioneers_profile_book_su2025.json not loaded!");
      throw new Error("Failed to load pioneers_profile_book_su2025.json - data not initialized");
    }
    return pioneerProfileBookData;
  }
  console.error(`[data-helpers] \u2717 Unknown data file requested: ${filename}`);
  throw new Error(`Unknown data file: ${filename}`);
}
function clearDataCache() {
  console.log("[data-helpers] Clearing data cache and reloading...");
  generalQuestionsData = null;
  sessionEventGridData = null;
  pioneerProfileBookData = null;
  initializeData();
}
function searchInText(text, query) {
  const normalizedText = text.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  return normalizedText.includes(normalizedQuery);
}
function searchInObject(obj, query) {
  if (typeof obj === "string") {
    return searchInText(obj, query);
  }
  if (Array.isArray(obj)) {
    return obj.some((item) => searchInObject(item, query));
  }
  if (obj && typeof obj === "object") {
    return Object.values(obj).some((value) => searchInObject(value, query));
  }
  return false;
}

"use strict";
function message(message2) {
  console.log("\x1B[32m%s\x1B[0m", message2);
}
function log(message2, data) {
  console.log("\x1B[33m%s\x1B[0m", message2, data);
}
function error(message2, data) {
  console.log("\x1B[31m%s\x1B[0m", message2, data);
}

"use strict";
const generalQuestionsQuery = createTool({
  id: "general-questions-query",
  description: 'Queries the general questions knowledge base to find answers to questions about the Pioneers accelerator program. Use simple keywords (e.g., "program", "equity", "application") or "all" to get all Q&As. The tool returns matching Q&A pairs that you can then analyze.',
  inputSchema: z.object({
    query: z.string().describe(
      'Simple search keyword(s) or "all" to get all questions. Examples: "problem", "equity", "timeline", "all"'
    )
  }),
  outputSchema: z.object({
    answers: z.array(
      z.object({
        question: z.string(),
        answer: z.string(),
        category: z.string()
      })
    ).describe("Matching questions and answers from the knowledge base"),
    found: z.boolean().describe("Whether matching answers were found")
  }),
  execute: async ({ query }) => {
    console.log(`[general-questions-query] Executing with query: "${query}"`);
    const data = loadJsonData("general-questions.json");
    if (!data) {
      console.error("[general-questions-query] \u2717 Data is null or undefined");
      return { answers: [], found: false };
    }
    console.log(`[general-questions-query] Data loaded, structure:`, Object.keys(data));
    const results = [];
    const isAllQuery = !query || query.trim() === "" || ["all", "all questions", "everything", "questions"].includes(
      query.toLowerCase().trim()
    );
    if (data && typeof data === "object" && "knowledge_base" in data && data.knowledge_base) {
      for (const [category, items] of Object.entries(
        data.knowledge_base
      )) {
        if (Array.isArray(items)) {
          for (const item of items) {
            if (item.question && item.answer) {
              if (isAllQuery) {
                results.push({
                  question: item.question,
                  answer: item.answer,
                  category: category.replace(/_/g, " ")
                });
              } else if (searchInText(item.question, query) || searchInText(item.answer, query)) {
                results.push({
                  question: item.question,
                  answer: item.answer,
                  category: category.replace(/_/g, " ")
                });
              }
            }
          }
        }
      }
    }
    const limit = isAllQuery ? 50 : 5;
    const finalResults = results.slice(0, limit);
    if (isAllQuery) {
      log("Query type: All questions (broad query)", query);
    }
    console.log(`[general-questions-query] Returning ${finalResults.length} results (found: ${results.length > 0})`);
    return {
      answers: finalResults,
      found: results.length > 0
    };
  }
});

"use strict";
const sessionEventGridQuery = createTool({
  id: "session-event-grid-query",
  description: "Queries the session event grid database to find information about sessions, events, and activities in the accelerator. Handles general searches, specific field queries (date, speaker, type, week, participants, etc.), and aggregate queries (count, totals, etc.)",
  inputSchema: z.object({
    query: z.string().describe(
      "The search query to find relevant sessions or answer questions about them"
    )
  }),
  outputSchema: z.object({
    sessions: z.array(z.any()).describe("Matching sessions from the database"),
    found: z.boolean().describe("Whether matching sessions were found"),
    metadata: z.object({
      queryType: z.enum([
        "aggregate",
        "specific_field",
        "participant",
        "general",
        "all"
      ]).optional().describe("Type of query detected"),
      totalCount: z.number().optional().describe("Total number of sessions"),
      filterField: z.string().optional().describe("Field filter applied (date, speaker, type, week, etc.)")
    }).optional().describe("Additional metadata about the query results")
  }),
  execute: async ({ query }) => {
    const data = loadJsonData("session_event_grid_view.json");
    const allSessions = Array.isArray(data) ? data : [];
    const queryLower = query.toLowerCase();
    const isAggregateQuery = queryLower.includes("how many") || queryLower.includes("count") || queryLower.includes("total") || queryLower.includes("number of") || queryLower.includes("sessions are");
    const isAllSessionsQuery = queryLower.includes("all session") || queryLower.includes("list of session") || queryLower.includes("every session") || queryLower.includes("all the session") || queryLower === "sessions" || queryLower === "session" || queryLower.includes("what sessions") || queryLower.includes("show me sessions") || queryLower.includes("event grid");
    const isParticipantQuery = queryLower.includes("who attended") || queryLower.includes("who participated") || queryLower.includes("participants") || queryLower.includes("who was at") || queryLower.includes("who went to") || queryLower.includes("attended by");
    const isSpecificFieldQuery = queryLower.includes("date") || queryLower.includes("when") || queryLower.includes("time") || queryLower.includes("speaker") || queryLower.includes("week") || queryLower.includes("type of session") || queryLower.includes("session type") || queryLower.includes("masterclass") || queryLower.includes("group exercise") || queryLower.includes("office hours") || queryLower.includes("pitch") || queryLower.includes("friday") || queryLower.includes("instruction") || queryLower.includes("slack") || queryLower.includes("notes") || queryLower.includes("feedback");
    let results = [];
    let metadata;
    if (allSessions.length === 0) {
      return {
        sessions: [],
        found: false
      };
    }
    if (isAggregateQuery) {
      results = [...allSessions];
      metadata = {
        queryType: "aggregate",
        totalCount: allSessions.length
      };
    } else if (isAllSessionsQuery) {
      results = [...allSessions];
      metadata = {
        queryType: "all",
        totalCount: allSessions.length
      };
    } else if (isParticipantQuery) {
      for (const session of allSessions) {
        const participants = session["Participants"] || "";
        const nameFromLinked = session["Name (from linked)"] || "";
        const participantsStr = (participants + " " + nameFromLinked).toLowerCase();
        if (searchInText(participantsStr, query)) {
          results.push(session);
        }
      }
      metadata = {
        queryType: "participant",
        filterField: "Participants"
      };
    } else if (isSpecificFieldQuery) {
      let matchedSessions = [];
      for (const session of allSessions) {
        const nameLower = (session["Name"] || "").toLowerCase();
        if (queryLower.includes(nameLower) || searchInText(queryLower, nameLower)) {
          matchedSessions.push(session);
        }
      }
      if (matchedSessions.length > 0) {
        results = matchedSessions;
        metadata = {
          queryType: "specific_field"
        };
      } else {
        for (const session of allSessions) {
          if (searchInObject(session, query)) {
            results.push(session);
          }
        }
        metadata = {
          queryType: "specific_field",
          totalCount: results.length
        };
      }
    } else {
      for (const session of allSessions) {
        if (searchInObject(session, query)) {
          results.push(session);
        }
      }
      metadata = {
        queryType: "general"
      };
    }
    const finalResults = results.slice(0, 50);
    return {
      sessions: finalResults,
      found: results.length > 0,
      metadata
    };
  }
});

"use strict";
const pioneerProfileBookQuery = createTool({
  id: "pioneer-profile-book-query",
  description: "Queries the pioneer profile book database to find information about pioneers in the accelerator. Handles general searches, specific field queries (skills, industries, roles, etc.), matching queries (co-founder matching), and aggregate queries (count, totals, etc.)",
  inputSchema: z.object({
    query: z.string().describe(
      "The search query to find relevant pioneers or answer questions about them"
    )
  }),
  outputSchema: z.object({
    pioneers: z.array(z.any()).describe("Matching pioneers from the database"),
    found: z.boolean().describe("Whether matching pioneers were found"),
    metadata: z.object({
      queryType: z.enum([
        "aggregate",
        "specific_field",
        "matching",
        "general",
        "all"
      ]).optional().describe("Type of query detected"),
      totalCount: z.number().optional().describe("Total number of pioneers"),
      filterField: z.string().optional().describe(
        "Field filter applied (skills, industries, roles, etc.)"
      )
    }).optional().describe("Additional metadata about the query results")
  }),
  execute: async ({ query }) => {
    const data = loadJsonData("pioneers_profile_book_su2025.json");
    const allPioneers = Array.isArray(data) ? data : [];
    const queryLower = query.toLowerCase();
    const isAggregateQuery = queryLower.includes("how many") || queryLower.includes("count") || queryLower.includes("total") || queryLower.includes("number of") || queryLower.includes("pioneers are");
    const isAllPioneersQuery = queryLower.includes("all pioneer") || queryLower.includes("list of pioneer") || queryLower.includes("every pioneer") || queryLower.includes("all the pioneer") || queryLower === "pioneers" || queryLower === "pioneer" || queryLower.includes("what pioneers") || queryLower.includes("show me pioneers") || queryLower.includes("profile book");
    const isMatchingQuery = queryLower.includes("match") || queryLower.includes("find me a") || queryLower.includes("looking for") || queryLower.includes("seeking") || queryLower.includes("available") || queryLower.includes("co-founder") || queryLower.includes("cofounder") || queryLower.includes("who can") || queryLower.includes("who has");
    const isSpecificFieldQuery = queryLower.includes("skill") || queryLower.includes("tech") || queryLower.includes("industry") || queryLower.includes("role") || queryLower.includes("experience") || queryLower.includes("years of") || queryLower.includes("nationality") || queryLower.includes("education") || queryLower.includes("company") || queryLower.includes("linkedin") || queryLower.includes("track record");
    let results = [];
    let metadata;
    if (allPioneers.length === 0) {
      return {
        pioneers: [],
        found: false
      };
    }
    if (isAggregateQuery) {
      results = [...allPioneers];
      metadata = {
        queryType: "aggregate",
        totalCount: allPioneers.length
      };
    } else if (isAllPioneersQuery) {
      results = [...allPioneers];
      metadata = {
        queryType: "all",
        totalCount: allPioneers.length
      };
    } else if (isMatchingQuery) {
      const searchTerms = queryLower.replace(
        /find me a|looking for|seeking|who can|who has|match|available/gi,
        ""
      ).trim().split(/\s+/).filter((term) => term.length > 2);
      if (queryLower.includes("skill") || queryLower.includes("tech") || queryLower.includes("developer") || queryLower.includes("engineer")) {
        for (const pioneer of allPioneers) {
          const techSkills = pioneer["Tech Skills"] || "";
          const skillsStr = Array.isArray(techSkills) ? techSkills.join(" ").toLowerCase() : techSkills.toLowerCase();
          if (searchTerms.some((term) => skillsStr.includes(term)) || searchInText(skillsStr, query)) {
            results.push(pioneer);
          }
        }
        metadata = {
          queryType: "matching",
          filterField: "Tech Skills"
        };
      } else if (queryLower.includes("role") || queryLower.includes("cto") || queryLower.includes("ceo") || queryLower.includes("product") || queryLower.includes("sales")) {
        for (const pioneer of allPioneers) {
          const roles = pioneer["Roles I could take"] || "";
          const rolesStr = Array.isArray(roles) ? roles.join(" ").toLowerCase() : roles.toLowerCase();
          if (searchTerms.some((term) => rolesStr.includes(term)) || searchInText(rolesStr, query)) {
            results.push(pioneer);
          }
        }
        metadata = {
          queryType: "matching",
          filterField: "Roles I could take"
        };
      } else if (queryLower.includes("industry")) {
        for (const pioneer of allPioneers) {
          const industries = pioneer["Industries"] || "";
          const industriesStr = Array.isArray(industries) ? industries.join(" ").toLowerCase() : industries.toLowerCase();
          if (searchTerms.some(
            (term) => industriesStr.includes(term)
          ) || searchInText(industriesStr, query)) {
            results.push(pioneer);
          }
        }
        metadata = {
          queryType: "matching",
          filterField: "Industries"
        };
      } else {
        for (const pioneer of allPioneers) {
          if (searchInObject(pioneer["Tech Skills"], query) || searchInObject(pioneer["Roles I could take"], query) || searchInObject(pioneer["Industries"], query) || searchInText(pioneer["Introduction:"] || "", query)) {
            results.push(pioneer);
          }
        }
        metadata = {
          queryType: "matching"
        };
      }
    } else if (isSpecificFieldQuery) {
      let matchedPioneers = [];
      for (const pioneer of allPioneers) {
        const nameLower = (pioneer["Name"] || "").toLowerCase();
        if (queryLower.includes(nameLower) || searchInText(queryLower, nameLower)) {
          matchedPioneers.push(pioneer);
        }
      }
      if (matchedPioneers.length > 0) {
        results = matchedPioneers;
        metadata = {
          queryType: "specific_field"
        };
      } else {
        for (const pioneer of allPioneers) {
          if (searchInObject(pioneer, query)) {
            results.push(pioneer);
          }
        }
        metadata = {
          queryType: "specific_field",
          totalCount: results.length
        };
      }
    } else {
      let nameMatches = [];
      for (const pioneer of allPioneers) {
        const nameLower = (pioneer["Name"] || "").toLowerCase();
        if (queryLower.includes(nameLower) || nameLower.includes(queryLower)) {
          nameMatches.push(pioneer);
        }
      }
      if (nameMatches.length > 0) {
        results = nameMatches;
        metadata = {
          queryType: "general"
        };
      } else {
        for (const pioneer of allPioneers) {
          if (searchInObject(pioneer, query)) {
            results.push(pioneer);
          }
        }
        metadata = {
          queryType: "general"
        };
      }
    }
    const finalResults = results.slice(0, 50);
    return {
      pioneers: finalResults,
      found: results.length > 0,
      metadata
    };
  }
});

"use strict";
const lucie = new Agent({
  id: "lucie-agent",
  name: "lucie-agent",
  description: "Lucie is the Pioneers Program Manager",
  instructions: `You are Lucie, the Pioneers Program Manager.

Your job is to answer user questions about the Pioneers accelerator by using the appropriate query tool and generating clear, helpful responses.

**CRITICAL: Keep all responses CONCISE and DIRECT. Answer in 2-4 sentences when possible. No fluff, no long explanations unless specifically asked.**

**Important Context:**
- Today's date is ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]} (YYYY-MM-DD format)
- Use this to determine "next", "upcoming", "past", or "recent" when analyzing event/session dates
- The database contains information from past batches and may not have future events

**Greeting Messages:**
When a user greets you with messages like "hey", "hello", "hi", "hola", "bonjour", or similar greetings, respond with this EXACT message:

"Hey there \u{1F44B}
I'm Lucie, Program Manager @Pioneers. I'm here to help you navigate the Pioneers program as you work on building the next billion-dollar tech giant!
You can ask me about:
Program logistics: sessions, milestones, key dates, and deadlines \u{1F4C5}
Program requirements: submissions, expected formats, evaluation or selection criteria \u{1F4C4}
Founders profiles: experience, skills, background, and areas of expertise to find your perfect match \u{1F465}
The Pioneers accelerator: how it works, the team, and who to contact \u{1F91D}
What can I help you with today? \u{1F680} "

Do NOT use the query tools for greetings - just respond with the above message.

Available Tools:
1. general-questions-query: Use for general questions about the accelerator program, policies, benefits, FAQ-style questions
   - Query with VERY SIMPLE keywords: "program", "application", "equity", "timeline", etc.
   - For best results, use 1-2 word queries or pass an empty query to get all Q&As
2. session-event-grid-query: Use for questions about sessions, events, activities, schedules, speakers, participants
3. pioneer-profile-book-query: Use for questions about pioneers, their profiles, skills, industries, co-founder matching

How to Handle Queries:

**IMPORTANT - Query Strategy:**
- For questions asking about specific subsets (like "top 3", "all CTOs", "most experienced"), use BROAD search terms or request "all pioneers/all sessions/all"
- Let YOUR intelligence (the LLM) filter and analyze the returned data
- Example: User asks "top 3 technical founders with most experience" \u2192 query "all pioneers" or "pioneers" \u2192 YOU analyze the data to find technical founders and rank by experience
- Example: User asks "all CTOs in the batch" \u2192 query "all pioneers" or "roles" \u2192 YOU filter for CTOs from the results
- Example: User asks "What problem does Pioneers solve?" \u2192 query "all" or "problem" \u2192 YOU find relevant Q&As and extract answer
- Do NOT try to craft overly specific search queries - the tools work best with broad terms
- For general-questions-query: Use single keywords or "all" to get comprehensive results, then filter intelligently

**Query Tool Usage:**
1. Determine which tool to use based on the domain (general questions, sessions/events, or pioneers)
2. Pass a SIMPLE, BROAD query term to the tool (examples: "all pioneers", "sessions", "roles", "skills")
3. The tool will return raw data - YOU analyze and filter it intelligently
4. If you get good data from the first query, analyze it and respond - don't make additional queries
5. Generate a clear, comprehensive response based on your analysis

Response Guidelines:
- **BE CONCISE:** Keep answers brief and to the point - no fluff or unnecessary elaboration
- Answer the question directly in 2-4 sentences max when possible
- For lists, show only the most relevant items (not everything unless explicitly asked for "all")
- Analyze the returned data to answer the specific question
- Extract, filter, sort, and rank data as needed using your intelligence
- For date-based queries ("next event", "upcoming session"):
  * Parse date fields (they may be in formats like "6/11/2025 10:00am" or "2025-06-11")
  * Compare event dates in the data to today's date
  * If all events are in the past, briefly state this
  * If future events exist, identify the soonest one
  * Format dates in a human-readable way (e.g., "June 15, 2025")
- If no data is found, provide a brief helpful message
- Always use the same language as the user's question
- Keep responses conversational and friendly but SHORT
- For follow-up questions, use the conversation context from memory to understand references

**Slack-Friendly Formatting:**
Your responses will be displayed in Slack. Keep them SHORT and scannable:
- Use *bold* for key information (names, dates, important terms)
- For lists, use bullet points \u2022 but limit to 3-5 items max unless asked for more
- Keep paragraphs to 1-2 sentences
- Use emoji sparingly for personality (\u2728 \u{1F680} \u{1F4A1} \u{1F465} \u{1F4C5})
- For event/session info: *Event Name* - Date (brief, no extra details unless asked)
- For people: *Name* - Key role/skill (one line)
- Avoid headers (# ## ###), code blocks, or tables
- Get straight to the answer - no long introductions or conclusions

**Response Style Examples:**
\u274C Bad (too wordy):
The next upcoming event that we have scheduled for the batch is the Technical Workshop, which is scheduled to take place on June 15, 2025. This is going to be a workshop that focuses on AI development topics, and it would be particularly useful and relevant for founders who are currently building ML products or have an interest in machine learning.

\u2705 Good (concise):
Next up: *Technical Workshop* on June 15, 2025 \u{1F680} - Focused on AI development for ML founders.

\u274C Bad (too much detail):
Here are all the CTOs in the batch. We have John Doe who is the CTO at TechCorp and has a background in distributed systems, and we also have Jane Smith who is the CTO at StartupX and specializes in mobile architecture. Both of them have strong technical leadership experience.

\u2705 Good (brief):
CTOs in the batch:
\u2022 *John Doe* - TechCorp, distributed systems
\u2022 *Jane Smith* - StartupX, mobile architecture

Examples of Good Query Patterns:
- User: "Who are the CTOs?" \u2192 Tool query: "all pioneers" \u2192 YOU filter for CTO roles
- User: "Show me technical founders" \u2192 Tool query: "pioneers" \u2192 YOU identify technical skills/roles
- User: "What's the next session?" \u2192 Tool query: "all sessions" \u2192 YOU compare dates to today and find the next one
- User: "How many events in week 3?" \u2192 Tool query: "sessions" or "all sessions" \u2192 YOU count week 3 events
- User: "When is the next event?" \u2192 Tool query: "all sessions" \u2192 YOU analyze dates, compare to today, identify next event or state all are past
- User: "What problem does Pioneers solve?" \u2192 Tool query: "problem" or "program" \u2192 YOU find relevant Q&As and extract answer
- User: "How do I apply?" \u2192 Tool query: "application" or "apply" \u2192 YOU find application info
- User: "What's the equity stake?" \u2192 Tool query: "equity" \u2192 YOU find equity details

Do NOT:
- Answer questions from your own knowledge about Pioneer.vc - always use the tools
- Make up information if the tools don't return results
- Craft overly complex or specific queries for the tools - keep them broad and simple
- Write long, wordy responses - be brief and direct
- Add unnecessary context or explanations unless explicitly asked

Always prioritize accuracy, helpfulness, and BREVITY in your responses.`,
  model: "openai/gpt-4o-mini",
  tools: {
    generalQuestionsQuery,
    sessionEventGridQuery,
    pioneerProfileBookQuery
  },
  memory: new Memory({
    options: {
      lastMessages: 20
    }
  })
});

"use strict";
function verifySlackRequest(signingSecret, requestSignature, timestamp, body) {
  const fiveMinutesAgo = Math.floor(Date.now() / 1e3) - 60 * 5;
  if (parseInt(timestamp) < fiveMinutesAgo) {
    return false;
  }
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = "v0=" + crypto.createHmac("sha256", signingSecret).update(sigBasestring, "utf8").digest("hex");
  if (typeof requestSignature !== "string" || Buffer.byteLength(requestSignature, "utf8") !== Buffer.byteLength(mySignature, "utf8")) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(mySignature, "utf8"), Buffer.from(requestSignature, "utf8"));
}

"use strict";
const SPINNER = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
const TOOL_ICONS = ["\u{1F504}", "\u2699\uFE0F", "\u{1F527}", "\u26A1"];
const WORKFLOW_ICONS = ["\u{1F4CB}", "\u26A1", "\u{1F504}", "\u2728"];
const ANIMATION_INTERVAL = 300;
const TOOL_DISPLAY_DELAY = 300;
const STEP_DISPLAY_DELAY = 300;

"use strict";
function formatChunkType(type) {
  return type.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
function getStatusText(state, frame) {
  const spinner = SPINNER[frame % SPINNER.length];
  const toolIcon = TOOL_ICONS[frame % TOOL_ICONS.length];
  const workflowIcon = WORKFLOW_ICONS[frame % WORKFLOW_ICONS.length];
  const type = state.chunkType;
  const label = formatChunkType(type);
  if (type.startsWith("tool-") && state.toolName) {
    return `${toolIcon} ${label}: ${state.toolName}...`;
  }
  if (type.startsWith("workflow-") && state.stepName) {
    return `${workflowIcon} ${label}: ${state.stepName}...`;
  }
  if (type.includes("agent") && state.agentName) {
    return `${spinner} ${label}: ${state.agentName}...`;
  }
  return `${spinner} ${label}...`;
}

"use strict";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const formatName = (id) => id.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

"use strict";
async function streamToSlack(options) {
  const { mastra, slackClient, channel, threadTs, agentName, message, resourceId, threadId } = options;
  const state = { text: "", chunkType: "start" };
  let messageTs;
  let frame = 0;
  let animationTimer;
  let isFinished = false;
  const stopAnimation = () => {
    isFinished = true;
    if (animationTimer) {
      clearInterval(animationTimer);
      animationTimer = void 0;
    }
  };
  const updateSlack = async (text) => {
    if (!messageTs || isFinished) return;
    try {
      await slackClient.chat.update({
        channel,
        ts: messageTs,
        text: text ?? getStatusText(state, frame)
      });
    } catch {
    }
  };
  const sendFinalMessage = async (text) => {
    await retrySlackUpdate(slackClient, channel, messageTs, text);
  };
  try {
    const initial = await slackClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: getStatusText(state, 0)
    });
    messageTs = initial.ts;
    animationTimer = setInterval(() => {
      if (!isFinished) {
        frame++;
        updateSlack();
      }
    }, ANIMATION_INTERVAL);
    const agent = mastra.getAgent(agentName);
    if (!agent) throw new Error(`Agent "${agentName}" not found`);
    const stream = await agent.stream(message, {
      resourceId,
      threadId
    });
    for await (const chunk of stream.fullStream) {
      state.chunkType = chunk.type;
      switch (chunk.type) {
        case "text-delta":
          if (chunk.payload.text) {
            state.text += chunk.payload.text;
          }
          break;
        case "tool-call":
          state.toolName = formatName(chunk.payload.toolName);
          frame++;
          await updateSlack();
          await sleep(TOOL_DISPLAY_DELAY);
          break;
        case "tool-output":
          if (chunk.payload.output && typeof chunk.payload.output === "object") {
            const output = chunk.payload.output;
            if (output.type) {
              state.chunkType = output.type;
            }
            if (output.type === "workflow-step-start") {
              state.stepName = formatName(output.payload?.id || output.payload?.stepId || "step");
              frame++;
              await updateSlack();
              await sleep(STEP_DISPLAY_DELAY);
            }
          }
          break;
        case "workflow-execution-start":
          state.workflowName = formatName(chunk.payload.name || chunk.payload.workflowId);
          state.stepName = "Starting";
          break;
      }
    }
    stopAnimation();
    await sendFinalMessage(state.text || "Sorry, I couldn't generate a response.");
    console.log("\u2705 Response sent to Slack");
  } catch (error) {
    console.error("\u274C Error streaming to Slack:", error);
    stopAnimation();
    const errorText = `\u274C Error: ${error instanceof Error ? error.message : String(error)}`;
    if (messageTs) {
      await sendFinalMessage(errorText);
    } else {
      await slackClient.chat.postMessage({ channel, thread_ts: threadTs, text: errorText }).catch(() => {
      });
    }
    throw error;
  }
}
async function retrySlackUpdate(client, channel, ts, text, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await client.chat.update({ channel, ts, text });
      return;
    } catch (err) {
      console.error(`\u274C Final message attempt ${attempt + 1} failed:`, err);
      if (attempt < maxAttempts - 1) await sleep(500);
    }
  }
  console.error(`\u274C Failed to send final message after ${maxAttempts} attempts`);
}

"use strict";
function createSlackEventsRoute(config) {
  return registerApiRoute(`/slack/${config.name}/events`, {
    method: "POST",
    handler: async (c) => {
      try {
        const body = await c.req.text();
        const payload = JSON.parse(body);
        if (payload.type === "url_verification") {
          console.log(`\u2705 [${config.name}] URL verification challenge received`);
          return c.json({ challenge: payload.challenge });
        }
        if (!config.botToken || !config.signingSecret) {
          console.error(`\u274C [${config.name}] Missing bot token or signing secret`);
          return c.json({ error: "Server misconfigured" }, 500);
        }
        const slackSignature = c.req.header("x-slack-signature");
        const slackTimestamp = c.req.header("x-slack-request-timestamp");
        if (!slackSignature || !slackTimestamp) {
          return c.json({ error: "Missing Slack signature headers" }, 401);
        }
        const isValid = verifySlackRequest(config.signingSecret, slackSignature, slackTimestamp, body);
        if (!isValid) {
          console.error(`\u274C [${config.name}] Invalid Slack signature`);
          return c.json({ error: "Invalid signature" }, 401);
        }
        if (payload.event) {
          const event = payload.event;
          if (event.bot_id || event.subtype) {
            return c.json({ ok: true });
          }
          if (event.type === "app_mention" || event.type === "message") {
            let messageText = event.text || "";
            const userId = event.user;
            const channelId = event.channel;
            const threadTs = event.thread_ts || event.ts;
            const teamId = payload.team_id;
            console.log(`\u{1F4E8} [${config.name}] Message received:`, {
              agent: config.agentName,
              text: messageText,
              user: userId
            });
            messageText = messageText.replace(/<@[A-Z0-9]+>/g, "").trim();
            const mastra = c.get("mastra");
            const slackClient = new WebClient(config.botToken);
            (async () => {
              try {
                await streamToSlack({
                  mastra,
                  slackClient,
                  channel: channelId,
                  threadTs,
                  agentName: config.agentName,
                  message: messageText,
                  resourceId: `slack-${teamId}-${userId}`,
                  threadId: `slack-${channelId}-${threadTs}`
                });
              } catch (error) {
                console.error(`\u274C [${config.name}] Error processing message:`, error);
              }
            })();
          }
        }
        return c.json({ ok: true });
      } catch (error) {
        console.error(`Error handling Slack event [${config.name}]:`, error);
        return c.json({ error: "Failed to handle event" }, 500);
      }
    }
  });
}
const slackApps = [
  {
    name: "reverse",
    botToken: process.env.SLACK_REVERSE_BOT_TOKEN,
    signingSecret: process.env.SLACK_REVERSE_SIGNING_SECRET,
    agentName: "reverseAgent"
  },
  {
    name: "caps",
    botToken: process.env.SLACK_CAPS_BOT_TOKEN,
    signingSecret: process.env.SLACK_CAPS_SIGNING_SECRET,
    agentName: "capsAgent"
  }
];
const slackRoutes = slackApps.map(createSlackEventsRoute);

"use strict";
const mastra = new Mastra({
  agents: {
    lucie
  },
  storage: new LibSQLStore({
    id: "mastra",
    url: "file:./mastra.db"
  }),
  server: {
    apiRoutes: slackRoutes
  },
  bundler: {
    externals: ["supports-color"]
  }
});

export { mastra };
