import { 
	App, 
	Editor, 
	MarkdownView, 
	Notice, 
	Plugin, 
	FileSystemAdapter,
	addIcon
} from 'obsidian';

const fs = require('fs');

import { HomebrewerySettingTab, HomebrewerySettings, DEFAULT_SETTINGS } from './HomebrewerySettingTab'
import { BrewView, VIEW_TYPE_HOMEBREWERY } from './BrewView';
import { SnippetsModal } from './SnippetsModal';
import { HOMEBREWERY_ICON } from './homebrewery-icon';

// The website that the application should get content from
// Here in the debug enviroment it is set to localhost
export const HOMEBREWERY_URL = 'http://localhost:8000';
export const PARSER_RELATIVE_DIR = 'parser/';
export const PARSER_RELATIVE_PATH = PARSER_RELATIVE_DIR + 'homebreweryParser.js';

export default class HomebreweryPlugin extends Plugin {
	settings: HomebrewerySettings;

	async onload() {
		await this.loadSettings();

		addIcon('homebrewery', HOMEBREWERY_ICON);
		
		this.registerView(
			VIEW_TYPE_HOMEBREWERY,
			(leaf) => new BrewView(leaf, this)
		);

		this.registerMarkdownPostProcessor((element, context)=>{
			console.log("Here");
		});

		function checkSnippetsMenu(plugin: HomebreweryPlugin) {
			const activeBrewSettings = plugin.getActiveBrewSettings();
			if(!activeBrewSettings){
				new Notice("Snippets are only available in a registered Brew. Go to Settings/Homebrewery to register Brew.");
				return false;
			}
			return true;
		}

		// Load Snippets Modal
		this.addCommand({
			id: "display-modal",
			name: "Display Snippets",
			hotkeys: [{ modifiers: ["Ctrl", "Shift"], key: "enter" }],
			editorCallback: (editor: Editor, view: MarkdownView) => {
				if(!checkSnippetsMenu(this)) return;
				new SnippetsModal(this.app, this, editor).open();
			},
		});

		// Adds the snippets menu as an icon in the left menu
		this.addRibbonIcon('homebrewery', 'Homebrewery Snippets', (evt: MouseEvent) => {
			const editor = app.workspace?.getActiveViewOfType(MarkdownView)?.editor;
			if(!editor) {
				new Notice("You need to put the cursor in the markdown document to access snippets.");
				return;
			}

			if(!checkSnippetsMenu(this)) return;

			new SnippetsModal(this.app, this, editor).open();
		}).addClass('my-plugin-ribbon-class');

		const app = this.app;
		this.addCommand({
			id: "homebrewery-test",
			name: "Test",
			callback() {
				const editor = app.workspace?.getActiveViewOfType(MarkdownView)?.editor;
				console.log(editor);
				// console.log(view.editor);
			},
		})

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new HomebrewerySettingTab(this.app, this));

		// Use lambda call to function for "this" to carry on to it.
		// TODO: See if the update process can be made in some other way that is faster
		this.registerEvent(this.app.vault.on('modify', ()=>{this.updateBrewViews()}));

		// This can be used, but the flickering needs to be fixed
		//this.registerEvent(this.app.workspace.on('editor-change', ()=>{this.updateBrewViews()}));

		this.checkParser();
		await this.activateView();
		this.updateBrewViews();
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_HOMEBREWERY);
	}

	async activateView() {
		if(this.app.workspace.rightSplit === null) {
			setTimeout(this.activateView, 100);
			return;
		}
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_HOMEBREWERY);

		await this.app.workspace.getRightLeaf(false).setViewState({
			type: VIEW_TYPE_HOMEBREWERY,
			active: true,
		});
	
		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(VIEW_TYPE_HOMEBREWERY)[0]
		)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}


	// Download parser from Homebrewery and add it to the parser folder
	async loadParser() {
		if (!fs.existsSync(this.getAbsolutePath(PARSER_RELATIVE_DIR))){
			fs.mkdirSync(this.getAbsolutePath(PARSER_RELATIVE_DIR));
		}

		let getParser = new XMLHttpRequest();
		getParser.open("GET", HOMEBREWERY_URL + '/api/homebreweryParser.js', true);
		getParser.onload = () => {
			fs.writeFileSync(this.getAbsolutePath(PARSER_RELATIVE_PATH), getParser.responseText);
			new Notice("Loaded Homebrewery parser");
		};
		getParser.onerror = () => {
			new Notice("Homebrewery Error: Unable to load parser from Homebrewery");
		};
		getParser.send();
	}

	getThemes() {
		let getThemesJSON = new XMLHttpRequest();
		getThemesJSON.open("GET", HOMEBREWERY_URL + '/api/themes.json', false);
		getThemesJSON.send();
		
		return JSON.parse(getThemesJSON.responseText);
	}

	// Check if parser is loaded. Tries to load it if not
	async checkParser() {
		if (!fs.existsSync(this.getAbsolutePath(PARSER_RELATIVE_DIR))){
			fs.mkdirSync(this.getAbsolutePath(PARSER_RELATIVE_DIR));
		}
		if (!fs.existsSync(this.getAbsolutePath(PARSER_RELATIVE_PATH))){
			this.loadParser();
		}
	}

	// Set the content in every homebrewery view
	async updateBrewViews() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HOMEBREWERY).forEach((leaf) => {
			if (leaf.view instanceof BrewView) {
				leaf.view.updateView();
			}
		});
	}

	getActiveBrewSettings() {
		const activeFile = this.app.workspace.getActiveFile();

		// Check if file is open
		if(! activeFile || !activeFile.name) {
			return undefined;
		}

		const brewSettingsInstance = this.settings.linkedFiles.find((instance)=>{
			return instance['filepath'] == activeFile.path || 
			instance['filepath'] + '.md' == activeFile.path
		});

		// If the current file isn't in the brew settings, it should not be rendered
		if(!brewSettingsInstance){
			console.log("Not a Brew");
			return undefined;
		}

		return brewSettingsInstance;
	}

	getAbsolutePath(fileName: string): string {
		let basePath;
		let relativePath;
		// base path
		if (this.app.vault.adapter instanceof FileSystemAdapter) {
			basePath = this.app.vault.adapter.getBasePath();
		} else {
			throw new Error('Cannot determine base path.');
		}
		// relative path
		relativePath = `${this.app.vault.configDir}/plugins/Obsidian-Homebrewery-Plugin/${fileName}`;
		// absolute path
		return `${basePath}/${relativePath}`;
	}
	
}
