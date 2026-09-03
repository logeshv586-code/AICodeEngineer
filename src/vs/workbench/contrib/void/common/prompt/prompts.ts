/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { IDirectoryStrService } from '../directoryStrService.js';
import { StagingSelectionItem } from '../chatThreadServiceTypes.js';
import { os } from '../helpers/systemInfo.js';
import { RawToolParamsObj } from '../sendLLMMessageTypes.js';
import { approvalTypeOfBuiltinToolName, BuiltinToolCallParams, BuiltinToolName, BuiltinToolResultType, ToolName } from '../toolsServiceTypes.js';
import { ChatMode } from '../voidSettingsTypes.js';

export const tripleTick = ['```', '```']

export const MAX_DIRSTR_CHARS_TOTAL_BEGINNING = 20_000
export const MAX_DIRSTR_CHARS_TOTAL_TOOL = 20_000
export const MAX_DIRSTR_RESULTS_TOTAL_BEGINNING = 100
export const MAX_DIRSTR_RESULTS_TOTAL_TOOL = 100

export const MAX_FILE_CHARS_PAGE = 500_000
export const MAX_CHILDREN_URIS_PAGE = 500

export const MAX_TERMINAL_CHARS = 100_000
export const MAX_TERMINAL_INACTIVE_TIME = 8
export const MAX_TERMINAL_BG_COMMAND_TIME = 5

export const MAX_PREFIX_SUFFIX_CHARS = 20_000

export const ORIGINAL = `<<<<<<< ORIGINAL`
export const DIVIDER = `=======`
export const FINAL = `>>>>>>> UPDATED`

const searchReplaceBlockTemplate = `\
${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}

${ORIGINAL}
// ... original code goes here
${DIVIDER}
// ... final code goes here
${FINAL}`

const createSearchReplaceBlocks_systemMessage = `\
You are a coding assistant that takes in a diff and outputs SEARCH/REPLACE code blocks that implement the requested change.
The diff is labeled \`DIFF\` and the original file is labeled \`ORIGINAL_FILE\`.

Format every SEARCH/REPLACE block exactly like this:
${tripleTick[0]}
${searchReplaceBlockTemplate}
${tripleTick[1]}

Rules:
1. Implement the diff completely.
2. You may output multiple SEARCH/REPLACE blocks.
3. Treat comments in the diff as part of the requested change.
4. Output SEARCH/REPLACE blocks only. Do not add explanations.
5. ORIGINAL text must exactly match the original file, including whitespace and comments.
6. Each ORIGINAL section must uniquely identify its target while remaining as small as practical.
7. ORIGINAL sections must not overlap.`

const replaceTool_description = `\
A single string containing one or more SEARCH/REPLACE blocks.
Use this exact format:
${searchReplaceBlockTemplate}

Rules:
1. ORIGINAL must exactly match text in the current file.
2. Each ORIGINAL section must uniquely identify its target.
3. ORIGINAL sections must not overlap.
4. Keep each block as small as practical while still unique.
5. This parameter is a STRING, not an array.`

const chatSuggestionDiffExample = `\
${tripleTick[0]}typescript
/Users/username/Desktop/my_project/app.ts
// ... existing code ...
// {{change}}
// ... existing code ...
${tripleTick[1]}`

export type InternalToolInfo = {
	name: string,
	description: string,
	params: {
		[paramName: string]: { description: string }
	},
	mcpServerName?: string,
}

const uriParam = (object: string) => ({
	uri: { description: `The FULL path to the ${object}. Relative paths are resolved inside the active workspace.` }
})

const paginationParam = {
	page_number: { description: 'Optional. The page number of the result. Default is 1.' }
} as const

const terminalDescHelper = `Run a command in the user's workspace. Use terminal commands for builds, tests, package-manager operations, git inspection, generators, and diagnostics. Do not modify source files with terminal text-replacement commands when edit_file or rewrite_file can perform the change safely.`
const cwdHelper = 'Optional. The directory in which to run the command. Defaults to the first workspace folder.'

export type SnakeCase<S extends string> =
	S extends 'URI' ? 'uri'
	: S extends `${infer Prefix}URI` ? `${SnakeCase<Prefix>}_uri`
	: S extends `${infer C}${infer Rest}`
	? `${C extends Lowercase<C> ? C : `_${Lowercase<C>}`}${SnakeCase<Rest>}`
	: S;

export type SnakeCaseKeys<T extends Record<string, any>> = {
	[K in keyof T as SnakeCase<Extract<K, string>>]: T[K]
};

export const builtinTools: {
	[T in keyof BuiltinToolCallParams]: {
		name: string;
		description: string;
		params: Partial<{ [paramName in keyof SnakeCaseKeys<BuiltinToolCallParams[T]>]: { description: string } }>
	}
} = {
	read_file: {
		name: 'read_file',
		description: `Read file contents with explicit paging metadata. COMPLETE means the requested content is complete. MORE_PAGES means call read_file again with the next page_number. Never ask the user to paste a local file that this tool can read.`,
		params: {
			...uriParam('file'),
			start_line: { description: 'Optional. Use only when exact line numbers are already known. Defaults to the beginning.' },
			end_line: { description: 'Optional. Use only when exact line numbers are already known. Defaults to the end.' },
			...paginationParam,
		},
	},
	ls_dir: {
		name: 'ls_dir',
		description: `List files and folders in a directory.`,
		params: {
			uri: { description: `Optional. The full folder path. Leave empty to use the active workspace root.` },
			...paginationParam,
		},
	},
	get_dir_tree: {
		name: 'get_dir_tree',
		description: `Return a tree of files and folders beneath a workspace directory. Use this to understand unfamiliar project structure.`,
		params: {
			...uriParam('folder')
		}
	},
	search_pathnames_only: {
		name: 'search_pathnames_only',
		description: `Search file and folder names in the workspace. Use this when you know or can infer part of a path or filename.`,
		params: {
			query: { description: `Filename/path query.` },
			include_pattern: { description: 'Optional. Limit the search only when broad results are too large.' },
			...paginationParam,
		},
	},
	search_for_files: {
		name: 'search_for_files',
		description: `Search workspace file contents by substring or regex and return matching file paths.`,
		params: {
			query: { description: `Text or regex to search for.` },
			search_in_folder: { description: 'Optional. Restrict to descendants of this workspace folder.' },
			is_regex: { description: 'Optional. Default false.' },
			...paginationParam,
		},
	},
	search_in_file: {
		name: 'search_in_file',
		description: `Find line numbers containing a string or regex inside one file.`,
		params: {
			...uriParam('file'),
			query: { description: 'String or regex to find.' },
			is_regex: { description: 'Optional. Default false.' }
		}
	},
	read_lint_errors: {
		name: 'read_lint_errors',
		description: `Read current editor/language-service lint diagnostics for a file.`,
		params: {
			...uriParam('file'),
		},
	},
	create_file_or_folder: {
		name: 'create_file_or_folder',
		description: `Create a file or folder inside the workspace. Folder paths must end with a slash. For source files, include complete initial contents whenever practical.`,
		params: {
			...uriParam('file or folder'),
			content: { description: 'Optional for folders. For files, complete initial UTF-8 content.' },
		},
	},
	delete_file_or_folder: {
		name: 'delete_file_or_folder',
		description: `Delete a workspace file or folder.`,
		params: {
			...uriParam('file or folder'),
			is_recursive: { description: 'Optional. true for recursive folder deletion.' }
		},
	},
	edit_file: {
		name: 'edit_file',
		description: `Apply exact SEARCH/REPLACE blocks to an existing file. Prefer this for targeted edits after reading the relevant code.`,
		params: {
			...uriParam('file'),
			search_replace_blocks: { description: replaceTool_description }
		},
	},
	rewrite_file: {
		name: 'rewrite_file',
		description: `Replace the entire file content. Use for new/small files or when a whole-file rewrite is clearly safer than targeted replacement.`,
		params: {
			...uriParam('file'),
			new_content: { description: `Complete new file contents.` }
		},
	},
	run_command: {
		name: 'run_command',
		description: `Run a foreground terminal command and wait for its result. The command returns after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity. ${terminalDescHelper}`,
		params: {
			command: { description: 'Terminal command to run.' },
			cwd: { description: cwdHelper },
		},
	},
	run_persistent_command: {
		name: 'run_persistent_command',
		description: `Run a command in a persistent terminal created by open_persistent_terminal. Useful for already-running shells and services. ${terminalDescHelper}`,
		params: {
			command: { description: 'Terminal command to run.' },
			persistent_terminal_id: { description: 'Persistent terminal ID.' },
		},
	},
	open_persistent_terminal: {
		name: 'open_persistent_terminal',
		description: `Open a persistent terminal for a dev server, watcher, listener, REPL, or other long-running process.`,
		params: {
			cwd: { description: cwdHelper },
		}
	},
	kill_persistent_terminal: {
		name: 'kill_persistent_terminal',
		description: `Stop and close a persistent terminal.`,
		params: { persistent_terminal_id: { description: `Persistent terminal ID.` } }
	},
	semantic_search: {
		name: 'semantic_search',
		description: `Search the current project's local semantic code index for relevant code snippets and symbols. Use it for unfamiliar implementations; fall back immediately to exact workspace search when indexing is unavailable or insufficient.`,
		params: {
			query: { description: `Natural-language code concept or implementation query.` },
			top_k: { description: `Optional. Number of results, default 5.` }
		}
	}
} satisfies { [T in keyof BuiltinToolResultType]: InternalToolInfo }

export const builtinToolNames = Object.keys(builtinTools) as BuiltinToolName[]
const toolNamesSet = new Set<string>(builtinToolNames)

export const toolAliasesByCanonicalName: Readonly<Record<string, readonly string[]>> = {
	create_file_or_folder: ['write_file', 'write_file_or_folder', 'create_file', 'create_folder', 'save_file', 'write_to_file', 'put_file', 'new_file', 'write'],
	read_file: ['read_file_or_folder', 'view_file', 'get_file', 'cat_file', 'read'],
	edit_file: ['modify_file', 'update_file', 'apply_diff'],
	rewrite_file: ['overwrite_file', 'replace_file'],
	delete_file_or_folder: ['delete_file', 'remove_file', 'unlink_file', 'rm'],
	ls_dir: ['list_dir', 'dir_list', 'ls', 'list_directory'],
	get_dir_tree: ['dir_tree', 'tree', 'directory_tree'],
	search_for_files: ['file_search', 'grep', 'search_files', 'search'],
	search_pathnames_only: ['find_files', 'locate_file'],
	run_command: ['exec', 'execute_command', 'run_terminal_command', 'bash', 'terminal'],
}

export const toolNamesIncludingAliases = (canonicalName: string): string[] => [
	canonicalName,
	...(toolAliasesByCanonicalName[canonicalName] ?? []),
]

export const parameterAliasesByCanonicalName: Readonly<Record<string, readonly string[]>> = {
	uri: ['path', 'file_path', 'filePath', 'target_file', 'targetFile', 'filename', 'file', 'location', 'url'],
	content: ['code', 'text', 'file_content', 'fileContent', 'body', 'contents', 'code_content', 'codeContent'],
	new_content: ['newContent', 'content', 'code', 'text', 'file_content', 'fileContent', 'body', 'contents', 'code_content', 'codeContent'],
	search_replace_blocks: ['searchReplaceBlocks', 'blocks', 'diff', 'patch', 'search_replace', 'searchReplace'],
	query: ['pattern', 'search', 'term', 'q', 'search_query', 'searchQuery'],
	command: ['cmd', 'script', 'shell_command', 'shellCommand'],
	cwd: ['working_directory', 'workingDirectory', 'directory'],
	search_in_folder: ['searchInFolder', 'folder', 'root', 'search_path', 'searchPath'],
	include_pattern: ['includePattern', 'glob'],
	is_regex: ['isRegex', 'regex'],
	is_recursive: ['isRecursive', 'recursive'],
	page_number: ['pageNumber', 'page'],
	start_line: ['startLine', 'line_start', 'lineStart'],
	end_line: ['endLine', 'line_end', 'lineEnd'],
	top_k: ['topK', 'limit', 'k'],
	persistent_terminal_id: ['persistentTerminalId', 'terminal_id', 'terminalId'],
}

export const parameterNamesIncludingAliases = (canonicalName: string): string[] => [
	canonicalName,
	...(parameterAliasesByCanonicalName[canonicalName] ?? []),
]

export const normalizeToolName = (toolName: string): BuiltinToolName | string => {
	if (!toolName) return toolName
	const lower = toolName.trim().replace(/^<+/, '').replace(/[>{(\s]+$/, '').toLowerCase()
	for (const canonical of builtinToolNames) {
		if (lower === canonical.toLowerCase()) return canonical
		if ((toolAliasesByCanonicalName[canonical] ?? []).some(alias => alias.toLowerCase() === lower)) return canonical
	}
	return toolName
}

export const normalizeRawParams = (rawParams: RawToolParamsObj): RawToolParamsObj => {
	if (!rawParams || typeof rawParams !== 'object') return rawParams
	for (const canonicalName of Object.keys(parameterAliasesByCanonicalName)) {
		const value = parameterNamesIncludingAliases(canonicalName)
			.map(name => rawParams[name])
			.find(candidate => candidate !== undefined && candidate !== null)
		if (value === undefined) continue
		rawParams[canonicalName] = typeof value === 'string'
			? value
			: canonicalName === 'search_replace_blocks' ? JSON.stringify(value) : String(value)
	}
	return rawParams
}

export const isABuiltinToolName = (toolName: string): toolName is BuiltinToolName => {
	return toolNamesSet.has(normalizeToolName(toolName))
}

export const availableTools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined) => {
	const builtinToolNamesForMode: BuiltinToolName[] | undefined = chatMode === 'normal' ? undefined
		: chatMode === 'gather' ? builtinToolNames.filter(toolName => !(toolName in approvalTypeOfBuiltinToolName))
			: chatMode === 'agent' ? builtinToolNames
				: undefined
	const effectiveBuiltinTools = builtinToolNamesForMode?.map(toolName => builtinTools[toolName]) ?? undefined
	const effectiveMCPTools = chatMode === 'agent' || chatMode === 'gather' ? mcpTools : undefined
	return !(builtinToolNamesForMode || mcpTools) ? undefined : [
		...(effectiveBuiltinTools ?? []),
		...(effectiveMCPTools ?? []),
	]
}

const toolCallDefinitionsXMLString = (tools: InternalToolInfo[]) => tools.map((tool, index) => {
	const params = Object.keys(tool.params).map(paramName => `<${paramName}>${tool.params[paramName].description}</${paramName}>`).join('\n')
	return `\
    ${index + 1}. ${tool.name}
    Description: ${tool.description}
    Format:
    <${tool.name}>${params ? `\n${params}` : ''}
    </${tool.name}>`
}).join('\n\n')

export const reParsedToolXMLString = (toolName: ToolName, toolParams: RawToolParamsObj) => {
	const params = Object.keys(toolParams).map(paramName => `<${paramName}>${toolParams[paramName]}</${paramName}>`).join('\n')
	return `\
    <${toolName}>${params ? `\n${params}` : ''}
    </${toolName}>`.replace('\t', '  ')
}

const systemToolsXMLPrompt = (chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined) => {
	const tools = availableTools(chatMode, mcpTools)
	if (!tools?.length) return null
	return `\
    Available tools:

    ${toolCallDefinitionsXMLString(tools)}

    Tool calling rules:
    - To use a tool, output exactly one tool call using one of the formats above.
    - A tool-call turn MUST contain the tool call only. Do not write a preamble, plan, narration, progress update, explanation, or trailing text in that same response.
    - After emitting the tool call, stop and wait for the result. Forge will continue the agent loop automatically.
    - All parameters are required unless their description says Optional.
    - Use the exact registered tool name. Do not invent tool names.
    - Use the actual workspace path listed in system_info or a relative path. Never use /workspace as a literal filesystem target.
    - Keep discovery/edit/test iterations inside the tool loop. Send normal prose to the user only when the task is complete, blocked on a genuine user decision, or requires approval.`
}

export const chat_systemMessage = ({ workspaceFolders, openedURIs, activeURI, persistentTerminalIDs, directoryStr, chatMode: mode, mcpTools, includeXMLToolDefinitions }: { workspaceFolders: string[], directoryStr: string, openedURIs: string[], activeURI: string | undefined, persistentTerminalIDs: string[], chatMode: ChatMode, mcpTools: InternalToolInfo[] | undefined, includeXMLToolDefinitions: boolean }) => {
	const header = `You are Forge, an expert coding ${mode === 'agent' ? 'agent' : 'assistant'}.
${mode === 'agent' ? 'Your job is to inspect, modify, run, test, debug, and verify the user\'s codebase until the requested task is complete.' : mode === 'gather' ? 'Your job is to search and understand the user\'s codebase accurately.' : 'Your job is to help with coding tasks.'}
You may receive explicitly selected files or folders under SELECTIONS.`

	const sysInfo = `Here is the user's system information:
<system_info>
- ${os}
- Workspace folders:
${workspaceFolders.join('\n') || 'NO FOLDERS OPEN'}
- Active file:
${activeURI || 'NONE'}
- Open files:
${openedURIs.join('\n') || 'NO OPENED FILES'}${mode === 'agent' && persistentTerminalIDs.length ? `\n- Persistent terminal IDs: ${persistentTerminalIDs.join(', ')}` : ''}
</system_info>`

	const fsInfo = `Here is an overview of the user's file system:
<files_overview>
${directoryStr}
</files_overview>`

	const toolDefinitions = includeXMLToolDefinitions ? systemToolsXMLPrompt(mode, mcpTools) : null
	const details: string[] = []

	details.push('Do not invent file contents, command results, test results, or project structure. Ground codebase claims in the provided context or tool results.')

	if (mode === 'agent' || mode === 'gather') {
		details.push('Use tools whenever they materially help. You do not need to ask permission for read-only workspace inspection.')
		details.push('Tool-call turns are silent execution turns: emit only the tool call. Never write "let me inspect", "I will check", "I am going to", or similar progress narration before a tool call.')
		details.push('Do not send user-facing progress prose between consecutive tool calls. Continue the tool loop until you have a final result, a real blocker, or an approval requirement.')
		details.push('Use semantic_search when locating an unfamiliar implementation or concept. If the local semantic index is unavailable, incomplete, or irrelevant, immediately fall back to exact workspace search and file reads.')
		details.push('If an exact filename/path or active file is already known, read/search it directly instead of performing unnecessary discovery.')
		details.push('When a tool result says COMPLETE, trust it. When it says MORE_PAGES or CONTEXT_SHORTENED, retrieve the missing page/range yourself instead of asking the user to paste the file.')
	}

	if (mode === 'agent') {
		details.push('For implementation requests, take action with tools. Do not merely describe edits that you could make yourself.')
		details.push('Follow the full engineering loop: understand acceptance criteria; inspect relevant code and dependencies; edit; run targeted lint/type/build/tests; diagnose failures; fix them; then verify the final state.')
		details.push('Prefer the smallest sufficient set of reads. Read related definitions/usages before risky cross-file edits, but do not repeatedly re-read unchanged files without a reason.')
		details.push('Use edit_file for targeted changes and rewrite_file for new/small files or true whole-file rewrites. Never claim a file changed unless the edit tool succeeded.')
		details.push('Use terminal tools for actual builds/tests/package operations. Never claim checks passed unless their command result shows success.')
		details.push('If tests fail because of your changes, continue fixing. If failures clearly pre-existed or require credentials/external infrastructure, report that evidence precisely in the final answer.')
		details.push('Never modify files outside the opened workspace.')
		details.push('Do not stop simply because one model response or context window ended. Resume from compacted history and continue until the task is verified.')
		details.push('When creating requested artifacts, create them inside the workspace, verify they exist, and report the exact path in the final response.')
	}

	if (mode === 'gather') {
		details.push('Gather enough exact context to answer accurately. Use read/search tools instead of guessing.')
	}

	if (mode === 'normal') {
		details.push('If more local context is required, ask the user to reference files/folders with @.')
	}

	details.push(`If you present code blocks to the user, include the language when possible. If a full path is known and relevant, put it on the first line of the block.`)

	if (mode === 'gather' || mode === 'normal') {
		details.push(`When suggesting a file edit rather than applying it, use a concise code block with the full path and only the changed area. Example:\n${chatSuggestionDiffExample}`)
	}

	details.push('Use Markdown for user-facing prose. Keep the final answer focused on what changed, what was verified, and any remaining blocker.')
	details.push(`Today's date is ${new Date().toDateString()}.`)

	const importantDetails = `Important notes:\n${details.map((detail, index) => `${index + 1}. ${detail}`).join('\n\n')}`
	return [header, sysInfo, toolDefinitions, importantDetails, fsInfo].filter(Boolean).join('\n\n\n').trim().replace('\t', '  ')
}

export const DEFAULT_FILE_SIZE_LIMIT = 2_000_000

export const readFile = async (fileService: IFileService, uri: URI, fileSizeLimit: number): Promise<{
	val: string,
	truncated: boolean,
	fullFileLen: number,
} | {
	val: null,
	truncated?: undefined
	fullFileLen?: undefined,
}> => {
	try {
		const fileContent = await fileService.readFile(uri)
		const val = fileContent.value.toString()
		if (val.length > fileSizeLimit) return { val: val.substring(0, fileSizeLimit), truncated: true, fullFileLen: val.length }
		return { val, truncated: false, fullFileLen: val.length }
	}
	catch {
		return { val: null }
	}
}

export const messageOfSelection = async (
	s: StagingSelectionItem,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService,
		folderOpts: {
			maxChildren: number,
			maxCharsPerFile: number,
		}
	}
) => {
	const lineNumAddition = (range: [number, number]) => ` (lines ${range[0]}:${range[1]})`
	if (s.type === 'CodeSelection') {
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)
		const lines = val?.split('\n')
		const innerVal = lines?.slice(s.range[0] - 1, s.range[1]).join('\n')
		const content = !lines ? '' : `${tripleTick[0]}${s.language}\n${innerVal}\n${tripleTick[1]}`
		return `${s.uri.fsPath}${lineNumAddition(s.range)}:\n${content}`
	}
	if (s.type === 'File') {
		const { val } = await readFile(opts.fileService, s.uri, DEFAULT_FILE_SIZE_LIMIT)
		const content = val === null ? '' : `${tripleTick[0]}${s.language}\n${val}\n${tripleTick[1]}`
		return `${s.uri.fsPath}:\n${content}`
	}
	if (s.type === 'Folder') {
		const dirStr = await opts.directoryStrService.getDirectoryStrTool(s.uri)
		const folderStructure = `${s.uri.fsPath} folder structure:${tripleTick[0]}\n${dirStr}\n${tripleTick[1]}`
		const uris = await opts.directoryStrService.getAllURIsInDirectory(s.uri, { maxResults: opts.folderOpts.maxChildren })
		const strOfFiles = await Promise.all(uris.map(async uri => {
			const { val, truncated } = await readFile(opts.fileService, uri, opts.folderOpts.maxCharsPerFile)
			const truncationStr = truncated ? `\n... file truncated ...` : ''
			const content = val === null ? 'null' : `${tripleTick[0]}\n${val}${truncationStr}\n${tripleTick[1]}`
			return `${uri.fsPath}:\n${content}`
		}))
		return [folderStructure, ...strOfFiles].join('\n\n')
	}
	if (s.type === 'BrowserComponent') {
		return `[${s.title}]\nURL: ${s.uri.toString()}\n${tripleTick[0]}markdown\n${s.content}\n${tripleTick[1]}`
	}
	return ''
}

export const chat_userMessageContent = async (
	instructions: string,
	currSelns: StagingSelectionItem[] | null,
	opts: {
		directoryStrService: IDirectoryStrService,
		fileService: IFileService
	},
) => {
	const selnsStrs = await Promise.all((currSelns ?? []).map(s => messageOfSelection(s, {
		...opts,
		folderOpts: { maxChildren: 100, maxCharsPerFile: 100_000 }
	})))
	const selections = selnsStrs.join('\n\n')
	return selections ? `${instructions}\n---\nSELECTIONS\n${selections}` : instructions
}

export const rewriteCode_systemMessage = `\
You are a coding assistant that rewrites an entire file to make a requested change.
Return the complete updated file only. Preserve unrelated comments, formatting, and behavior whenever possible. Do not add explanations.`

export const rewriteCode_userMessage = ({ originalCode, applyStr, language }: { originalCode: string, applyStr: string, language: string }) => `\
ORIGINAL_FILE
${tripleTick[0]}${language}
${originalCode}
${tripleTick[1]}

CHANGE
${tripleTick[0]}
${applyStr}
${tripleTick[1]}

INSTRUCTIONS
Apply the requested change and return only the complete updated file.`

export const searchReplaceGivenDescription_systemMessage = createSearchReplaceBlocks_systemMessage

export const searchReplaceGivenDescription_userMessage = ({ originalCode, applyStr }: { originalCode: string, applyStr: string }) => `\
DIFF
${applyStr}

ORIGINAL_FILE
${tripleTick[0]}
${originalCode}
${tripleTick[1]}`

export const voidPrefixAndSuffix = ({ fullFileStr, startLine, endLine }: { fullFileStr: string, startLine: number, endLine: number }) => {
	const fullFileLines = fullFileStr.split('\n')
	let prefix = ''
	let i = startLine - 1
	while (i !== 0) {
		const newLine = fullFileLines[i - 1]
		if (newLine.length + 1 + prefix.length <= MAX_PREFIX_SUFFIX_CHARS) {
			prefix = `${newLine}\n${prefix}`
			i -= 1
		}
		else break
	}
	let suffix = ''
	let j = endLine - 1
	while (j !== fullFileLines.length - 1) {
		const newLine = fullFileLines[j + 1]
		if (newLine.length + 1 + suffix.length <= MAX_PREFIX_SUFFIX_CHARS) {
			suffix = `${suffix}\n${newLine}`
			j += 1
		}
		else break
	}
	return { prefix, suffix }
}

export type QuickEditFimTagsType = {
	preTag: string,
	sufTag: string,
	midTag: string
}

export const defaultQuickEditFimTags: QuickEditFimTagsType = {
	preTag: 'ABOVE',
	sufTag: 'BELOW',
	midTag: 'SELECTION',
}

export const ctrlKStream_systemMessage = ({ quickEditFIMTags: { preTag, midTag, sufTag } }: { quickEditFIMTags: QuickEditFimTagsType }) => `\
You are a fill-in-the-middle coding assistant. Replace only the SELECTION marked by <${midTag}> tags.
The user provides context before it in <${preTag}> tags and after it in <${sufTag}> tags.
Output one block only: <${midTag}>...new code...</${midTag}>.
Do not change content outside the selection. Keep syntax and brackets balanced.`

export const ctrlKStream_userMessage = ({ selection, prefix, suffix, instructions, fimTags, language }: {
	selection: string,
	prefix: string,
	suffix: string,
	instructions: string,
	fimTags: QuickEditFimTagsType,
	language: string,
}) => {
	const { preTag, sufTag, midTag } = fimTags
	return `\
CURRENT SELECTION
${tripleTick[0]}${language}
<${midTag}>${selection}</${midTag}>
${tripleTick[1]}

INSTRUCTIONS
${instructions}

<${preTag}>${prefix}</${preTag}>
<${sufTag}>${suffix}</${sufTag}>

Return only <${midTag}>...new code...</${midTag}>.`
}

export const gitCommitMessage_systemMessage = `
You are an expert software engineer who writes clear, concise Git commit messages that summarize the purpose and intent of a change.
Respond with exactly:
<output>one concise commit message</output>
<reasoning>a brief explanation</reasoning>
Do not include anything outside these tags.`.trim()

export const gitCommitMessage_userMessage = (stat: string, sampledDiffs: string, branch: string, log: string) => `
Based on the Git changes below, write a concise commit message that accurately summarizes the intent.

Section 1 - Summary of Changes (git diff --stat):
${stat}

Section 2 - Sampled File Diffs (Top changed files):
${sampledDiffs}

Section 3 - Current Git Branch:
${branch}

Section 4 - Last 5 Commits (excluding merges):
${log}`.trim()
