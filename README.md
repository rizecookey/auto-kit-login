# Auto KIT Login
Browser extension to automatically redirect you to a login screen whenever you are not logged in on a supported KIT page.

## Supported pages
The following pages are currently supported (assuming they are not modified in a way that breaks the login):
- KIT Campus (https://campus.studium.kit.edu)
- KIT ILIAS instance (https://ilias.studium.kit.edu)
- Campus Plus (https://plus.campus.kit.edu)
- WiWi-Portal (https://portal.wiwi.kit.edu)
- My SCC (https://my.scc.kit.edu)
- KIT GitLab instance (https://gitlab.kit.edu)

## Build the extension
To build the extension, `node` and `npm` are required. Run
```
npm run build
```
to build the extension. The build script will create all necessary extension files in the `dist/<browser>` directory,
(`dist/firefox` for Firefox based browsers, `dist/chrome` for Chromium-based browsers).

## Installing
### Firefox
Download the `auto-kit-login-<version>-firefox.xpi` file from the [releases page](https://github.com/rizecookey/auto-kit-login/releases/latest).
Firefox will automatically ask you whether you want to install the addon. After installation, click on the extensions icon in the toolbar, 
click the settings icon for the Auto KIT Login addon and select "Manage extension". Under the permissions tab, make sure that the extension
has the permission to access sites with the kit.edu domain.

### Chrome (and Chromium-based browsers)
Download the `auto-kit-login-<version>-chrome.zip` file from the [releases page](https://github.com/rizecookey/auto-kit-login/releases/latest).
Extract the .zip file in a known location. Navigate to the extensions page in your browser (`chrome://extensions` for Chrome) and enable developer mode.
Click on "Load unpacked" and select the directory in which you extracted the zip file (the folder should contain directories called "background" etc...).

## Usage
Whenever you visit a supported KIT page, the extension will try to determine whether you're currently logged in. If you are not, it will then automatically redirect
you to a page with a popup to log you in. You can use a password manager of your choice to autofill your password to further automate the login process.

You can configure which pages to use the autologin for by clicking the extension icon (if the extension is not pinned, you will find it under the extensions button in the toolbar).
