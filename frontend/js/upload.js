document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadError = document.getElementById('uploadError');
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');

    const uploadPortal = document.getElementById('uploadPortal');
    const analysisDashboard = document.getElementById('analysisDashboard');
    const downloadReportBtn = document.getElementById('downloadReportBtn');

    // Analysis elements to populate
    const atsScoreCircle = document.getElementById('atsScoreCircle');
    const atsScoreValue = document.getElementById('atsScoreValue');
    const atsLevelLabel = document.getElementById('atsLevelLabel');
    const resumeSummaryText = document.getElementById('resumeSummaryText');
    const skillsFoundList = document.getElementById('skillsFoundList');
    const missingSkillsList = document.getElementById('missingSkillsList');
    const techRecommendedList = document.getElementById('techRecommendedList');
    
    const strengthsList = document.getElementById('strengthsList');
    const weaknessesList = document.getElementById('weaknessesList');
    const suggestionsList = document.getElementById('suggestionsList');
    const questionsList = document.getElementById('questionsList');

    // Check authorization on load
    async function checkAuth() {
        try {
            const response = await fetch('/api/current-user');
            if (!response.ok) {
                window.location.href = '/login';
            }
        } catch (err) {
            window.location.href = '/login';
        }
    }
    checkAuth();

    // Trigger file dialog on click
    dropZone.addEventListener('click', () => fileInput.click());

    // Drag-over styling toggles
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
        }, false);
    });

    // Capture dropped files
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            handleSelectedFile(files[0]);
        }
    });

    // Capture file selected via browse dialog
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            handleSelectedFile(fileInput.files[0]);
        }
    });

    function handleSelectedFile(file) {
        uploadError.style.display = 'none';

        // Check if file is PDF
        if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
            showError('Invalid file format. Only PDF files are supported.');
            return;
        }

        // Check file size (16MB limit)
        if (file.size > 16 * 1024 * 1024) {
            showError('File is too large. Maximum size allowed is 16MB.');
            return;
        }

        uploadResume(file);
    }

    async function uploadResume(file) {
        showLoader(true, 'Uploading & Parsing PDF...');
        
        const formData = new FormData();
        formData.append('resume', file);

        try {
            // Upload to API
            const response = await fetch('/api/upload-resume', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                renderAnalysis(data.analysis);
            } else {
                showError(data.error || 'Failed to process resume. Please ensure the PDF contains parseable text.');
            }
        } catch (err) {
            console.error('Upload resume error:', err);
            showError('Network error occurred. Ensure your server is active and try again.');
        } finally {
            showLoader(false);
        }
    }

    function renderAnalysis(analysis) {
        // Toggle view visibility
        uploadPortal.style.display = 'none';
        analysisDashboard.style.display = 'block';

        // 1. Render ATS Score progress circle
        const score = analysis.ats_score || 70;
        atsScoreValue.textContent = `${score}%`;
        
        // Circular stroke-dashoffset calculations: total stroke is 440 (2 * pi * r where r=60 is ~377 but here stroke is 440)
        // SVG circle dasharray is 440.
        const circumference = 440;
        const offset = circumference - (score / 100) * circumference;
        atsScoreCircle.style.strokeDashoffset = offset;

        // Score rating description text
        if (score >= 85) {
            atsLevelLabel.textContent = 'Excellent Match';
            atsLevelLabel.style.color = 'var(--success)';
        } else if (score >= 70) {
            atsLevelLabel.textContent = 'Good Match';
            atsLevelLabel.style.color = 'var(--accent-color)';
        } else if (score >= 50) {
            atsLevelLabel.textContent = 'Average Match';
            atsLevelLabel.style.color = 'var(--warning)';
        } else {
            atsLevelLabel.textContent = 'Needs Improvement';
            atsLevelLabel.style.color = 'var(--danger)';
        }

        // 2. Render summary
        resumeSummaryText.textContent = analysis.summary || 'Summary unavailable.';

        // 3. Render tag fields
        renderTags(skillsFoundList, analysis.skills_found);
        renderTags(missingSkillsList, analysis.missing_skills);
        renderTags(techRecommendedList, analysis.tech_recommended);

        // 4. Render bullet lists
        renderBullets(strengthsList, analysis.strengths);
        renderBullets(weaknessesList, analysis.weaknesses);
        renderBullets(suggestionsList, analysis.suggestions);
        renderBullets(questionsList, analysis.questions);
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
            container.innerHTML = '<span style="font-size: 0.85rem; color: var(--text-light);">None identified</span>';
        }
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
            container.innerHTML = '<li style="list-style: none; color: var(--text-light); padding-left: 0;">No items available</li>';
        }
    }

    // PDF Exporting using html2pdf
    downloadReportBtn.addEventListener('click', () => {
        const element = document.getElementById('pdfTarget');
        
        // Temporary light theme application to PDF if desired or export as is
        const opt = {
            margin:       10,
            filename:     'Resume_ATS_Analysis_Report.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        // Show compiling loader
        showLoader(true, 'Generating PDF document...');
        
        html2pdf().set(opt).from(element).save().then(() => {
            showLoader(false);
        }).catch(err => {
            console.error('PDF Generation failed:', err);
            showLoader(false);
            alert('Could not download PDF. Please try again.');
        });
    });

    function showError(msg) {
        uploadError.textContent = msg;
        uploadError.style.display = 'block';
    }

    function showLoader(show, text = 'Loading...') {
        if (show) {
            loaderText.textContent = text;
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }
});
