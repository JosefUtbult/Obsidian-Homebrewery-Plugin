import { 
	App, 
	Editor, 
	MarkdownView, 
	Modal, 
	Notice, 
	Plugin, 
	PluginSettingTab, 
	Setting, 
	FileSystemAdapter, 
	ItemView, 
	WorkspaceLeaf, 
	TFile
} from 'obsidian';
import { threadId } from 'worker_threads';

const fs = require('fs');

// The website that the application should get content from
// Here in the debug enviroment it is set to localhost
const HOMEBREWERY_URL = 'http://localhost:8000';
const PARSER_RELATIVE_DIR = 'parser/';
const PARSER_RELATIVE_PATH = PARSER_RELATIVE_DIR + 'homebreweryParser.js';
export const VIEW_TYPE_HOMEBREWERY = "brew-view";

// Remember to rename these classes and interfaces!

interface HomebrewerySettings {
	linkedFiles: brew_setting[];
}

class brew_setting {
	filepath
	theme
	
	constructor() {
		this.filepath = '';
		this.theme = '5ePHB';
	}
};

const DEFAULT_SETTINGS: HomebrewerySettings = {
	linkedFiles: [new brew_setting()],
}

function getAbsolutePath(fileName: string): string {
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

export default class Homebrewery extends Plugin {
	settings: HomebrewerySettings;

	async onload() {
		await this.loadSettings();

		this.registerView(
			VIEW_TYPE_HOMEBREWERY,
			(leaf) => new BrewView(leaf, this)
		);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});

		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				// new SampleModal(this.app).open();
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						// new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new HomebrewerySettingTab(this.app, this));

		// On opening a new file
		// this.registerEvent(this.app.workspace.on('active-leaf-change', parseMarkdown));
		
		// Use lambda call to function for "this" to carry on to it.
		// TODO: See if the update process can be made in some other way that is faster
		this.registerEvent(this.app.vault.on('modify', ()=>{this.updateBrewViews()}));

		this.checkParser();
		this.activateView();
		this.updateBrewViews();
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_HOMEBREWERY);
	}

	async activateView() {
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
		if (!fs.existsSync(getAbsolutePath(PARSER_RELATIVE_DIR))){
			fs.mkdirSync(getAbsolutePath(PARSER_RELATIVE_DIR));
		}

		let getParser = new XMLHttpRequest();
		getParser.open("GET", HOMEBREWERY_URL + '/api/homebreweryParser.js', true);
		getParser.onload = () => {
			fs.writeFileSync(getAbsolutePath(PARSER_RELATIVE_PATH), getParser.responseText);
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
		if (!fs.existsSync(getAbsolutePath(PARSER_RELATIVE_DIR))){
			fs.mkdirSync(getAbsolutePath(PARSER_RELATIVE_DIR));
		}
		if (!fs.existsSync(getAbsolutePath(PARSER_RELATIVE_PATH))){
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
}


export class BrewView extends ItemView {
	
	plugin;

	constructor(leaf: WorkspaceLeaf, plugin: Homebrewery) {
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
			homebreweryParser = require(getAbsolutePath(PARSER_RELATIVE_PATH));
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
		
		// Check if file is open
		if(! activeFile || !activeFile.name) {
			return;
		}

		const brewSettingsInstance = this.plugin.settings.linkedFiles.find((instance)=>{
			return instance['filepath'] == activeFile.path || 
			instance['filepath'] + '.md' == activeFile.path
		});

		// If the current file isn't in the brew settings, it should not be rendered
		if(!brewSettingsInstance){
			console.log("Not a Brew");
			return;
		}

		const res = await this.parseMarkdown(activeFile);
		// TODO: Add functionality for locally stored stylesheets
		this.setContent(res, `${HOMEBREWERY_URL}/api/themes/${brewSettingsInstance.theme}/style.css`);
	}

	async onOpen() {
		this.updateView()
	}

	async onClose() {
		// Nothing to clean up.
	}
}

class HomebrewerySettingTab extends PluginSettingTab {
	plugin: Homebrewery;

	constructor(app: App, plugin: Homebrewery) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		let themesJson = this.plugin.getThemes();

		containerEl.empty();
		containerEl.createEl('h2', {text: 'Homebrewery settings'});

		// Load the parser from the Homebrewery site
		new Setting(containerEl)
			.setName('Load Homebrewery parser')
			.setDesc('Load the parser from Homebrewery. Do this to update the parser to the latest version')
			.addButton( button => button
				.setButtonText('Load Parser')
				.setCta()
				.onClick(this.plugin.loadParser)
			);

		// Add button to create a new file link. It generates an empty instance of
		// source/target filepaths in settings
		new Setting(containerEl)
			.setName('Add a brew')
			.setDesc('Exit Homebrewery settings and reenter in order to apply new brew slot.')
			.addButton( button => button
				.setButtonText('Add')
				.setCta()
				.onClick( async () => {
					this.plugin.settings.linkedFiles.push(new brew_setting());
					await this.plugin.saveSettings();
					// Call the display function again to reload the settings
					this.display();
				})
			);

		// Add button to remove all brews from Homebrewery
		new Setting(containerEl)
			.setName('Remove all brews')
			.setDesc('This will not remove the markdown files. Only the links to Homebrewery')
			.addButton( button => button
				.setButtonText('Remove')
				.setWarning()
				.onClick( async () => {
					this.plugin.settings.linkedFiles = [];
					await this.plugin.saveSettings();
					// Call the display function again to reload the settings
					this.display();
				})
			);

		// Expose this as object in loop
		const parent = this
		this.plugin.settings.linkedFiles.forEach(function (instance: brew_setting, index) {
			let childContainer = containerEl.createDiv('brew-settings-container');
			
			// Add an heading containing only the filename
			childContainer.createEl('h4', {text: instance.filepath ? instance.filepath.replace(/^.*[\\\/]/, '') : 'Brew'});
			
			new Setting(childContainer)
				.setName(`Filepath`)
				.addText( text => text
					.setValue(instance.filepath)
					.onChange(async value => {
						instance.filepath = value;
						await parent.plugin.saveSettings();
					})
				)

			new Setting(childContainer)
				.setName('Theme')
				.addDropdown((dropdown) => {
					themesJson['homebrewery-themes'].forEach((theme)=>{
						dropdown.addOption(theme['path'], theme['name'])
					})
					dropdown.setValue(instance.theme)
						.onChange(async theme => {
							instance.theme = theme;
							await parent.plugin.saveSettings();
							await parent.plugin.updateBrewViews();
						});
				})

			new Setting(childContainer)
				.setName('Remove Brew')
				.setDesc('This will not remove the markdown files. Only the links to Homebrewery')
				// Adds button to remove a specific brew
				.addButton( button => button
					.setButtonText('Remove')
					.setWarning()
					.onClick(async () => {
						parent.plugin.settings.linkedFiles.splice(index, 1);
						await parent.plugin.saveSettings();
						// Call the display function again to reload the settings
						parent.display();
					})
				);
		});
	}
}
