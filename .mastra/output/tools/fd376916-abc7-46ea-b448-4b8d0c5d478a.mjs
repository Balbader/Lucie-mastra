import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadJsonData, searchInText, searchInObject } from './d3a63360-9f6c-49fd-bc40-9d347d00ffa1.mjs';
import 'fs';
import 'path';
import 'url';

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

export { pioneerProfileBookQuery };
