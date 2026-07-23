document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const loaderText = document.getElementById('loaderText');

    // Setup screen elements
    const interviewSetup = document.getElementById('interviewSetup');
    const typeOptions = document.querySelectorAll('.type-option');
    const startInterviewBtn = document.getElementById('startInterviewBtn');

    // Console screen elements
    const interviewConsole = document.getElementById('interviewConsole');
    const questionCounter = document.getElementById('questionCounter');
    const consoleProgressBar = document.getElementById('consoleProgressBar');
    const ttsButton = document.getElementById('ttsButton');
    const questionText = document.getElementById('questionText');
    const micButton = document.getElementById('micButton');
    const micStatusText = document.getElementById('micStatusText');
    const speechTranscript = document.getElementById('speechTranscript');
    const answerInput = document.getElementById('answerInput');
    
    const exitSessionBtn = document.getElementById('exitSessionBtn');
    const submitAnswerBtn = document.getElementById('submitAnswerBtn');

    let selectedType = 'Technical';
    let sessionId = null;
    let currentQuestionId = null;
    let currentQuestionText = '';
    
    // Web Speech API Speech Recognition configuration
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isRecording = false;

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

    // Select category on click
    typeOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            typeOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedType = opt.dataset.type;
        });
    });

    // Start practice session click trigger
    startInterviewBtn.addEventListener('click', async () => {
        showLoader(true, 'Generating tailored questions using Gemini...');
        try {
            const response = await fetch('/api/generate-question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ interview_type: selectedType })
            });

            const data = await response.json();
            
            if (response.ok) {
                sessionId = data.session_id;
                
                // Hide Setup, show Console
                interviewSetup.style.display = 'none';
                interviewConsole.style.display = 'block';

                displayQuestion(data);
            } else {
                alert(data.error || 'Failed to start interview session.');
            }
        } catch (err) {
            console.error('Start interview error:', err);
            alert('A network error occurred. Please try again.');
        } finally {
            showLoader(false);
        }
    });

    // Render current question details
    function displayQuestion(data) {
        currentQuestionId = data.question.id;
        currentQuestionText = data.question.question_text;
        
        questionText.textContent = currentQuestionText;
        questionCounter.textContent = `Question ${data.current_index} of ${data.total_questions}`;
        
        // Progress percentage calculation
        const percent = ((data.current_index - 1) / data.total_questions) * 100;
        consoleProgressBar.style.width = `${percent}%`;

        // Clear input textareas
        speechTranscript.textContent = 'Your spoken transcript will appear here in real-time...';
        answerInput.value = '';

        // Automatically trigger TTS for user accessibility if they want it
        // We'll keep it manual to avoid sudden loud audio unless they click the audio button
    }

    // Text to Speech (TTS) Implementation
    ttsButton.addEventListener('click', () => {
        if ('speechSynthesis' in window) {
            // Cancel current speech output
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(currentQuestionText);
            utterance.lang = 'en-US';
            utterance.rate = 1.0;
            utterance.pitch = 1.0;

            // Change icon state while speaking
            const icon = ttsButton.querySelector('i');
            icon.classList.replace('fa-volume-up', 'fa-spinner');
            icon.classList.add('fa-spin');

            utterance.onend = () => {
                icon.classList.replace('fa-spinner', 'fa-volume-up');
                icon.classList.remove('fa-spin');
            };

            utterance.onerror = () => {
                icon.classList.replace('fa-spinner', 'fa-volume-up');
                icon.classList.remove('fa-spin');
            };

            window.speechSynthesis.speak(utterance);
        } else {
            alert('Text-to-Speech is not supported in this browser.');
        }
    });

    // Speech to Text (STT) Web Speech API Setup
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isRecording = true;
            micButton.classList.add('recording');
            micStatusText.textContent = "Listening... Speak clearly. Click the mic again to stop.";
            speechTranscript.textContent = 'Recording started. Speak into your microphone...';
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const activeTranscript = finalTranscript || interimTranscript;
            if (activeTranscript.trim()) {
                speechTranscript.textContent = activeTranscript;
                answerInput.value = activeTranscript;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            micStatusText.textContent = `Microphone error: ${event.error}. Please type manually.`;
            stopRecording();
        };

        recognition.onend = () => {
            stopRecording();
        };
    }

    function toggleRecording() {
        if (!recognition) {
            alert('Speech recognition is not supported in your browser (Google Chrome is recommended). Please type your answer manually.');
            return;
        }

        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    function startRecording() {
        if (recognition) {
            recognition.start();
        }
    }

    function stopRecording() {
        if (recognition && isRecording) {
            recognition.stop();
        }
        isRecording = false;
        micButton.classList.remove('recording');
        micStatusText.textContent = "Mic stopped. You can edit the text below and click submit.";
    }

    micButton.addEventListener('click', toggleRecording);

    // Submit answer triggers
    submitAnswerBtn.addEventListener('click', async () => {
        // Cancel ongoing TTS
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }

        const answerText = answerInput.value.trim();
        if (!answerText) {
            alert('Please speak or type an answer before submitting.');
            return;
        }

        stopRecording();
        showLoader(true, 'AI is evaluating your answer, please wait...');

        try {
            const response = await fetch('/api/evaluate-answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    question_id: currentQuestionId,
                    user_answer: answerText
                })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.is_completed) {
                    // Session finished! Redirect to results screen
                    showLoader(true, 'Compiling comprehensive mock report...');
                    setTimeout(() => {
                        window.location.href = `/result?session_id=${sessionId}`;
                    }, 2000);
                } else {
                    // Load next question
                    await loadNextQuestion();
                }
            } else {
                alert(data.error || 'Failed to submit response.');
                showLoader(false);
            }
        } catch (err) {
            console.error('Submit answer error:', err);
            alert('A network error occurred. Please try again.');
            showLoader(false);
        }
    });

    async function loadNextQuestion() {
        showLoader(true, 'Fetching next tailored question...');
        try {
            const response = await fetch('/api/generate-question', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: sessionId
                })
            });

            const data = await response.json();

            if (response.ok) {
                displayQuestion(data);
            } else {
                alert(data.error || 'Failed to retrieve next question.');
            }
        } catch (err) {
            console.error('Load next question error:', err);
            alert('Failed to load next question.');
        } finally {
            showLoader(false);
        }
    }

    // Exit practice button trigger
    exitSessionBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to quit the current interview? Your partial answers will not be recorded in your dashboard analytics.')) {
            // Cancel speech
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }
            window.location.href = '/dashboard';
        }
    });

    function showLoader(show, text = 'Loading...') {
        if (show) {
            loaderText.textContent = text;
            loader.classList.add('active');
        } else {
            loader.classList.remove('active');
        }
    }
});
