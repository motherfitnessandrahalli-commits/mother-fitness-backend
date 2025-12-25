// API Configuration for Member App - Updated
const API_CONFIG = {
    BASE_URL: (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.'))
        ? window.location.origin
        : 'https://mother-fitness-backend.onrender.com',
    ENDPOINTS: {
        MEMBER_LOGIN: '/api/member/login',
        MEMBER_PROFILE: '/api/member/me',
        UPDATE_PROFILE: '/api/member/profile',
        CHANGE_PASSWORD: '/api/member/change-password',
        MEMBER_ATTENDANCE: '/api/member/attendance',
        MEMBER_PAYMENTS: '/api/member/payments',
        SUBSCRIBE_PUSH: '/api/member/subscribe-push',
        ANNOUNCEMENTS_ACTIVE: '/api/announcements/active',
        ATTENDANCE_CURRENT_COUNT: '/api/attendance/current-count',
        MEMBER_BADGES: '/api/member/badges',
        MEMBER_MONTHLY_PROGRESS: '/api/member/monthly-progress',
    }
};

class MemberAPI {
    constructor() {
        this.baseUrl = API_CONFIG.BASE_URL;
        this.token = sessionStorage.getItem('memberToken');
    }

    setToken(token) {
        this.token = token;
        sessionStorage.setItem('memberToken', token);
    }

    clearToken() {
        this.token = null;
        sessionStorage.removeItem('memberToken');
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const defaultHeaders = {
            'Content-Type': 'application/json',
        };

        if (this.token) {
            defaultHeaders['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...defaultHeaders,
                    ...options.headers,
                },
            });

            if (response.status === 401) {
                this.clearToken();
                window.location.href = './index.html';
                throw new Error('Session expired. Please login again.');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            throw error;
        }
    }

    // Member Authentication
    async login(memberId, password) {
        const response = await this.request(API_CONFIG.ENDPOINTS.MEMBER_LOGIN, {
            method: 'POST',
            body: JSON.stringify({ memberId, password }),
        });

        if (response.data && response.data.token) {
            this.setToken(response.data.token);
        }

        return response;
    }

    async getProfile() {
        return await this.request(API_CONFIG.ENDPOINTS.MEMBER_PROFILE);
    }

    async updateProfile(profileData) {
        return await this.request(API_CONFIG.ENDPOINTS.UPDATE_PROFILE, {
            method: 'PUT',
            body: JSON.stringify(profileData),
        });
    }

    async changePassword(currentPassword, newPassword) {
        return await this.request(API_CONFIG.ENDPOINTS.CHANGE_PASSWORD, {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    async getAttendance(limit = 30, page = 1) {
        const params = new URLSearchParams({ limit, page }).toString();
        return await this.request(`${API_CONFIG.ENDPOINTS.MEMBER_ATTENDANCE}?${params}`);
    }

    async getPayments(limit = 10, page = 1) {
        const params = new URLSearchParams({ limit, page }).toString();
        return await this.request(`${API_CONFIG.ENDPOINTS.MEMBER_PAYMENTS}?${params}`);
    }

    async subscribePush(subscription) {
        return await this.request(API_CONFIG.ENDPOINTS.SUBSCRIBE_PUSH, {
            method: 'POST',
            body: JSON.stringify({ subscription }),
        });
    }

    async getActiveAnnouncements() {
        return await this.request(API_CONFIG.ENDPOINTS.ANNOUNCEMENTS_ACTIVE);
    }

    async getCurrentGymCount() {
        return await this.request(API_CONFIG.ENDPOINTS.ATTENDANCE_CURRENT_COUNT);
    }

    async getBadgeStatus() {
        return await this.request(API_CONFIG.ENDPOINTS.MEMBER_BADGES);
    }

    async getMonthlyProgress() {
        return await this.request(API_CONFIG.ENDPOINTS.MEMBER_MONTHLY_PROGRESS);
    }
}
