from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding='utf-8')


def replace_once(path: str, before: str, after: str) -> None:
    original = read(path)
    count = original.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one literal match, found {count}')
    write(path, original.replace(before, after, 1))


def regex_once(path: str, pattern: str, replacement: str) -> None:
    original = read(path)
    updated, count = re.subn(pattern, lambda _match: replacement, original, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one regex match, found {count}: {pattern[:100]}')
    write(path, updated)


# Keep the canonical tool protocol and UI, but allow compact read-only batches internally.
replace_once(
    'src/vs/workbench/contrib/void/common/toolsServiceTypes.ts',
    """\t'read_file': { uri: URI, startLine: number | null, endLine: number | null, pageNumber: number },
\t'ls_dir': { uri: URI, pageNumber: number },
\t'get_dir_tree': { uri: URI },
\t'search_pathnames_only': { query: string, includePattern: string | null, pageNumber: number },
\t'search_for_files': { query: string, isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
\t'search_in_file': { uri: URI, query: string, isRegex: boolean },
\t'semantic_search': { query: string, top_k?: number },""",
    """\t'read_file': { uri: URI, uris?: URI[], startLine: number | null, endLine: number | null, pageNumber: number },
\t'ls_dir': { uri: URI, pageNumber: number },
\t'get_dir_tree': { uri: URI },
\t'search_pathnames_only': { query: string, queries?: string[], includePattern: string | null, pageNumber: number },
\t'search_for_files': { query: string, queries?: string[], isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
\t'search_in_file': { uri: URI, query: string, isRegex: boolean },
\t'semantic_search': { query: string, queries?: string[], top_k?: number },""",
)

prompts = 'src/vs/workbench/contrib/void/common/prompt/prompts.ts'
replace_once(
    prompts,
    """\t\tdescription: `Read file contents with explicit paging metadata. COMPLETE means the requested content is complete. MORE_PAGES means call read_file again with the next page_number. Never ask the user to paste a local file that this tool can read.`,
\t\tparams: {
\t\t\t...uriParam('file'),""",
    """\t\tdescription: `Read file contents with explicit paging metadata. COMPLETE means the requested content is complete. MORE_PAGES means call read_file again with the next page_number. Never ask the user to paste a local file that this tool can read. Independent files may be read concurrently by passing a JSON array in uri.`,
\t\tparams: {
\t\t\turi: { description: 'One full/relative file path, or a JSON array of up to 6 file paths to read concurrently.' },""",
)
replace_once(prompts, "\t\t\tquery: { description: `Filename/path query.` },", "\t\t\tquery: { description: `One filename/path query, or a JSON array of up to 6 independent queries to run concurrently.` },")
replace_once(prompts, "\t\t\tquery: { description: `Text or regex to search for.` },", "\t\t\tquery: { description: `One text/regex query, or a JSON array of up to 6 independent queries to run concurrently.` },")
replace_once(prompts, "\t\t\tquery: { description: `Natural-language code concept or implementation query.` },", "\t\t\tquery: { description: `One natural-language code concept, or a JSON array of up to 6 independent concepts to search concurrently.` },")
replace_once(
    prompts,
    """\t\trawParams[canonicalName] = typeof value === 'string'
\t\t\t? value
\t\t\t: canonicalName === 'search_replace_blocks' ? JSON.stringify(value) : String(value)""",
    """\t\tconst preserveStructuredValue = canonicalName === 'search_replace_blocks'
\t\t\t|| ((canonicalName === 'uri' || canonicalName === 'query') && Array.isArray(value))
\t\trawParams[canonicalName] = typeof value === 'string'
\t\t\t? value
\t\t\t: preserveStructuredValue ? JSON.stringify(value) : String(value)""",
)
replace_once(
    prompts,
    "\t\tdetails.push('If an exact filename/path or active file is already known, read/search it directly instead of performing unnecessary discovery.')",
    "\t\tdetails.push('If an exact filename/path or active file is already known, read/search it directly instead of performing unnecessary discovery.')\n\t\tdetails.push('When several independent files or search queries are needed, batch up to 6 of them in one read_file/search call using the documented JSON-array form. This parallel batching is for read-only discovery only; keep dependent operations and edits serialized.')",
)

service = 'src/vs/workbench/contrib/void/browser/toolsService.ts'
replace_once(
    service,
    "const validateOptionalStr = (argName: string, str: unknown) => {",
    """const validateStringList = (argName: string, value: unknown, maxItems = 6): string[] => {
\tlet values: unknown[]
\tif (Array.isArray(value)) values = value
\telse {
\t\tconst raw = validateStr(argName, value).trim()
\t\tif (!raw.startsWith('[')) values = [raw]
\t\telse {
\t\t\ttry { values = JSON.parse(raw) }
\t\t\tcatch { throw new Error(`Invalid LLM output: ${argName} looked like a JSON array but could not be parsed.`) }
\t\t}
\t}
\tif (!Array.isArray(values) || values.length === 0) throw new Error(`Invalid LLM output: ${argName} must contain at least one value.`)
\tif (values.length > maxItems) throw new Error(`Invalid LLM output: ${argName} supports at most ${maxItems} parallel values.`)
\treturn values.map((item, index) => {
\t\tif (typeof item !== 'string' || !item.trim()) throw new Error(`Invalid LLM output: ${argName}[${index}] must be a non-empty string.`)
\t\treturn item.trim()
\t})
}

const validateOptionalStr = (argName: string, str: unknown) => {""",
)

regex_once(
    service,
    r"\t\t\tread_file: async \(rawParams: RawToolParamsObj\) => \{.*?\n\t\t\t\},\n\t\t\tls_dir:",
    """\t\t\tread_file: async (rawParams: RawToolParamsObj) => {
\t\t\t\tconst params = normalizeRawParams(rawParams)
\t\t\t\tconst { uri: uriUnknown, start_line: startLineUnknown, end_line: endLineUnknown, page_number: pageNumberUnknown } = params
\t\t\t\tconst uriStrings = validateStringList('uri', uriUnknown)
\t\t\t\tconst uris = await Promise.all(uriStrings.map(resolveWorkspaceURI))
\t\t\t\tconst uri = uris[0]
\t\t\t\tconst pageNumber = validatePageNum(pageNumberUnknown)

\t\t\t\tlet startLine = validateNumber(startLineUnknown, { default: null })
\t\t\t\tlet endLine = validateNumber(endLineUnknown, { default: null })
\t\t\t\tif (startLine !== null && startLine < 1) startLine = null
\t\t\t\tif (endLine !== null && endLine < 1) endLine = null

\t\t\t\treturn { uri, uris: uris.length > 1 ? uris : undefined, startLine, endLine, pageNumber }
\t\t\t},
\t\t\tls_dir:""",
)

regex_once(
    service,
    r"\t\t\tsearch_pathnames_only: \(rawParams: RawToolParamsObj\) => \{.*?\n\t\t\t\},\n\t\t\tsearch_for_files:",
    """\t\t\tsearch_pathnames_only: (rawParams: RawToolParamsObj) => {
\t\t\t\tconst params = normalizeRawParams(rawParams)
\t\t\t\tconst { query: queryUnknown, include_pattern: includeUnknown, page_number: pageNumberUnknown } = params
\t\t\t\tconst queryStrings = validateStringList('query', queryUnknown)
\t\t\t\tconst queryStr = queryStrings[0]
\t\t\t\tconst pageNumber = validatePageNum(pageNumberUnknown)
\t\t\t\tconst includePattern = validateOptionalStr('include_pattern', includeUnknown)
\t\t\t\treturn { query: queryStr, queries: queryStrings.length > 1 ? queryStrings : undefined, includePattern, pageNumber }
\t\t\t},
\t\t\tsearch_for_files:""",
)

regex_once(
    service,
    r"\t\t\tsearch_for_files: async \(rawParams: RawToolParamsObj\) => \{.*?\n\t\t\t\},\n\t\t\tsearch_in_file:",
    """\t\t\tsearch_for_files: async (rawParams: RawToolParamsObj) => {
\t\t\t\tconst params = normalizeRawParams(rawParams)
\t\t\t\tconst { query: queryUnknown, search_in_folder: searchInFolderUnknown, is_regex: isRegexUnknown, page_number: pageNumberUnknown } = params
\t\t\t\tconst queryStrings = validateStringList('query', queryUnknown)
\t\t\t\tconst queryStr = queryStrings[0]
\t\t\t\tconst pageNumber = validatePageNum(pageNumberUnknown)
\t\t\t\tconst searchInFolder = isFalsy(searchInFolderUnknown) ? null : await resolveWorkspaceURI(searchInFolderUnknown)
\t\t\t\tconst isRegex = validateBoolean(isRegexUnknown, { default: false })
\t\t\t\treturn { query: queryStr, queries: queryStrings.length > 1 ? queryStrings : undefined, isRegex, searchInFolder, pageNumber }
\t\t\t},
\t\t\tsearch_in_file:""",
)

regex_once(
    service,
    r"\t\t\tsemantic_search: \(rawParams: RawToolParamsObj\) => \{.*?\n\t\t\t\},\n\n\t\t\tread_lint_errors:",
    """\t\t\tsemantic_search: (rawParams: RawToolParamsObj) => {
\t\t\t\tconst params = normalizeRawParams(rawParams)
\t\t\t\tconst { query: queryUnknown, top_k: topKUnknown } = params
\t\t\t\tconst queryStrings = validateStringList('query', queryUnknown)
\t\t\t\tconst query = queryStrings[0]
\t\t\t\tconst topK = validateNumber(topKUnknown, { default: 5 }) || 5
\t\t\t\treturn { query, queries: queryStrings.length > 1 ? queryStrings : undefined, top_k: topK }
\t\t\t},

\t\t\tread_lint_errors:""",
)

regex_once(
    service,
    r"\t\t\tread_file: async \(\{ uri, startLine, endLine, pageNumber \}\) => \{.*?\n\t\t\t\},\n\n\t\t\tls_dir:",
    """\t\t\tread_file: async ({ uri, uris, startLine, endLine, pageNumber }) => {
\t\t\t\tconst targets = uris?.length ? uris : [uri]
\t\t\t\tconst isBatch = targets.length > 1
\t\t\t\tconst pageSize = isBatch ? Math.min(MAX_FILE_CHARS_PAGE, 100_000) : MAX_FILE_CHARS_PAGE

\t\t\t\tconst readOne = async (target: URI) => {
\t\t\t\t\tawait voidModelService.initializeModel(target)
\t\t\t\t\tconst { model } = await voidModelService.getModelSafe(target)
\t\t\t\t\tif (model === null) throw new Error(`No contents; File does not exist: ${target.fsPath}.`)

\t\t\t\t\tlet contents: string
\t\t\t\t\tif (startLine === null && endLine === null) contents = model.getValue(EndOfLinePreference.LF)
\t\t\t\t\telse {
\t\t\t\t\t\tconst startLineNumber = startLine === null ? 1 : startLine
\t\t\t\t\t\tconst endLineNumber = endLine === null ? model.getLineCount() : endLine
\t\t\t\t\t\tcontents = model.getValueInRange({ startLineNumber, startColumn: 1, endLineNumber, endColumn: Number.MAX_SAFE_INTEGER }, EndOfLinePreference.LF)
\t\t\t\t\t}

\t\t\t\t\tconst fromIdx = pageSize * (pageNumber - 1)
\t\t\t\t\tconst toIdx = pageSize * pageNumber - 1
\t\t\t\t\treturn {
\t\t\t\t\t\turi: target,
\t\t\t\t\t\tfileContents: contents.slice(fromIdx, toIdx + 1),
\t\t\t\t\t\ttotalFileLen: contents.length,
\t\t\t\t\t\ttotalNumLines: model.getLineCount(),
\t\t\t\t\t\thasNextPage: (contents.length - 1) - toIdx >= 1,
\t\t\t\t\t}
\t\t\t\t}

\t\t\t\tconst pages = await Promise.all(targets.map(readOne))
\t\t\t\tif (!isBatch) {
\t\t\t\t\tconst page = pages[0]
\t\t\t\t\treturn { result: { fileContents: page.fileContents, totalFileLen: page.totalFileLen, hasNextPage: page.hasNextPage, totalNumLines: page.totalNumLines } }
\t\t\t\t}

\t\t\t\tconst fileContents = pages.map(page => {
\t\t\t\t\tconst status = page.hasNextPage ? 'MORE_PAGES' : 'COMPLETE'
\t\t\t\t\treturn `===== FILE ${page.uri.fsPath} =====\n[READ_FILE ${status} page=${pageNumber} returned_chars=${page.fileContents.length} total_chars=${page.totalFileLen} total_lines=${page.totalNumLines}]\n${page.fileContents}\n[END_FILE ${status}]`
\t\t\t\t}).join('\n\n')
\t\t\t\treturn { result: {
\t\t\t\t\tfileContents,
\t\t\t\t\ttotalFileLen: pages.reduce((sum, page) => sum + page.totalFileLen, 0),
\t\t\t\t\ttotalNumLines: pages.reduce((sum, page) => sum + page.totalNumLines, 0),
\t\t\t\t\thasNextPage: pages.some(page => page.hasNextPage),
\t\t\t\t} }
\t\t\t},

\t\t\tls_dir:""",
)

regex_once(
    service,
    r"\t\t\tsearch_pathnames_only: async \(\{ query: queryStr, includePattern, pageNumber \}\) => \{.*?\n\t\t\t\},\n\n\t\t\tsearch_for_files:",
    """\t\t\tsearch_pathnames_only: async ({ query: queryStr, queries, includePattern, pageNumber }) => {
\t\t\t\tconst queryStrings = queries?.length ? queries : [queryStr]
\t\t\t\tconst searchOne = async (pattern: string) => {
\t\t\t\t\tconst query = queryBuilder.file(workspaceContextService.getWorkspace().folders.map(f => f.uri), {
\t\t\t\t\t\tfilePattern: pattern,
\t\t\t\t\t\tincludePattern: includePattern ?? undefined,
\t\t\t\t\t\tsortByScore: true,
\t\t\t\t\t})
\t\t\t\t\tconst data = await searchService.fileSearch(query, CancellationToken.None)
\t\t\t\t\tconst fromIdx = MAX_CHILDREN_URIS_PAGE * (pageNumber - 1)
\t\t\t\t\tconst toIdx = MAX_CHILDREN_URIS_PAGE * pageNumber - 1
\t\t\t\t\treturn { uris: data.results.slice(fromIdx, toIdx + 1).map(({ resource }) => resource), hasNextPage: (data.results.length - 1) - toIdx >= 1 }
\t\t\t\t}
\t\t\t\tconst pages = await Promise.all(queryStrings.map(searchOne))
\t\t\t\tconst seen = new Set<string>()
\t\t\t\tconst resultUris: URI[] = []
\t\t\t\tfor (const page of pages) for (const resultUri of page.uris) {
\t\t\t\t\tconst key = resultUri.toString()
\t\t\t\t\tif (!seen.has(key)) { seen.add(key); resultUris.push(resultUri) }
\t\t\t\t}
\t\t\t\treturn { result: { uris: resultUris, hasNextPage: pages.some(page => page.hasNextPage) } }
\t\t\t},

\t\t\tsearch_for_files:""",
)

regex_once(
    service,
    r"\t\t\tsearch_for_files: async \(\{ query: queryStr, isRegex, searchInFolder, pageNumber \}\) => \{.*?\n\t\t\t\},\n\t\t\tsearch_in_file:",
    """\t\t\tsearch_for_files: async ({ query: queryStr, queries, isRegex, searchInFolder, pageNumber }) => {
\t\t\t\tconst searchFolders = searchInFolder === null ? workspaceContextService.getWorkspace().folders.map(f => f.uri) : [searchInFolder]
\t\t\t\tconst queryStrings = queries?.length ? queries : [queryStr]
\t\t\t\tconst searchOne = async (pattern: string) => {
\t\t\t\t\tconst query = queryBuilder.text({ pattern, isRegExp: isRegex }, searchFolders)
\t\t\t\t\tconst data = await searchService.textSearch(query, CancellationToken.None)
\t\t\t\t\tconst fromIdx = MAX_CHILDREN_URIS_PAGE * (pageNumber - 1)
\t\t\t\t\tconst toIdx = MAX_CHILDREN_URIS_PAGE * pageNumber - 1
\t\t\t\t\treturn { uris: data.results.slice(fromIdx, toIdx + 1).map(({ resource }) => resource), hasNextPage: (data.results.length - 1) - toIdx >= 1 }
\t\t\t\t}
\t\t\t\tconst pages = await Promise.all(queryStrings.map(searchOne))
\t\t\t\tconst seen = new Set<string>()
\t\t\t\tconst resultUris: URI[] = []
\t\t\t\tfor (const page of pages) for (const resultUri of page.uris) {
\t\t\t\t\tconst key = resultUri.toString()
\t\t\t\t\tif (!seen.has(key)) { seen.add(key); resultUris.push(resultUri) }
\t\t\t\t}
\t\t\t\treturn { result: { uris: resultUris, hasNextPage: pages.some(page => page.hasNextPage) } }
\t\t\t},
\t\t\tsearch_in_file:""",
)

regex_once(
    service,
    r"\t\t\tsemantic_search: async \(\{ query, top_k \}\) => \{.*?\n\t\t\t\},\n\n\t\t\tread_lint_errors:",
    """\t\t\tsemantic_search: async ({ query, queries, top_k }) => {
\t\t\t\tconst queryStrings = queries?.length ? queries : [query]
\t\t\t\tconst topK = top_k ?? 5
\t\t\t\tconst groups = await Promise.all(queryStrings.map(searchQuery => this.semanticSearchService.search({ query: searchQuery, topK })))
\t\t\t\tconst seen = new Set<string>()
\t\t\t\tconst hits = groups.flat().map(h => ({
\t\t\t\t\tfilePath: h.chunk.filePath,
\t\t\t\t\tstartLine: h.chunk.startLine,
\t\t\t\t\tendLine: h.chunk.endLine,
\t\t\t\t\tscore: h.score,
\t\t\t\t\tcontent: h.chunk.content,
\t\t\t\t})).sort((a, b) => b.score - a.score).filter(hit => {
\t\t\t\t\tconst key = `${hit.filePath}:${hit.startLine}:${hit.endLine}:${hit.content}`
\t\t\t\t\tif (seen.has(key)) return false
\t\t\t\t\tseen.add(key)
\t\t\t\t\treturn true
\t\t\t\t}).slice(0, Math.min(40, topK * queryStrings.length))
\t\t\t\treturn { result: { hits } }
\t\t\t},

\t\t\tread_lint_errors:""",
)

chat = 'src/vs/workbench/contrib/void/browser/chatThreadService.ts'
replace_once(
    chat,
    "import { chat_userMessageContent, isABuiltinToolName, normalizeRawParams, normalizeToolName } from '../common/prompt/prompts.js';",
    "import { builtinToolNames, chat_userMessageContent, isABuiltinToolName, normalizeRawParams, normalizeToolName, toolNamesIncludingAliases } from '../common/prompt/prompts.js';",
)
replace_once(
    chat,
    """\t\t\tconst builtInToolNames = Object.keys(approvalTypeOfBuiltinToolName)
\t\t\tconst registeredToolNames = [...mcpToolNames, ...builtInToolNames]""",
    """\t\t\tconst builtInToolNames = builtinToolNames.flatMap(toolNamesIncludingAliases)
\t\t\tconst registeredToolNames = [...mcpToolNames, ...builtInToolNames]""",
)

contract = 'scripts/forge-agent-tool-contract-test.mjs'
replace_once(
    contract,
    """check(
  'workspace paths are model-safe',""",
    """check(
  'parallel read-only discovery is supported',
  hasAll(toolTypes, ['uris?: URI[]', 'queries?: string[]'])
    && hasAll(toolsService, [
      'validateStringList',
      'Promise.all(targets.map(readOne))',
      'Promise.all(queryStrings.map(searchOne))',
      'Promise.all(queryStrings.map(searchQuery => this.semanticSearchService.search',
    ])
    && hasAll(prompts, [
      'JSON array of up to 6 file paths',
      'batch up to 6 of them in one read_file/search call',
      'parallel batching is for read-only discovery only',
    ]),
  'Independent file reads and discovery queries should execute concurrently without changing the canonical tool protocol or parallelizing edits.',
);

check(
  'all built-in tool aliases are sanitized',
  hasAll(chatService, [
    'builtinToolNames.flatMap(toolNamesIncludingAliases)',
    'const registeredToolNames = [...mcpToolNames, ...builtInToolNames]',
  ]),
  'Persisted assistant text must strip leaked calls for read/search tools as well as edit/terminal tools.',
);

check(
  'workspace paths are model-safe',""",
)

print('Forge parallel read-only discovery patch applied successfully.')
