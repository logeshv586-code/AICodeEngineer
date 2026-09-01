/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// Connection testing intentionally has a much tighter policy than normal generation.
// A Settings button must never inherit an SDK's multi-minute timeout/retry defaults.

// disable foreign import complaints
/* eslint-disable */
import Anthropic from '@anthropic-ai/sdk';
import OpenAI, { AzureOpenAI, ClientOptions } from 'openai';
import { GoogleGenAI } from '@google/genai';
import { GoogleAuth } from 'google-auth-library';
/* eslint-enable */

import { displayInfoOfProviderName, ProviderName, SettingsOfProvider } from '../../common/voidSettingsTypes.js';

export const TEST_CONNECTION_TIMEOUT_MS = 15_000;

class TestConnectionTimeoutError extends Error {
	constructor() {
		super(`Connection timed out after ${TEST_CONNECTION_TIMEOUT_MS / 1000} seconds.`);
		this.name = 'TestConnectionTimeoutError';
	}
}

const withHardTimeout = async <T>(promise: Promise<T>, abort?: () => void): Promise<T> => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<T>((_resolve, reject) => {
				timer = setTimeout(() => {
					try { abort?.(); } catch { }
					reject(new TestConnectionTimeoutError());
				}, TEST_CONNECTION_TIMEOUT_MS);
			}),
		]);
	}
	finally {
		if (timer !== undefined) clearTimeout(timer);
	}
};

const parseHeadersJSON = (value: string | undefined): Record<string, string | null | undefined> | undefined => {
	if (!value) return undefined;
	try {
		return JSON.parse(value);
	}
	catch {
		throw new Error('OpenAI-Compatible headers must be valid JSON.');
	}
};

const getGoogleAccessToken = async (): Promise<string> => {
	const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/cloud-platform' });
	const token = await withHardTimeout(auth.getAccessToken());
	if (!token) throw new Error('Google API failed to generate an access token.');
	return token;
};

const newFastOpenAICompatibleClient = async (providerName: ProviderName, settingsOfProvider: SettingsOfProvider): Promise<OpenAI> => {
	const common: ClientOptions = {
		dangerouslyAllowBrowser: true,
		timeout: TEST_CONNECTION_TIMEOUT_MS,
		maxRetries: 0,
	};

	if (providerName === 'openAI') {
		return new OpenAI({ apiKey: settingsOfProvider.openAI.apiKey, ...common });
	}
	if (providerName === 'ollama') {
		return new OpenAI({ baseURL: `${settingsOfProvider.ollama.endpoint}/v1`, apiKey: 'noop', ...common });
	}
	if (providerName === 'vLLM') {
		return new OpenAI({ baseURL: `${settingsOfProvider.vLLM.endpoint}/v1`, apiKey: 'noop', ...common });
	}
	if (providerName === 'liteLLM') {
		return new OpenAI({ baseURL: `${settingsOfProvider.liteLLM.endpoint}/v1`, apiKey: 'noop', ...common });
	}
	if (providerName === 'lmStudio') {
		return new OpenAI({ baseURL: `${settingsOfProvider.lmStudio.endpoint}/v1`, apiKey: 'noop', ...common });
	}
	if (providerName === 'openRouter') {
		return new OpenAI({
			baseURL: 'https://openrouter.ai/api/v1',
			apiKey: settingsOfProvider.openRouter.apiKey,
			defaultHeaders: {
				'HTTP-Referer': 'https://voideditor.com',
				'X-Title': 'Forge',
			},
			...common,
		});
	}
	if (providerName === 'googleVertex') {
		const config = settingsOfProvider.googleVertex;
		const baseURL = `https://${config.region}-aiplatform.googleapis.com/v1/projects/${config.project}/locations/${config.region}/endpoints/openapi`;
		return new OpenAI({ baseURL, apiKey: await getGoogleAccessToken(), ...common });
	}
	if (providerName === 'microsoftAzure') {
		const config = settingsOfProvider.microsoftAzure;
		return new AzureOpenAI({
			endpoint: `https://${config.project}.openai.azure.com/`,
			apiKey: config.apiKey,
			apiVersion: config.azureApiVersion ?? '2024-04-01-preview',
			...common,
		});
	}
	if (providerName === 'awsBedrock') {
		const config = settingsOfProvider.awsBedrock;
		let baseURL = config.endpoint || 'http://localhost:4000/v1';
		if (!baseURL.endsWith('/v1')) baseURL = baseURL.replace(/\/+$/, '') + '/v1';
		return new OpenAI({ baseURL, apiKey: config.apiKey, ...common });
	}
	if (providerName === 'nvidia') {
		return new OpenAI({
			baseURL: 'https://integrate.api.nvidia.com/v1',
			apiKey: settingsOfProvider.nvidia.apiKey,
			...common,
		});
	}
	if (providerName === 'deepseek') {
		return new OpenAI({ baseURL: 'https://api.deepseek.com/v1', apiKey: settingsOfProvider.deepseek.apiKey, ...common });
	}
	if (providerName === 'openAICompatible') {
		const config = settingsOfProvider.openAICompatible;
		return new OpenAI({
			baseURL: config.endpoint,
			apiKey: config.apiKey,
			defaultHeaders: parseHeadersJSON(config.headersJSON),
			...common,
		});
	}
	if (providerName === 'groq') {
		return new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: settingsOfProvider.groq.apiKey, ...common });
	}
	if (providerName === 'xAI') {
		return new OpenAI({ baseURL: 'https://api.x.ai/v1', apiKey: settingsOfProvider.xAI.apiKey, ...common });
	}
	if (providerName === 'mistral') {
		return new OpenAI({ baseURL: 'https://api.mistral.ai/v1', apiKey: settingsOfProvider.mistral.apiKey, ...common });
	}

	throw new Error(`Provider ${providerName} does not use an OpenAI-compatible connection test.`);
};

const timeoutMessage = (providerName: ProviderName, modelName: string): string => {
	const providerTitle = displayInfoOfProviderName(providerName).title;
	return `Connection timed out after ${TEST_CONNECTION_TIMEOUT_MS / 1000} seconds. ${providerTitle} did not answer for model "${modelName}". The model may be cold-starting, unavailable, or the model ID may be incorrect.`;
};

const normalizeConnectionError = (providerName: ProviderName, modelName: string, error: unknown): string => {
	const providerTitle = displayInfoOfProviderName(providerName).title;
	const record = error as { status?: unknown; name?: unknown; message?: unknown } | null;
	const message = error instanceof Error ? error.message : String(error ?? '');
	const name = typeof record?.name === 'string' ? record.name : '';
	const status = Number(record?.status ?? message.match(/\b([45]\d\d)\b/)?.[1]);

	if (error instanceof TestConnectionTimeoutError || /timeout|timed out/i.test(`${name} ${message}`)) {
		return timeoutMessage(providerName, modelName);
	}
	if (status === 401) return `${providerTitle} rejected the API key (HTTP 401). Check the key and try again.`;
	if (status === 403) return `${providerTitle} denied access (HTTP 403). Check that this API key can use model "${modelName}".`;
	if (status === 404) return `${providerTitle} could not find model "${modelName}" or the configured endpoint (HTTP 404). Check the exact model ID.`;
	if (status === 429) return `${providerTitle} is rate-limiting the connection test (HTTP 429). Check quota and retry shortly.`;
	if (status >= 500 && status <= 599) return `${providerTitle} is temporarily unavailable (HTTP ${status}). Retry shortly.`;
	return message || `Unable to connect to ${providerTitle}.`;
};

/**
 * Small real inference request used only by the Settings "Test API" action.
 * It is intentionally bounded to 15 seconds and SDK retries are disabled so the UI
 * cannot remain in "Testing…" for the normal generation client's multi-minute window.
 */
export const testLLMConnectionFast = async ({ providerName, modelName, settingsOfProvider }: {
	providerName: ProviderName;
	modelName: string;
	settingsOfProvider: SettingsOfProvider;
}): Promise<{ ok: boolean; error?: string }> => {
	try {
		if (providerName === 'anthropic') {
			const client = new Anthropic({
				apiKey: settingsOfProvider.anthropic.apiKey,
				timeout: TEST_CONNECTION_TIMEOUT_MS,
				maxRetries: 0,
			});
			await withHardTimeout(client.messages.create({
				model: modelName,
				max_tokens: 1,
				messages: [{ role: 'user', content: 'Reply OK.' }],
			}));
		}
		else if (providerName === 'gemini') {
			const client = new GoogleGenAI({ apiKey: settingsOfProvider.gemini.apiKey });
			await withHardTimeout(client.models.generateContent({
				model: modelName,
				contents: 'Reply OK.',
				config: { maxOutputTokens: 1 },
			}));
		}
		else {
			const controller = new AbortController();
			const client = await withHardTimeout(newFastOpenAICompatibleClient(providerName, settingsOfProvider), () => controller.abort());
			if (providerName === 'microsoftAzure') (client as AzureOpenAI).deploymentName = modelName;
			await withHardTimeout(client.chat.completions.create({
				model: modelName,
				messages: [{ role: 'user', content: 'Reply OK.' }],
				max_tokens: 1,
				stream: false,
			} as any, { signal: controller.signal }), () => controller.abort());
		}

		return { ok: true };
	}
	catch (error) {
		return { ok: false, error: normalizeConnectionError(providerName, modelName, error) };
	}
};
