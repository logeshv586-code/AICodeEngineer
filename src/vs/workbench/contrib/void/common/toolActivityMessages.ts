/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Centralized mapping from tool names to human-readable status messages.
 * Used in the UI to display friendly tool activity indicators instead of raw tool names.
 */

const TOOL_ACTIVITY_MESSAGES: Record<string, string> = {
	get_dir_tree: 'Inspecting project structure...',
	read_file: 'Reading file...',
	search_for_files: 'Searching files...',
	search_pathnames_only: 'Searching file names...',
	search_in_file: 'Searching inside file...',
	semantic_search: 'Searching code index...',
	read_lint_errors: 'Reading diagnostics...',
	ls_dir: 'Listing directory...',
	run_command: 'Running command...',
	run_persistent_command: 'Running persistent command...',
	open_persistent_terminal: 'Opening persistent terminal...',
	kill_persistent_terminal: 'Closing persistent terminal...',
	edit_file: 'Editing file...',
	rewrite_file: 'Updating file...',
	create_file_or_folder: 'Creating file...',
	delete_file_or_folder: 'Deleting file...',
}

export function getToolActivityMessage(toolName: string): string {
	return TOOL_ACTIVITY_MESSAGES[toolName] ?? `Running ${toolName}...`
}

/**
 * Returns a short, past-tense label for error messages.
 * e.g. "inspect the project structure" for get_dir_tree
 */
const TOOL_ERROR_LABELS: Record<string, string> = {
	get_dir_tree: 'inspect the project structure',
	read_file: 'read the file',
	search_for_files: 'search files',
	search_pathnames_only: 'search file names',
	search_in_file: 'search inside the file',
	semantic_search: 'search the code index',
	read_lint_errors: 'read diagnostics',
	ls_dir: 'list the directory',
	run_command: 'run the command',
	run_persistent_command: 'run the persistent command',
	open_persistent_terminal: 'open the persistent terminal',
	kill_persistent_terminal: 'close the persistent terminal',
	edit_file: 'edit the file',
	rewrite_file: 'update the file',
	create_file_or_folder: 'create the file',
	delete_file_or_folder: 'delete the file',
}

export function getToolErrorLabel(toolName: string): string {
	return TOOL_ERROR_LABELS[toolName] ?? `execute ${toolName}`
}
