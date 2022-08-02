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
		/*
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			new SnippetsModal(this.app, this).open();
		});
		*/

		// Perform additional things with the ribbon
		// ribbonIconEl.addClass('my-plugin-ribbon-class');

		// Load Snippets Modal
		this.addCommand({
			id: "display-modal",
			name: "Display Snippets",
			// TODO: Figure out a way to get the editor object into the ribbon icon
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new SnippetsModal(this.app, this, editor).open();
			},
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

export class SnippetsModal extends Modal {
	plugin: Homebrewery;
	editor: Editor;

	constructor(app: App, plugin: Homebrewery, editor: Editor) {
		super(app);
		this.plugin = plugin;
		this.editor = editor;
	}

	toggleSnippetsGroup(snippetsContainer: HTMLDivElement, containerName: string) {
		const containers = snippetsContainer.getElementsByClassName(containerName);
		if(!containers) return;

		const container = containers[0];
		if((container as HTMLElement).style.display == 'none') {
			this.hideAllSnippetsGroups(snippetsContainer);
			(container as HTMLElement).style.display = 'block';
		}
		else {
			this.hideAllSnippetsGroups(snippetsContainer);
		}
	}

	hideAllSnippetsGroups(snippetsContainer: HTMLDivElement) {
		let buttonEls = snippetsContainer.getElementsByClassName('homebrewery-snippet-container');
		for(let i = 0; i < buttonEls.length; i++ ) {
			(buttonEls[i] as HTMLElement).style.display = 'none';
		}
	}

	onOpen() {
		let { contentEl } = this;

		const activeBrewSettings = this.plugin.getActiveBrewSettings();

		// Read the current themes snippets from Homebrewery
		let readThemeSnippets = new XMLHttpRequest();
		readThemeSnippets.open("GET", `${HOMEBREWERY_URL}/api/themes/${activeBrewSettings?.theme}/snippets.json`, false);
		readThemeSnippets.send();
		let snippetsGroups = JSON.parse(readThemeSnippets.responseText);

		// We only want to view the snippets for the markdown input field
		snippetsGroups = snippetsGroups.filter((instance)=>{return instance['view'] == 'text'});

		// Add a link element containing the import for fontawesome
		const fontawesomeImport = contentEl.createEl('link');
		fontawesomeImport.href = "https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css";
		fontawesomeImport.rel = 'stylesheet';

		contentEl.createEl('h1').innerHTML = 'Homebrewery Snippets';
		// Container for all group buttons and all snippets buttons
		const snippetsGroupContainer = contentEl.createDiv('homebrewery-snippets-group-container');

		// Generate identifying class name for snippet groups
		const uniqueSnippetName = (snippetsGroup) => {
			return `${snippetsGroup['groupName'].replace(' ', '-')}-container`
		};

		// Go through all groups, add a button in the snippetsGroupContainer and make it display the groups snippets on click
		snippetsGroups.forEach((snippetsGroup)=>{
			let snippetsGroupButton = snippetsGroupContainer.createEl('button', 'mod-cta homebrewery-snippets-group-button')

			snippetsGroupButton.innerHTML = `<i class="fa fa-solid ${snippetsGroup['icon']}"></i> ${snippetsGroup['groupName']}`;
			snippetsGroupButton.onClickEvent((() => {
				this.toggleSnippetsGroup(snippetsContainer, uniqueSnippetName(snippetsGroup));
			}));
		});

		// Container for all snippet snippets in every group
		const snippetsContainer = snippetsGroupContainer.createDiv('homebrewery-snippets-container');

		snippetsGroups.forEach((snippetsGroup)=>{
			// Container for all snippets in specific group
			let snippetGroupContainer = snippetsContainer
				.createDiv(`homebrewery-snippet-container ${uniqueSnippetName(snippetsGroup)}`)
			snippetGroupContainer.style.display = 'none';

			snippetsGroup['snippets'].forEach((snippet) => {
				let snippetButton = snippetGroupContainer.createEl('button')
				snippetButton.addClass('homebrewery-snippet-button');
				snippetButton.innerHTML = `<i class="fa fa-solid ${snippet['icon']}"></i> ${snippet['name']}`;
				snippetButton.onClickEvent(() => {
					this.hideAllSnippetsGroups(snippetsContainer);

					// Run the specified snippet in Homebrewery
					let runSnippet = new XMLHttpRequest();
					runSnippet.open("POST", snippet['path'] , false);
					runSnippet.send();
					this.editor.replaceSelection(runSnippet.responseText);
				})
			});
		});
		
	}
  
	onClose() {
		let { contentEl } = this;
		contentEl.empty();
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
