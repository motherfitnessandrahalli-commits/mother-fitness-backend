// Member App Logic for Dashboard

class MemberApp {
    constructor() {
        this.api = new MemberAPI();
        this.memberProfile = null;
        this.init();
    }

    init() {
        // Data Consistency Protocol: Clear local data to ensure fresh sync
        localStorage.removeItem('member_cache'); // Clear any sticky data

        // Redirect if not logged in
        if (!this.api.token) {
            window.location.href = './index.html';
            return;
        }

        this.initTheme();
        this.loadDashboard();
        this.loadAnnouncements();
        this.loadGymCount();
        this.loadBadges();
        this.loadMonthlyProgress();
        this.setupEventListeners();
    }

    // --- Theme Management ---
    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        const body = document.body;
        const icon = document.getElementById('themeToggle');

        if (theme === 'dark') {
            body.classList.add('dark-mode');
            if (icon) icon.textContent = '☀️';
        } else {
            body.classList.remove('dark-mode');
            if (icon) icon.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
    }

    // --- Data Loading ---
    async loadDashboard() {
        try {
            const response = await this.api.getProfile();
            this.memberProfile = response.data.customer;

            // Debug Data Integrity
            console.log('PLAN RECEIVED:', this.memberProfile.plan);

            // Update member info
            document.getElementById('memberName').textContent = this.memberProfile.name;
            document.getElementById('memberId').textContent = this.memberProfile.memberId;
            // SINGLE SOURCE OF TRUTH: Access nested membership object
            const membership = this.memberProfile.membership || {};
            document.getElementById('planType').textContent = membership.planName || this.memberProfile.plan || 'No Plan';

            // Update member avatar with photo if available
            const avatarDiv = document.querySelector('.member-avatar');
            if (this.memberProfile.photo) {
                avatarDiv.innerHTML = `<img src="${this.memberProfile.photo}" alt="${this.memberProfile.name}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            } else {
                avatarDiv.innerHTML = '👤';
            }

            // Improved Expiry Logic
            const expiryDate = membership.endDate || this.memberProfile.endDate || this.memberProfile.validity;
            const status = this.calculateMembershipStatus(expiryDate);

            document.getElementById('daysRemaining').textContent = status.daysRemaining;
            document.getElementById('expiryDate').textContent = expiryDate ? new Date(expiryDate).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            }) : '--';

            // Update status badge and card
            const badge = document.getElementById('statusBadge');
            const card = document.getElementById('statusCard');
            badge.textContent = status.text;
            badge.className = `status-badge status-${status.class}`;
            card.className = `status-card card-${status.class}`;

            // Check if first login - show password change modal
            if (sessionStorage.getItem('isFirstLogin') === 'true') {
                this.showPasswordChangeModal();
            }
        } catch (error) {
            console.error(error);
            alert('Failed to load profile: ' + error.message);
        }
    }

    async loadAnnouncements() {
        try {
            const container = document.getElementById('announcement-banner');
            const response = await this.api.getActiveAnnouncements();
            const announcements = response.data;

            if (announcements && announcements.length > 0) {
                const typeIcons = {
                    'info': 'ℹ️',
                    'important': '⚠️',
                    'offer': '🏷️',
                    'event': '🎉',
                    'maintenance': '🔧'
                };

                container.innerHTML = announcements.map(ann => `
                    <div class="announcement-item ${ann.type}">
                        <div class="announcement-icon">${typeIcons[ann.type] || 'ℹ️'}</div>
                        <div class="announcement-content">
                            <h4>${ann.title}</h4>
                            <p>${ann.message}</p>
                        </div>
                    </div>
                `).join('');
                container.style.display = 'flex';
            } else {
                container.style.display = 'none';
            }
        } catch (error) {
            console.error('Failed to load announcements:', error);
            document.getElementById('announcement-banner').style.display = 'none';
        }
    }

    async loadGymCount() {
        try {
            const response = await this.api.getCurrentGymCount();
            const { count } = response.data;

            // Update count display
            document.getElementById('gymCountNumber').textContent = count;

            // Determine crowd level
            const crowdLevelEl = document.getElementById('crowdLevel');
            let levelClass = '';
            let levelText = '';

            if (count === 0) {
                levelClass = 'level-empty';
                levelText = '🟢 Gym is empty';
            } else if (count <= 5) {
                levelClass = 'level-free';
                levelText = '🟢 Gym is free';
            } else if (count <= 15) {
                levelClass = 'level-medium';
                levelText = '🟡 Medium crowd';
            } else {
                levelClass = 'level-crowded';
                levelText = '🔴 Gym is crowded';
            }

            crowdLevelEl.textContent = levelText;
            crowdLevelEl.className = `crowd-level ${levelClass}`;
        } catch (error) {
            console.error('Failed to load gym count:', error);
            document.getElementById('gymCountNumber').textContent = '--';
            document.getElementById('crowdLevel').textContent = 'Unable to load';
        }
    }

    async loadBadges() {
        try {
            const response = await this.api.getBadgeStatus();
            const { badgesEarned } = response.data;

            // Update badge display
            const badgeElements = document.querySelectorAll('.member-badges .badge');
            badgeElements.forEach(badgeEl => {
                const badgeName = badgeEl.getAttribute('data-badge');
                if (badgesEarned && badgesEarned.includes(badgeName)) {
                    badgeEl.classList.remove('locked');
                    badgeEl.classList.add('earned');
                }
            });
        } catch (error) {
            console.error('Failed to load badges:', error);
        }
    }

    showBadgePopup(badgeData) {
        const { badge, message } = badgeData;

        // Badge icons
        const badgeIcons = {
            'Bronze': '🥉',
            'Silver': '🥈',
            'Gold': '🥇',
            'Beast Mode': '💪'
        };

        // Update popup content
        document.getElementById('badgeIconLarge').textContent = badgeIcons[badge] || '🏆';
        document.getElementById('badgeName').textContent = `${badge} Badge!`;
        document.getElementById('badgeMessage').textContent = message;

        // Show popup
        const popup = document.getElementById('badgePopup');
        popup.style.display = 'flex';

        // Create confetti
        this.createConfetti();

        // Play sound (optional audio element)
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFb');
            audio.play().catch(() => { });
        } catch (e) { }

        // Setup close button
        document.getElementById('badgePopupBtn').onclick = () => {
            popup.style.display = 'none';
            document.getElementById('confettiContainer').innerHTML = '';
        };
    }

    createConfetti() {
        const container = document.getElementById('confettiContainer');
        container.innerHTML = '';

        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f7b731', '#5f27cd', '#00d2d3'];
        const confettiCount = 50;

        for (let i = 0; i < confettiCount; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + '%';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.animationDelay = Math.random() * 3 + 's';
            confetti.style.animationDuration = (Math.random() * 3 + 2) + 's';
            container.appendChild(confetti);
        }
    }

    async loadMonthlyProgress() {
        try {
            const response = await this.api.getMonthlyProgress();
            const { month, totalCheckIns, daysMissed, currentStreak } = response.data;

            document.getElementById('progressMonth').textContent = `📊 ${month} Progress`;
            document.getElementById('totalCheckIns').textContent = totalCheckIns;
            document.getElementById('daysMissed').textContent = daysMissed;
            document.getElementById('currentStreak').textContent = currentStreak;
        } catch (error) {
            console.error('Failed to load monthly progress:', error);
        }
    }

    calculateMembershipStatus(validity) {
        if (!validity) return { daysRemaining: 0, text: 'No Plan', class: 'expired' };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const validityDate = new Date(validity);
        validityDate.setHours(0, 0, 0, 0);

        const diffTime = validityDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { daysRemaining: 0, text: 'Expired', class: 'expired' };
        } else if (diffDays <= 7) {
            return { daysRemaining: diffDays, text: 'Expiring Soon', class: 'expiring' };
        } else {
            return { daysRemaining: diffDays, text: 'Active', class: 'active' };
        }
    }

    // --- Modals & Actions ---
    showPasswordChangeModal() {
        document.getElementById('passwordModal').style.display = 'flex';
    }

    setupEventListeners() {
        // --- Hamburger Menu Logic ---
        const hamburgerBtn = document.getElementById('hamburgerBtn');
        const closeMenuBtn = document.getElementById('closeMenuBtn');
        const menuOverlay = document.getElementById('menuOverlay');
        const sideMenu = document.getElementById('sideMenu');

        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => this.toggleMenu(true));
        }

        if (closeMenuBtn) {
            closeMenuBtn.addEventListener('click', () => this.toggleMenu(false));
        }

        if (menuOverlay) {
            menuOverlay.addEventListener('click', () => this.toggleMenu(false));
        }

        // --- Menu Actions ---

        // Theme Toggle in Menu
        const menuThemeToggle = document.getElementById('menuThemeToggle');
        if (menuThemeToggle) {
            menuThemeToggle.addEventListener('click', () => {
                this.toggleTheme();
                // Optionally close menu after toggle, but keeping it open is user friendly
            });
        }

        // Logout in Menu
        const menuLogoutBtn = document.getElementById('menuLogoutBtn');
        if (menuLogoutBtn) {
            menuLogoutBtn.addEventListener('click', () => this.handleLogout());
        }

        // Handle password change form
        const pwdForm = document.getElementById('changePasswordForm');
        if (pwdForm) {
            pwdForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handlePasswordChange();
            });
        }
    }

    toggleMenu(show) {
        const menuOverlay = document.getElementById('menuOverlay');
        const sideMenu = document.getElementById('sideMenu');

        if (show) {
            menuOverlay.classList.add('show');
            sideMenu.classList.add('open');
        } else {
            menuOverlay.classList.remove('show');
            sideMenu.classList.remove('open');
        }
    }

    handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
            this.api.clearToken();
            sessionStorage.clear();
            window.location.href = './index.html';
        }
    }

    setTheme(theme) {
        const body = document.body;
        // Update dashboard theme icon if it still exists (it doesn't, but good for safety)
        const icon = document.getElementById('themeToggle');

        // Update menu theme text/icon
        const menuThemeText = document.querySelector('#menuThemeToggle span:last-child');
        const menuThemeIcon = document.querySelector('#menuThemeToggle .menu-icon');

        if (theme === 'dark') {
            body.classList.add('dark-mode');
            if (icon) icon.textContent = '☀️';
            if (menuThemeText) menuThemeText.textContent = 'Light Mode';
            if (menuThemeIcon) menuThemeIcon.textContent = '☀️';
        } else {
            body.classList.remove('dark-mode');
            if (icon) icon.textContent = '🌙';
            if (menuThemeText) menuThemeText.textContent = 'Dark Mode';
            if (menuThemeIcon) menuThemeIcon.textContent = '🌙';
        }
        localStorage.setItem('theme', theme);
    }

    async handlePasswordChange() {
        const currentPwd = document.getElementById('currentPwd').value;
        const newPwd = document.getElementById('newPwd').value;
        const confirmPwd = document.getElementById('confirmPwd').value;
        const errorDiv = document.getElementById('pwdError');

        errorDiv.style.display = 'none';

        if (newPwd !== confirmPwd) {
            errorDiv.textContent = 'Passwords do not match!';
            errorDiv.style.display = 'block';
            return;
        }

        if (newPwd.length < 4) {
            errorDiv.textContent = 'Password must be at least 4 characters';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            await this.api.changePassword(currentPwd, newPwd);
            sessionStorage.removeItem('isFirstLogin');
            document.getElementById('passwordModal').style.display = 'none';
            alert('Password changed successfully!');
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    }
}

// Initialize Application
const app = new MemberApp();
window.app = app;
