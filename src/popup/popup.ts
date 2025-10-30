import { config, PageConfig } from '../common/config';
import userConfigManager from '../common/user_config';
import * as bootstrap from 'bootstrap'

async function setup(): Promise<void> {
    bootstrap; // make sure bootstrap is loaded
    await loadConfigOptions();
}

async function loadConfigOptions(): Promise<void> {
    let table = document.getElementById('page_config');

    let userConfig = await userConfigManager.get();

    setupToggle('enable_autologin', userConfig.enabled, val => userConfigManager.set({ enabled: val }));
    setupToggle('enable_session_cookie_extension', userConfig.extendLoginCookieLifetime, val => userConfigManager.set({ extendLoginCookieLifetime: val }))
    setupToggle('enable_auto_submit', userConfig.autoSubmitLoginForm, val => userConfigManager.set({ autoSubmitLoginForm: val }));
    setupDropdown('login_window_type', config.extension.userConfig.loginWindowTypes, userConfig.loginWindowType, val => userConfigManager.set({ loginWindowType: val }))

    for (let pageId in config.pages) {
        let page = config.pages[pageId];
        let generatedOption = createPageOption(pageId, page, userConfig);
        table!!.appendChild(generatedOption);
    }
}

function setupToggle(id: string, initialValue: boolean, onChange: (newValue: boolean) => void): HTMLInputElement {
    let toggle = document.querySelector<HTMLInputElement>(`input[id=${id}]`);
    if (!toggle) {
        throw new Error(`toggle ${id} not found in document`);
    }

    toggle.checked = initialValue;
    toggle.onchange = () => onChange(toggle.checked);
    return toggle;
}

function setupDropdown<T>(id: string, values: {[Property in keyof T]: string}, initialValue: keyof T, onChange: (newValue: keyof T) => void) {
    let dropdownDiv = document.querySelector<HTMLDivElement>(`div[id=${id}]`);
    if (!dropdownDiv || !dropdownDiv.classList.contains('dropdown')) {
        throw new Error(`dropdown ${id} not found in document`);
    }

    let dropdownButton = dropdownDiv.querySelector<HTMLButtonElement>(`button`);
    if (!dropdownButton) {
        throw new Error(`no dropdown button associated with ${id} found`);
    }
    dropdownButton.innerText = values[initialValue];
    let dropdownList = dropdownDiv.querySelector<HTMLUListElement>(`ul`);
    if (!dropdownList) {
        throw new Error(`no dropdown options associated with ${id} found`);
    }
    for (let value in values) {
        let listEntry = document.createElement('li');
        let listLink = document.createElement('a');
        listLink.className = 'dropdown-item';
        listLink.href = '#';
        listLink.innerText = values[value];
        listLink.onclick = () => {
            onChange(value);
            dropdownButton.innerText = values[value];
        }
        listEntry.appendChild(listLink);
        dropdownList.appendChild(listEntry);
    }
}

function createPageOption(pageId: string, pageDetails: PageConfig, userConfig: any): HTMLDivElement {
    let tableRow = document.createElement('div');
    tableRow.className = 'row flex-nowrap align-items-center';

    let nameCell = document.createElement('div');
    nameCell.className = 'col-10 name';
    nameCell.innerText = pageDetails.name;

    let toggleCell = document.createElement('div');
    toggleCell.className = 'col toggle form-check form-switch';
    let toggle = document.createElement('input');
    toggle.className = "form-check-input float-end";
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