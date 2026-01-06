import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { lucie } from './agents/lucie-agent';
import { slackRoutes } from './slack/routes';

export const mastra = new Mastra({
  agents: { lucie },
  storage: new LibSQLStore({
    id: 'mastra',
    url: 'file:./mastra.db',
  }),
  server: {
    apiRoutes: slackRoutes,
  },
  bundler: {
    externals: ['supports-color'],
  },
});
