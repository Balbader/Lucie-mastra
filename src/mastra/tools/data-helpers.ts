import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Pre-loaded data storage
 * Data is loaded once at module initialization
 */
let generalQuestionsData: any = null;
let sessionEventGridData: any = null;
let pioneerProfileBookData: any = null;

/**
 * Find project root by traversing up from current file
 */
function getProjectRoot(): string {
	const currentFile = fileURLToPath(import.meta.url);
	let currentDir = dirname(currentFile);

	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const dataPath = join(currentDir, 'data');
		if (existsSync(join(dataPath, 'general-questions.json'))) {
			return currentDir;
		}
		const parentDir = dirname(currentDir);
		if (parentDir === currentDir) break;
		currentDir = parentDir;
		attempts++;
	}

	return process.cwd();
}

/**
 * Try to load a JSON file from multiple possible paths
 */
function tryLoadJsonFile(filename: string): any {
	const projectRoot = getProjectRoot();

	const possiblePaths = [
		// From project root (when running from source)
		join(process.cwd(), 'data', filename),
		// From .mastra/output (when running built version)
		join(process.cwd(), '..', '..', 'data', filename),
		// From .mastra/output with different structure
		join(process.cwd(), '..', 'data', filename),
		// Using project root detection
		join(projectRoot, 'data', filename),
		// Mastra Cloud might use a different structure
		join('/app', 'data', filename),
		join('/var/task', 'data', filename),
	];

	console.log(`[data-helpers] Loading ${filename}...`);
	console.log(`[data-helpers] Current working directory: ${process.cwd()}`);
	console.log(`[data-helpers] Detected project root: ${projectRoot}`);

	for (const filePath of possiblePaths) {
		try {
			if (existsSync(filePath)) {
				console.log(`[data-helpers] ✓ Found ${filename} at: ${filePath}`);
				const fileContent = readFileSync(filePath, 'utf-8');
				const data = JSON.parse(fileContent);
				console.log(`[data-helpers] ✓ Successfully loaded ${filename} (${Object.keys(data).length} top-level keys)`);
				return data;
			}
		} catch (error) {
			console.error(`[data-helpers] ✗ Failed to load from ${filePath}:`, error);
			continue;
		}
	}

	console.error(`[data-helpers] ✗ Failed to load ${filename} from any path`);
	console.error(`[data-helpers] Tried paths:`, possiblePaths);
	return null;
}

/**
 * Initialize all data files at module load
 */
function initializeData(): void {
	if (generalQuestionsData !== null) {
		console.log('[data-helpers] Data already loaded, skipping initialization');
		return;
	}

	console.log('[data-helpers] Initializing data files...');

	// Load general-questions.json
	try {
		generalQuestionsData = tryLoadJsonFile('general-questions.json');
		if (!generalQuestionsData) {
			console.warn('[data-helpers] ⚠ Using fallback empty data for general-questions.json');
			generalQuestionsData = { knowledge_base: {} };
		}
	} catch (e) {
		console.error('[data-helpers] ✗ Error loading general-questions.json:', e);
		generalQuestionsData = { knowledge_base: {} };
	}

	// Load session_event_grid_view.json
	try {
		sessionEventGridData = tryLoadJsonFile('session_event_grid_view.json');
		if (!sessionEventGridData) {
			console.warn('[data-helpers] ⚠ Using fallback empty array for session_event_grid_view.json');
			sessionEventGridData = [];
		}
	} catch (e) {
		console.error('[data-helpers] ✗ Error loading session_event_grid_view.json:', e);
		sessionEventGridData = [];
	}

	// Load pioneers_profile_book_su2025.json
	try {
		pioneerProfileBookData = tryLoadJsonFile('pioneers_profile_book_su2025.json');
		if (!pioneerProfileBookData) {
			console.warn('[data-helpers] ⚠ Using fallback empty array for pioneers_profile_book_su2025.json');
			pioneerProfileBookData = [];
		}
	} catch (e) {
		console.error('[data-helpers] ✗ Error loading pioneers_profile_book_su2025.json:', e);
		pioneerProfileBookData = [];
	}

	console.log('[data-helpers] ✓ Data initialization complete');
}

// Initialize data on module load
initializeData();

/**
 * Helper function to load JSON data files from the data directory
 * Returns pre-loaded data for known files
 */
export function loadJsonData<T>(filename: string): T {
	if (filename === 'general-questions.json') {
		if (generalQuestionsData === null) {
			console.error('[data-helpers] ✗ general-questions.json not loaded!');
			throw new Error('Failed to load general-questions.json - data not initialized');
		}
		return generalQuestionsData;
	}

	if (filename === 'session_event_grid_view.json') {
		if (sessionEventGridData === null) {
			console.error('[data-helpers] ✗ session_event_grid_view.json not loaded!');
			throw new Error('Failed to load session_event_grid_view.json - data not initialized');
		}
		return sessionEventGridData;
	}

	if (filename === 'pioneers_profile_book_su2025.json') {
		if (pioneerProfileBookData === null) {
			console.error('[data-helpers] ✗ pioneers_profile_book_su2025.json not loaded!');
			throw new Error('Failed to load pioneers_profile_book_su2025.json - data not initialized');
		}
		return pioneerProfileBookData;
	}

	console.error(`[data-helpers] ✗ Unknown data file requested: ${filename}`);
	throw new Error(`Unknown data file: ${filename}`);
}

/**
 * Clear the data cache and reload all files
 * Useful for development/testing when data files change
 */
export function clearDataCache(): void {
	console.log('[data-helpers] Clearing data cache and reloading...');
	generalQuestionsData = null;
	sessionEventGridData = null;
	pioneerProfileBookData = null;
	initializeData();
}

/**
 * Helper function to search text content (case-insensitive)
 */
export function searchInText(text: string, query: string): boolean {
	const normalizedText = text.toLowerCase();
	const normalizedQuery = query.toLowerCase();
	return normalizedText.includes(normalizedQuery);
}

/**
 * Helper function to search in object values recursively
 */
export function searchInObject(obj: any, query: string): boolean {
	if (typeof obj === 'string') {
		return searchInText(obj, query);
	}
	if (Array.isArray(obj)) {
		return obj.some((item) => searchInObject(item, query));
	}
	if (obj && typeof obj === 'object') {
		return Object.values(obj).some((value) => searchInObject(value, query));
	}
	return false;
}
