import { config, PageConfig } from '../common/config';
import userConfigManager from '../common/user_config';
import * as bootstrap from 'bootstrap'

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
        });
    };
    let autoSubmitToggle = document.querySelector<HTMLInputElement>('input[id=enable_auto_submit]')!!;
    autoSubmitToggle.checked = userConfig.autoSubmitLoginForm;
    autoSubmitToggle.onchange = async function() {
        userConfigManager.set({
            autoSubmitLoginForm: autoSubmitToggle.checked
        });
    };

    for (let pageId in config.pages) {
        let page = config.pages[pageId];
        let generatedOption = createPageOption(pageId, page, userConfig);
        table!!.appendChild(generatedOption);
    }
}

function createPageOption(pageId: string, pageDetails: PageConfig, userConfig: any): HTMLDivElement {
    let tableRow = document.createElement('div');
    tableRow.className = 'row flex-nowrap';

    let nameCell = document.createElement('div');
    nameCell.className = 'col-10 name';
    nameCell.innerText = pageDetails.name;

    let toggleCell = document.createElement('div');
    toggleCell.className = 'col toggle form-check form-switch';
    let toggle = document.createElement('input');
    toggle.className = "form-check-input";
    toggle.type = 'checkbox';
    toggle.role = 'switch';
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