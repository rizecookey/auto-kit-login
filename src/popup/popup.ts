import * as configLoader from '../common/config';
import * as userConfigManager from '../common/user_config';
import { PageConfig } from '../common/config';

const config = configLoader.getConfig();

async function setup(): Promise<void> {
    await loadConfigOptions();
}

async function loadConfigOptions(): Promise<void> {
    let table = document.getElementById('page_config');

    let userConfig = await userConfigManager.get();
    let enabledToggle = document.querySelector<HTMLInputElement>('input[id=enable_autologin]')!!;
    enabledToggle.checked = userConfig.enabled;
    enabledToggle.onchange = async function() {
        userConfigManager.set({
            enabled: enabledToggle.checked
        })
    };

    for (let pageId in config.pages) {
        let page = config.pages[pageId];
        let generatedOption = createPageOption(pageId, page, userConfig);
        table!!.appendChild(generatedOption);
    }
}

function createPageOption(pageId: string, pageDetails: PageConfig, userConfig: any): HTMLDivElement {
    let tableRow = document.createElement('div');
    tableRow.className = 'table_row';

    let nameCell = document.createElement('div');
    nameCell.className = 'table_cell name';
    nameCell.innerHTML = pageDetails.name;

    let toggleCell = document.createElement('div');
    toggleCell.className = 'table_cell toggle';
    let toggle = document.createElement('input');
    toggle.type = 'checkbox'
    toggle.id = `autologin_${pageId}`;
    toggle.checked = userConfig.autologinPages[pageId];
    toggle.onchange = async function() {
        await setPageAutologinEnabled(pageId, toggle.checked);
    }
    toggleCell.appendChild(toggle);

    tableRow.appendChild(nameCell);
    tableRow.appendChild(toggleCell);

    return tableRow;
}

async function setPageAutologinEnabled(pageId: string, enabled: boolean): Promise<void> {
    let newConfig: any = {
        autologinPages: {}
    };

    newConfig.autologinPages[pageId] = enabled;

    await userConfigManager.set(newConfig);
}

setup();