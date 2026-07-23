document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const usernameDisplay = document.getElementById('usernameDisplay');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // User Portal DOM elements
    const statTotalInterviews = document.getElementById('statTotalInterviews');
    const statAverageScore = document.getElementById('statAverageScore');
    const statResumeScore = document.getElementById('statResumeScore');
    const recentInterviewsBody = document.getElementById('recentInterviewsBody');
    const resumeHistoryBody = document.getElementById('resumeHistoryBody');
    const latestResumeWidget = document.getElementById('latestResumeWidget');
    const latestAtsScore = document.getElementById('latestAtsScore');

    // Admin Console DOM elements
    const adminTabs = document.getElementById('adminTabs');
    const adminStatUsers = document.getElementById('adminStatUsers');
    const adminStatInterviews = document.getElementById('adminStatInterviews');
    const adminStatAvgScore = document.getElementById('adminStatAvgScore');
    const adminTechCount = document.getElementById('adminTechCount');
    const adminHrCount = document.getElementById('adminHrCount');
    const adminAptCount = document.getElementById('adminAptCount');
    const adminTechProgress = document.getElementById('adminTechProgress');
    const adminHrProgress = document.getElementById('adminHrProgress');
    const adminAptProgress = document.getElementById('adminAptProgress');
    const adminActivitiesBody = document.getElementById('adminActivitiesBody');
    const adminUsersBody = document.getElementById('adminUsersBody');

    let currentUser = null;

    // Check authorization status
    async function checkAuth() {
        showLoader(true);
        try {
            const response = await fetch('/api/current-user');
            if (!response.ok) {
                // Not logged in
                window.location.href = '/login';
                return;
            }
            const data = await response.json();
            currentUser = data.user;
            usernameDisplay.textContent = currentUser.username;

            // If admin, show Admin tabs
            if (currentUser.is_admin) {
                adminTabs.classList.remove('admin-only');
                // Set admin subtext
                document.getElementById('welcomeSubtext').textContent = "Administrator Console. View logs, manage users, and practice mock interviews.";
            }

            // Load user specific dashboard stats
            await loadUserDashboard();
        } catch (err) {
            console.error('Auth verification failed:', err);
            window.location.href = '/login';
        } finally {
            showLoader(false);
        }
    }

    // Load candidate portal elements
    async function loadUserDashboard() {
        try {
            const response = await fetch('/api/dashboard');
            if (!response.ok) return;

            const data = await response.json();

            // Populate counters
            statTotalInterviews.textContent = data.total_interviews;
            statAverageScore.textContent = data.avg_score;
            
            if (data.resume_analyzed) {
                statResumeScore.innerHTML = `<span class="badge badge-tech">${data.latest_resume_score}% Score</span>`;
                latestResumeWidget.style.display = 'block';
                latestAtsScore.textContent = `${data.latest_resume_score}%`;
            } else {
                statResumeScore.textContent = "No Analysis Yet";
                latestResumeWidget.style.display = 'none';
            }

            // Render Recent Mock Interviews
            recentInterviewsBody.innerHTML = '';
            if (data.recent_performance && data.recent_performance.length > 0) {
                data.recent_performance.forEach(session => {
                    const row = document.createElement('tr');
                    
                    let badgeClass = 'badge-tech';
                    if (session.interview_type === 'HR') badgeClass = 'badge-hr';
                    if (session.interview_type === 'Aptitude') badgeClass = 'badge-apt';

                    row.innerHTML = `
                        <td><span class="badge ${badgeClass}">${session.interview_type}</span></td>
                        <td><strong>${session.score}%</strong></td>
                        <td>${session.date}</td>
                        <td>
                            <a href="/result?session_id=${session.id}" class="btn btn-secondary" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;">
                                <i class="fas fa-poll-h"></i> Review Feedback
                            </a>
                        </td>
                    `;
                    recentInterviewsBody.appendChild(row);
                });
            } else {
                recentInterviewsBody.innerHTML = `
                    <tr>
                        <td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 2rem 1rem;">
                            No mock interviews taken yet. Click "Start New Interview" to begin!
                        </td>
                    </tr>
                `;
            }

            // Render Resume Upload Gaps list
            resumeHistoryBody.innerHTML = '';
            if (data.resume_history && data.resume_history.length > 0) {
                data.resume_history.forEach(res => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td><i class="fas fa-file-pdf" style="color: var(--danger); margin-right: 0.5rem;"></i> ${res.filename}</td>
                        <td><strong>${res.ats_score}%</strong></td>
                    `;
                    resumeHistoryBody.appendChild(row);
                });
            } else {
                resumeHistoryBody.innerHTML = `
                    <tr>
                        <td colspan="2" style="text-align: center; color: var(--text-secondary); padding: 2rem 1rem;">
                            No resume analyzed yet. Upload one to review ATS score.
                        </td>
                    </tr>
                `;
            }

        } catch (err) {
            console.error('Failed to load user portal:', err);
        }
    }

    // Load Admin metrics and users listing (global access helper)
    window.loadAdminPanelData = async function() {
        showLoader(true);
        try {
            // Fetch global analytics
            const statsResp = await fetch('/api/admin/stats');
            if (statsResp.ok) {
                const stats = await statsResp.json();
                
                adminStatUsers.textContent = stats.total_users;
                adminStatInterviews.textContent = stats.total_interviews;
                adminStatAvgScore.textContent = stats.avg_score;

                // Type breakdown counts
                const hrCount = stats.type_breakdown.HR || 0;
                const techCount = stats.type_breakdown.Technical || 0;
                const aptCount = stats.type_breakdown.Aptitude || 0;

                adminHrCount.textContent = hrCount;
                adminTechCount.textContent = techCount;
                adminAptCount.textContent = aptCount;

                // Update type progress percentage bars
                const total = hrCount + techCount + aptCount || 1;
                adminHrProgress.style.width = `${(hrCount / total) * 100}%`;
                adminTechProgress.style.width = `${(techCount / total) * 100}%`;
                adminAptProgress.style.width = `${(aptCount / total) * 100}%`;

                // Render activities
                adminActivitiesBody.innerHTML = '';
                if (stats.recent_activities && stats.recent_activities.length > 0) {
                    stats.recent_activities.forEach(act => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td><i class="fas fa-user-circle"></i> ${act.username}</td>
                            <td>${act.interview_type}</td>
                            <td><strong>${act.score}%</strong></td>
                        `;
                        adminActivitiesBody.appendChild(row);
                    });
                } else {
                    adminActivitiesBody.innerHTML = '<tr><td colspan="3" style="text-align: center;">No activities.</td></tr>';
                }
            }

            // Fetch User Accounts list
            const usersResp = await fetch('/api/admin/users');
            if (usersResp.ok) {
                const users = await usersResp.json();
                adminUsersBody.innerHTML = '';

                users.forEach(u => {
                    const row = document.createElement('tr');
                    
                    const deleteBtn = u.username === 'admin' 
                        ? `<button class="btn btn-secondary" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" disabled>Protected</button>`
                        : `<button class="btn btn-danger" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="deleteUserAccount(${u.id}, '${u.username}')"><i class="fas fa-trash"></i> Delete</button>`;

                    row.innerHTML = `
                        <td>${u.id}</td>
                        <td><strong>${u.username}</strong></td>
                        <td>${u.email}</td>
                        <td>${u.created_at}</td>
                        <td>${u.interviews_taken}</td>
                        <td>${u.resumes_uploaded}</td>
                        <td><span class="badge ${u.is_admin ? 'badge-hr' : 'badge-tech'}">${u.is_admin ? 'Admin' : 'Candidate'}</span></td>
                        <td>${deleteBtn}</td>
                    `;
                    adminUsersBody.appendChild(row);
                });
            }

        } catch (err) {
            console.error('Failed to load admin console:', err);
        } finally {
            showLoader(false);
        }
    };

    // Global action function to delete user account
    window.deleteUserAccount = async function(userId, username) {
        if (!confirm(`Are you absolutely sure you want to delete user account "${username}"? All associated resumes, scores, and evaluation feedback will be permanently deleted.`)) {
            return;
        }

        showLoader(true);
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (response.ok) {
                alert(data.message || 'User deleted successfully.');
                // Refresh list
                await window.loadAdminPanelData();
                await loadUserDashboard();
            } else {
                alert(data.error || 'Failed to delete user.');
            }
        } catch (err) {
            console.error('Delete user error:', err);
            alert('A network error occurred. Please try again.');
        } finally {
            showLoader(false);
        }
    };

    // Logout trigger
    logoutBtn.addEventListener('click', async () => {
        showLoader(true);
        try {
            const response = await fetch('/api/logout', {
                method: 'POST'
            });
            if (response.ok) {
                window.location.href = '/login';
            } else {
                alert('Logout failed. Please try again.');
            }
        } catch (err) {
            console.error('Logout error:', err);
            window.location.href = '/login';
        } finally {
            showLoader(false);
        }
    });

    // Helper functions
    function showLoader(show) {
        if (show) {
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }

    // Run auth check on load
    checkAuth();
});
