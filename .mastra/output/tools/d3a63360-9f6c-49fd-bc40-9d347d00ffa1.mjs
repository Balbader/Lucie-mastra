import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

export { clearDataCache, loadJsonData, searchInObject, searchInText };
