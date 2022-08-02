import { 
	App, 
	Editor, 
	Modal
} from 'obsidian';

import HomebreweryPlugin, { HOMEBREWERY_URL } from './HomebreweryPlugin';

export class SnippetsModal extends Modal {
	plugin: HomebreweryPlugin;
	editor: Editor;

	constructor(app: App, plugin: HomebreweryPlugin, editor: Editor) {
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
		snippetsGroups = snippetsGroups.filter((instance: any)=>{return instance['view'] == 'text'});

		// Add a link element containing the import for fontawesome
		const fontawesomeImport = contentEl.createEl('link');
		fontawesomeImport.href = "https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css";
		fontawesomeImport.rel = 'stylesheet';

		contentEl.createEl('h1').innerHTML = 'Homebrewery Snippets';
		// Container for all group buttons and all snippets buttons
		const snippetsGroupContainer = contentEl.createDiv('homebrewery-snippets-group-container');

		// Generate identifying class name for snippet groups
		const uniqueSnippetName = (snippetsGroup: any) => {
			return `${snippetsGroup['groupName'].replace(' ', '-')}-container`
		};

		// Go through all groups, add a button in the snippetsGroupContainer and make it display the groups snippets on click
		snippetsGroups.forEach((snippetsGroup: any)=>{
			let snippetsGroupButton = snippetsGroupContainer.createEl('button', 'mod-cta homebrewery-snippets-group-button')

			snippetsGroupButton.innerHTML = `<i class="fa fa-solid ${snippetsGroup['icon']}"></i> ${snippetsGroup['groupName']}`;
			snippetsGroupButton.onClickEvent((() => {
				this.toggleSnippetsGroup(snippetsContainer, uniqueSnippetName(snippetsGroup));
			}));
		});

		// Container for all snippet snippets in every group
		const snippetsContainer = snippetsGroupContainer.createDiv('homebrewery-snippets-container');

		snippetsGroups.forEach((snippetsGroup: any)=>{
			// Container for all snippets in specific group
			let snippetGroupContainer = snippetsContainer
				.createDiv(`homebrewery-snippet-container ${uniqueSnippetName(snippetsGroup)}`)
			snippetGroupContainer.style.display = 'none';

			snippetsGroup['snippets'].forEach((snippet: any) => {
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