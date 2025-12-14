// Theme Management for Member App
(function () {
    function initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        if (savedTheme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    }

    // Run immediately
    initTheme();

    // Export for use by toggle buttons
    window.updateTheme = function (newTheme) {
        localStorage.setItem('theme', newTheme);
        initTheme();
    };
})();
