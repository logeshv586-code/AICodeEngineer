# Forge IDE Guide

Forge is an AI-assisted development environment designed to understand a project, make changes directly, verify its work, and continue until the requested task is complete.

This guide explains the current workflow in plain language. It focuses on what happens during an update instead of describing internal source locations.

## What Forge Can Do

Forge agents can:

- Read individual files or inspect the whole project.
- Search for filenames, symbols, text, and related code.
- Understand how several files work together before making changes.
- Create new files and any missing parent locations.
- Edit part of a file or rewrite the complete file.
- Delete files or groups of files when the task requires it.
- Run commands, builds, checks, and tests.
- Report errors in a clear, actionable form.
- Resume interrupted work without losing the task or queued instructions.

## The Current Update Flow

### 1. Receive the request

The user describes the desired outcome in chat. The request can be short, detailed, or a continuation of earlier work.

Forge keeps the request as the active task. If another message arrives while work is running, that message is placed in the task queue.

### 2. Understand the goal

The agent identifies:

- What the user wants changed.
- Which parts of the project are relevant.
- What must remain unchanged.
- How the result can be verified.

For a simple request, the agent can act immediately. For a larger request, it creates a small plan and updates progress as work continues.

### 3. Gather enough context

The agent reads the relevant files and searches the project before editing. Local files should be read directly; the user should not be asked to copy and paste a file that is already available in the open project.

Every file-reading result identifies whether the requested content is complete. If more content exists, the agent reads the next page or requests a narrower line range automatically.

### 4. Choose and normalize an action

Different AI providers sometimes use different names for the same action. Forge accepts common variations and converts them into one internal action.

For example, requests to write, save, create, overwrite, modify, remove, list, search, or run a command are interpreted consistently. Common parameter variations such as path, filename, content, code, text, query, and command are also understood.

Malformed but recognizable tool calls are repaired when it is safe to do so. If an essential value is truly missing, the agent receives a clear message explaining exactly which value must be supplied and can retry the action.

### 5. Create a checkpoint

Before changing files, Forge records a checkpoint. This gives the user a safe review and recovery point.

Changes can be inspected, accepted, rejected, or reverted. A new checkpoint is created for the next meaningful set of edits.

### 6. Make the change

Forge chooses the least disruptive editing method that can complete the task:

- A focused edit changes only the necessary section.
- A rewrite replaces the full contents when the whole document or file must change.
- A create action makes a new file and any missing parent locations.
- A delete action removes the requested target after resolving it safely.

Existing files can be intentionally overwritten when the requested action requires replacement. Newly created or rewritten files are immediately made available to the editor and later agent steps.

### 7. Review the result

After editing, the agent checks the changed content and looks for obvious mistakes. For code changes, it also checks relevant diagnostics and confirms that the requested behavior is represented in the implementation.

The agent must not claim completion merely because an edit action succeeded. Completion means the requested outcome has been checked.

### 8. Build and validate

Forge runs the checks that match the type of change. These may include:

- Type checking or compilation.
- User-interface bundle generation.
- Automated tests.
- Runtime artifact verification.
- Focused checks for the exact bug or workflow being changed.

If a check fails because of the new work, the agent investigates, fixes the issue, and runs the check again. Existing unrelated warnings are reported separately and are not presented as newly introduced failures.

### 9. Finish or continue

When all required work and verification are complete, the agent returns a concise summary of what changed and which checks passed.

If work is interrupted, rate-limited, or manually stopped, the task is paused instead of discarded. The user can choose **Continue task** or send a continuation message. Forge resumes from the preserved conversation, checkpoints, tool results, and queued instructions.

## Queue and Decision Changes

Messages sent while an agent is working are kept in order. Before continuing the next stage, Forge applies the newest queued instruction to the active task.

A queued message can:

- Add another requirement.
- Correct an assumption.
- Change the preferred approach.
- Cancel part of the work.
- Replace the remaining task with a new direction.

The agent preserves completed work that is still useful, avoids repeating finished steps, and adjusts unfinished work to match the newest decision.

## Interruption and Recovery

An interruption can happen because the user presses stop, the application closes, the provider becomes unavailable, a rate limit is reached, or a tool is still waiting for approval.

Forge keeps enough state to resume safely:

- The original request and later queued messages.
- Completed and pending plan items.
- File checkpoints.
- Successful tool results.
- The active task state.
- The point at which execution stopped.

After resuming, the agent checks the current project state before applying another change. This prevents duplicate edits and allows the user to modify files manually between runs.

## File Reading Rules

When reading project files, agents follow these rules:

- Trust a result marked complete.
- Read the next page when more pages are available.
- Use a smaller line range if conversation limits shorten a result.
- Never treat conversation shortening as a file-system failure.
- Never ask the user to paste an accessible local file merely because more context is needed.
- Re-read a file before overwriting it if it may have changed since the previous read.

## File Editing Rules

When changing project files, agents follow these rules:

- Work only inside the user-approved project scope.
- Preserve unrelated user changes.
- Create missing parent locations when creating a file.
- Use focused edits when only a small section must change.
- Use a complete rewrite when the user requests a document-wide rewrite.
- Verify the resulting content after every significant update.
- Run appropriate checks before reporting completion.
- Explain any remaining limitation honestly.

## Provider and Model Resilience

Forge supports models from different providers even when their tool-call formats differ.

The compatibility layer handles:

- Structured function calls.
- JSON tool calls.
- XML-style tool calls.
- Common tool-name aliases.
- Common parameter-name aliases.
- Recoverable formatting mistakes.

Provider errors are converted into useful messages. Authentication problems, unavailable models, oversized requests, server failures, timeouts, and rate limits are identified separately.

For temporary rate limits, Forge waits longer before retrying. If retries are exhausted, it pauses the task so the user can continue later without starting again.

## Approval and Safety

Read-only inspection can run without interrupting the workflow. Actions that modify files or run commands follow the user's approval settings.

Forge resolves the exact target before a sensitive action, avoids broad destructive operations, and keeps checkpoints for recoverable edits. It does not expand the task into unrelated changes without user authorization.

## Completion Standard

A task is complete only when:

1. The requested outcome has been implemented.
2. The changed files have been reviewed.
3. Relevant validation has passed or any remaining failure has been clearly explained.
4. No required queued instruction remains unhandled.
5. The user receives a clear summary of the result.

This is the workflow all Forge agents should follow, regardless of which supported AI model or provider is selected.
