const configLoader = require('../config');
const userConfigManager = require('../user_config');

const config = configLoader.getConfig();

async function setup() {
    await loadConfigOptions();
}

async function loadConfigOptions() {
    let table = document.getElementById('page_config');

    let userConfig = await userConfigManager.get();
    let enabledToggle = document.getElementById('enable_autologin');
    enabledToggle.checked = userConfig.enabled;
    enabledToggle.onchange = async function() {
        userConfigManager.set({
            enabled: enabledToggle.checked
        })
    };

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

async function setPageAutologinEnabled(pageId, enabled) {
    let newConfig = {
        autologinPages: {}
    };

    newConfig.autologinPages[pageId] = enabled;

    await userConfigManager.set(newConfig);
}

setup();