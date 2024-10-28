import userConfigManager from '../common/user_config'

async function shouldAutoSubmit(): Promise<boolean> {
    return (await userConfigManager.get()).autoSubmitLoginForm;
}

async function setup(): Promise<void> {
    const passwordField = document.querySelector<HTMLInputElement>('input[id=password]');
    const submitButton = document.querySelector<HTMLButtonElement>('button[id=sbmt]');

    if (!passwordField || !submitButton) {
        // not the login page
        return;
    }

    async function onPotentialPasswordInput() {
        if (passwordField!!.value.length !== 0 && await shouldAutoSubmit()) {
            submitButton!!.click();
        }
    }

    passwordField?.addEventListener('input', () => onPotentialPasswordInput());
    onPotentialPasswordInput();

    console.log("auto submit script has been loaded");
}

setup();