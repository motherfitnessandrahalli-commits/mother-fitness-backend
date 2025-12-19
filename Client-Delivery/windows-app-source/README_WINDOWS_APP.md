# Mother Fitness - Windows Admin App

This folder contains the source code to build a Windows Executable (.exe) for the Admin Dashboard.

## Prerequisites
- Node.js installed on your computer.

## How to Build the App
1. Open a terminal (Command Prompt or PowerShell) in this folder:
   `Client-Delivery/windows-app-source`

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the executable:
   ```bash
   npm run dist
   ```

4. Once the process completes, you will find a new `dist` folder.
   - Inside `dist`, look for `Mother Fitness Admin Setup 1.0.0.exe`.
   - This is your installable Windows application.

## Configuration
- The app loads the interface from the `public` folder.
- It uses the `public/config.js` file to know which backend to connect to.
- If you change the backend URL in `public/config.js`, you do **not** need to rebuild the app. It loads the config at runtime.
