/*--------------------------------------------------------------------------------------
 *  Copyright 2026 forge Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { MCPServerOfName, MCPConfigFileJSON, MCPConfigFileEntryJSON, MCPServer, MCPToolCallParams, RawMCPToolCall, MCPServerEventResponse } from './mcpServiceTypes.js';
import { Event, Emitter } from '../../../../base/common/event.js';
import { InternalToolInfo } from './prompt/prompts.js';
import { IVoidSettingsService } from './voidSettingsService.js';
import { MCPUserStateOfName } from './voidSettingsTypes.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';


type MCPServiceState = {
	mcpServerOfName: MCPServerOfName,
	error: string | undefined, // global parsing error
}

export interface IMCPService {
	readonly _serviceBrand: undefined;
	revealMCPConfigFile(): Promise<void>;
	toggleServerIsOn(serverName: string, isOn: boolean): Promise<void>;
	addOrUpdateServer(serverName: string, config: MCPConfigFileEntryJSON): Promise<void>;
	removeServer(serverName: string): Promise<void>;
	retryServer(serverName: string): Promise<void>;

	readonly state: MCPServiceState; // NOT persisted
	onDidChangeState: Event<void>;

	getMCPTools(): InternalToolInfo[] | undefined;
	callMCPTool(toolData: MCPToolCallParams): Promise<{ result: RawMCPToolCall }>;
	stringifyResult(result: RawMCPToolCall): string
}

export const IMCPService = createDecorator<IMCPService>('mcpConfigService');



const MCP_CONFIG_FILE_NAME = 'mcp.json';
const MCP_CONFIG_SAMPLE = { mcpServers: {} }
const MCP_CONFIG_SAMPLE_STRING = JSON.stringify(MCP_CONFIG_SAMPLE, null, 2);
const COCOINDEX_MANAGER = 'forge-cocoindex' as const;


// export interface MCPCallToolOfToolName {
// 	[toolName: string]: (params: any) => Promise<{
// 		result: any | Promise<any>,
// 		interruptTool?: () => void
// 	}>;
// }


class MCPService extends Disposable implements IMCPService {
	_serviceBrand: undefined;


	private readonly channel: IChannel // MCPChannel
	private _lastMCPConfig: MCPConfigFileJSON = { mcpServers: {} };

	// list of MCP servers pulled from mcpChannel
	state: MCPServiceState = {
		mcpServerOfName: {},
		error: undefined,
	}

	// Emitters for server events
	private readonly _onDidChangeState = new Emitter<void>();
	public readonly onDidChangeState = this._onDidChangeState.event;

	// private readonly _onLoadingServersChange = new Emitter<MCPServerEventLoadingParam>();
	// public readonly onLoadingServersChange = this._onLoadingServersChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@IProductService private readonly productService: IProductService,
		@IEditorService private readonly editorService: IEditorService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();
		this.channel = this.mainProcessService.getChannel('void-channel-mcp')


		const onEvent = (e: MCPServerEventResponse) => {
			// console.log('GOT EVENT', e)
			this._setMCPServerState(e.response.name, e.response.newServer)
		}
		this._register((this.channel.listen('onAdd_server') satisfies Event<MCPServerEventResponse>)(onEvent));
		this._register((this.channel.listen('onUpdate_server') satisfies Event<MCPServerEventResponse>)(onEvent));
		this._register((this.channel.listen('onDelete_server') satisfies Event<MCPServerEventResponse>)(onEvent));

		this._initialize();
	}


	private async _initialize() {
		try {
			await this.voidSettingsService.waitForInitState;

			// Create .mcpConfig if it doesn't exist
			const mcpConfigUri = await this._getMCPConfigFilePath();
			const fileExists = await this._configFileExists(mcpConfigUri);
			if (!fileExists) {
				await this._createMCPConfigFile(mcpConfigUri);
				console.log('MCP Config file created:', mcpConfigUri.toString());
			}
			await this._removeCocoIndexMCPServers();
			await this._addMCPConfigFileWatcher();

			this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(async () => {
				await this._refreshMCPServers();
			}));

			await this._refreshMCPServers();
		} catch (error) {
			console.error('Error initializing MCPService:', error);
		}
	}

	private readonly _setMCPServerState = async (serverName: string, newServer: MCPServer | undefined) => {
		if (newServer === undefined) {
			// Remove the server from the state
			const { [serverName]: removed, ...remainingServers } = this.state.mcpServerOfName;
			this.state = {
				...this.state,
				mcpServerOfName: remainingServers
			}
		} else {
			// Add or update the server
			this.state = {
				...this.state,
				mcpServerOfName: {
					...this.state.mcpServerOfName,
					[serverName]: newServer
				}
			}
		}
		this._onDidChangeState.fire();
	}

	private readonly _setHasError = async (errMsg: string | undefined) => {
		this.state = {
			...this.state,
			error: errMsg,
		}
		this._onDidChangeState.fire();
	}

	// Create the file/directory if it doesn't exist
	private async _createMCPConfigFile(mcpConfigUri: URI): Promise<void> {
		await this.fileService.createFile(mcpConfigUri.with({ path: mcpConfigUri.path }));
		const buffer = VSBuffer.fromString(MCP_CONFIG_SAMPLE_STRING);
		await this.fileService.writeFile(mcpConfigUri, buffer);
	}


	private async _addMCPConfigFileWatcher(): Promise<void> {
		const mcpConfigUri = await this._getMCPConfigFilePath();
		this._register(
			this.fileService.watch(mcpConfigUri)
		)

		this._register(this.fileService.onDidFilesChange(async e => {
			if (!e.contains(mcpConfigUri)) return
			await this._refreshMCPServers();
		}));
	}

	// Client-side functions

	public async revealMCPConfigFile(): Promise<void> {
		try {
			const mcpConfigUri = await this._getMCPConfigFilePath();
			await this.editorService.openEditor({
				resource: mcpConfigUri,
				options: {
					pinned: true,
					revealIfOpened: true,
				}
			});
		} catch (error) {
			console.error('Error opening MCP config file:', error);
		}
	}

	private async _removeCocoIndexMCPServers(): Promise<void> {
		const config = await this._readRawMCPConfigFile();
		let changed = false;
		for (const [name, entry] of Object.entries(config.mcpServers)) {
			if (entry.managedBy === COCOINDEX_MANAGER
				|| (name.toLowerCase() === 'cocoindex' && entry.command?.toLowerCase() === 'ccc' && entry.args?.[0] === 'mcp')) {
				delete config.mcpServers[name];
				changed = true;
			}
		}
		if (changed) await this._writeRawMCPConfigFile(config);
	}

	private async _readRawMCPConfigFile(): Promise<MCPConfigFileJSON> {
		const mcpConfigUri = await this._getMCPConfigFilePath();
		const fileContent = await this.fileService.readFile(mcpConfigUri);
		const parsed = JSON.parse(fileContent.value.toString()) as Partial<MCPConfigFileJSON>;
		return { mcpServers: parsed.mcpServers ?? {} };
	}

	private async _writeRawMCPConfigFile(config: MCPConfigFileJSON): Promise<void> {
		const mcpConfigUri = await this._getMCPConfigFilePath();
		await this.fileService.writeFile(mcpConfigUri, VSBuffer.fromString(JSON.stringify(config, null, 2)));
	}

	public async addOrUpdateServer(serverName: string, config: MCPConfigFileEntryJSON): Promise<void> {
		const name = serverName.trim();
		if (!name) throw new Error('Server name is required.');
		if (!config.command?.trim() && !config.url?.trim()) throw new Error('Enter either a command or an MCP URL.');
		if (config.command && config.url) throw new Error('Choose either stdio command or HTTP URL, not both.');
		const current = await this._readRawMCPConfigFile();
		current.mcpServers[name] = config;
		await this._writeRawMCPConfigFile(current);
		await this._refreshMCPServers();
	}

	public async removeServer(serverName: string): Promise<void> {
		const current = await this._readRawMCPConfigFile();
		delete current.mcpServers[serverName];
		await this._writeRawMCPConfigFile(current);
		await this._refreshMCPServers();
	}

	public async retryServer(serverName: string): Promise<void> {
		if (!(serverName in (await this._readRawMCPConfigFile()).mcpServers)) return;
		await this.voidSettingsService.setMCPServerState(serverName, { isOn: true });
		await this._refreshMCPServers([serverName]);
	}

	public getMCPTools(): InternalToolInfo[] | undefined {
		const allTools: InternalToolInfo[] = []
		for (const serverName in this.state.mcpServerOfName) {
			const server = this.state.mcpServerOfName[serverName];
			server.tools?.forEach(tool => {
				allTools.push({
					description: tool.description || '',
					params: this._transformInputSchemaToParams(tool.inputSchema),
					name: tool.name,
					mcpServerName: serverName,
				})
			})
		}
		if (allTools.length === 0) return undefined
		return allTools
	}

	private _transformInputSchemaToParams(inputSchema?: Record<string, any>): { [paramName: string]: { description: string } } {

		// Check if inputSchema is valid
		if (!inputSchema || !inputSchema.properties) return {};

		const params: { [paramName: string]: { description: string } } = {};
		Object.keys(inputSchema.properties).forEach(paramName => {
			const propertyValues = inputSchema.properties[paramName];

			// Check if propertyValues is not an object
			if (typeof propertyValues !== 'object') {
				console.warn(`Invalid property value for ${paramName}: expected object, got ${typeof propertyValues}`);
				return; // in forEach the return is equivalent to continue
			}

			// Add the parameter to the params object
			params[paramName] = {
				description: JSON.stringify(propertyValues.description || '', null, 2) || '',
			}
		});
		return params;
	}

	private async _getMCPConfigFilePath(): Promise<URI> {
		const appName = this.productService.dataFolderName
		const userHome = await this.pathService.userHome();
		const uri = URI.joinPath(userHome, appName, MCP_CONFIG_FILE_NAME)
		return uri
	}

	private async _configFileExists(mcpConfigUri: URI): Promise<boolean> {
		try {
			await this.fileService.stat(mcpConfigUri);
			return true;
		} catch (error) {
			return false;
		}
	}


	private async _parseMCPConfigFile(): Promise<MCPConfigFileJSON | null> {
		const mcpConfigUri = await this._getMCPConfigFilePath();
		try {
			const fileContent = await this.fileService.readFile(mcpConfigUri);
			const contentString = fileContent.value.toString();
			const configFileJson = JSON.parse(contentString);
			if (!configFileJson.mcpServers) {
				throw new Error('Missing mcpServers property');
			}
			return configFileJson as MCPConfigFileJSON;
		} catch (error) {
			const fullError = `Error parsing MCP config file: ${error}`;
			this._setHasError(fullError)
			return null;
		}
	}


	// Handle server state changes
	private async _refreshMCPServers(forceServerNames: string[] = []): Promise<void> {

		this._setHasError(undefined)

		const newConfigFileJSON = await this._parseMCPConfigFile();
		if (!newConfigFileJSON) { console.log(`Not setting state: MCP config file not found`); return }
		if (!newConfigFileJSON?.mcpServers) { console.log(`Not setting state: MCP config file did not have an 'mcpServers' field`); return }


		const oldConfigFileNames = Object.keys(this._lastMCPConfig.mcpServers)
		const newConfigFileNames = Object.keys(newConfigFileJSON.mcpServers)

		const addedServerNames = newConfigFileNames.filter(serverName => !oldConfigFileNames.includes(serverName)); // in new and not in old
		const removedServerNames = oldConfigFileNames.filter(serverName => !newConfigFileNames.includes(serverName)); // in old and not in new

		// set isOn to any new servers in the config
		const addedUserStateOfName: MCPUserStateOfName = {}
		for (const name of addedServerNames) { addedUserStateOfName[name] = { isOn: true } }
		await this.voidSettingsService.addMCPUserStateOfNames(addedUserStateOfName);

		// delete isOn for any servers that no longer show up in the config
		await this.voidSettingsService.removeMCPUserStateOfNames(removedServerNames);

		const updatedServerNames = newConfigFileNames.filter(serverName =>
			!addedServerNames.includes(serverName)
			&& (forceServerNames.includes(serverName)
				|| JSON.stringify(this._lastMCPConfig.mcpServers[serverName]) !== JSON.stringify(newConfigFileJSON.mcpServers[serverName])))
		const changedServerNames = [...addedServerNames, ...updatedServerNames]
		this._lastMCPConfig = newConfigFileJSON

		// Only reconnect changed servers. File watcher events often repeat our own writes.
		for (const serverName of changedServerNames) {
			this._setMCPServerState(serverName, { status: 'loading', tools: [] })
		}
		if (changedServerNames.length === 0 && removedServerNames.length === 0) return

		await this.channel.call('refreshMCPServers', {
			mcpConfigFileJSON: newConfigFileJSON,
			addedServerNames,
			removedServerNames,
			updatedServerNames,
			userStateOfName: this.voidSettingsService.state.mcpUserStateOfName,
		})
	}

	stringifyResult(result: RawMCPToolCall): string {
		let toolResultStr: string
		if (result.event === 'text') {
			toolResultStr = result.text
		} else if (result.event === 'image') {
			toolResultStr = `[Image: ${result.image.mimeType}]`
		} else if (result.event === 'audio') {
			toolResultStr = `[Audio content]`
		} else if (result.event === 'resource') {
			toolResultStr = `[Resource content]`
		} else {
			toolResultStr = JSON.stringify(result)
		}
		return toolResultStr
	}

	// toggle MCP server and update isOn in void settings
	public async toggleServerIsOn(serverName: string, isOn: boolean): Promise<void> {
		this._setMCPServerState(serverName, { status: 'loading', tools: [] })

		await this.voidSettingsService.setMCPServerState(serverName, { isOn });
		await this.channel.call('toggleMCPServer', { serverName, isOn })
	}


	public async callMCPTool(toolData: MCPToolCallParams): Promise<{ result: RawMCPToolCall }> {
		const result = await this.channel.call<RawMCPToolCall>('callTool', toolData);
		if (result.event === 'error') {
			throw new Error(`Error: ${result.text}`)
		}
		return { result };
	}

	// public getMCPToolFns(): MCPToolResultType {
	// 	const tools = this.getMCPTools();
	// 	const toolFns: MCPToolResultType = {};

	// 	tools.forEach((tool) => {
	// 		const name = tool.name;
	// 		// Define the tool call function
	// 		const toolFn = async (params: {
	// 			serverName: string,
	// 			toolName: string,
	// 			args: any
	// 		}) => {
	// 			const { serverName, toolName, args } = params;
	// 			const response = await this.callMCPTool({
	// 				serverName,
	// 				toolName,
	// 				params: args,
	// 			});
	// 			return { result: response }
	// 		};
	// 		toolFns[name] = toolFn;
	// 	});

	// 	return toolFns
	// }
}

registerSingleton(IMCPService, MCPService, InstantiationType.Eager);
