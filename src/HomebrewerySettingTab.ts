import { 
	App,
	PluginSettingTab, 
	Setting
} from 'obsidian';

import HomebreweryPlugin from './HomebreweryPlugin';

export interface HomebrewerySettings {
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

export const DEFAULT_SETTINGS: HomebrewerySettings = {
	linkedFiles: [new brew_setting()],
}

export class HomebrewerySettingTab extends PluginSettingTab {
	plugin: HomebreweryPlugin;

	constructor(app: App, plugin: HomebreweryPlugin) {
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
					themesJson['homebrewery-themes'].forEach((theme: any)=>{
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