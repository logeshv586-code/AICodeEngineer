from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(before, after, 1), encoding='utf-8')


sidebar = 'src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx'

replace_once(
    sidebar,
    "\t'search_for_files': { done: 'Searched', proposed: 'Search', running: loadingTitleWrapper('Searching') },\n",
    "\t'search_for_files': { done: 'Searched', proposed: 'Search', running: loadingTitleWrapper('Searching') },\n\t'semantic_search': { done: 'Searched code index', proposed: 'Search code index', running: loadingTitleWrapper('Searching code index') },\n",
)

replace_once(
    sidebar,
    """\t\t'read_file': () => {
\t\t\tconst toolParams = _toolParams as BuiltinToolCallParams['read_file']
\t\t\treturn {
\t\t\t\tdesc1: getBasename(toolParams.uri.fsPath),
\t\t\t\tdesc1Info: getRelative(toolParams.uri, accessor),
\t\t\t};
\t\t},""",
    """\t\t'read_file': () => {
\t\t\tconst toolParams = _toolParams as BuiltinToolCallParams['read_file']
\t\t\tconst batchSuffix = toolParams.uris && toolParams.uris.length > 1 ? ` +${toolParams.uris.length - 1}` : ''
\t\t\treturn {
\t\t\t\tdesc1: `${getBasename(toolParams.uri.fsPath)}${batchSuffix}`,
\t\t\t\tdesc1Info: getRelative(toolParams.uri, accessor),
\t\t\t};
\t\t},""",
)

replace_once(
    sidebar,
    """\t\t'search_pathnames_only': () => {
\t\t\tconst toolParams = _toolParams as BuiltinToolCallParams['search_pathnames_only']
\t\t\treturn {
\t\t\t\tdesc1: `\"${toolParams.query}\"`,
\t\t\t}
\t\t},
\t\t'search_for_files': () => {
\t\t\tconst toolParams = _toolParams as BuiltinToolCallParams['search_for_files']
\t\t\treturn {
\t\t\t\tdesc1: `\"${toolParams.query}\"`,
\t\t\t}
\t\t},""",
    """\t\t'search_pathnames_only': () => {
\t\t\tconst toolParams = _toolParams as BuiltinToolCallParams['search_pathnames_only']
\t\t\tconst batchSuffix = toolParams.queries && toolParams.queries.length > 1 ? ` +${toolParams.queries.length - 1}` : ''
\t\t\treturn {
\t\t\t\tdesc1: `\"${toolParams.query}\"${batchSuffix}`,
\t\t\t}
\t\t},
\t\t'search_for_files': () => {
\t\t\tconst toolParams = _toolParams as BuiltinToolCallParams['search_for_files']
\t\t\tconst batchSuffix = toolParams.queries && toolParams.queries.length > 1 ? ` +${toolParams.queries.length - 1}` : ''
\t\t\treturn {
\t\t\t\tdesc1: `\"${toolParams.query}\"${batchSuffix}`,
\t\t\t}
\t\t},
\t\t'semantic_search': () => {
\t\t\tconst toolParams = _toolParams as BuiltinToolCallParams['semantic_search']
\t\t\tconst batchSuffix = toolParams.queries && toolParams.queries.length > 1 ? ` +${toolParams.queries.length - 1}` : ''
\t\t\treturn {
\t\t\t\tdesc1: `\"${toolParams.query}\"${batchSuffix}`,
\t\t\t}
\t\t},""",
)

replace_once(
    sidebar,
    """\t\t\tif (toolMessage.type === 'success') {
\t\t\t\tconst { result } = toolMessage
\t\t\t\tcomponentParams.onClick = () => { voidOpenFileFn(params.uri, accessor, range) }
\t\t\t\tif (result.hasNextPage && params.pageNumber === 1)  // first page
\t\t\t\t\tcomponentParams.desc2 = `(truncated after ${Math.round(MAX_FILE_CHARS_PAGE) / 1000}k)`
\t\t\t\telse if (params.pageNumber > 1) // subsequent pages
\t\t\t\t\tcomponentParams.desc2 = `(part ${params.pageNumber})`
\t\t\t}""",
    """\t\t\tif (toolMessage.type === 'success') {
\t\t\t\tconst { result } = toolMessage
\t\t\t\tcomponentParams.onClick = () => { voidOpenFileFn(params.uri, accessor, range) }
\t\t\t\tconst pageChars = params.uris && params.uris.length > 1 ? Math.min(MAX_FILE_CHARS_PAGE, 100_000) : MAX_FILE_CHARS_PAGE
\t\t\t\tif (result.hasNextPage && params.pageNumber === 1)  // first page
\t\t\t\t\tcomponentParams.desc2 = `(truncated after ${Math.round(pageChars) / 1000}k per file)`
\t\t\t\telse if (params.pageNumber > 1) // subsequent pages
\t\t\t\t\tcomponentParams.desc2 = `(part ${params.pageNumber})`
\t\t\t}""",
)

semantic_component = """\t'semantic_search': {
\t\tresultWrapper: ({ toolMessage }) => {
\t\t\tconst accessor = useAccessor()
\t\t\tconst workspaceContextService = accessor.get('IWorkspaceContextService')
\t\t\tconst title = getTitle(toolMessage)
\t\t\tconst { desc1, desc1Info } = toolNameToDesc(toolMessage.name, toolMessage.params, accessor)
\t\t\tconst icon = null

\t\t\tif (toolMessage.type === 'tool_request') return null
\t\t\tif (toolMessage.type === 'running_now') return null

\t\t\tconst isError = false
\t\t\tconst isRejected = toolMessage.type === 'rejected'
\t\t\tconst componentParams: ToolHeaderParams = { title, desc1, desc1Info, isError, icon, isRejected }

\t\t\tif (toolMessage.type === 'success') {
\t\t\t\tconst { result } = toolMessage
\t\t\t\tcomponentParams.numResults = result.hits.length
\t\t\t\tcomponentParams.children = result.hits.length === 0 ? undefined : <ToolChildrenWrapper>
\t\t\t\t\t{result.hits.map((hit, index) => {
\t\t\t\t\t\tconst workspaceRoot = workspaceContextService.getWorkspace().folders[0]?.uri
\t\t\t\t\t\tconst isAbsolutePath = /^(?:[A-Za-z]:[\\\\/]|[\\\\/])/.test(hit.filePath)
\t\t\t\t\t\tconst hitUri = isAbsolutePath
\t\t\t\t\t\t\t? URI.file(hit.filePath)
\t\t\t\t\t\t\t: workspaceRoot
\t\t\t\t\t\t\t\t? URI.joinPath(workspaceRoot, ...hit.filePath.split(/[\\\\/]+/).filter(Boolean))
\t\t\t\t\t\t\t\t: URI.file(hit.filePath)
\t\t\t\t\t\tconst relativePath = getRelative(hitUri, accessor) ?? hit.filePath
\t\t\t\t\t\treturn <ListableToolItem
\t\t\t\t\t\t\tkey={`${hit.filePath}:${hit.startLine}:${hit.endLine}:${index}`}
\t\t\t\t\t\t\tname={<span className='flex min-w-0 items-center gap-2'>
\t\t\t\t\t\t\t\t<span className='truncate'>{relativePath}</span>
\t\t\t\t\t\t\t\t<span className='shrink-0 text-[10px] text-void-fg-4'>L{hit.startLine}-{hit.endLine} · {Math.round(hit.score * 100)}%</span>
\t\t\t\t\t\t\t</span>}
\t\t\t\t\t\t\tclassName='w-full overflow-hidden'
\t\t\t\t\t\t\tonClick={() => voidOpenFileFn(hitUri, accessor, [hit.startLine, hit.endLine])}
\t\t\t\t\t\t/>
\t\t\t\t\t})}
\t\t\t\t</ToolChildrenWrapper>
\t\t\t}
\t\t\telse if (toolMessage.type === 'tool_error') {
\t\t\t\tcomponentParams.bottomChildren = <BottomChildren title='Error'>
\t\t\t\t\t<CodeChildren>{toolMessage.result}</CodeChildren>
\t\t\t\t</BottomChildren>
\t\t\t}

\t\t\treturn <ToolHeaderWrapper {...componentParams} />
\t\t},
\t},
"""
replace_once(
    sidebar,
    "\n\t'search_in_file': {\n\t\tresultWrapper:",
    "\n" + semantic_component + "\t'search_in_file': {\n\t\tresultWrapper:",
)

activity = 'src/vs/workbench/contrib/void/common/toolActivityMessages.ts'
replace_once(
    activity,
    """\tsearch_pathnames_only: 'Searching file names...',
\tls_dir: 'Listing directory...',
\trun_command: 'Running command...',""",
    """\tsearch_pathnames_only: 'Searching file names...',
\tsearch_in_file: 'Searching inside file...',
\tsemantic_search: 'Searching code index...',
\tread_lint_errors: 'Reading diagnostics...',
\tls_dir: 'Listing directory...',
\trun_command: 'Running command...',
\trun_persistent_command: 'Running persistent command...',
\topen_persistent_terminal: 'Opening persistent terminal...',
\tkill_persistent_terminal: 'Closing persistent terminal...',""",
)
replace_once(
    activity,
    """\tsearch_pathnames_only: 'search file names',
\tls_dir: 'list the directory',
\trun_command: 'run the command',""",
    """\tsearch_pathnames_only: 'search file names',
\tsearch_in_file: 'search inside the file',
\tsemantic_search: 'search the code index',
\tread_lint_errors: 'read diagnostics',
\tls_dir: 'list the directory',
\trun_command: 'run the command',
\trun_persistent_command: 'run the persistent command',
\topen_persistent_terminal: 'open the persistent terminal',
\tkill_persistent_terminal: 'close the persistent terminal',""",
)

contract = 'scripts/forge-agent-tool-contract-test.mjs'
replace_once(
    contract,
    """check(
  'workspace paths are model-safe',""",
    """check(
  'semantic search has complete sidebar coverage',
  hasAll(sidebarChat, [
    "'semantic_search': { done: 'Searched code index'",
    "BuiltinToolCallParams['semantic_search']",
    "'semantic_search': {\\n\\t\\tresultWrapper",
    'result.hits.map((hit, index)',
    'voidOpenFileFn(hitUri, accessor, [hit.startLine, hit.endLine])',
  ])
    && hasAll(toolActivityMessages, [
      "semantic_search: 'Searching code index...'",
      "semantic_search: 'search the code index'",
    ]),
  'Every registered semantic-search tool state must have a typed label, description, result renderer, navigation target, and activity/error text.',
);

check(
  'workspace paths are model-safe',""",
)

print('Forge semantic-search UI and batch presentation patch applied successfully.')
