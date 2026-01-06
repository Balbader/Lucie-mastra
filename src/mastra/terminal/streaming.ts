import type { Mastra } from '@mastra/core/mastra';
import { formatName } from '../slack/utils';
import { handleNestedChunkEvents } from '../slack/chunks';
import type { StreamState } from '../slack/types';

export interface TerminalStreamingOptions {
  mastra: Mastra;
  agentName: string;
  message: string;
  resourceId: string;
  threadId: string;
}

/**
 * Stream agent response to terminal with real-time updates
 *
 * @param options - Configuration including mastra instance, agent name, and message context
 */
export async function streamToTerminal(
  options: TerminalStreamingOptions,

): Promise<void> {
  const { mastra, agentName, message, resourceId, threadId } = options;

  const state: StreamState = { text: '', chunkType: 'start' };

  try {
    // Display initial thinking indicator
    // process.stdout.write('\n🤔 Thinking...\n\n');

    // Get agent and start streaming
    const agent = mastra.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent "${agentName}" not found`);
    }

    const stream = await agent.stream(message, {
      resourceId,
      threadId,
    });

    // Process chunks
    for await (const chunk of stream.fullStream) {
      state.chunkType = chunk.type;

      // Handle nested events (agent-execution-event-*, workflow-execution-event-*)
      handleNestedChunkEvents(chunk, state);

      switch (chunk.type) {
        case 'text-delta':
          if (chunk.payload.text) {
            state.text += chunk.payload.text;
            // Stream text in real-time
            process.stdout.write(chunk.payload.text);
          }
          break;

        case 'tool-call':
          state.toolName = formatName(chunk.payload.toolName);
          // process.stdout.write(
          //   `\n🔧 Using tool: ${state.toolName}\n`,
          // );
          break;

        case 'tool-output':
          // Workflow events come wrapped in tool-output chunks
          if (
            chunk.payload.output &&
              typeof chunk.payload.output === 'object'
          ) {
            const output = chunk.payload.output as {
              type?: string;
              payload?: {
                id?: string;
                stepId?: string;
                name?: string;
                workflowId?: string;
              };
            };
            if (output.type) {
              state.chunkType = output.type;
            }
            if (output.type === 'workflow-step-start') {
              state.stepName = formatName(
                output.payload?.id ||
                  output.payload?.stepId ||
                  'step',
              );
              // process.stdout.write(
              //   `\n⚙️  Workflow step: ${state.stepName}\n`,
              // );
            }
          }
          break;

        case 'workflow-execution-start':
          state.workflowName = formatName(
            chunk.payload.name || chunk.payload.workflowId,
          );
          state.stepName = 'Starting';
          // process.stdout.write(
          //   `\n🔄 Starting workflow: ${state.workflowName}\n`,
          // );
          break;
      }
    }

    // Done
    if (!state.text.trim()) {
      process.stdout.write('\n⚠️  No response generated.\n');
    } else {
      process.stdout.write('\n');
    }
    // console.log('\n✅ Response complete\n');
  } catch (error) {
    console.error(
      '\n❌ Error:',
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
