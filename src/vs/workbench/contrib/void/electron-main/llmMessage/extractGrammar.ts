/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { generateUuid } from '../../../../../base/common/uuid.js'
import { endsWithAnyPrefixOf, SurroundingsRemover } from '../../common/helpers/extractCodeFromResult.js'
import { availableTools, InternalToolInfo } from '../../common/prompt/prompts.js'
import { OnFinalMessage, OnText, RawToolCallObj, RawToolParamsObj } from '../../common/sendLLMMessageTypes.js'
import { ToolName, ToolParamName } from '../../common/toolsServiceTypes.js'
import { ChatMode } from '../../common/voidSettingsTypes.js'


// =============== reasoning ===============

// could simplify this - this assumes we can never add a tag without committing it to the user's screen, but that's not true
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
				// console.log('endswith1', { fullTextSoFar, fullReasoningSoFar, fullText_ })
				// wait until we get the full tag or know more
				return
			}
			// if found the first tag
			const tag1Index = fullText_.indexOf(thinkTags[0])
			if (tag1Index !== -1) {
				// console.log('tag1Index !==1', { tag1Index, fullTextSoFar, fullReasoningSoFar, thinkTags, fullText_ })
				foundTag1 = true
				// Add text before the tag to fullTextSoFar
				fullTextSoFar += fullText_.substring(0, tag1Index)
				// Update latestAddIdx to after the first tag
				latestAddIdx = tag1Index + thinkTags[0].length
				onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
				return
			}

			// console.log('adding to text A', { fullTextSoFar, fullReasoningSoFar })
			// add the text to fullText
			fullTextSoFar = fullText_
			latestAddIdx = fullText_.length
			onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
			return
		}

		// at this point, we found <tag1>

		// until found the second think tag, keep adding to fullReasoning
		if (!foundTag2) {
			const endsWithTag2 = endsWithAnyPrefixOf(fullText_, thinkTags[1])
			if (endsWithTag2 && endsWithTag2 !== thinkTags[1]) { // if ends with any partial part (full is fine)
				// console.log('endsWith2', { fullTextSoFar, fullReasoningSoFar })
				// wait until we get the full tag or know more
				return
			}

			// if found the second tag
			const tag2Index = fullText_.indexOf(thinkTags[1], latestAddIdx)
			if (tag2Index !== -1) {
				// console.log('tag2Index !== -1', { fullTextSoFar, fullReasoningSoFar })
				foundTag2 = true
				// Add everything between first and second tag to reasoning
				fullReasoningSoFar += fullText_.substring(latestAddIdx, tag2Index)
				// Update latestAddIdx to after the second tag
				latestAddIdx = tag2Index + thinkTags[1].length
				onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
				return
			}

			// add the text to fullReasoning (content after first tag but before second tag)
			// console.log('adding to text B', { fullTextSoFar, fullReasoningSoFar })

			// If we have more text than we've processed, add it to reasoning
			if (fullText_.length > latestAddIdx) {
				fullReasoningSoFar += fullText_.substring(latestAddIdx)
				latestAddIdx = fullText_.length
			}

			onText({ ...p, fullText: fullTextSoFar, fullReasoning: fullReasoningSoFar })
			return
		}

		// at this point, we found <tag2> - content after the second tag is normal text
		// console.log('adding to text C', { fullTextSoFar, fullReasoningSoFar })

		// Add any new text after the closing tag to fullTextSoFar
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
		if (tag1Idx === -1) return { fullText: fullText_, fullReasoning: '' } // never started reasoning
		if (tag2Idx === -1) return { fullText: '', fullReasoning: fullText_ } // never stopped reasoning

		const fullReasoning = fullText_.substring(tag1Idx + thinkTags[0].length, tag2Idx)
		const fullText = fullText_.substring(0, tag1Idx) + fullText_.substring(tag2Idx + thinkTags[1].length, Infinity)

		return { fullText, fullReasoning }
	}

	const newOnFinalMessage: OnFinalMessage = (params) => {

		// treat like just got text before calling onFinalMessage (or else we sometimes miss the final chunk that's new to finalMessage)
		newOnText({ ...params })

		const { fullText, fullReasoning } = getOnFinalMessageParams()
		onFinalMessage({ ...params, fullText, fullReasoning })
	}

	return { newOnText, newOnFinalMessage }
}


// =============== tools (unified: XML / JSON / function-call) ===============



// trim all whitespace up until the first newline, and all whitespace up until the last newline
const trimBeforeAndAfterNewLines = (s: string) => {
	if (!s) return s;

	const firstNewLineIndex = s.indexOf('\n');

	if (firstNewLineIndex !== -1 && s.substring(0, firstNewLineIndex).trim() === '') {
		s = s.substring(firstNewLineIndex + 1, Infinity)
	}

	const lastNewLineIndex = s.lastIndexOf('\n');
	if (lastNewLineIndex !== -1 && s.substring(lastNewLineIndex + 1, Infinity).trim() === '') {
		s = s.substring(0, lastNewLineIndex)
	}

	return s
}

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
	for (const str of matches) {
		const idx = fullText.indexOf(str);
		if (idx !== -1) {
			return [idx, str] as const
		}
	}
	return null
}


type ToolOfToolName = { [toolName: string]: InternalToolInfo | undefined }
const parseXMLPrefixToToolCall = <T extends ToolName,>(toolName: T, toolId: string, str: string, toolOfToolName: ToolOfToolName): RawToolCallObj => {
	const paramsObj: RawToolParamsObj = {}
	const doneParams: ToolParamName<T>[] = []
	let isDone = false

	const getAnswer = (): RawToolCallObj => {
		// trim off all whitespace at and before first \n and after last \n for each param
		for (const p in paramsObj) {
			const paramName = p as ToolParamName<T>
			const orig = paramsObj[paramName]
			if (orig === undefined) continue
			paramsObj[paramName] = trimBeforeAndAfterNewLines(orig)
		}

		// return tool call
		const ans: RawToolCallObj = {
			name: toolName,
			rawParams: paramsObj,
			doneParams: doneParams,
			isDone: isDone,
			id: toolId,
		}
		return ans
	}

	// find first toolName tag
	const openToolTag = `<${toolName}>`
	const hybridToolTag = `{"name":"${toolName}">`
	let i = str.indexOf(openToolTag)
	let matchedOpenTag = openToolTag
	if (i === -1) {
		i = str.indexOf(hybridToolTag)
		matchedOpenTag = hybridToolTag
	}
	if (i === -1) return getAnswer()
	let j = str.lastIndexOf(`</${toolName}>`)
	if (j === -1) j = Infinity
	else isDone = true


	str = str.substring(i + matchedOpenTag.length, j)

	const pm = new SurroundingsRemover(str)

	const allowedParams = Object.keys(toolOfToolName[toolName]?.params ?? {}) as ToolParamName<T>[]
	if (allowedParams.length === 0) return getAnswer()
	let latestMatchedOpenParam: null | ToolParamName<T> = null
	let n = 0
	while (true) {
		n += 1
		if (n > 10) return getAnswer() // just for good measure as this code is early

		// find the param name opening tag
		let matchedOpenParam: null | ToolParamName<T> = null
		for (const paramName of allowedParams) {
			const removed = pm.removeFromStartUntilFullMatch(`<${paramName}>`, true)
			if (removed) {
				matchedOpenParam = paramName
				break
			}
		}
		// if did not find a new param, stop
		if (matchedOpenParam === null) {
			if (latestMatchedOpenParam !== null) {
				paramsObj[latestMatchedOpenParam] += pm.value()
			}
			return getAnswer()
		}
		else {
			latestMatchedOpenParam = matchedOpenParam
		}

		paramsObj[latestMatchedOpenParam] = ''

		// find the param name closing tag
		let matchedCloseParam: boolean = false
		let paramContents = ''
		for (const paramName of allowedParams) {
			const i = pm.i
			const closeTag = `</${paramName}>`
			const removed = pm.removeFromStartUntilFullMatch(closeTag, true)
			if (removed) {
				const i2 = pm.i
				paramContents = pm.originalS.substring(i, i2 - closeTag.length)
				matchedCloseParam = true
				break
			}
		}
		// if did not find a new close tag, stop
		if (!matchedCloseParam) {
			paramsObj[latestMatchedOpenParam] += pm.value()
			return getAnswer()
		}
		else {
			doneParams.push(latestMatchedOpenParam)
		}

		paramsObj[latestMatchedOpenParam] += paramContents
	}
}


// ---- Unified tool-call detection helpers ----

/**
 * Extract a tool name from a detected tag/pattern, based on its format.
 */
const extractToolNameFromTag = (tag: string, tools: InternalToolInfo[]): ToolName => {
	// XML: <tool_name>
	if (tag.startsWith('<') && tag.endsWith('>') && !tag.startsWith('{"')) {
		return tag.substring(1, tag.length - 1) as ToolName
	}
	// JSON/hybrid: {"name":"tool_name" or {"name":"tool_name">
	const jsonMatch = tag.match(/"name"\s*:\s*"([^"]+)"/)
	if (jsonMatch) {
		return jsonMatch[1] as ToolName
	}
	// Function-call: tool_name({ or tool_name{
	for (const t of tools) {
		if (tag.startsWith(t.name)) {
			return t.name as ToolName
		}
	}
	return tag as ToolName
}

/**
 * Detect function-call patterns in text: tool_name({...}) or tool_name{...}
 * Only matches registered tool names.
 */
const findFnCallPattern = (text: string, tools: InternalToolInfo[]): { idx: number, toolName: ToolName } | null => {
	for (const tool of tools) {
		// Match: tool_name({ — function call with JSON arg in parens
		const fnParenIdx = text.indexOf(`${tool.name}({`)
		if (fnParenIdx !== -1) {
			return { idx: fnParenIdx, toolName: tool.name as ToolName }
		}
		// Match: tool_name( — function call with opening paren (args may follow)
		const fnIdx = text.indexOf(`${tool.name}(`)
		if (fnIdx !== -1) {
			// Verify this looks like a tool call, not prose (check for { or " after the paren)
			const afterParen = text.substring(fnIdx + tool.name.length + 1, fnIdx + tool.name.length + 3)
			if (afterParen.startsWith('{') || afterParen.startsWith('"') || afterParen.startsWith("'")) {
				return { idx: fnIdx, toolName: tool.name as ToolName }
			}
		}
		// Match: tool_name{ — direct JSON arg without parens
		const directIdx = text.indexOf(`${tool.name}{`)
		if (directIdx !== -1) {
			return { idx: directIdx, toolName: tool.name as ToolName }
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
		const pattern = `"name":"${tool.name}"`
		const patternIdx = text.indexOf(pattern)
		if (patternIdx !== -1) {
			// Walk backward to find the opening { of the JSON object
			const braceIdx = text.lastIndexOf('{', patternIdx)
			if (braceIdx >= 0) {
				return { idx: braceIdx, toolName: tool.name as ToolName }
			}
		}
		// Also check with spaces around colon
		const patternSpaced = `"name" : "${tool.name}"`
		const patternSpacedIdx = text.indexOf(patternSpaced)
		if (patternSpacedIdx !== -1) {
			const braceIdx = text.lastIndexOf('{', patternSpacedIdx)
			if (braceIdx >= 0) {
				return { idx: braceIdx, toolName: tool.name as ToolName }
			}
		}
	}
	return null
}

/**
 * Detect partial function-call or JSON tool-call patterns at the end of text
 * that should be buffered (not yet shown to the user).
 *
 * Only buffers patterns that strongly indicate a tool invocation:
 * - tool_name( with no matching ) → function-call in progress
 * - {"name":"<partial_tool_name → JSON tool call starting
 *
 * Normal prose like "I'll use get_dir_tree to inspect" is NOT buffered
 * because there's no ( or { after the tool name.
 */
const findPartialFnJsonAtEnd = (text: string, tools: InternalToolInfo[]): number | null => {
	// 1. Check for tool_name( near the end without matching )
	for (const tool of tools) {
		const fnStart = `${tool.name}(`
		const lastIdx = text.lastIndexOf(fnStart)
		if (lastIdx !== -1) {
			const afterFn = text.substring(lastIdx + fnStart.length)
			// If no closing ) found, this is a partial function call — buffer it
			if (!afterFn.includes(')')) {
				return lastIdx
			}
		}
	}

	// 2. Check for tool_name{ near the end without matching }
	for (const tool of tools) {
		const fnStart = `${tool.name}{`
		const lastIdx = text.lastIndexOf(fnStart)
		if (lastIdx !== -1) {
			const afterFn = text.substring(lastIdx + fnStart.length)
			const openBraces = (afterFn.match(/{/g) || []).length + 1 // +1 for the one in fnStart
			const closeBraces = (afterFn.match(/}/g) || []).length
			if (openBraces > closeBraces) {
				return lastIdx
			}
		}
	}

	// 3. Check for partial JSON: {"name":"<partial_tool_name at end of text
	const jsonPrefixMatch = text.match(/\{\s*"name"\s*:\s*"([^"]*?)$/)
	if (jsonPrefixMatch) {
		const partialName = jsonPrefixMatch[1]
		// Only buffer if some registered tool name starts with this partial
		if (tools.some(t => t.name.startsWith(partialName))) {
			const bufferStart = text.lastIndexOf(jsonPrefixMatch[0])
			if (bufferStart >= 0) {
				return bufferStart
			}
		}
	}

	// 4. Check for {"name":"tool_name" at end without complete JSON object
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

/**
 * Unified tool-call extractor for streaming LLM responses.
 *
 * Handles three tool-call formats:
 * 1. XML:            <tool_name><param>value</param></tool_name>
 * 2. Function-call:  tool_name({...}) or tool_name{...}
 * 3. JSON:           {"name":"tool_name","args":{...}}
 *
 * Architecture: maintains two separate buffers:
 * - `visibleTextSoFar`    — only user-facing text (never contains tool syntax)
 * - `toolProtocolBuffer`  — tool syntax being accumulated (never shown to UI)
 *
 * This prevents tool protocol from contaminating the assistant message.
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
	// XML open tags (kept for backward compatibility with XML-format models)
	const xmlOpenTags = tools.flatMap(t => [`<${t.name}>`, `{"name":"${t.name}">`])
	for (const t of tools) { toolOfToolName[t.name] = t }

	const toolId = generateUuid()

	// ---- Dual-buffer state ----
	let visibleTextSoFar = ''     // only user-facing text → goes to displayContentSoFar
	let trueFullText = ''         // raw model output (internal only, for parsing)
	let latestToolCall: RawToolCallObj | undefined = undefined

	// For XML partial tag detection (existing mechanism)
	let foundToolStart: { idx: number, toolName: ToolName } | null = null
	let pendingBuffer = ''        // text not yet classified as visible or tool protocol

	let prevFullTextLen = 0
	const newOnText: OnText = (params) => {
		const newText = params.fullText.substring(prevFullTextLen)
		prevFullTextLen = params.fullText.length
		trueFullText = params.fullText

		// If we've already found the start of a tool invocation, all subsequent
		// text is part of the tool protocol — don't add to visible text.
		if (foundToolStart !== null) {
			// Re-parse tool call from the full raw text starting at the tool position
			const toolText = trueFullText.substring(foundToolStart.idx, Infinity)

			// Try XML parsing
			latestToolCall = parseXMLPrefixToToolCall(
				foundToolStart.toolName,
				toolId,
				toolText,
				toolOfToolName,
			)

			// If XML parsing didn't produce params, try JSON/function-call parsing
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

		// --- No tool start found yet — classify incoming text ---

		pendingBuffer += newText

		// Step 1: Check for partial XML tag at end of pending buffer
		const isPartialXML = findPartiallyWrittenToolTagAtEnd(pendingBuffer, xmlOpenTags)
		if (isPartialXML) {
			// Buffer entire pending text — might be start of an XML tag
			onText({
				...params,
				fullText: visibleTextSoFar,
				toolCall: latestToolCall,
			})
			return
		}

		// Step 2: Flush pending buffer into visible text, then scan for patterns
		visibleTextSoFar += pendingBuffer
		pendingBuffer = ''

		// Step 3: Check for complete XML open tag
		const xmlMatch = findIndexOfAny(visibleTextSoFar, xmlOpenTags)
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

		// Step 4: Check for function-call pattern: tool_name({...}) or tool_name{...}
		const fnMatch = findFnCallPattern(visibleTextSoFar, tools)
		if (fnMatch) {
			foundToolStart = { idx: fnMatch.idx, toolName: fnMatch.toolName }
			visibleTextSoFar = visibleTextSoFar.substring(0, fnMatch.idx)

			const toolText = trueFullText.substring(fnMatch.idx, Infinity)
			const jsonResult = parseJSONToolCall(toolText, tools)
			if (jsonResult) {
				latestToolCall = jsonResult.toolCall
			} else {
				// Partial function-call — create a placeholder tool call
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

		// Step 5: Check for JSON tool-call pattern: {"name":"tool_name",...}
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

		// Step 6: Check for partial function-call/JSON at end of visible text
		// Buffer these so they don't flash in the UI before being classified
		const partialMatch = findPartialFnJsonAtEnd(visibleTextSoFar, tools)
		if (partialMatch !== null) {
			pendingBuffer = visibleTextSoFar.substring(partialMatch)
			visibleTextSoFar = visibleTextSoFar.substring(0, partialMatch)
		}

		// Emit visible text to the UI
		onText({
			...params,
			fullText: visibleTextSoFar,
			toolCall: latestToolCall,
		})
	}


	const newOnFinalMessage: OnFinalMessage = (params) => {
		// Flush any remaining text before processing final message
		newOnText({ ...params })

		// If there was pending text that never resolved to a tool call, add it to visible
		if (pendingBuffer && !foundToolStart) {
			visibleTextSoFar += pendingBuffer
			pendingBuffer = ''
		}

		visibleTextSoFar = visibleTextSoFar.trimEnd()
		let toolCall = latestToolCall
		let finalText = visibleTextSoFar

		// Final pass: if no tool call was detected during streaming, try the
		// full-text JSON parser as a last resort (handles edge cases)
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

// Keep backward-compatible alias
export const extractXMLToolsWrapper = extractToolsWrapper

const parseJSONToolCall = (text: string, tools: InternalToolInfo[]): { start: number, toolCall: RawToolCallObj } | null => {
	// Some OpenAI-compatible models emit a compact tool-call object, while
	// others occasionally turn the descriptive phrase "name file or folder"
	// into a malformed key. Accept that specific, unambiguous variant and
	// normalize it to our canonical create tool before validation.
	const nameMatch = /"(?:name|name_file_or_folder)"\s*(?::|,)/g
	let start = -1
	for (const match of text.matchAll(nameMatch)) {
		const brace = text.lastIndexOf('{', match.index ?? -1)
		if (brace >= 0) start = brace
	}

	// Support models that output `tool_name{"arg": "val"}` directly
	let directToolName: string | null = null;
	if (start < 0) {
		for (const tool of tools) {
			const toolRegex = new RegExp(`\\b${tool.name}\\s*\\{`, 'g')
			let match;
			while ((match = toolRegex.exec(text)) !== null) {
				start = match.index + match[0].length - 1 // points to '{'
				directToolName = tool.name;
			}
		}
	}

	// Support models that output `tool_name({...})` with parens
	if (start < 0) {
		for (const tool of tools) {
			const toolRegex = new RegExp(`\\b${tool.name}\\s*\\(\\s*\\{`, 'g')
			let match;
			while ((match = toolRegex.exec(text)) !== null) {
				// Point start to the opening { (skip the paren)
				const braceIdx = text.indexOf('{', match.index + tool.name.length)
				if (braceIdx >= 0) {
					start = braceIdx
					directToolName = tool.name
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
		// A few providers produce `"uri>C:\\project"` rather than a JSON
		// `"uri":"C:\\\\project"` pair. This is still unambiguous inside the
		// args object, so repair it before parsing and escape Windows separators.
		repairedCandidate = repairedCandidate.replace(/"uri\s*>\s*([^"\r\n]*)"/g, (_match, rawPath: string) => {
			const escapedPath = rawPath.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
			return `"uri":"${escapedPath}"`
		})
		const parsed = JSON.parse(repairedCandidate) as { name?: unknown, args?: unknown, arguments?: unknown }
		
		let toolName = directToolName || parsed.name;
		toolName = toolName === 'name_file_or_folder' ? 'create_file_or_folder' : toolName
		if (typeof toolName !== 'string' || !tools.some(tool => tool.name === toolName)) return null

		let rawArgs: unknown = directToolName ? parsed : (parsed.args ?? parsed.arguments ?? {})
		if (typeof rawArgs === 'string') rawArgs = rawArgs.trim() ? JSON.parse(rawArgs) : {}
		if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) return null
		const rawParams = rawArgs as RawToolParamsObj
		return {
			start,
			toolCall: {
				name: toolName as ToolName,
				rawParams,
				doneParams: Object.keys(rawParams) as ToolParamName<ToolName>[],
				id: generateUuid(),
				isDone: true,
			},
		}
	} catch {
		if (directToolName) {
			// Recover from invalid JSON args by passing empty args
			return {
				start,
				toolCall: {
					name: directToolName as ToolName,
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
