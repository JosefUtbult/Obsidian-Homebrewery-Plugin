import { 
	Notice, 
	ItemView, 
	WorkspaceLeaf, 
	MarkdownView,
	EditorPosition
} from 'obsidian';

import HomebreweryPlugin, { HOMEBREWERY_URL, PARSER_RELATIVE_PATH } from './HomebreweryPlugin';

export const VIEW_TYPE_HOMEBREWERY = "brew-view";

// Generates a view in the right sidebar containing the rendered brew
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

	// Goes through all elements in the old rendered view and the new one, and only makes changes on 
	// elements that has changed to avoid rerendering flickering
	async compareElementsRecursively(resEl: HTMLElement, bufferEl: HTMLElement){
		
		for(let i = 0; i < Math.max(bufferEl.children.length, resEl.children.length); i++ ) {
			if(!bufferEl.children[i]) {
				if(resEl.children[bufferEl.children.length - 1]) {
					resEl.removeChild(resEl.children[bufferEl.children.length - 1]);
				}
			}
			else if(!resEl.children[i]) {
				if(bufferEl.children[i - 1]) {
					resEl.appendChild(bufferEl.children[i - 1].cloneNode(true));
				}
			}
			else {
				this.compareElementsRecursively(resEl.children[i] as HTMLElement, bufferEl.children[i] as HTMLElement);
			}
		}

		// If the outer html is the same after going through all their children, the recursion worked
		// or there was'nt any changes in the subtree
		if(resEl.outerHTML != bufferEl.outerHTML) {
			resEl.outerHTML = bufferEl.outerHTML;
		}
	}

	// Create a child element in the view, where all styling is reset. Add an import
	// to the stylesheet from Homebrewery in that element, and the parsed html after it.
	// When the markdown changes and the element already is present, generate a template buffer,
	// write the new contents to that and recursively change every changed child in the element 
	async setContent(content: string, stylesheet: string) {
		const container = this.containerEl.children[1];
		const containerChild = container.getElementsByClassName('homebrewery-content');
		
		// If there already is a rendered view present, replace the changed content in that view
		// instead of recreating it in order to avoid rerendering flickering
		if(containerChild.length) {
			const resEl = containerChild[0] as HTMLElement;

			// Fetch the stylesheet link and update its href if it's changed
			const stylesheetEl = container.firstChild?.firstChild as HTMLLinkElement;
			if(stylesheetEl && stylesheetEl.href && stylesheetEl.href != stylesheet) {
				stylesheetEl.href = stylesheet;
			}

			// Create a dummy object and put the new content in that, creating a separate element tree
			var template = resEl.parentElement?.createEl('template');
			if(!template) return;
			template.innerHTML = content;
			let bufferEl = template.content.firstChild;
			if(!resEl.firstChild || !bufferEl) return;

			// Recursively go through all elements in the old rendered view and the new one, and update elements
			await this.compareElementsRecursively(resEl.firstChild as HTMLElement, bufferEl as HTMLElement);

			resEl.parentElement?.removeChild(template);
		}
		// If there isn't any element containing the rendered view it's probably the first time rendering the 
		// document, make it from scratch
		else {
			let containerChildEl = container.createDiv("reset-this");
			let stylesheetEl = containerChildEl.createEl('link');
			stylesheetEl.setAttr('href', stylesheet);
			stylesheetEl.setAttr('rel', 'stylesheet');
			let containerSubChildEl = containerChildEl.createDiv("homebrewery-content");

			containerSubChildEl.innerHTML += content;
		}
	}

	// Ugly hack to get substitution functionality with a lambda expression to work in typescript
	markdownSubstitute(re: RegExp, data: string) {
		let instance = re.exec(data);
		if (instance !== null) {
			const link = instance[1].toLowerCase().replace(' ', '-');
			const linkEl = `[${instance[1]}](#${link ? link : 'None'})`;
			const res = instance.input.slice(0, instance.index) + linkEl + 
				instance.input.slice(instance.index + 
				instance[0].length, instance.input.length);
			return this.markdownSubstitute(re, res)
		}
		return data;
	}

	// Read the contents of the active file and try to render it using the Homebrewery parser
	async parseMarkdown(content: string, filename: string) {
		const inlineFileLinkRe = new RegExp('\\[\\[[\\s]*' + filename + '#([^\\]]*)\\]\\]', 'g');
		const noFileLinkRe = new RegExp('\\[\\[[\\s]*#([^\\]]*)\\]\\]', 'g');
		content = this.markdownSubstitute(inlineFileLinkRe, content);
		content = this.markdownSubstitute(noFileLinkRe, content);
		

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
		const activeBrewSettings = this.plugin.getActiveBrewSettings();
		if(!activeBrewSettings) return;
		
		const activeFile = this.app.workspace.getActiveFile();
		if(!activeFile) return;
		
		let content = '';

		// Try to load the content from the current editor. The changes here are accessible earlier than from a saved file
		const doc = app.workspace?.getActiveViewOfType(MarkdownView)?.editor?.getDoc();
		if(doc) {
			content = doc.getRange({ch: 0, line: 0} as EditorPosition, {ch: 0, line: doc.lineCount()} as EditorPosition);
			if(!content) return;
		}
		// If no editor is present (when the view is updated during plugin load or settings changes), just read the content
		// from the saved active file
		else {
			content = await this.app.vault.read(activeFile);
		}
		
		const res = await this.parseMarkdown(content, activeFile.name.replace('.md', ''));
		// TODO: Add functionality for locally stored stylesheets
		this.setContent(res, `${HOMEBREWERY_URL}/api/themes/${activeBrewSettings.theme}/style.css`);
	}

	async onOpen() {
		this.updateView()
	}

	async onClose() {
	}
}