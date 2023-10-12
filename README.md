# Auto KIT Login
Browser extension to automatically log you in on pages of the Karlsruher Institute of Technology.

# Build the extension
To build the extension, `node` and `npm` are required. Run
```
npm run build
```
to build the extension. The build script will create all necessary extension files in the `dist/<browser>` directory,
(`dist/firefox` for Firefox based browsers, `dist/chrome` for Chrome-based browsers).

# Installing
## Firefox
Download the `auto-kit-login-<version>-firefox.xpi` file from the [releases page](https://github.com/rizecookey/auto-kit-login/releases/latest).
Firefox will automatically ask you whether you want to install the addon. After installation, click on the extensions icon in the toolbar, 
click the settings icon for the Auto KIT Login addon and select "Manage extension". Under the permissions tab, make sure that the extension
has the permission to access sites with the kit.edu domain.

## Chrome (and Chromium-based browsers)
Download the `auto-kit-login-<version>-chrome.zip` file from the [releases page](https://github.com/rizecookey/auto-kit-login/releases/latest).
Extract the .zip file in a known location. Navigate to the extensions page in your browser (`chrome://extensions` for Chrome) and enable developer mode.
Click on "Load unpacked" and select the directory in which you extracted the zip file (the folder should contain directories called "background" etc...).

# Usage
Log into any supported KIT page to make the extension save your login. Afterwards, the extension should detect whether you are already logged in and
authenticate you automatically if not.

You can configure which pages to use the autologin for by clicking the extension icon (if the extension is not pinned, you will find under extensions button in the toolbar).
