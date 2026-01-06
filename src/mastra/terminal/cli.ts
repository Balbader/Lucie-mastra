#!/usr/bin/env node

// Load environment variables from .env file
import 'dotenv/config';

import * as readline from 'node:readline';
import { mastra } from '../index';
import { streamToTerminal } from './streaming';

// Available agents - must match keys in src/mastra/index.ts
const availableAgents = ['lucie'];

/**
 * Create readline interface for user input
 */
function createReadlineInterface(): readline.Interface {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		prompt: '',
	});
}

/**
 * Display agent selection menu
 */
function displayAgentMenu(): void {
	console.log('\n📋 Available Agents:\n');
	availableAgents.forEach((agent, index) => {
		console.log(`  ${index + 1}. ${agent}`);
	});
	console.log();
}

/**
 * Select agent interactively
 */
async function selectAgent(rl: readline.Interface): Promise<string> {
	return new Promise((resolve) => {
		displayAgentMenu();
		rl.question('Select an agent (number or name): ', (answer) => {
			const trimmed = answer.trim();

			// Try number first
			const num = parseInt(trimmed, 10);
			if (!isNaN(num) && num > 0 && num <= availableAgents.length) {
				resolve(availableAgents[num - 1]);
				return;
			}

			// Try name match
			const matched = availableAgents.find(
				(agent) => agent.toLowerCase() === trimmed.toLowerCase(),
			);
			if (matched) {
				resolve(matched);
				return;
			}

			// Default to first agent
			console.log(
				`⚠️  Invalid selection, using "${availableAgents[0]}"\n`,
			);
			resolve(availableAgents[0]);
		});
	});
}

/**
 * Get user message
 */
async function getMessage(
	rl: readline.Interface,
	agentName: string,
): Promise<string | null> {
	return new Promise((resolve) => {
		rl.question(`\n💬 [${agentName}] You: `, (answer) => {
			const trimmed = answer.trim();
			if (
				trimmed === '' ||
				trimmed.toLowerCase() === 'exit' ||
				trimmed.toLowerCase() === 'quit'
			) {
				resolve(null);
			} else {
				resolve(trimmed);
			}
		});
	});
}

/**
 * Main CLI loop
 */
async function main() {
	const rl = createReadlineInterface();

	// Get agent from CLI arg or prompt
	let agentArg: string | undefined;
	const agentIndex = process.argv.findIndex((arg) => arg === '--agent');
	if (agentIndex !== -1) {
		// Handle --agent name format
		agentArg = process.argv[agentIndex + 1];
	} else {
		// Handle --agent=name format
		agentArg = process.argv
			.find((arg) => arg.startsWith('--agent='))
			?.split('=')[1];
	}
	const agentName = agentArg || (await selectAgent(rl));

	if (!availableAgents.includes(agentName)) {
		console.error(
			`❌ Agent "${agentName}" not found. Available agents: ${availableAgents.join(
				', ',
			)}`,
		);
		process.exit(1);
	}

	console.log(`\n✅ Using agent: ${agentName}`);
	console.log('💡 Type "exit" or "quit" to end the conversation\n');

	// Conversation context
	const resourceId = `terminal-${process.pid}-${Date.now()}`;
	let threadId = `terminal-${Date.now()}`;
	let messageCount = 0;

	// Main conversation loop
	while (true) {
		const message = await getMessage(rl, agentName);

		if (!message) {
			console.log('\n👋 Goodbye!\n');
			break;
		}

		try {
			// Update thread ID for new conversations (first message starts new thread)
			if (messageCount === 0) {
				threadId = `terminal-${Date.now()}`;
			}
			messageCount++;

			// Stream response
			await streamToTerminal({
				mastra,
				agentName,
				message,
				resourceId,
				threadId,
			});
		} catch (error) {
			console.error(
				'\n❌ Error:',
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	rl.close();
	process.exit(0);
}

// Run CLI
main().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
