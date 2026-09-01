import { CancellationToken } from '../../../../base/common/cancellation.js'
import { URI } from '../../../../base/common/uri.js'
import { IFileService } from '../../../../platform/files/common/files.js'
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js'
import { createDecorator, IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js'
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js'
import { QueryBuilder } from '../../../services/search/common/queryBuilder.js'
import { ISearchService } from '../../../services/search/common/search.js'
import { IEditCodeService } from './editCodeServiceInterface.js'
import { ITerminalToolService } from './terminalToolService.js'
import { LintErrorItem, BuiltinToolCallParams, BuiltinToolResultType, BuiltinToolName } from '../common/toolsServiceTypes.js'
import { IVoidModelService } from '../common/voidModelService.js'
import { EndOfLinePreference } from '../../../../editor/common/model.js'
import { IVoidCommandBarService } from './voidCommandBarService.js'
import { computeDirectoryTree1Deep, IDirectoryStrService, stringifyDirectoryTree1Deep } from '../common/directoryStrService.js'
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js'
import { timeout } from '../../../../base/common/async.js'
import { RawToolParamsObj } from '../common/sendLLMMessageTypes.js'
import { MAX_CHILDREN_URIs_PAGE, MAX_FILE_CHARS_PAGE, MAX_TERMINAL_BG_COMMAND_TIME, MAX_TERMINAL_INACTIVE_TIME, normalizeRawParams } from '../common/prompt/prompts.js'
import { IVoidSettingsService } from '../common/voidSettingsService.js'
import { generateUuid } from '../../../../base/common/uuid.js'
import { ISemanticSearchService } from '../common/forge/contracts/ISemanticSearchService.js'
import { VSBuffer } from '../../../../base/common/buffer.js'
import { IPathService } from '../../../services/path/common/pathService.js'
import { IWorkspaceEditingService } from '../../../services/workspaces/common/workspaceEditing.js'


// tool use for AI
type ValidateBuiltinParams = { [T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T] | Promise<BuiltinToolCallParams[T]> }
type CallBuiltinTool = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T]) => Promise<{ result: BuiltinToolResultType[T] | Promise<BuiltinToolResultType[T]>, interruptTool?: () => void }> }
type BuiltinToolResultToString = { [T in BuiltinToolName]: (p: BuiltinToolCallParams[T], result: Awaited<BuiltinToolResultType[T]>) => string }


const isFalsy = (u: unknown) => {
	return !u || u === 'null' || u === 'undefined'
}

const validateStr = (argName: string, value: unknown) => {
	if (value === null) throw new Error(`Invalid LLM output: ${argName} was null.`)
	if (value === undefined) throw new Error(`The model omitted the required "${argName}" parameter. Retry the tool call with "${argName}" as a string.`)
	if (typeof value !== 'string') throw new Error(`Invalid LLM output format: ${argName} must be a string, but its type is "${typeof value}". Full value: ${JSON.stringify(value)}.`)
	return value
}


const validateURI = (uriStr: unknown) => {
	if (uriStr === null) throw new Error(`Invalid LLM output: uri was null.`)
	if (typeof uriStr !== 'string') throw new Error(`Invalid LLM output format: Provided uri must be a string, but it's a(n) ${typeof uriStr}. Full value: ${JSON.stringify(uriStr)}.`)

	if (uriStr.includes('://')) {
		try {
			return URI.parse(uriStr)
		} catch (e) {
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	}
	return URI.file(uriStr)
}

const validateOptionalStr = (argName: string, str: unknown) => {
	if (isFalsy(str)) return null
	return validateStr(argName, str)
}

const validatePageNum = (pageNumberUnknown: unknown) => {
	if (!pageNumberUnknown) return 1
	const parsedInt = Number.parseInt(pageNumberUnknown + '')
	if (!Number.isInteger(parsedInt)) throw new Error(`Page number was not an integer: "${pageNumberUnknown}".`)
	if (parsedInt < 1) throw new Error(`Invalid LLM output format: Specified page number must be 1 or greater: "${pageNumberUnknown}".`)
	return parsedInt
}

const validateNumber = (numStr: unknown, opts: { default: number | null }) => {
	if (typeof numStr === 'number') return numStr
	if (isFalsy(numStr)) return opts.default
	if (typeof numStr === 'string') {
		const parsedInt = Number.parseInt(numStr + '')
		if (!Number.isInteger(parsedInt)) return opts.default
		return parsedInt
	}
	return opts.default
}

const validateProposedTerminalId = (terminalIdUnknown: unknown) => {
	if (!terminalIdUnknown) throw new Error(`A value for terminalID must be specified, but the value was "${terminalIdUnknown}"`)
	return terminalIdUnknown + ''
}

const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') return true
		if (b === 'false') return false
	}
	if (typeof b === 'boolean') return b
	return opts.default
}

const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim()
	return uriStr.endsWith('/') || uriStr.endsWith('\\')
}

const nextPageStr = (hasNextPage: boolean) => hasNextPage ? '\n\n(Additional results available on next page...)' : ''

const stringifyLintErrors = (lintErrors: LintErrorItem[]) => {
	return lintErrors.map(l => `${l.message} (line ${l.startLineNumber})`).join('\n')
}

export interface IToolsService {
	readonly _serviceBrand: undefined;
	validateParams: ValidateBuiltinParams;
	callTool: CallBuiltinTool;
	stringOfResult: BuiltinToolResultToString;
}

export const IToolsService = createDecorator<IToolsService>('ToolsService');

export class ToolsService implements IToolsService {
	readonly _serviceBrand: undefined;
	public validateParams: ValidateBuiltinParams;
	public callTool: CallBuiltinTool;
	public stringOfResult: BuiltinToolResultToString;

	constructor(
		@IFileService fileService: IFileService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@ISearchService searchService: ISearchService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IVoidModelService voidModelService: IVoidModelService,
		@IEditCodeService editCodeService: IEditCodeService,
		@ITerminalToolService private readonly terminalToolService: ITerminalToolService,
		@IVoidCommandBarService private readonly commandBarService: IVoidCommandBarService,
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IMarkerService private readonly markerService: IMarkerService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@ISemanticSearchService private readonly semanticSearchService: ISemanticSearchService,
		@IPathService private readonly pathService: IPathService,
		@IWorkspaceEditingService private readonly workspaceEditingService: IWorkspaceEditingService,
	) {
		const queryBuilder = instantiationService.createInstance(QueryBuilder);
		const ensureWorkspaceRoot = async (): Promise<URI> => {
			const existingWorkspaceRoot = workspaceContextService.getWorkspace().folders[0]?.uri;
			if (existingWorkspaceRoot) return existingWorkspaceRoot;
			const workspaceRoot = URI.joinPath(await this.pathService.userHome(), 'Forge AI Workspace');
			if (!await fileService.exists(workspaceRoot)) await fileService.createFolder(workspaceRoot);
			await this.workspaceEditingService.addFolders([{ uri: workspaceRoot }], true);
			return workspaceRoot;
		};
		const normalizedPath = (uri: URI): string => {
			let path = uri.path.replace(/\/+$/, '') || '/';
			if (uri.scheme === 'file' && /^\/[A-Za-z]:\//.test(path)) path = path.toLowerCase();
			return path;
		};
		const isInsideRoot = (candidate: URI, root: URI): boolean => {
			if (candidate.scheme !== root.scheme || candidate.authority !== root.authority) return false;
			const candidatePath = normalizedPath(candidate);
			const rootPath = normalizedPath(root);
			return candidatePath === rootPath || candidatePath.startsWith(rootPath === '/' ? '/' : `${rootPath}/`);
		};
		const ensureInsideWorkspace = async (candidate: URI): Promise<URI> => {
			let roots = workspaceContextService.getWorkspace().folders.map(folder => folder.uri);
			if (roots.length === 0) roots = [await ensureWorkspaceRoot()];
			if (roots.some(root => isInsideRoot(candidate, root))) return candidate;
			throw new Error(`Tool path is outside the opened workspace: ${candidate.fsPath}. Open that folder in Forge before asking the agent to access it.`);
		};
		const resolveWorkspaceURI = async (uriStr: unknown): Promise<URI> => {
			const rawPath = validateStr('uri', uriStr).trim();
			const workspaceRoot = workspaceContextService.getWorkspace().folders[0]?.uri;
			if (rawPath === '/workspace' || rawPath.startsWith('/workspace/')) {
				const root = workspaceRoot ?? await ensureWorkspaceRoot();
				const relativePath = rawPath.slice('/workspace'.length).replace(/^[/\\]+/, '');
				const target = relativePath ? URI.joinPath(root, ...relativePath.split(/[\\/]+/)) : root;
				return ensureInsideWorkspace(target);
			}
			if (!rawPath.includes('://') && !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(rawPath)) {
				const root = workspaceRoot ?? await ensureWorkspaceRoot();
				return ensureInsideWorkspace(URI.joinPath(root, ...rawPath.split(/[\\/]+/)));
			}
			return ensureInsideWorkspace(validateURI(rawPath));
		};

		this.validateParams = {
			read_file: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
				const uri = await resolveWorkspaceURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				let startLine = validateNumber(startLineUnknown, { default: null })
				let endLine = validateNumber(endLineUnknown, { default: null })
				if (startLine !== null && startLine < 1) startLine = null
				if (endLine !== null && endLine < 1) endLine = null
				return { uri, startLine, endLine, pageNumber }
			},
			ls_dir: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, page_number: pageNumberUnknown } = params
				const uri = isFalsy(uriStr) ? await ensureWorkspaceRoot() : await resolveWorkspaceURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { uri, pageNumber }
			},
			get_dir_tree: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr } = params
				const uri = isFalsy(uriStr) ? await ensureWorkspaceRoot() : await resolveWorkspaceURI(uriStr)
				return { uri }
			},
			search_pathnames_only: (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { query: queryUnknown, include_pattern: includeUnknown, page_number: pageNumberUnknown } = params
				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)
				return { query: queryStr, includePattern, pageNumber }
			},
			search_for_files: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { query: queryUnknown, search_in_folder: searchInFolderUnknown, is_regex: isRegexUnknown, page_number: pageNumberUnknown } = params
				const queryStr = validateStr('query', queryUnknown)
				const pageNumber = validatePageNum(pageNumberUnknown)
				const searchInFolder = isFalsy(searchInFolderUnknown) ? null : await resolveWorkspaceURI(searchInFolderUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				return { query: queryStr, isRegex, searchInFolder, pageNumber }
			},
			search_in_file: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, query: queryUnknown, is_regex: isRegexUnknown } = params;
				const uri = await resolveWorkspaceURI(uriStr);
				const query = validateStr('query', queryUnknown);
				const isRegex = validateBoolean(isRegexUnknown, { default: false });
				return { uri, query, isRegex };
			},
			semantic_search: (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { query: queryUnknown, top_k: topKUnknown } = params;
				const query = validateStr('query', queryUnknown);
				const topK = validateNumber(topKUnknown, { default: 5 }) || 5;
				return { query, top_k: topK };
			},
			read_lint_errors: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriUnknown } = params
				return { uri: await resolveWorkspaceURI(uriUnknown) }
			},
			create_file_or_folder: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriUnknown, content: contentUnknown } = params
				const uri = await resolveWorkspaceURI(uriUnknown)
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				const content = isFolder ? undefined : validateOptionalStr('content', contentUnknown)
				return { uri, isFolder, content: content ?? undefined }
			},
			delete_file_or_folder: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriUnknown, is_recursive: isRecursiveUnknown } = params
				const uri = await resolveWorkspaceURI(uriUnknown)
				const isRecursive = validateBoolean(isRecursiveUnknown, { default: false })
				const isFolder = checkIfIsFolder(validateStr('uri', uriUnknown))
				return { uri, isRecursive, isFolder }
			},
			rewrite_file: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, new_content: newContentUnknown } = params
				return { uri: await resolveWorkspaceURI(uriStr), newContent: validateStr('newContent', newContentUnknown) }
			},
			edit_file: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params
				return { uri: await resolveWorkspaceURI(uriStr), searchReplaceBlocks: validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown) }
			},
			run_command: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { command: commandUnknown, cwd: cwdUnknown } = params
				const command = validateStr('command', commandUnknown)
				const cwdStr = validateOptionalStr('cwd', cwdUnknown)
				const cwd = cwdStr === null ? null : (await resolveWorkspaceURI(cwdStr)).fsPath
				return { command, cwd, terminalId: generateUuid() }
			},
			run_persistent_command: (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				return { command: validateStr('command', commandUnknown), persistentTerminalId: validateProposedTerminalId(persistentTerminalIdUnknown) };
			},
			open_persistent_terminal: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const cwdStr = validateOptionalStr('cwd', params.cwd)
				return { cwd: cwdStr === null ? null : (await resolveWorkspaceURI(cwdStr)).fsPath };
			},
			kill_persistent_terminal: (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				return { persistentTerminalId: validateProposedTerminalId(params.persistent_terminal_id) };
			},
		}

		this.callTool = {
			read_file: async ({ uri, startLine, endLine, pageNumber }) => {
				await voidModelService.initializeModel(uri)
				const { model } = await voidModelService.getModelSafe(uri)
				if (model === null) throw new Error(`No contents; File does not exist.`)
				let contents: string
				if (startLine === null && endLine === null) contents = model.getValue(EndOfLinePreference.LF)
				else {
					const startLineNumber = startLine === null ? 1 : startLine
					const endLineNumber = endLine === null ? model.getLineCount() : endLine
					contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
				}
				const totalNumLines = model.getLineCount()
				const fromIdx = MAX_FILE_CHARS_PAGE * (pageNumber - 1)
				const toIdx = MAX_FILE_CHARS_PAGE * pageNumber - 1
				const fileContents = contents.slice(fromIdx, toIdx + 1)
				const hasNextPage = (contents.length - 1) - toIdx >= 1
				return { result: { fileContents, totalFileLen: contents.length, hasNextPage, totalNumLines } }
			},
			ls_dir: async ({ uri, pageNumber }) => ({ result: await computeDirectoryTree1Deep(fileService, uri, pageNumber) }),
			get_dir_tree: async ({ uri }) => ({ result: { str: await this.directoryStrService.getDirectoryStrTool(uri) } }),
			search_pathnames_only: async ({ query: queryStr, includePattern, pageNumber }) => {
				const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), { filePattern: queryStr, includePattern: includePattern ?? undefined, sortByScore: true })
				const data = await searchService.fileSearch(query, CancellationToken.None)
				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results.slice(fromIdx, toIdx + 1).map(({ resource }) => resource)
				return { result: { uris, hasNextPage: (data.results.length - 1) - toIdx >= 1 } }
			},
			search_for_files: async ({ query: queryStr, isRegex, searchInFolder, pageNumber }) => {
				const searchFolders = searchInFolder === null ? workspaceContextService.getWorkspace().folders.map(f => f.uri) : [searchInFolder]
				const query = queryBuilder.text({ pattern: queryStr, isRegExp: isRegex }, searchFolders)
				const data = await searchService.textSearch(query, CancellationToken.None)
				const fromIdx = MAX_CHILDREN_URIs_PAGE * (pageNumber - 1)
				const toIdx = MAX_CHILDREN_URIs_PAGE * pageNumber - 1
				const uris = data.results.slice(fromIdx, toIdx + 1).map(({ resource }) => resource)
				return { result: { queryStr, uris, hasNextPage: (data.results.length - 1) - toIdx >= 1 } }
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				await voidModelService.initializeModel(uri);
				const { model } = await voidModelService.getModelSafe(uri);
				if (model === null) throw new Error(`No contents; File does not exist.`);
				const contentOfLine = model.getValue(EndOfLinePreference.LF).split('\n');
				const regex = isRegex ? new RegExp(query) : null;
				const lines: number[] = []
				for (let i = 0; i < contentOfLine.length; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) lines.push(i + 1);
				}
				return { result: { lines } };
			},
			semantic_search: async ({ query, top_k }) => ({
				result: {
					hits: (await this.semanticSearchService.search({ query, topK: top_k })).map(h => ({
						filePath: h.chunk.filePath,
						startLine: h.chunk.startLine,
						endLine: h.chunk.endLine,
						score: h.score,
						content: h.chunk.content
					}))
				}
			}),
			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				return { result: { lintErrors: this._getLintErrors(uri).lintErrors } }
			},
			create_file_or_folder: async ({ uri, isFolder, content }) => {
				if (isFolder) await fileService.createFolder(uri)
				else {
					const parentUri = URI.joinPath(uri, '..')
					if (!await fileService.exists(parentUri)) await fileService.createFolder(parentUri)
					await fileService.createFile(uri, content === undefined ? undefined : VSBuffer.fromString(content), { overwrite: true })
					await voidModelService.initializeModel(uri)
				}
				return { result: {} }
			},
			delete_file_or_folder: async ({ uri, isRecursive }) => {
				await fileService.del(uri, { recursive: isRecursive })
				return { result: {} }
			},
			rewrite_file: async ({ uri, newContent }) => {
				if (!await fileService.exists(uri)) {
					const parentUri = URI.joinPath(uri, '..')
					if (!await fileService.exists(parentUri)) await fileService.createFolder(parentUri)
					await fileService.createFile(uri, VSBuffer.fromString(newContent), { overwrite: true })
				}
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyRewriteFile({ uri, newContent })
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					return { lintErrors: this._getLintErrors(uri).lintErrors }
				})
				return { result: lintErrorsPromise }
			},
			edit_file: async ({ uri, searchReplaceBlocks }) => {
				if (!await fileService.exists(uri)) {
					const parentUri = URI.joinPath(uri, '..')
					if (!await fileService.exists(parentUri)) await fileService.createFolder(parentUri)
					await fileService.createFile(uri, VSBuffer.fromString(''), { overwrite: true })
				}
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks })
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					return { lintErrors: this._getLintErrors(uri).lintErrors }
				})
				return { result: lintErrorsPromise }
			},
			run_command: async ({ command, cwd, terminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'temporary', cwd, terminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			run_persistent_command: async ({ command, persistentTerminalId }) => {
				const { resPromise, interrupt } = await this.terminalToolService.runCommand(command, { type: 'persistent', persistentTerminalId })
				return { result: resPromise, interruptTool: interrupt }
			},
			open_persistent_terminal: async ({ cwd }) => ({ result: { persistentTerminalId: await this.terminalToolService.createPersistentTerminal({ cwd }) } }),
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				await this.terminalToolService.killPersistentTerminal(persistentTerminalId)
				return { result: {} }
			},
		}

		this.stringOfResult = {
			read_file: (params, result) => {
				const pageStatus = result.hasNextPage ? 'MORE_PAGES' : 'COMPLETE'
				const nextPageInstruction = result.hasNextPage ? ` Call read_file again with page_number=${params.pageNumber + 1}; do not ask the user to paste the file.` : ' The requested file content is complete; do not ask the user to paste it.'
				return `[READ_FILE ${pageStatus} page=${params.pageNumber} returned_chars=${result.fileContents.length} total_chars=${result.totalFileLen} total_lines=${result.totalNumLines}]${nextPageInstruction}\n${result.fileContents}\n[END_READ_FILE ${pageStatus}]`
			},
			ls_dir: (params, result) => stringifyDirectoryTree1Deep(params, result),
			get_dir_tree: (_params, result) => result.str,
			search_pathnames_only: (_params, result) => result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage),
			search_for_files: (_params, result) => result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage),
			search_in_file: (params, result) => {
				const { model } = voidModelService.getModel(params.uri)
				if (!model) return '<Error getting string of result>'
				return result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``
				}).join('\n\n');
			},
			read_lint_errors: (_params, result) => result.lintErrors ? stringifyLintErrors(result.lintErrors) : 'No lint errors found.',
			semantic_search: (_params, result) => result.hits.map(h => `${h.filePath}:${h.startLine}-${h.endLine} (score: ${h.score.toFixed(2)})\n${h.content}`).join('\n\n'),
			create_file_or_folder: (params, _result) => `URI ${params.uri.fsPath} successfully created.${params.isFolder ? '' : params.content === undefined ? ' The file has no content yet; use rewrite_file immediately to write the requested implementation.' : ''}`,
			delete_file_or_folder: (params, _result) => `URI ${params.uri.fsPath} successfully deleted.`,
			edit_file: (params, result) => {
				const lintErrsString = this.voidSettingsService.state.globalSettings.includeToolLintErrors ? (result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.` : ` No lint errors found.`) : ''
				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			rewrite_file: (params, result) => {
				const lintErrsString = this.voidSettingsService.state.globalSettings.includeToolLintErrors ? (result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.` : ` No lint errors found.`) : ''
				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			run_command: (_params, result) => {
				const { resolveReason, result: result_ } = result
				if (resolveReason.type === 'done') return `${result_}\n(exit code ${resolveReason.exitCode})`
				if (resolveReason.type === 'timeout') return `${result_}\nTerminal command ran, but was automatically killed by Void after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},
			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_ } = result
				if (resolveReason.type === 'done') return `${result_}\n(exit code ${resolveReason.exitCode})`
				if (resolveReason.type === 'timeout') return `${result_}\nTerminal command is running in terminal ${params.persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},
			open_persistent_terminal: (_params, result) => `Successfully created persistent terminal. persistentTerminalId="${result.persistentTerminalId}"`,
			kill_persistent_terminal: (params, _result) => `Successfully closed terminal "${params.persistentTerminalId}".`,
		}
	}

	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const lintErrors = this.markerService.read({ resource: uri })
			.filter(l => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning)
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem))
		return { lintErrors: lintErrors.length ? lintErrors : null }
	}
}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
