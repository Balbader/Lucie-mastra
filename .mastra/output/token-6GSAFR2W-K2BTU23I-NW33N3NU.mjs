import { r as require_token_util } from './chunk-G2AMUTU4.mjs';
import { b as __commonJS, c as require_token_error } from './index.mjs';
import '@mastra/core/evals/scoreTraces';
import '@mastra/core/mastra';
import '@mastra/libsql';
import '@mastra/core/agent';
import '@mastra/memory';
import './tools/2ae67c2d-93bd-418e-a7e0-8d895cd8bc4e.mjs';
import '@mastra/core/tools';
import 'zod';
import './tools/655dd03c-8525-4548-a43d-805f681af30a.mjs';
import 'fs';
import 'path';
import 'url';
import './tools/819ea872-1c3e-4879-88fc-dbc82f362bf9.mjs';
import './tools/af624ede-cac7-47df-a39a-583ae8cb595d.mjs';
import './tools/32f08569-5a2e-4002-9650-ecac9faceebf.mjs';
import '@mastra/core/server';
import '@slack/web-api';
import 'crypto';
import 'fs/promises';
import 'https';
import 'http';
import 'http2';
import 'stream';
import '@mastra/core/utils/zod-to-json';
import '@mastra/core/error';
import '@mastra/core/utils';
import '@mastra/core/evals';
import '@mastra/core/storage';
import '@mastra/core/a2a';
import 'stream/web';
import 'zod/v4';
import 'zod/v3';
import '@mastra/core/memory';
import 'child_process';
import 'module';
import 'util';
import '@mastra/core/llm';
import 'os';
import '@mastra/core/workflows';
import '@mastra/core/request-context';
import 'buffer';
import './tools.mjs';

// ../memory/dist/token-6GSAFR2W-K2BTU23I.js
var require_token = __commonJS({
  "../../../node_modules/.pnpm/@vercel+oidc@3.0.5/node_modules/@vercel/oidc/dist/token.js"(exports, module) {
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    var token_exports = {};
    __export(token_exports, {
      refreshToken: () => refreshToken
    });
    module.exports = __toCommonJS(token_exports);
    var import_token_error = require_token_error();
    var import_token_util = require_token_util();
    async function refreshToken() {
      const { projectId, teamId } = (0, import_token_util.findProjectInfo)();
      let maybeToken = (0, import_token_util.loadToken)(projectId);
      if (!maybeToken || (0, import_token_util.isExpired)((0, import_token_util.getTokenPayload)(maybeToken.token))) {
        const authToken = (0, import_token_util.getVercelCliToken)();
        if (!authToken) {
          throw new import_token_error.VercelOidcTokenError(
            "Failed to refresh OIDC token: login to vercel cli"
          );
        }
        if (!projectId) {
          throw new import_token_error.VercelOidcTokenError(
            "Failed to refresh OIDC token: project id not found"
          );
        }
        maybeToken = await (0, import_token_util.getVercelOidcToken)(authToken, projectId, teamId);
        if (!maybeToken) {
          throw new import_token_error.VercelOidcTokenError("Failed to refresh OIDC token");
        }
        (0, import_token_util.saveToken)(maybeToken, projectId);
      }
      process.env.VERCEL_OIDC_TOKEN = maybeToken.token;
      return;
    }
  }
});
var token6GSAFR2W = require_token();

export { token6GSAFR2W as default };
