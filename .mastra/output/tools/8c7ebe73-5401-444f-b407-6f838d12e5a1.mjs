import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadJsonData, searchInText } from './d3a63360-9f6c-49fd-bc40-9d347d00ffa1.mjs';
import { log } from './536074a7-4025-4846-9992-4bff108613e5.mjs';
import 'fs';
import 'path';
import 'url';

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

export { generalQuestionsQuery };
