document.addEventListener('DOMContentLoaded', () => {
    const signupForm = document.getElementById('signupForm');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const loader = document.getElementById('loader');
    
    const errorAlert = document.getElementById('errorAlert');
    const successAlert = document.getElementById('successAlert');

    // Password requirements elements
    const reqLength = document.getElementById('req-length');
    const reqUpper = document.getElementById('req-upper');
    const reqLower = document.getElementById('req-lower');
    const reqNumber = document.getElementById('req-number');
    const reqSpecial = document.getElementById('req-special');

    // Validation patterns
    const regexUpper = /[A-Z]/;
    const regexLower = /[a-z]/;
    const regexNumber = /[0-9]/;
    const regexSpecial = /[!@#$%^&*(),.?":{}|<>]/;

    // Validate password as the user types
    passwordInput.addEventListener('input', () => {
        const val = passwordInput.value;

        // Check 1: Length
        const hasLength = val.length >= 8;
        updateReq(reqLength, hasLength);

        // Check 2: Uppercase
        const hasUpper = regexUpper.test(val);
        updateReq(reqUpper, hasUpper);

        // Check 3: Lowercase
        const hasLower = regexLower.test(val);
        updateReq(reqLower, hasLower);

        // Check 4: Number
        const hasNumber = regexNumber.test(val);
        updateReq(reqNumber, hasNumber);

        // Check 5: Special
        const hasSpecial = regexSpecial.test(val);
        updateReq(reqSpecial, hasSpecial);

        // Enable or disable register button
        const isAllValid = hasLength && hasUpper && hasLower && hasNumber && hasSpecial;
        submitBtn.disabled = !isAllValid;
    });

    // Helper to toggle check icon and class
    function updateReq(element, isValid) {
        const icon = element.querySelector('i');
        if (isValid) {
            element.classList.replace('req-invalid', 'req-valid');
            icon.classList.replace('fa-times-circle', 'fa-check-circle');
        } else {
            element.classList.replace('req-valid', 'req-invalid');
            icon.classList.replace('fa-check-circle', 'fa-times-circle');
        }
    }

    // Submit handler
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        errorAlert.style.display = 'none';
        successAlert.style.display = 'none';
        
        const username = usernameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!username || !email || !password) {
            showError('All fields are required.');
            return;
        }

        // Show loading screen
        loader.classList.add('active');

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            
            if (response.ok) {
                successAlert.textContent = 'Account created successfully! Redirecting to login...';
                successAlert.style.display = 'block';
                signupForm.reset();
                submitBtn.disabled = true;
                
                // Reset requirements text state
                document.querySelectorAll('.req-item').forEach(el => {
                    el.classList.replace('req-valid', 'req-invalid');
                    el.querySelector('i').classList.replace('fa-check-circle', 'fa-times-circle');
                });

                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } else {
                showError(data.error || 'Registration failed. Please try again.');
            }
        } catch (err) {
            console.error('Signup error:', err);
            showError('Network error or server unavailable. Please try again later.');
        } finally {
            loader.classList.remove('active');
        }
    });

    function showError(msg) {
        errorAlert.textContent = msg;
        errorAlert.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
});
