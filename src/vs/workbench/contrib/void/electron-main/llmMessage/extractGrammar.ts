/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../../base/common/uuid.js'
import { endsWithAnyPrefixOf } from '../../common/helpers/extractCodeFromResult.js'
import { availableTools, InternalToolInfo, normalizeRawParams, normalizeToolName, parameterNamesIncludingAliases, toolNamesIncludingAliases } from '../../common/prompt/prompts.js'
import { OnFinalMessage, OnText, RawToolCallObj, RawToolParamsObj } from '../../common/sendLLMMessageTypes.js'
import { ToolName, ToolParamName } from '../../common/toolsServiceTypes.js'
import { ChatMode } from '../../common/voidSettingsTypes.js'


// =============== reasoning ===============

export const extractReasoningWrapper = (
	onText: OnText, onFinalMessage: OnFinalMessage, thinkTags: [string, string]
): { newOnText: OnText, newOnFinalMessage: OnFinalMessage } => {
	let latestAddIdx = 0 // exclusive index in fullText_
	let foundTag1 = false
	let foundTag2 = false

	let fullTextSoFar = ''
	let fullReasoningSoFar = ''


	if (!thinkTags[0] || !thinkTags[1]) throw new Error(`thinkTags must not be empty if provided. Got ${JSON.stringify(thinkTags)}.`)

	let onText_ = onText
	onText = (params) => {
		onText_(params)
	}

	const newOnText: OnText = ({ fullText: fullText_, ...p }) => {

		// until found the first think tag, keep adding to fullText
		if (!foundTag1) {
			const endsWithTag1 = endsWithAnyPrefixOf(fullText_, thinkTags[0])
			if (endsWithTag1) {
				return
			}
			// if found the first tag
			const tag1Index = fullText_.indexOf(thinkTags[0])
			if (tag1Index !== -1) {
				foundTag1 = true
				fullTextSoFar += fullText_.substring(0, tag1Index)
				latestAddIdx = tag1Index + thinkTags[0].length
				onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
				return
			}

			fullTextSoFar = fullText_
			latestAddIdx = fullText_.length
			onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
			return
		}

		// at this point, we found <tag1>

		// until found the second think tag, keep adding to fullReasoning
		if (!foundTag2) {
			const endsWithTag2 = endsWithAnyPrefixOf(fullText_, thinkTags[1])
			if (endsWithTag2 && endsWithTag2 !== thinkTags[1]) {
				return
			}

			// if found the second tag
			const tag2Index = fullText_.indexOf(thinkTags[1], latestAddIdx)
			if (tag2Index !== -1) {
				foundTag2 = true
				fullReasoningSoFar += fullText_.substring(latestAddIdx, tag2Index)
				latestAddIdx = tag2Index + thinkTags[1].length
				onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
				return
			}

			if (fullText_.length > latestAddIdx) {
				fullReasoningSoFar += fullText_.substring(latestAddIdx)
				latestAddIdx = fullText_.length
			}

			onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
			return
		}

		if (fullText_.length > latestAddIdx) {
			fullTextSoFar += fullText_.substring(latestAddIdx)
			latestAddIdx = fullText_.length
		}

		onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
	}


	const getOnFinalMessageParams = () => {
		const fullText_ = fullTextSoFar
		const tag1Idx = fullText_.indexOf(thinkTags[0])
		const tag2Idx = fullText_.indexOf(thinkTags[1])
		if (tag1Idx === -1) return { fullText: fullText_, fullReasoning: '' }
		if (tag2Idx === -1) return { fullText: '', fullReasoning: fullText_ }

		const fullReasoning = fullText_.substring(tag1Idx + thinkTags[0].length, tag2Idx)
		const fullText = fullText_.substring(0, tag1Idx) + fullText_.substring(tag2Idx + thinkTags[1].length, Infinity)

		return { fullText, fullReasoning }
	}

	const newOnFinalMessage: OnFinalMessage = (params) => {
		newOnText({ ...params })
		const { fullText, fullReasoning } = getOnFinalMessageParams()
		onFinalMessage({ ...params, fullText, fullReasoning })
	}

	return { newOnText, newOnFinalMessage }
}


// =============== tools (unified: XML / JSON / function-call) ===============


const findPartiallyWrittenToolTagAtEnd = (fullText: string, toolTags: string[]) => {
	for (const toolTag of toolTags) {
		const foundPrefix = endsWithAnyPrefixOf(fullText, toolTag)
		if (foundPrefix) {
			return [foundPrefix, toolTag] as const
		}
	}
	return false
}

const findIndexOfAny = (fullText: string, matches: string[]) => {
	let earliest: readonly [number, string] | null = null
	for (const str of matches) {
		const idx = fullText.indexOf(str);
		if (idx !== -1 && (earliest === null || idx < earliest[0])) earliest = [idx, str] as const
	}
	return earliest
}

/**
 * Detect function-call patterns: tool_name({...}) or tool_name{...}
 * Only matches registered tool names.
 */
const findFnCallPattern = (text: string, tools: InternalToolInfo[]): { idx: number, toolName: ToolName } | null => {
	for (const tool of tools) {
		for (const name of toolNamesIncludingAliases(tool.name)) {
			const fnIdx = text.indexOf(`${name}(`)
			if (fnIdx !== -1) {
				const afterParen = text.substring(fnIdx + name.length + 1, fnIdx + name.length + 3)
				if (afterParen.startsWith('{') || afterParen.startsWith('"') || afterParen.startsWith("'")) {
					return { idx: fnIdx, toolName: tool.name as ToolName }
				}
			}
			const directIdx = text.indexOf(`${name}{`)
				if (directIdx !== -1) {
					return { idx: directIdx, toolName: tool.name as ToolName }
				}
				}
			}
		return null
	}

/**
 * Detect JSON tool-call patterns: {"name":"tool_name", ...}
 * Only matches registered tool names.
 */
const findJSONToolCallStart = (text: string, tools: InternalToolInfo[]): { idx: number, toolName: ToolName } | null => {
	for (const tool of tools) {
		for (const name of toolNamesIncludingAliases(tool.name)) {
			const pattern = `"name":"${name}"`
			const patternIdx = text.indexOf(pattern)
			if (patternIdx !== -1) {
				const braceIdx = text.lastIndexOf('{', patternIdx)
				if (braceIdx >= 0) {
					return { idx: braceIdx, toolName: tool.name as ToolName }
				}
			}
			const patternSpaced = `"name" : "${name}"`
			const patternSpacedIdx = text.indexOf(patternSpaced)
			if (patternSpacedIdx !== -1) {
				const braceIdx = text.lastIndexOf('{', patternSpacedIdx)
				if (braceIdx >= 0) {
					return { idx: braceIdx, toolName: tool.name as ToolName }
				}
			}
			}
		}
	return null
}

/**
 * Detect partial function-call or JSON tool-call patterns at the end of text
 * that should be buffered (not yet shown to the user).
 */
const findPartialFnJsonAtEnd = (text: string, tools: InternalToolInfo[]): number | null => {
	for (const tool of tools) {
		for (const name of toolNamesIncludingAliases(tool.name)) {
			const fnStart = `${name}(`
			const lastIdx = text.lastIndexOf(fnStart)
			if (lastIdx !== -1) {
				const afterFn = text.substring(lastIdx + fnStart.length)
				if (!afterFn.includes(')')) {
					return lastIdx
				}
			}
			const directStart = `${name}{`
			const directIdx = text.lastIndexOf(directStart)
			if (directIdx !== -1) {
				const afterDirect = text.substring(directIdx + directStart.length)
				const openBraces = (afterDirect.match(/{/g) || []).length + 1
				const closeBraces = (afterDirect.match(/}/g) || []).length
				if (openBraces > closeBraces) {
					return directIdx
				}
			}
		}
	}

	const jsonPrefixMatch = text.match(/\{\s*"name"\s*:\s*"([^"]*?)$/)
	if (jsonPrefixMatch) {
		const partialName = jsonPrefixMatch[1]
		if (tools.some(t => t.name.startsWith(partialName))) {
			const bufferStart = text.lastIndexOf(jsonPrefixMatch[0])
			if (bufferStart >= 0) {
				return bufferStart
			}
		}
	}

	for (const tool of tools) {
		const jsonStart = `{"name":"${tool.name}"`
		const lastIdx = text.lastIndexOf(jsonStart)
		if (lastIdx !== -1) {
			const afterJson = text.substring(lastIdx)
			const openBraces = (afterJson.match(/{/g) || []).length
			const closeBraces = (afterJson.match(/}/g) || []).length
			if (openBraces > closeBraces) {
				return lastIdx
			}
		}
	}

	return null
}


// ---- Main streaming tool extractor ----

type ToolOfToolName = { [toolName: string]: InternalToolInfo }

const extractToolNameFromTag = (tag: string, tools: InternalToolInfo[]): ToolName => {
	const tagName = tag.match(/^<?\s*([\w-]+)/)?.[1]
	const normalized = normalizeToolName(tagName ?? '')
	return (tools.find(t => t.name === normalized)?.name ?? tools[0].name) as ToolName
}

const parseXMLPrefixToToolCall = (
	toolName: ToolName,
	toolId: string,
	text: string,
	toolOfToolName: ToolOfToolName,
): RawToolCallObj => {
	const tool = toolOfToolName[toolName]
	if (!tool) {
		return { name: toolName, rawParams: {}, doneParams: [], isDone: true, id: toolId }
	}

	const rawParams: RawToolParamsObj = {}
	const doneParams: ToolParamName<ToolName>[] = []

	// Parse XML attributes and parameters, accepting common model aliases.
	const openingTag = text.match(/^<?\s*[\w-]+\s*([^>]*)>/)?.[1] ?? ''
	for (const match of openingTag.matchAll(/([\w-]+)\s*=\s*(?:"([\s\S]*?)"|'([\s\S]*?)')/g)) {
		rawParams[match[1]] = match[2] ?? match[3] ?? ''
	}

	const paramNames = tool.params ? Object.keys(tool.params) : []
	for (const paramName of paramNames) {
			for (const name of parameterNamesIncludingAliases(paramName)) {
				const tagMatch = text.match(new RegExp(`(?:<\\s*|\\b)${name}\\s*>([\\s\\S]*?)(?:<\\/\\s*${name}\\s*>|$)`, 'i'))
				if (tagMatch) {
					rawParams[paramName] = tagMatch[1]
					if (/<\/\s*[\w-]+\s*>$/.test(tagMatch[0])) doneParams.push(paramName as ToolParamName<ToolName>)
					break
				}
			}
		}

	const closeToolTags = toolNamesIncludingAliases(toolName).map(name => `</${name}>`)
	const isDone = closeToolTags.some(tag => text.includes(tag))

	return {
		name: toolName,
		rawParams: normalizeRawParams(rawParams),
		doneParams,
		isDone,
		id: toolId,
	}
}

/**
 * Unified tool-call extractor for streaming LLM responses.
 * Handles XML, function-call, and JSON tool call patterns.
 */
export const extractToolsWrapper = (
	onText: OnText,
	onFinalMessage: OnFinalMessage,
	chatMode: ChatMode | null,
	mcpTools: InternalToolInfo[] | undefined,
): { newOnText: OnText, newOnFinalMessage: OnFinalMessage } => {

	if (!chatMode) return { newOnText: onText, newOnFinalMessage: onFinalMessage }
	const tools = availableTools(chatMode, mcpTools)
	if (!tools) return { newOnText: onText, newOnFinalMessage: onFinalMessage }

	const toolOfToolName: ToolOfToolName = {}
	const xmlOpenTags = tools.flatMap(t => toolNamesIncludingAliases(t.name).map(name => `<${name}`))
	const malformedXMLOpenTags = tools.flatMap(t => toolNamesIncludingAliases(t.name).map(name => `${name}>`))
	for (const t of tools) { toolOfToolName[t.name] = t }

	const toolId = generateUuid()

	let visibleTextSoFar = ''
	let trueFullText = ''
	let latestToolCall: RawToolCallObj | undefined = undefined

	let foundToolStart: { idx: number, toolName: ToolName } | null = null
	let pendingBuffer = ''

	let prevFullTextLen = 0
	const newOnText: OnText = (params) => {
		const newText = params.fullText.substring(prevFullTextLen)
		prevFullTextLen = params.fullText.length
		trueFullText = params.fullText

		if (foundToolStart !== null) {
			const toolText = trueFullText.substring(foundToolStart.idx, Infinity)

			latestToolCall = parseXMLPrefixToToolCall(
				foundToolStart.toolName,
				toolId,
				toolText,
				toolOfToolName,
			)

			if (Object.keys(latestToolCall.rawParams).length === 0 && !latestToolCall.isDone) {
				const jsonResult = parseJSONToolCall(toolText, tools)
				if (jsonResult) {
					latestToolCall = jsonResult.toolCall
				}
			}

			onText({
				...params,
				fullText: visibleTextSoFar,
				toolCall: latestToolCall,
			})
			return
		}

		pendingBuffer += newText

		const isPartialXML = findPartiallyWrittenToolTagAtEnd(pendingBuffer, xmlOpenTags)
		if (isPartialXML) {
			onText({
				...params,
				fullText: visibleTextSoFar,
				toolCall: latestToolCall,
			})
			return
		}

		visibleTextSoFar += pendingBuffer
		pendingBuffer = ''

		const xmlMatch = findIndexOfAny(visibleTextSoFar, [...xmlOpenTags, ...malformedXMLOpenTags])
		if (xmlMatch !== null) {
			const [idx, toolTag] = xmlMatch
			const toolName = extractToolNameFromTag(toolTag, tools)
			foundToolStart = { idx, toolName }
			visibleTextSoFar = visibleTextSoFar.substring(0, idx)

			latestToolCall = parseXMLPrefixToToolCall(
				toolName,
				toolId,
				trueFullText.substring(idx, Infinity),
				toolOfToolName,
			)

			onText({ ...params, fullText: visibleTextSoFar, toolCall: latestToolCall })
			return
		}

		const fnMatch = findFnCallPattern(visibleTextSoFar, tools)
		if (fnMatch) {
			foundToolStart = { idx: fnMatch.idx, toolName: fnMatch.toolName }
			visibleTextSoFar = visibleTextSoFar.substring(0, fnMatch.idx)

			const toolText = trueFullText.substring(fnMatch.idx, Infinity)
			const jsonResult = parseJSONToolCall(toolText, tools)
			if (jsonResult) {
				latestToolCall = jsonResult.toolCall
			} else {
				latestToolCall = {
					name: fnMatch.toolName,
					rawParams: {},
					doneParams: [],
					isDone: false,
					id: toolId,
				}
			}

			onText({ ...params, fullText: visibleTextSoFar, toolCall: latestToolCall })
			return
		}

		const jsonMatch = findJSONToolCallStart(visibleTextSoFar, tools)
		if (jsonMatch) {
			foundToolStart = { idx: jsonMatch.idx, toolName: jsonMatch.toolName }
			visibleTextSoFar = visibleTextSoFar.substring(0, jsonMatch.idx)

			const toolText = trueFullText.substring(jsonMatch.idx, Infinity)
			const jsonResult = parseJSONToolCall(toolText, tools)
			if (jsonResult) {
				latestToolCall = jsonResult.toolCall
			} else {
				latestToolCall = {
					name: jsonMatch.toolName,
					rawParams: {},
					doneParams: [],
					isDone: false,
					id: toolId,
				}
			}

			onText({ ...params, fullText: visibleTextSoFar, toolCall: latestToolCall })
			return
		}

		const partialMatch = findPartialFnJsonAtEnd(visibleTextSoFar, tools)
		if (partialMatch !== null) {
			pendingBuffer = visibleTextSoFar.substring(partialMatch)
			visibleTextSoFar = visibleTextSoFar.substring(0, partialMatch)
		}

		onText({
			...params,
			fullText: visibleTextSoFar,
			toolCall: latestToolCall,
		})
	}

	const newOnFinalMessage: OnFinalMessage = (params) => {
		newOnText({ ...params })

		if (pendingBuffer && !foundToolStart) {
			visibleTextSoFar += pendingBuffer
			pendingBuffer = ''
		}

		visibleTextSoFar = visibleTextSoFar.trimEnd()
		let toolCall = latestToolCall
		let finalText = visibleTextSoFar

		if (!toolCall || (Object.keys(toolCall.rawParams).length === 0 && !toolCall.isDone)) {
			const jsonToolCall = parseJSONToolCall(trueFullText || params.fullText, tools)
			if (jsonToolCall) {
				toolCall = jsonToolCall.toolCall
				finalText = (trueFullText || params.fullText).slice(0, jsonToolCall.start).trimEnd()
			}
		}

		onFinalMessage({ ...params, fullText: finalText, toolCall: toolCall })
	}
	return { newOnText, newOnFinalMessage }
}

export const extractXMLToolsWrapper = extractToolsWrapper

const parseJSONToolCall = (text: string, tools: InternalToolInfo[]): { start: number, toolCall: RawToolCallObj } | null => {
	const nameMatch = /"(?:name|name_file_or_folder)"\s*(?::|,)/g
	let start = -1
	for (const match of text.matchAll(nameMatch)) {
		const brace = text.lastIndexOf('{', match.index ?? -1)
		if (brace >= 0) start = brace
	}

	let directToolName: string | null = null;
	if (start < 0) {
		for (const tool of tools) {
			for (const name of toolNamesIncludingAliases(tool.name)) {
				const toolRegex = new RegExp(`\\b${name}\\s*\\{`, 'g')
				let match;
				while ((match = toolRegex.exec(text)) !== null) {
					start = match.index + match[0].length - 1
					directToolName = name;
				}
			}
		}
	}

	if (start < 0) {
		for (const tool of tools) {
			for (const name of toolNamesIncludingAliases(tool.name)) {
				const toolRegex = new RegExp(`\\b${name}\\s*\\(\\s*\\{`, 'g')
				let match;
				while ((match = toolRegex.exec(text)) !== null) {
					const braceIdx = text.indexOf('{', match.index + name.length)
					if (braceIdx >= 0) {
						start = braceIdx
						directToolName = name
					}
				}
			}
		}
	}

	if (start < 0) return null
	const end = text.lastIndexOf('}')
	if (end <= start) return null

	try {
		const candidate = text.slice(start, end + 1)
		let repairedCandidate = candidate.replace(
			/^\s*\{\s*"name_file_or_folder"\s*,\s*"args"\s*:\s*/,
			'{"name":"create_file_or_folder","args":'
		)
		repairedCandidate = repairedCandidate.replace(/"uri\s*>\s*([^"\r\n]*)"/g, (_match, rawPath: string) => {
			const escapedPath = rawPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
			return `"uri":"${escapedPath}"`
		})
		const parsed = JSON.parse(repairedCandidate) as { name?: unknown, args?: unknown, arguments?: unknown }

		let rawToolNameStr = directToolName || (typeof parsed.name === 'string' ? parsed.name : undefined);
		if (!rawToolNameStr) return null;
		const canonicalToolName = normalizeToolName(rawToolNameStr) as ToolName;
		if (!tools.some(tool => tool.name === canonicalToolName) && !tools.some(tool => tool.name === rawToolNameStr)) return null;

		let rawArgs: unknown = directToolName ? parsed : (parsed.args ?? parsed.arguments ?? {});
		if (typeof rawArgs === 'string') rawArgs = rawArgs.trim() ? JSON.parse(rawArgs) : {};
		if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) return null;
		const rawParams = normalizeRawParams(rawArgs as RawToolParamsObj);
		return {
			start,
			toolCall: {
				name: canonicalToolName,
				rawParams,
				doneParams: Object.keys(rawParams) as ToolParamName<ToolName>[],
				id: generateUuid(),
				isDone: true,
			},
		}
	} catch {
		if (directToolName) {
			const canonicalToolName = normalizeToolName(directToolName) as ToolName
			return {
				start,
				toolCall: {
					name: canonicalToolName,
					rawParams: {},
					doneParams: [],
					id: generateUuid(),
					isDone: true,
				},
			}
		}
		return null
	}
}
