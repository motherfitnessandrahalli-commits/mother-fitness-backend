
const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Inject Constructor Logic
const constructorHook = 'this.init();';
const constructionPatch = `
        // Biometric & Access Control
        this.doorController = new DoorController();
        this.biometricSystem = new BiometricSystem(this, this.doorController);

        this.init();`;

if (!content.includes('this.doorController = new DoorController();')) {
    content = content.replace(constructorHook, constructionPatch);
    console.log('Injected Constructor Logic');
}

// 2. Inject Methods
const methodHook = 'toggleTheme() {';
const methodPatch = `toggleTheme() {`;
const methodsToAdd = `
    // Access Control Methods
    async connectDoor() {
        const success = await this.doorController.connect();
        if (success) {
            this.showNotification('success', 'Hardware Connected', 'Door Controller is now active.');
            const btn = document.getElementById('connect-door-btn');
            if(btn) {
                btn.classList.remove('btn-warning');
                btn.classList.add('btn-success');
                btn.innerHTML = '<span class="btn-icon">✅</span> Connected';
            }
        }
    }

    toggleAccessView() {
        const dashboard = document.getElementById('access-dashboard');
        
        // Toggle
        if (dashboard.style.display === 'none') {
            // Show Access Mode
            document.querySelector('.dashboard-stats').style.display = 'none';
            document.querySelector('.controls-section').style.display = 'none';
            document.querySelector('.customer-list-section').style.display = 'none';
            
            dashboard.style.display = 'block';
            this.biometricSystem.start();
        } else {
            // Hide Access Mode
            dashboard.style.display = 'none';
            
            document.querySelector('.dashboard-stats').style.display = 'grid';
            document.querySelector('.controls-section').style.display = 'flex';
            document.querySelector('.customer-list-section').style.display = 'block';
            
            this.biometricSystem.stop();
        }
        
        this.closeHamburgerMenu();
    }
`;

// Insert methods before the closing brace of the class? 
// Actually, inserting after toggleTheme is safer as I know where it is.
// But wait, toggleTheme block needs to close first.
// I'll search for the END of toggleTheme.
// toggleTheme is:
// toggleTheme() {
// ...
// }
// I'll just append it to the end of the class, but finding the end of the class is hard with regex.
// I'll put it after `loadTheme` block or `toggleTheme`.
// Let's rely on the fact that I can just add it prototype style if needed, but class properties are better.
// I will insert it right before "async loadCustomers() {"

const targetMethod = 'async loadCustomers() {';
if (!content.includes('toggleAccessView()')) {
    content = content.replace(targetMethod, methodsToAdd + '\n\n    ' + targetMethod);
    console.log('Injected Access Methods');
}

// 3. Add Event Listener for Menu Button
// This needs to go in setupEventListeners or similar. 
// I'll put it in `setupAnalyticsListener` since that's a known post-init setup, 
// OR I can add a new setup method and call it.
// Let's add `setupAccessListener` and call it in `initializeApp`.

const initHook = 'this.setupAnalyticsListener(); // Fix analytics button';
const initPatch = `this.setupAnalyticsListener();
            this.setupAccessListener();`;

const accessListenerMethod = `
    setupAccessListener() {
        setTimeout(() => {
            const btn = document.getElementById('menu-access-btn');
            if (btn) {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.toggleAccessView();
                });
            }
        }, 1500);
    }
`;

if (!content.includes('this.setupAccessListener();')) {
    content = content.replace(initHook, initPatch);
    // Add the method definition
    content = content.replace(targetMethod, accessListenerMethod + '\n\n    ' + targetMethod);
    console.log('Injected Listener Setup');
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('App.js patched successfully');
