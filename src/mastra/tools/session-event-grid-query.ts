import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadJsonData, searchInObject, searchInText } from './data-helpers';

export const sessionEventGridQuery = createTool({
	id: 'session-event-grid-query',
	description:
		'Queries the session event grid database to find information about sessions, events, and activities in the accelerator. Handles general searches, specific field queries (date, speaker, type, week, participants, etc.), and aggregate queries (count, totals, etc.)',
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				'The search query to find relevant sessions or answer questions about them',
			),
	}),
	outputSchema: z.object({
		sessions: z
			.array(z.any())
			.describe('Matching sessions from the database'),
		found: z.boolean().describe('Whether matching sessions were found'),
		metadata: z
			.object({
				queryType: z
					.enum([
						'aggregate',
						'specific_field',
						'participant',
						'general',
						'all',
					])
					.optional()
					.describe('Type of query detected'),
				totalCount: z
					.number()
					.optional()
					.describe('Total number of sessions'),
				filterField: z
					.string()
					.optional()
					.describe(
						'Field filter applied (date, speaker, type, week, etc.)',
					),
			})
			.optional()
			.describe('Additional metadata about the query results'),
	}),
	execute: async ({ query }) => {
		const data = loadJsonData('session_event_grid_view.json');
		const allSessions = Array.isArray(data) ? data : [];
		const queryLower = query.toLowerCase();

		// Detect query type
		const isAggregateQuery =
			queryLower.includes('how many') ||
			queryLower.includes('count') ||
			queryLower.includes('total') ||
			queryLower.includes('number of') ||
			queryLower.includes('sessions are');

		const isAllSessionsQuery =
			queryLower.includes('all session') ||
			queryLower.includes('list of session') ||
			queryLower.includes('every session') ||
			queryLower.includes('all the session') ||
			queryLower === 'sessions' ||
			queryLower === 'session' ||
			queryLower.includes('what sessions') ||
			queryLower.includes('show me sessions') ||
			queryLower.includes('event grid');

		const isParticipantQuery =
			queryLower.includes('who attended') ||
			queryLower.includes('who participated') ||
			queryLower.includes('participants') ||
			queryLower.includes('who was at') ||
			queryLower.includes('who went to') ||
			queryLower.includes('attended by');

		const isSpecificFieldQuery =
			queryLower.includes('date') ||
			queryLower.includes('when') ||
			queryLower.includes('time') ||
			queryLower.includes('speaker') ||
			queryLower.includes('week') ||
			queryLower.includes('type of session') ||
			queryLower.includes('session type') ||
			queryLower.includes('masterclass') ||
			queryLower.includes('group exercise') ||
			queryLower.includes('office hours') ||
			queryLower.includes('pitch') ||
			queryLower.includes('friday') ||
			queryLower.includes('instruction') ||
			queryLower.includes('slack') ||
			queryLower.includes('notes') ||
			queryLower.includes('feedback');

		let results: any[] = [];
		let metadata:
			| {
					queryType:
						| 'aggregate'
						| 'specific_field'
						| 'participant'
						| 'general'
						| 'all';
					totalCount?: number;
					filterField?: string;
			  }
			| undefined;

		if (allSessions.length === 0) {
			return {
				sessions: [],
				found: false,
			};
		}

		// Handle aggregate queries - return all sessions with metadata
		if (isAggregateQuery) {
			results = [...allSessions];
			metadata = {
				queryType: 'aggregate' as const,
				totalCount: allSessions.length,
			};
		}
		// Handle "all sessions" queries
		else if (isAllSessionsQuery) {
			results = [...allSessions];
			metadata = {
				queryType: 'all' as const,
				totalCount: allSessions.length,
			};
		}
		// Handle participant queries - find sessions by participant names
		else if (isParticipantQuery) {

			// Extract participant name from query
			for (const session of allSessions) {
				const participants = session['Participants'] || '';
				const nameFromLinked = session['Name (from linked)'] || '';
				const participantsStr = (
					participants +
					' ' +
					nameFromLinked
				).toLowerCase();

				if (searchInText(participantsStr, query)) {
					results.push(session);
				}
			}
			metadata = {
				queryType: 'participant' as const,
				filterField: 'Participants',
			};
		}
		// Handle specific field queries
		else if (isSpecificFieldQuery) {

			// Try to extract session name from query
			let matchedSessions: any[] = [];
			for (const session of allSessions) {
				const nameLower = (session['Name'] || '').toLowerCase();
				if (
					queryLower.includes(nameLower) ||
					searchInText(queryLower, nameLower)
				) {
					matchedSessions.push(session);
				}
			}

			// If specific session found, return just that one
			if (matchedSessions.length > 0) {
				results = matchedSessions;
				metadata = {
					queryType: 'specific_field' as const,
				};
			} else {
				// If no specific session mentioned, search by field
				for (const session of allSessions) {
					if (searchInObject(session, query)) {
						results.push(session);
					}
				}
				metadata = {
					queryType: 'specific_field' as const,
					totalCount: results.length,
				};
			}
		}
		// General search - use semantic matching
		else {
			// Search across all session fields using searchInObject
			for (const session of allSessions) {
				if (searchInObject(session, query)) {
					results.push(session);
				}
			}
			metadata = {
				queryType: 'general' as const,
			};
		}

		const finalResults = results.slice(0, 50); // Limit to top 50 results

		return {
			sessions: finalResults,
			found: results.length > 0,
			metadata,
		};
	},
});
