
// ===================================
// API Configuration
// ===================================

const API_CONFIG = {
    // Backend API URL - Loaded from config.js
    BASE_URL: (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.startsWith('192.168.') ||
        window.location.hostname.startsWith('10.') ||
        window.location.hostname.startsWith('172.'))
        ? window.location.origin
        : 'https://mother-fitness-backend.onrender.com',
    ENDPOINTS: {
        // Auth
        LOGIN: '/api/auth/login',
        REGISTER: '/api/auth/register',
        ME: '/api/auth/me',
        CHANGE_PASSWORD: '/api/auth/change-password',

        // Customers
        CUSTOMERS: '/api/customers',
        CUSTOMER_BY_ID: (id) => `/api/customers/${id}`,
        CUSTOMER_STATS: '/api/customers/stats/overview',
        SYNC_BADGES: '/api/customers/sync-badges',

        // Attendance
        ATTENDANCE: '/api/attendance',
        MARK_ATTENDANCE: '/api/attendance/mark',
        ATTENDANCE_STATS: '/api/attendance/stats',
        CUSTOMER_ATTENDANCE: (id) => `/api/attendance/customer/${id}`,

        // Analytics
        DASHBOARD_STATS: '/api/analytics/dashboard',
        PLAN_POPULARITY: '/api/analytics/plans',
        AGE_DEMOGRAPHICS: '/api/analytics/demographics',
        BUSINESS_GROWTH: '/api/analytics/growth',
        PROFIT_METRICS: '/api/analytics/profits',

        // Upload
        UPLOAD_PHOTO: '/api/upload',
        DELETE_PHOTO: (filename) => `/api/upload/${filename}`,

        // Notifications
        SEND_EXPIRY_EMAILS: '/api/notifications/email/expired',

        // Payments
        PAYMENTS: '/api/payments',
        PAYMENT_BY_ID: (id) => `/api/payments/${id}`,
        CUSTOMER_PAYMENTS: (customerId) => `/api/payments/customer/${customerId}`,
        PAYMENT_STATS: '/api/payments/stats/overview',

        // Access Control
        VERIFY_ACCESS: '/api/access/verify',
        CONNECT_DOOR: '/api/access/connect',
        GET_PORTS: '/api/access/ports',

        // ZKTeco Multi-Device & Occupancy
        ZK_CONNECT: '/api/zkteco/connect',
        ZK_DISCONNECT: '/api/zkteco/disconnect',
        ZK_STATUS: '/api/zkteco/status',
        ZK_OCCUPANCY: '/api/zkteco/occupancy',
        ZK_SYNC: '/api/zkteco/sync',

        // Intelligence
        GET_TIMELINE: (customerId) => `/api/intelligence/timeline/${customerId}`,
        GET_BUSINESS_HEALTH: '/api/intelligence/business-health',
    }
};

// ===================================
// API Service
// ===================================

class API {
    constructor() {
        this.baseURL = API_CONFIG.BASE_URL;
        this.token = sessionStorage.getItem('token');
    }

    // Set authentication token (session-based)
    setToken(token) {
        this.token = token;
        sessionStorage.setItem('token', token);
    }

    // Clear authentication token
    clearToken() {
        this.token = null;
        sessionStorage.removeItem('token');
    }

    // Get authentication token
    getToken() {
        return this.token || sessionStorage.getItem('token');
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.getToken();
    }

    // Generic request method
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        // Add auth token if available
        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Handle 'data' property for Axios-like compatibility
        if (options.data && !options.body) {
            options.body = JSON.stringify(options.data);
        }

        const config = {
            ...options,
            headers,
        };

        try {
            const response = await fetch(url, config);
            let data;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                data = await response.json();
            } else {
                data = { message: await response.text() };
            }

            if (!response.ok) {
                // Handle authentication errors
                // Don't reload if this is the /me endpoint (token validation) or login endpoint
                if (response.status === 401 &&
                    endpoint !== API_CONFIG.ENDPOINTS.LOGIN &&
                    endpoint !== API_CONFIG.ENDPOINTS.ME) {
                    this.clearToken();
                    window.location.reload();
                }
                throw new Error(data.message || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    // ===================================
    // Authentication Methods
    // ===================================

    async login(email, password) {
        const response = await this.request(API_CONFIG.ENDPOINTS.LOGIN, {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (response.data && response.data.token) {
            this.setToken(response.data.token);
        }

        return response;
    }

    async register(userData) {
        const response = await this.request(API_CONFIG.ENDPOINTS.REGISTER, {
            method: 'POST',
            body: JSON.stringify(userData),
        });

        if (response.data && response.data.token) {
            this.setToken(response.data.token);
        }

        return response;
    }

    async getMe() {
        return await this.request(API_CONFIG.ENDPOINTS.ME);
    }

    async changePassword(currentPassword, newPassword) {
        return await this.request(API_CONFIG.ENDPOINTS.CHANGE_PASSWORD, {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword }),
        });
    }

    logout() {
        this.clearToken();
    }

    // ===================================
    // Customer Methods
    // ===================================

    async getCustomers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString
            ? `${API_CONFIG.ENDPOINTS.CUSTOMERS}?${queryString}`
            : API_CONFIG.ENDPOINTS.CUSTOMERS;

        return await this.request(endpoint);
    }

    async getCustomer(id) {
        return await this.request(API_CONFIG.ENDPOINTS.CUSTOMER_BY_ID(id));
    }

    async createCustomer(customerData) {
        return await this.request(API_CONFIG.ENDPOINTS.CUSTOMERS, {
            method: 'POST',
            body: JSON.stringify(customerData),
        });
    }

    async updateCustomer(id, customerData) {
        return await this.request(API_CONFIG.ENDPOINTS.CUSTOMER_BY_ID(id), {
            method: 'PUT',
            body: JSON.stringify(customerData),
        });
    }

    async deleteCustomer(id) {
        return await this.request(API_CONFIG.ENDPOINTS.CUSTOMER_BY_ID(id), {
            method: 'DELETE',
        });
    }

    async getCustomerStats() {
        return await this.request(API_CONFIG.ENDPOINTS.CUSTOMER_STATS);
    }

    async syncBadges() {
        return await this.request(API_CONFIG.ENDPOINTS.SYNC_BADGES, {
            method: 'POST'
        });
    }

    // ===================================
    // Attendance Methods
    // ===================================

    async markAttendance(customerId) {
        return await this.request(API_CONFIG.ENDPOINTS.MARK_ATTENDANCE, {
            method: 'POST',
            body: JSON.stringify({ customerId }),
        });
    }

    async getAttendance(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString
            ? `${API_CONFIG.ENDPOINTS.ATTENDANCE}?${queryString}`
            : API_CONFIG.ENDPOINTS.ATTENDANCE;

        return await this.request(endpoint);
    }

    async getAttendanceStats(date) {
        const queryString = date ? `?date=${date}` : '';
        return await this.request(`${API_CONFIG.ENDPOINTS.ATTENDANCE_STATS}${queryString}`);
    }

    async getCustomerAttendance(customerId) {
        return await this.request(API_CONFIG.ENDPOINTS.CUSTOMER_ATTENDANCE(customerId));
    }

    // ===================================
    // Analytics Methods
    // ===================================

    async getDashboardStats() {
        return await this.request(API_CONFIG.ENDPOINTS.DASHBOARD_STATS);
    }

    async getPlanPopularity() {
        return await this.request(API_CONFIG.ENDPOINTS.PLAN_POPULARITY);
    }

    async getAgeDemographics() {
        return await this.request(API_CONFIG.ENDPOINTS.AGE_DEMOGRAPHICS);
    }

    async getBusinessGrowth() {
        return await this.request(API_CONFIG.ENDPOINTS.BUSINESS_GROWTH);
    }

    async getProfitMetrics() {
        return await this.request(API_CONFIG.ENDPOINTS.PROFIT_METRICS);
    }

    // ===================================
    // Upload Methods
    // ===================================

    async uploadPhoto(file) {
        const formData = new FormData();
        formData.append('photo', file);

        const url = `${this.baseURL}${API_CONFIG.ENDPOINTS.UPLOAD_PHOTO}`;
        const token = this.getToken();

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Upload failed');
        }

        return data;
    }

    async deletePhoto(filename) {
        return await this.request(API_CONFIG.ENDPOINTS.DELETE_PHOTO(filename), {
            method: 'DELETE',
        });
    }

    // ===================================
    // Notification Methods
    // ===================================

    async sendExpiryEmails() {
        return await this.request(API_CONFIG.ENDPOINTS.SEND_EXPIRY_EMAILS, {
            method: 'POST',
        });
    }

    // ===================================
    // Payment Methods
    // ===================================

    async getPayments(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = queryString
            ? `${API_CONFIG.ENDPOINTS.PAYMENTS}?${queryString}`
            : API_CONFIG.ENDPOINTS.PAYMENTS;

        return await this.request(endpoint);
    }

    async getCustomerPayments(customerId) {
        return await this.request(API_CONFIG.ENDPOINTS.CUSTOMER_PAYMENTS(customerId));
    }

    async createPayment(paymentData) {
        return await this.request(API_CONFIG.ENDPOINTS.PAYMENTS, {
            method: 'POST',
            body: JSON.stringify(paymentData),
        });
    }

    async updatePayment(id, paymentData) {
        return await this.request(API_CONFIG.ENDPOINTS.PAYMENT_BY_ID(id), {
            method: 'PUT',
            body: JSON.stringify(paymentData),
        });
    }

    async deletePayment(id) {
        return await this.request(API_CONFIG.ENDPOINTS.PAYMENT_BY_ID(id), {
            method: 'DELETE',
        });
    }

    async getPaymentStats() {
        return await this.request(API_CONFIG.ENDPOINTS.PAYMENT_STATS);
    }

    // ===================================
    // Announcement Methods
    // ===================================

    async getAllAnnouncements() {
        return await this.request('/api/announcements', {
            method: 'GET',
        });
    }

    async createAnnouncement(announcementData) {
        return await this.request('/api/announcements', {
            method: 'POST',
            body: JSON.stringify(announcementData),
        });
    }

    async deleteAnnouncement(id) {
        return await this.request(`/api/announcements/${id}`, {
            method: 'DELETE',
        });
    }

    // ===================================
    // Access Control Methods
    // ===================================

    async verifyAccess(memberId) {
        return await this.request(API_CONFIG.ENDPOINTS.VERIFY_ACCESS, {
            method: 'POST',
            body: JSON.stringify({ memberId }),
        });
    }

    async connectDoor(portName) {
        return await this.request(API_CONFIG.ENDPOINTS.CONNECT_DOOR, {
            method: 'POST',
            body: JSON.stringify({ portName }),
        });
    }

    async getAccessPorts() {
        return await this.request(API_CONFIG.ENDPOINTS.GET_PORTS);
    }

    // ===================================
    // ZKTeco Methods (Multi-Device)
    // ===================================

    async connectZKTeco(ip, port, role) {
        return await this.request(API_CONFIG.ENDPOINTS.ZK_CONNECT, {
            method: 'POST',
            body: JSON.stringify({ ip, port, role }),
        });
    }

    async disconnectZKTeco(ip) {
        return await this.request(API_CONFIG.ENDPOINTS.ZK_DISCONNECT, {
            method: 'POST',
            body: JSON.stringify({ ip }),
        });
    }

    async getZKTecoStatus() {
        return await this.request(API_CONFIG.ENDPOINTS.ZK_STATUS);
    }

    async getOccupancy() {
        return await this.request(API_CONFIG.ENDPOINTS.ZK_OCCUPANCY);
    }

    async syncZKTeco() {
        return await this.request(API_CONFIG.ENDPOINTS.ZK_SYNC, {
            method: 'POST'
        });
    }

    // ===================================
    // Intelligence Methods
    // ===================================

    async getMemberTimeline(customerId) {
        return await this.request(API_CONFIG.ENDPOINTS.GET_TIMELINE(customerId));
    }

    async getBusinessHealth() {
        return await this.request(API_CONFIG.ENDPOINTS.GET_BUSINESS_HEALTH);
    }
}
