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

	// Check if it's already a full URI with scheme (e.g., vscode-remote://, file://, etc.)
	// Look for :// pattern which indicates a scheme is present
	// Examples of supported URIs:
	// - vscode-remote://wsl+Ubuntu/home/user/file.txt (WSL)
	// - vscode-remote://ssh-remote+myserver/home/user/file.txt (SSH)
	// - file:///home/user/file.txt (local file with scheme)
	// - /home/user/file.txt (local file path, will be converted to file://)
	// - C:\Users\file.txt (Windows local path, will be converted to file://)
	if (uriStr.includes('://')) {
		try {
			const uri = URI.parse(uriStr)
			return uri
		} catch (e) {
			// If parsing fails, it's a malformed URI
			throw new Error(`Invalid URI format: ${uriStr}. Error: ${e}`)
		}
	} else {
		// No scheme present, treat as file path
		// This handles regular file paths like /home/user/file.txt or C:\Users\file.txt
		const uri = URI.file(uriStr)
		return uri
	}
}

const validateStringList = (argName: string, value: unknown, maxItems = 6): string[] => {
	let values: unknown[]
	if (Array.isArray(value)) values = value
	else {
		const raw = validateStr(argName, value).trim()
		if (!raw.startsWith('[')) values = [raw]
		else {
			try { values = JSON.parse(raw) }
			catch { throw new Error(`Invalid LLM output: ${argName} looked like a JSON array but could not be parsed.`) }
		}
	}
	if (!Array.isArray(values) || values.length === 0) throw new Error(`Invalid LLM output: ${argName} must contain at least one value.`)
	if (values.length > maxItems) throw new Error(`Invalid LLM output: ${argName} supports at most ${maxItems} parallel values.`)
	return values.map((item, index) => {
		if (typeof item !== 'string' || !item.trim()) throw new Error(`Invalid LLM output: ${argName}[${index}] must be a non-empty string.`)
		return item.trim()
	})
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
	if (typeof numStr === 'number')
		return numStr
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
	const terminalId = terminalIdUnknown + ''
	return terminalId
}

const validateBoolean = (b: unknown, opts: { default: boolean }) => {
	if (typeof b === 'string') {
		if (b === 'true') return true
		if (b === 'false') return false
	}
	if (typeof b === 'boolean') {
		return b
	}
	return opts.default
}

const checkIfIsFolder = (uriStr: string) => {
	uriStr = uriStr.trim()
	if (uriStr.endsWith('/') || uriStr.endsWith('\\')) return true
	return false
}

const nextPageStr = (hasNextPage: boolean) => {
	if (hasNextPage) return '\n\n(Additional results available on next page...)'
	return ''
}

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

			// An empty window has no safe relative-path target. Create one visible,
			// user-owned project folder and add it to the untitled workspace so the
			// agent can create its first project without writing to an arbitrary path.
			const workspaceRoot = URI.joinPath(await this.pathService.userHome(), 'Forge AI Workspace');
			if (!await fileService.exists(workspaceRoot)) await fileService.createFolder(workspaceRoot);
			await this.workspaceEditingService.addFolders([{ uri: workspaceRoot }], true);
			return workspaceRoot;
		};
		const normalizedPath = (uri: URI): string => {
			let path = uri.path.replace(/\/+$/, '') || '/';
			// Windows drive-letter file URIs are case-insensitive. Keep remote/POSIX
			// workspaces case-sensitive so similarly named paths are not conflated.
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

			// Models commonly use /workspace as a placeholder. Map it to the
			// actual workspace rather than creating a stray path on the machine.
			if (rawPath === '/workspace' || rawPath.startsWith('/workspace/')) {
				const root = workspaceRoot ?? await ensureWorkspaceRoot();
				const relativePath = rawPath.slice('/workspace'.length).replace(/^[/\\]+/, '');
				const target = relativePath ? URI.joinPath(root, ...relativePath.split(/[\\/]+/)) : root;
				return ensureInsideWorkspace(target);
			}

			// A bare filename is also intended to be created in the active project.
			if (!rawPath.includes('://') && !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(rawPath)) {
				const root = workspaceRoot ?? await ensureWorkspaceRoot();
				return ensureInsideWorkspace(URI.joinPath(root, ...rawPath.split(/[\\/]+/)));
			}

			return ensureInsideWorkspace(validateURI(rawPath));
		};

		this.validateParams = {
			read_file: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriUnknown, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
				const uriStrings = validateStringList('uri', uriUnknown)
				const uris = await Promise.all(uriStrings.map(resolveWorkspaceURI))
				const uri = uris[0]
				const pageNumber = validatePageNum(pageNumberUnknown)

				let startLine = validateNumber(startLineUnknown, { default: null })
				let endLine = validateNumber(endLineUnknown, { default: null })
				if (startLine !== null && startLine < 1) startLine = null
				if (endLine !== null && endLine < 1) endLine = null

				return { uri, uris: uris.length > 1 ? uris : undefined, startLine, endLine, pageNumber }
			},
			ls_dir: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, page_number: pageNumberUnknown } = params

				// Models occasionally omit the directory when asking for an initial
				// listing. Use the opened workspace root so an empty repository can
				// still proceed; with no folder open, return an actionable error.
				const uri = isFalsy(uriStr) ? await ensureWorkspaceRoot() : await resolveWorkspaceURI(uriStr)
				const pageNumber = validatePageNum(pageNumberUnknown)
				return { uri, pageNumber }
			},
			get_dir_tree: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, } = params
				const uri = isFalsy(uriStr) ? await ensureWorkspaceRoot() : await resolveWorkspaceURI(uriStr)
				return { uri }
			},
			search_pathnames_only: (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { query: queryUnknown, include_pattern: includeUnknown, page_number: pageNumberUnknown } = params
				const queryStrings = validateStringList('query', queryUnknown)
				const queryStr = queryStrings[0]
				const pageNumber = validatePageNum(pageNumberUnknown)
				const includePattern = validateOptionalStr('include_pattern', includeUnknown)
				return { query: queryStr, queries: queryStrings.length > 1 ? queryStrings : undefined, includePattern, pageNumber }
			},
			search_for_files: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { query: queryUnknown, search_in_folder: searchInFolderUnknown, is_regex: isRegexUnknown, page_number: pageNumberUnknown } = params
				const queryStrings = validateStringList('query', queryUnknown)
				const queryStr = queryStrings[0]
				const pageNumber = validatePageNum(pageNumberUnknown)
				const searchInFolder = isFalsy(searchInFolderUnknown) ? null : await resolveWorkspaceURI(searchInFolderUnknown)
				const isRegex = validateBoolean(isRegexUnknown, { default: false })
				return { query: queryStr, queries: queryStrings.length > 1 ? queryStrings : undefined, isRegex, searchInFolder, pageNumber }
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
				const { query: queryUnknown, top_k: topKUnknown } = params
				const queryStrings = validateStringList('query', queryUnknown)
				const query = queryStrings[0]
				const topK = validateNumber(topKUnknown, { default: 5 }) || 5
				return { query, queries: queryStrings.length > 1 ? queryStrings : undefined, top_k: topK }
			},

			read_lint_errors: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const {
					uri: uriUnknown,
				} = params
				const uri = await resolveWorkspaceURI(uriUnknown)
				return { uri }
			},

			// ---

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
				const uriStr = validateStr('uri', uriUnknown)
				const isFolder = checkIfIsFolder(uriStr)
				return { uri, isRecursive, isFolder }
			},

			rewrite_file: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, new_content: newContentUnknown } = params
				const uri = await resolveWorkspaceURI(uriStr)
				const newContent = validateStr('newContent', newContentUnknown)
				return { uri, newContent }
			},

			edit_file: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { uri: uriStr, search_replace_blocks: searchReplaceBlocksUnknown } = params
				const uri = await resolveWorkspaceURI(uriStr)
				const searchReplaceBlocks = validateStr('searchReplaceBlocks', searchReplaceBlocksUnknown)
				return { uri, searchReplaceBlocks }
			},

			// ---

			run_command: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { command: commandUnknown, cwd: cwdUnknown } = params
				const command = validateStr('command', commandUnknown)
				const cwdStr = validateOptionalStr('cwd', cwdUnknown)
				const cwd = cwdStr === null ? null : (await resolveWorkspaceURI(cwdStr)).fsPath
				const terminalId = generateUuid()
				return { command, cwd, terminalId }
			},
			run_persistent_command: (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { command: commandUnknown, persistent_terminal_id: persistentTerminalIdUnknown } = params;
				const command = validateStr('command', commandUnknown);
				const persistentTerminalId = validateProposedTerminalId(persistentTerminalIdUnknown)
				return { command, persistentTerminalId };
			},
			open_persistent_terminal: async (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { cwd: cwdUnknown } = params;
				const cwdStr = validateOptionalStr('cwd', cwdUnknown)
				const cwd = cwdStr === null ? null : (await resolveWorkspaceURI(cwdStr)).fsPath
				return { cwd };
			},
			kill_persistent_terminal: (rawParams: RawToolParamsObj) => {
				const params = normalizeRawParams(rawParams)
				const { persistent_terminal_id: terminalIdUnknown } = params;
				const persistentTerminalId = validateProposedTerminalId(terminalIdUnknown);
				return { persistentTerminalId };
			},

		}


		this.callTool = {
			read_file: async ({ uri, uris, startLine, endLine, pageNumber }) => {
				const targets = uris?.length ? uris : [uri]
				const isBatch = targets.length > 1
				const pageSize = isBatch ? Math.min(MAX_FILE_CHARS_PAGE, 100_000) : MAX_FILE_CHARS_PAGE

				const readOne = async (target: URI) => {
					await voidModelService.initializeModel(target)
					const { model } = await voidModelService.getModelSafe(target)
					if (model === null) throw new Error(`No contents; File does not exist: ${target.fsPath}.`)

					let contents: string
					if (startLine === null && endLine === null) contents = model.getValue(EndOfLinePreference.LF)
					else {
						const startLineNumber = startLine === null ? 1 : startLine
						const endLineNumber = endLine === null ? model.getLineCount() : endLine
						contents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					}

					const fromIdx = pageSize * (pageNumber - 1)
					const toIdx = pageSize * pageNumber - 1
					return {
						uri: target,
						fileContents: contents.slice(fromIdx, toIdx + 1),
						totalFileLen: contents.length,
						totalNumLines: model.getLineCount(),
						hasNextPage: (contents.length - 1) - toIdx >= 1,
					}
				}

				const pages = await Promise.all(targets.map(readOne))
				if (!isBatch) {
					const page = pages[0]
					return { result: { fileContents: page.fileContents, totalFileLen: page.totalFileLen, hasNextPage: page.hasNextPage, totalNumLines: page.totalNumLines } }
				}

				const fileContents = pages.map(page => {
					const status = page.hasNextPage ? 'MORE_PAGES' : 'COMPLETE'
					return `===== FILE ${page.uri.fsPath} =====
[READ_FILE ${status} page=${pageNumber} returned_chars=${page.fileContents.length} total_chars=${page.totalFileLen} total_lines=${page.totalNumLines}]
${page.fileContents}
[END_FILE ${status}]`
				}).join('\n\n')
				return { result: {
					fileContents,
					totalFileLen: pages.reduce((sum, page) => sum + page.totalFileLen, 0),
					totalNumLines: pages.reduce((sum, page) => sum + page.totalNumLines, 0),
					hasNextPage: pages.some(page => page.hasNextPage),
				} }
			},

			ls_dir: async ({ uri, pageNumber }) => {
				const dirResult = await computeDirectoryTree1Deep(fileService, uri, pageNumber)
				return { result: dirResult }
			},

			get_dir_tree: async ({ uri }) => {
				const str = await this.directoryStrService.getDirectoryStrTool(uri)
				return { result: { str } }
			},

			search_pathnames_only: async ({ query: queryStr, queries, includePattern, pageNumber }) => {
				const queryStrings = queries?.length ? queries : [queryStr]
				const searchOne = async (pattern: string) => {
					const query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
						filePattern: pattern,
						includePattern: includePattern ?? undefined,
						sortByScore: true,
					})
					const data = await searchService.fileSearch(query, CancellationToken.None)
					const fromIdx = MAX_CHILDREN_URIS_PAGE * (pageNumber - 1)
					const toIdx = MAX_CHILDREN_URIS_PAGE * pageNumber - 1
					return { uris: data.results.slice(fromIdx, toIdx + 1).map(({ resource }) => resource), hasNextPage: (data.results.length - 1) - toIdx >= 1 }
				}
				const pages = await Promise.all(queryStrings.map(searchOne))
				const seen = new Set<string>()
				const resultUris: URI[] = []
				for (const page of pages) for (const resultUri of page.uris) {
					const key = resultUri.toString()
					if (!seen.has(key)) { seen.add(key); resultUris.push(resultUri) }
				}
				return { result: { uris: resultUris, hasNextPage: pages.some(page => page.hasNextPage) } }
			},

			search_for_files: async ({ query: queryStr, queries, isRegex, searchInFolder, pageNumber }) => {
				const searchFolders = searchInFolder === null ? workspaceContextService.getWorkspace().folders.map(f => f.uri) : [searchInFolder]
				const queryStrings = queries?.length ? queries : [queryStr]
				const searchOne = async (pattern: string) => {
					const query = queryBuilder.text({ pattern, isRegExp: isRegex }, searchFolders)
					const data = await searchService.textSearch(query, CancellationToken.None)
					const fromIdx = MAX_CHILDREN_URIS_PAGE * (pageNumber - 1)
					const toIdx = MAX_CHILDREN_URIS_PAGE * pageNumber - 1
					return { uris: data.results.slice(fromIdx, toIdx + 1).map(({ resource }) => resource), hasNextPage: (data.results.length - 1) - toIdx >= 1 }
				}
				const pages = await Promise.all(queryStrings.map(searchOne))
				const seen = new Set<string>()
				const resultUris: URI[] = []
				for (const page of pages) for (const resultUri of page.uris) {
					const key = resultUri.toString()
					if (!seen.has(key)) { seen.add(key); resultUris.push(resultUri) }
				}
				return { result: { uris: resultUris, hasNextPage: pages.some(page => page.hasNextPage) } }
			},
			search_in_file: async ({ uri, query, isRegex }) => {
				await voidModelService.initializeModel(uri);
				const { model } = await voidModelService.getModelSafe(uri);
				if (model === null) { throw new Error(`No contents; File does not exist.`); }
				const contents = model.getValue(EndOfLinePreference.LF);
				const contentOfLine = contents.split('\n');
				const totalLines = contentOfLine.length;
				const regex = isRegex ? new RegExp(query) : null;
				const lines: number[] = []
				for (let i = 0; i < totalLines; i++) {
					const line = contentOfLine[i];
					if ((isRegex && regex!.test(line)) || (!isRegex && line.includes(query))) {
						const matchLine = i + 1;
						lines.push(matchLine);
					}
				}
				return { result: { lines } };
			},
			semantic_search: async ({ query, queries, top_k }) => {
				const queryStrings = queries?.length ? queries : [query]
				const topK = top_k ?? 5
				const groups = await Promise.all(queryStrings.map(searchQuery => this.semanticSearchService.search({ query: searchQuery, topK })))
				const seen = new Set<string>()
				const hits = groups.flat().map(h => ({
					filePath: h.chunk.filePath,
					startLine: h.chunk.startLine,
					endLine: h.chunk.endLine,
					score: h.score,
					content: h.chunk.content,
				})).sort((a, b) => b.score - a.score).filter(hit => {
					const key = `${hit.filePath}:${hit.startLine}:${hit.endLine}:${hit.content}`
					if (seen.has(key)) return false
					seen.add(key)
					return true
				}).slice(0, Math.min(40, topK * queryStrings.length))
				return { result: { hits } }
			},

			read_lint_errors: async ({ uri }) => {
				await timeout(1000)
				const { lintErrors } = this._getLintErrors(uri)
				return { result: { lintErrors } }
			},

			create_file_or_folder: async ({ uri, isFolder, content }) => {
				if (isFolder) {
					await fileService.createFolder(uri)
				} else {
					const parentUri = URI.joinPath(uri, '..')
					if (!await fileService.exists(parentUri)) {
						await fileService.createFolder(parentUri)
					}
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
					if (!await fileService.exists(parentUri)) {
						await fileService.createFolder(parentUri)
					}
					await fileService.createFile(uri, VSBuffer.fromString(newContent), { overwrite: true })
				}
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyRewriteFile({ uri, newContent })
				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
				})
				return { result: lintErrorsPromise }
			},

			edit_file: async ({ uri, searchReplaceBlocks }) => {
				if (!await fileService.exists(uri)) {
					const parentUri = URI.joinPath(uri, '..')
					if (!await fileService.exists(parentUri)) {
						await fileService.createFolder(parentUri)
					}
					await fileService.createFile(uri, VSBuffer.fromString(''), { overwrite: true })
				}
				await voidModelService.initializeModel(uri)
				if (this.commandBarService.getStreamState(uri) === 'streaming') {
					throw new Error(`Another LLM is currently making changes to this file. Please stop streaming for now and ask the user to resume later.`)
				}
				await editCodeService.callBeforeApplyOrEdit(uri)
				editCodeService.instantlyApplySearchReplaceBlocks({ uri, searchReplaceBlocks })

				// at end, get lint errors
				const lintErrorsPromise = Promise.resolve().then(async () => {
					await timeout(2000)
					const { lintErrors } = this._getLintErrors(uri)
					return { lintErrors }
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
			open_persistent_terminal: async ({ cwd }) => {
				const persistentTerminalId = await this.terminalToolService.createPersistentTerminal({ cwd })
				return { result: { persistentTerminalId } }
			},
			kill_persistent_terminal: async ({ persistentTerminalId }) => {
				// Close the background terminal by sending exit
				await this.terminalToolService.killPersistentTerminal(persistentTerminalId)
				return { result: {} }
			},
		}

		this.stringOfResult = {
			read_file: (params, result) => {
				const pageStatus = result.hasNextPage ? 'MORE_PAGES' : 'COMPLETE'
				const nextPageInstruction = result.hasNextPage
					? ` Call read_file again with page_number=${params.pageNumber + 1}; do not ask the user to paste the file.`
					: ' The requested file content is complete; do not ask the user to paste it.'
				return `[READ_FILE ${pageStatus} page=${params.pageNumber} returned_chars=${result.fileContents.length} total_chars=${result.totalFileLen} total_lines=${result.totalNumLines}]${nextPageInstruction}\n${result.fileContents}\n[END_READ_FILE ${pageStatus}]`
			},
			ls_dir: (params, result) => {
				const dirTreeStr = stringifyDirectoryTree1Deep(params, result)
				return dirTreeStr
			},
			get_dir_tree: (params, result) => {
				return result.str
			},
			search_pathnames_only: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_for_files: (params, result) => {
				return result.uris.map(uri => uri.fsPath).join('\n') + nextPageStr(result.hasNextPage)
			},
			search_in_file: (params, result) => {
				const { model } = voidModelService.getModel(params.uri)
				if (!model) return '<Error getting string of result>'
				const lines = result.lines.map(n => {
					const lineContent = model.getValueInRange({ startLineNumber: n, startColumn: 1, endLineNumber: n, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
					return `Line ${n}:\n\`\`\`\n${lineContent}\n\`\`\``
				}).join('\n\n');
				return lines;
			},
			read_lint_errors: (params, result) => {
				return result.lintErrors ?
					stringifyLintErrors(result.lintErrors)
					: 'No lint errors found.'
			},
			semantic_search: (params, result) => {
				return result.hits.map(h => `${h.filePath}:${h.startLine}-${h.endLine} (score: ${h.score.toFixed(2)})\n${h.content}`).join('\n\n');
			},
			// ---
			create_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully created.${params.isFolder ? '' : params.content === undefined ? ' The file has no content yet; use rewrite_file immediately to write the requested implementation.' : ''}`
			},
			delete_file_or_folder: (params, result) => {
				return `URI ${params.uri.fsPath} successfully deleted.`
			},
			edit_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			rewrite_file: (params, result) => {
				const lintErrsString = (
					this.voidSettingsService.state.globalSettings.includeToolLintErrors ?
						(result.lintErrors ? ` Lint errors found after change:\n${stringifyLintErrors(result.lintErrors)}.\nIf this is related to a change made while calling this tool, you might want to fix the error.`
							: ` No lint errors found.`)
						: '')

				return `Change successfully made to ${params.uri.fsPath}.${lintErrsString}`
			},
			run_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// normal command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command ran, but was automatically killed by Void after ${MAX_TERMINAL_INACTIVE_TIME}s of inactivity and did not finish successfully. To try with more time, open a persistent terminal and run the command there.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			run_persistent_command: (params, result) => {
				const { resolveReason, result: result_, } = result
				const { persistentTerminalId } = params
				// success
				if (resolveReason.type === 'done') {
					return `${result_}\n(exit code ${resolveReason.exitCode})`
				}
				// bg command
				if (resolveReason.type === 'timeout') {
					return `${result_}\nTerminal command is running in terminal ${persistentTerminalId}. The given outputs are the results after ${MAX_TERMINAL_BG_COMMAND_TIME} seconds.`
				}
				throw new Error(`Unexpected internal error: Terminal command did not resolve with a valid reason.`)
			},

			open_persistent_terminal: (_params, result) => {
				const { persistentTerminalId } = result;
				return `Successfully created persistent terminal. persistentTerminalId="${persistentTerminalId}"`;
			},
			kill_persistent_terminal: (params, _result) => {
				return `Successfully closed terminal "${params.persistentTerminalId}".`;
			},
		}



	}


	private _getLintErrors(uri: URI): { lintErrors: LintErrorItem[] | null } {
		const lintErrors = this.markerService
			.read({ resource: uri })
			.filter(l => l.severity === MarkerSeverity.Error || l.severity === MarkerSeverity.Warning)
			.slice(0, 100)
			.map(l => ({
				code: typeof l.code === 'string' ? l.code : l.code?.value || '',
				message: (l.severity === MarkerSeverity.Error ? '(error) ' : '(warning) ') + l.message,
				startLineNumber: l.startLineNumber,
				endLineNumber: l.endLineNumber,
			} satisfies LintErrorItem))

		if (!lintErrors.length) return { lintErrors: null }
		return { lintErrors, }
	}


}

registerSingleton(IToolsService, ToolsService, InstantiationType.Eager);
