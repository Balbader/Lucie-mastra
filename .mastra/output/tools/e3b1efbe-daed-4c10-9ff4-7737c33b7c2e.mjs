import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadJsonData, searchInText, searchInObject } from './d3a63360-9f6c-49fd-bc40-9d347d00ffa1.mjs';
import 'fs';
import 'path';
import 'url';

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

export { sessionEventGridQuery };
