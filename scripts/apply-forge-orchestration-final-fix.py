from pathlib import Path


def replace_once(path: str, before: str, after: str) -> None:
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one match, found {count}')
    p.write_text(text.replace(before, after, 1), encoding='utf-8')


sidebar = 'src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx'

# Older persisted threads may still contain a short assistant preamble immediately
# before a tool message. Hide only that narrow compatibility case; substantive
# assistant replies remain visible.
replace_once(
    sidebar,
    """\tconst thread = chatThreadsService.getCurrentThread()\n\n\t// Get current model selection for display in the footer""",
    """\tconst thread = chatThreadsService.getCurrentThread()\n\tconst nextMessage = thread.messages[messageIdx + 1]\n\tconst isExecutionPreamble = isCommitted\n\t\t&& (nextMessage?.role === 'tool' || nextMessage?.role === 'interrupted_streaming_tool')\n\t\t&& isRoutineAgentPreamble(chatMessage.displayContent)\n\n\t// Get current model selection for display in the footer""",
)

replace_once(
    sidebar,
    """\tconst isEmpty = !chatMessage.displayContent && !chatMessage.reasoning\n\tif (isEmpty) return null\n\n\treturn <>""",
    """\tconst isEmpty = !chatMessage.displayContent && !chatMessage.reasoning\n\tif (isEmpty) return null\n\tif (isExecutionPreamble) return null\n\n\treturn <>""",
)

# The semantic UI one-shot patch adds an extra contract. Correct the two helper
# identifiers it introduces so the validation script can execute instead of
# failing with ReferenceError before compile/build.
contract = 'scripts/forge-agent-tool-contract-test.mjs'
replace_once(
    contract,
    """const sidebar = read('src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx');\nconst conversion = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');""",
    """const sidebar = read('src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx');\nconst toolActivityMessages = read('src/vs/workbench/contrib/void/common/toolActivityMessages.ts');\nconst conversion = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');""",
)
replace_once(
    contract,
    """  hasAll(sidebarChat, [""",
    """  hasAll(sidebar, [""",
)

print('Forge orchestration final compatibility and validation fix applied successfully.')
