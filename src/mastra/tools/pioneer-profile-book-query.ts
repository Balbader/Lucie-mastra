import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { loadJsonData, searchInObject, searchInText } from './data-helpers';

export const pioneerProfileBookQuery = createTool({
	id: 'pioneer-profile-book-query',
	description:
		'Queries the pioneer profile book database to find information about pioneers in the accelerator. Handles general searches, specific field queries (skills, industries, roles, etc.), matching queries (co-founder matching), and aggregate queries (count, totals, etc.)',
	inputSchema: z.object({
		query: z
			.string()
			.describe(
				'The search query to find relevant pioneers or answer questions about them',
			),
	}),
	outputSchema: z.object({
		pioneers: z
			.array(z.any())
			.describe('Matching pioneers from the database'),
		found: z.boolean().describe('Whether matching pioneers were found'),
		metadata: z
			.object({
				queryType: z
					.enum([
						'aggregate',
						'specific_field',
						'matching',
						'general',
						'all',
					])
					.optional()
					.describe('Type of query detected'),
				totalCount: z
					.number()
					.optional()
					.describe('Total number of pioneers'),
				filterField: z
					.string()
					.optional()
					.describe(
						'Field filter applied (skills, industries, roles, etc.)',
					),
			})
			.optional()
			.describe('Additional metadata about the query results'),
	}),
	execute: async ({ query }) => {
		const data = loadJsonData('pioneers_profile_book_su2025.json');
		const allPioneers = Array.isArray(data) ? data : [];
		const queryLower = query.toLowerCase();

		// Detect query type
		const isAggregateQuery =
			queryLower.includes('how many') ||
			queryLower.includes('count') ||
			queryLower.includes('total') ||
			queryLower.includes('number of') ||
			queryLower.includes('pioneers are');

		const isAllPioneersQuery =
			queryLower.includes('all pioneer') ||
			queryLower.includes('list of pioneer') ||
			queryLower.includes('every pioneer') ||
			queryLower.includes('all the pioneer') ||
			queryLower === 'pioneers' ||
			queryLower === 'pioneer' ||
			queryLower.includes('what pioneers') ||
			queryLower.includes('show me pioneers') ||
			queryLower.includes('profile book');

		const isMatchingQuery =
			queryLower.includes('match') ||
			queryLower.includes('find me a') ||
			queryLower.includes('looking for') ||
			queryLower.includes('seeking') ||
			queryLower.includes('available') ||
			queryLower.includes('co-founder') ||
			queryLower.includes('cofounder') ||
			queryLower.includes('who can') ||
			queryLower.includes('who has');

		const isSpecificFieldQuery =
			queryLower.includes('skill') ||
			queryLower.includes('tech') ||
			queryLower.includes('industry') ||
			queryLower.includes('role') ||
			queryLower.includes('experience') ||
			queryLower.includes('years of') ||
			queryLower.includes('nationality') ||
			queryLower.includes('education') ||
			queryLower.includes('company') ||
			queryLower.includes('linkedin') ||
			queryLower.includes('track record');

		let results: any[] = [];
		let metadata:
			| {
					queryType:
						| 'aggregate'
						| 'specific_field'
						| 'matching'
						| 'general'
						| 'all';
					totalCount?: number;
					filterField?: string;
			  }
			| undefined;

		if (allPioneers.length === 0) {
			return {
				pioneers: [],
				found: false,
			};
		}

		// Handle aggregate queries - return all pioneers with metadata
		if (isAggregateQuery) {
			results = [...allPioneers];
			metadata = {
				queryType: 'aggregate' as const,
				totalCount: allPioneers.length,
			};
		}
		// Handle "all pioneers" queries
		else if (isAllPioneersQuery) {
			results = [...allPioneers];
			metadata = {
				queryType: 'all' as const,
				totalCount: allPioneers.length,
			};
		}
		// Handle matching queries - find pioneers by skills, roles, industries
		else if (isMatchingQuery) {
			// Extract search terms from query
			const searchTerms = queryLower
				.replace(
					/find me a|looking for|seeking|who can|who has|match|available/gi,
					'',
				)
				.trim()
				.split(/\s+/)
				.filter((term) => term.length > 2);

			// Search by skills
			if (
				queryLower.includes('skill') ||
				queryLower.includes('tech') ||
				queryLower.includes('developer') ||
				queryLower.includes('engineer')
			) {
				for (const pioneer of allPioneers) {
					const techSkills = pioneer['Tech Skills'] || '';
					const skillsStr = Array.isArray(techSkills)
						? techSkills.join(' ').toLowerCase()
						: techSkills.toLowerCase();
					if (
						searchTerms.some((term) => skillsStr.includes(term)) ||
						searchInText(skillsStr, query)
					) {
						results.push(pioneer);
					}
				}
				metadata = {
					queryType: 'matching' as const,
					filterField: 'Tech Skills',
				};
			}
			// Search by roles
			else if (
				queryLower.includes('role') ||
				queryLower.includes('cto') ||
				queryLower.includes('ceo') ||
				queryLower.includes('product') ||
				queryLower.includes('sales')
			) {
				for (const pioneer of allPioneers) {
					const roles = pioneer['Roles I could take'] || '';
					const rolesStr = Array.isArray(roles)
						? roles.join(' ').toLowerCase()
						: roles.toLowerCase();
					if (
						searchTerms.some((term) => rolesStr.includes(term)) ||
						searchInText(rolesStr, query)
					) {
						results.push(pioneer);
					}
				}
				metadata = {
					queryType: 'matching' as const,
					filterField: 'Roles I could take',
				};
			}
			// Search by industries
			else if (queryLower.includes('industry')) {
				for (const pioneer of allPioneers) {
					const industries = pioneer['Industries'] || '';
					const industriesStr = Array.isArray(industries)
						? industries.join(' ').toLowerCase()
						: industries.toLowerCase();
					if (
						searchTerms.some((term) =>
							industriesStr.includes(term),
						) ||
						searchInText(industriesStr, query)
					) {
						results.push(pioneer);
					}
				}
				metadata = {
					queryType: 'matching' as const,
					filterField: 'Industries',
				};
			}
			// General matching - search across all relevant fields
			else {
				for (const pioneer of allPioneers) {
					if (
						searchInObject(pioneer['Tech Skills'], query) ||
						searchInObject(pioneer['Roles I could take'], query) ||
						searchInObject(pioneer['Industries'], query) ||
						searchInText(pioneer['Introduction:'] || '', query)
					) {
						results.push(pioneer);
					}
				}
				metadata = {
					queryType: 'matching' as const,
				};
			}
		}
		// Handle specific field queries
		else if (isSpecificFieldQuery) {
			// Try to extract pioneer name from query
			let matchedPioneers: any[] = [];
			for (const pioneer of allPioneers) {
				const nameLower = (pioneer['Name'] || '').toLowerCase();
				if (
					queryLower.includes(nameLower) ||
					searchInText(queryLower, nameLower)
				) {
					matchedPioneers.push(pioneer);
				}
			}

			// If specific pioneer found, return just that one
			if (matchedPioneers.length > 0) {
				results = matchedPioneers;
				metadata = {
					queryType: 'specific_field' as const,
				};
			} else {
				// If no specific pioneer mentioned, search by field
				for (const pioneer of allPioneers) {
					if (searchInObject(pioneer, query)) {
						results.push(pioneer);
					}
				}
				metadata = {
					queryType: 'specific_field' as const,
					totalCount: results.length,
				};
			}
		}
		// General search - check for name match first, then semantic matching
		else {
			// First, try to find by name (exact or partial match)
			let nameMatches: any[] = [];
			for (const pioneer of allPioneers) {
				const nameLower = (pioneer['Name'] || '').toLowerCase();
				// Check if the query contains the pioneer's name or vice versa
				if (
					queryLower.includes(nameLower) ||
					nameLower.includes(queryLower)
				) {
					nameMatches.push(pioneer);
				}
			}

			// If we found name matches, use those
			if (nameMatches.length > 0) {
				results = nameMatches;
				metadata = {
					queryType: 'general' as const,
				};
			} else {
				// Otherwise, search across all pioneer fields using searchInObject
				for (const pioneer of allPioneers) {
					if (searchInObject(pioneer, query)) {
						results.push(pioneer);
					}
				}
				metadata = {
					queryType: 'general' as const,
				};
			}
		}

		const finalResults = results.slice(0, 50); // Limit to top 50 results

		return {
			pioneers: finalResults,
			found: results.length > 0,
			metadata,
		};
	},
});
