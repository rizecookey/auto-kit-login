const configLoader = require('../common/config');
const userConfigManager = require('../common/user_config');

const config = configLoader.getConfig();

async function setup() {
    await loadConfigOptions();
}

async function loadConfigOptions() {
    let table = document.getElementById('page_config');

    let userConfig = await userConfigManager.get();

    setupToggle(document.getElementById('enable_autologin'), userConfig.enabled, (element, _) => userConfigManager.set({ enabled: element.checked }));
    setupToggle(document.getElementById('save_password'), userConfig.savePassword, async (element, _) => userConfigManager.set({ savePassword: element.checked }));

    for (let pageId in config.pages) {
        let page = config.pages[pageId];
        let generatedOption = createPageOption(pageId, page, userConfig);
        table.appendChild(generatedOption);
    }
}

function createPageOption(pageId, pageDetails, userConfig) {
    let tableRow = document.createElement('div');
    tableRow.className = 'table_row';

    let nameCell = document.createElement('div');
    nameCell.className = 'table_cell name';
    nameCell.innerText = pageDetails.name;

    let toggleCell = document.createElement('div');
    toggleCell.className = 'table_cell toggle';
    const toggle = createToggle(`autologin_${pageId}`, 'checkbox');
    setupToggle(toggle, userConfig.autologinPages[pageId], async () => await setPageAutologinEnabled(pageId, toggle.checked))
    toggleCell.appendChild(toggle);

    tableRow.appendChild(nameCell);
    tableRow.appendChild(toggleCell);

    return tableRow;
}

function createToggle(id, type) {
    const toggle = document.createElement('input');
    toggle.type = type;
    toggle.id = id;
    return toggle;
}

function setupToggle(toggle, initialValue, onValueChange) {
    toggle.checked = initialValue;
    toggle.addEventListener('change', (element, event) => onValueChange(element, event));
}

async function setPageAutologinEnabled(pageId, enabled) {
    let newConfig = {
        autologinPages: {}
    };

    newConfig.autologinPages[pageId] = enabled;

    await userConfigManager.set(newConfig);
}

setup();