document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorAlert = document.getElementById('errorAlert');
    const loader = document.getElementById('loader');

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        errorAlert.style.display = 'none';
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            showError('Please enter both username and password.');
            return;
        }

        // Show loading screen
        loader.classList.add('active');

        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Successful login
                window.location.href = '/dashboard';
            } else {
                showError(data.error || 'Invalid credentials. Please try again.');
            }
        } catch (err) {
            console.error('Login error:', err);
            showError('Network error or server unavailable. Please try again later.');
        } finally {
            loader.classList.remove('active');
        }
    });

    function showError(msg) {
        errorAlert.textContent = msg;
        errorAlert.style.display = 'block';
    }
});
