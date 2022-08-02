import { 
	Notice, 
	ItemView, 
	WorkspaceLeaf, 
	TFile
} from 'obsidian';

import HomebreweryPlugin, { HOMEBREWERY_URL, PARSER_RELATIVE_PATH } from './HomebreweryPlugin';

export const VIEW_TYPE_HOMEBREWERY = "brew-view";

export class BrewView extends ItemView {
	
	plugin;

	constructor(leaf: WorkspaceLeaf, plugin: HomebreweryPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() {
		return VIEW_TYPE_HOMEBREWERY;
	}

	getDisplayText() {
		return "Brew view";
	}

	// Create a child element in the view, where all styling is reset. Add an import
	// to the stylesheet from Homebrewery in that element, and the parsed html after it
	async setContent(content: string, stylesheet: string) {
		const container = this.containerEl.children[1];
		container.empty();

		let containerChildEl = container.createDiv("reset-this");
		let stylesheetEl = containerChildEl.createEl('link');
		stylesheetEl.setAttr('href', stylesheet);
		stylesheetEl.setAttr('rel', 'stylesheet');

		containerChildEl.innerHTML += content;
	}

	// Read the contents of the active file and try to render it using the Homebrewery parser
	async parseMarkdown(activeFile: TFile) {
		
		const content = await this.app.vault.read(activeFile);
		let homebreweryParser = undefined;

		// Try to load markdown parser and parse the markdown from the active file
		try {
			homebreweryParser = require(this.plugin.getAbsolutePath(PARSER_RELATIVE_PATH));
		}
		catch {
			new Notice("Unable to load Homebrewery parser");
			return '';
		}
		
		let res = '';
		try {
			res = homebreweryParser.render(content);
		}
		catch {
			new Notice("Corrupted Homebrewery Parser");
			return '';
		}

		return res;
	}

	// Check if the current file is a brew, run its content through the Homebrewery parser,
	// and display the result in the Homebrewery viewer
	async updateView() {
		const activeFile = this.app.workspace.getActiveFile();
		const activeBrewSettings = this.plugin.getActiveBrewSettings();
		if(!activeBrewSettings) return;

		const res = await this.parseMarkdown(activeFile as TFile);
		// TODO: Add functionality for locally stored stylesheets
		this.setContent(res, `${HOMEBREWERY_URL}/api/themes/${activeBrewSettings.theme}/style.css`);
	}

	async onOpen() {
		this.updateView()
	}

	async onClose() {
		// Nothing to clean up.
	}
}