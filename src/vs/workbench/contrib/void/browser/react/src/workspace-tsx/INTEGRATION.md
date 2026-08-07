# Forge AI — Integration Complete

## Status: Wired into SidebarChat.tsx

The conversation-first UI is already integrated. Here's what's wired:

### What's Done

1. **Imports added** to `SidebarChat.tsx`:
   - `ChatView`, `SimpleSidebar`, `ThreadList`, `ComposerControlCenter`
   - `useStreamEvents`, `publishPlanCreated`, `publishToolStarted`, etc.
   - `routeIntent` from intentRouter

2. **New state**: `conversationMode` (defaults to `true`)
   - `const [conversationMode, setConversationMode] = useState(true)`

3. **New derived state**:
   - `threadItems` — built from `chatThreadsService`
   - `chatViewMessages` — converted from internal message format
   - `slashContextValue` — shared between SimpleSidebar and ChatView

4. **onSubmit modified**:
   - In conversation mode: sends plain text (no `[Forge agent: ...]` prefix)
   - Publishes `PLAN_CREATED` event for complex requests
   - Intent routing happens via lightweight keyword detection

5. **Render block replaced** with mode toggle:
   ```tsx
   {conversationMode ? (
     // New UI: SimpleSidebar + ChatView
     <SimpleSidebar ... />
     <ChatView ... />
   ) : (
     // Legacy UI: TopBar + LeftToolbar + RightPanel + BottomStatusBar
     <>
       <TopBar ... />
       <LeftToolbar ... />
       ...
     </>
   )}
   ```

### How to Test

1. Open VS Code with Forge AI extension loaded
2. Open the Forge AI sidebar (AuxiliaryBar)
3. Should see:
   - Minimal sidebar with "Assistant" branding
   - Empty state with suggestions in main area
   - Composer at bottom with context pills

4. Type a message:
   - Should see text appear in conversation
   - `onSubmit` publishes `PLAN_CREATED` event
   - `StreamRenderer` picks it up via `useStreamEvents`
   - Inline execution steps appear

5. Type `/`:
   - Slash command palette opens
   - 30+ commands available
   - No command opens a panel

### How to Toggle

```tsx
// In SidebarChat.tsx, change:
const [conversationMode, setConversationMode] = useState(true)
// to:
const [conversationMode, setConversationMode] = useState(false)
```

This reverts to the legacy dashboard UI. Useful for testing/debugging.

### Backward Compatibility

All legacy components are preserved:
- `AgentWorkspace`, `TopBar`, `LeftToolbar`, `RightPanel`, `BottomStatusBar`
- `UniversalComposer`, `AgentsView`, `WorkflowsView`, `PlanViewInWorkspace`
- Existing `messagesHTML`, `threadPageInput`, `landingPageContent`

They're just not rendered when `conversationMode === true`.

### Architecture Flow

```
User types message
  → onSubmit (conversation mode)
    → routeIntent() detects intent
    → Publishes PLAN_CREATED to ForgeEventBus
    → Sends plain text to chatThreadsService
      → LLM streams response
      → Backend publishes TOOL_STARTED, AGENT_STARTED, etc.
        → ForgeEventBus fires events
          → useStreamEvents() catches them
            → Transforms to StreamEvent (humanized labels)
              → StreamRenderer renders inline in ChatView
                → User sees: "Planning... Searching... Generating..."
```

### What's Still To Do

These are enhancements, not blockers:

1. **Real intent detection**: Replace keyword matching with LLM-based classification (currently uses `routeIntent()` with keywords)
2. **Auto-collapse completed steps**: `StreamRenderer` currently keeps all steps visible. Add auto-collapse after 3s.
3. **Thread persistence**: Save/load conversation threads to disk
4. **Settings toggle**: Add a UI toggle in Settings to switch between conversation/dashboard modes
5. **Stream event cleanup**: Auto-remove completed execution details after assistant finishes responding
6. **Diff previews**: Inline code diffs in the conversation
7. **Context injection**: Auto-include selected files in the LLM context
