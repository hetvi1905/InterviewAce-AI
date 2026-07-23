document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    
    // Header & Meta DOM elements
    const interviewMetaText = document.getElementById('interviewMetaText');
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    
    // Result DOM elements
    const resultScoreCircle = document.getElementById('resultScoreCircle');
    const resultScoreValue = document.getElementById('resultScoreValue');
    const resultConfidenceBadge = document.getElementById('resultConfidenceBadge');
    
    const overallFeedback = document.getElementById('overallFeedback');
    const statConfidence = document.getElementById('statConfidence');
    const statDate = document.getElementById('statDate');
    
    const strengthsList = document.getElementById('strengthsList');
    const weaknessesList = document.getElementById('weaknessesList');
    const recommendedTopics = document.getElementById('recommendedTopics');
    const questionsFeedbackList = document.getElementById('questionsFeedbackList');

    let sessionData = null;
    let questionsData = [];

    // Parse URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    async function checkAuthAndLoad() {
        showLoader(true);
        try {
            // Verify auth
            const authResponse = await fetch('/api/current-user');
            if (!authResponse.ok) {
                window.location.href = '/login';
                return;
            }

            if (!sessionId) {
                alert('No interview session selected.');
                window.location.href = '/dashboard';
                return;
            }

            // Fetch result details
            const response = await fetch(`/api/result?session_id=${sessionId}`);
            const data = await response.json();

            if (response.ok) {
                sessionData = data.session;
                questionsData = data.questions;
                renderReport();
            } else {
                alert(data.error || 'Failed to load interview results.');
                window.location.href = '/dashboard';
            }
        } catch (err) {
            console.error('Result page init error:', err);
            alert('A network error occurred.');
            window.location.href = '/dashboard';
        } finally {
            showLoader(false);
        }
    }

    function renderReport() {
        // Update header details
        interviewMetaText.textContent = `${sessionData.interview_type} Mock Interview Session`;
        
        // 1. Compile overall score circle
        const score = sessionData.score || 0;
        resultScoreValue.textContent = `${score}%`;
        
        const circumference = 440;
        const offset = circumference - (score / 100) * circumference;
        resultScoreCircle.style.strokeDashoffset = offset;

        // Confidence badge styling
        const confidence = sessionData.confidence_level || 'Medium';
        statConfidence.textContent = confidence;
        resultConfidenceBadge.textContent = `${confidence} Confidence`;

        if (confidence === 'High') {
            resultConfidenceBadge.className = 'badge badge-tech';
        } else if (confidence === 'Medium') {
            resultConfidenceBadge.className = 'badge badge-apt';
        } else {
            resultConfidenceBadge.className = 'badge badge-hr';
        }

        // Date parse
        const createdDate = new Date(sessionData.created_at);
        statDate.textContent = createdDate.toLocaleDateString();

        // 2. Render executive feedback
        overallFeedback.textContent = sessionData.feedback || 'Feedback summary compiling error.';

        // 3. Render strengths and weaknesses list
        renderBullets(strengthsList, sessionData.strengths);
        renderBullets(weaknessesList, sessionData.weaknesses);

        // 4. Render study recommendations tags
        renderTags(recommendedTopics, sessionData.recommended_topics);

        // 5. Render Chart.js Analytics Graph
        renderChart(sessionData.performance_graph_data);

        // 6. Render question-wise accordion lists
        renderQuestionsFeedback();
    }

    function renderBullets(container, list) {
        container.innerHTML = '';
        if (list && list.length > 0) {
            list.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                container.appendChild(li);
            });
        } else {
            container.innerHTML = '<li style="list-style: none; color: var(--text-light); padding-left: 0;">No items generated.</li>';
        }
    }

    function renderTags(container, list) {
        container.innerHTML = '';
        if (list && list.length > 0) {
            list.forEach(item => {
                const span = document.createElement('span');
                span.className = 'tag';
                span.textContent = item;
                container.appendChild(span);
            });
        } else {
            container.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-light);">None study items recommended.</span>';
        }
    }

    function renderChart(graphData) {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        // Extrapolate keys and sort them (e.g. Q1, Q2, Q3)
        const labels = Object.keys(graphData).sort();
        const scores = labels.map(key => graphData[key]);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Question Evaluation Score (%)',
                    data: scores,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#2563eb',
                    pointRadius: 6,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            color: 'rgba(148, 163, 184, 0.8)' // slate-400
                        },
                        grid: {
                            color: 'rgba(148, 163, 184, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: 'rgba(148, 163, 184, 0.8)'
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    function renderQuestionsFeedback() {
        questionsFeedbackList.innerHTML = '';

        questionsData.forEach((q, index) => {
            const item = document.createElement('div');
            item.className = 'q-feedback-item';

            item.innerHTML = `
                <div class="q-header" onclick="toggleAccordion(this)">
                    <div class="q-title-wrapper">
                        <span>${index + 1}</span>
                        <h4>${q.question_text}</h4>
                    </div>
                    <div class="q-score-badge">
                        Score: ${q.ai_score || 0}%
                    </div>
                </div>
                <div class="q-body">
                    <div class="q-body-section">
                        <h5>Your Transcribed Response</h5>
                        <blockquote>"${q.user_answer || 'No answer recorded.'}"</blockquote>
                    </div>
                    <div class="q-body-section">
                        <h5>AI Feedback & Critic</h5>
                        <p>${q.ai_feedback || 'AI feedback missing due to network exception.'}</p>
                    </div>
                    <div class="q-body-section">
                        <h5>Exemplar Target Answer</h5>
                        <p style="color: var(--success); font-weight: 500; font-family: 'Outfit', sans-serif;">
                            ${q.correct_answer || 'Exemplar answer is compiling...'}
                        </p>
                    </div>
                </div>
            `;
            questionsFeedbackList.appendChild(item);
        });
    }

    // Accordion Toggle helper
    window.toggleAccordion = function(headerElement) {
        const bodyElement = headerElement.nextElementSibling;
        bodyElement.classList.toggle('active');
    };

    // Download results as PDF using html2pdf
    downloadReportBtn.addEventListener('click', () => {
        const element = document.getElementById('pdfTarget');
        
        // Expand all accordions temporarily to capture all feedback details
        const accordions = document.querySelectorAll('.q-body');
        accordions.forEach(acc => acc.classList.add('active'));

        const opt = {
            margin:       10,
            filename:     `Interview_Result_Session_${sessionId}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        showLoader(true, 'Compiling performance report PDF...');

        html2pdf().set(opt).from(element).save().then(() => {
            showLoader(false);
            // Optionally collapse them again, but let's keep them expanded or reset
        }).catch(err => {
            console.error('PDF Result Generation failed:', err);
            showLoader(false);
            alert('Failed to compile PDF.');
        });
    });

    function showLoader(show) {
        if (show) {
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }

    checkAuthAndLoad();
});
