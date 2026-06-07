document.addEventListener('DOMContentLoaded', () => {
    
    // Check if we are on the Authentication Page (auth.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        initAuthPage();
        return;
    }

    // Check if we are on the Dashboard Page (index.html)
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        initDashboardPage();
        return;
    }

    // ----------------------------------------------------
    // 1. AUTHENTICATION PAGE CODE
    // ----------------------------------------------------
    function initAuthPage() {
        const tabLoginBtn = document.getElementById('tab-login-btn');
        const tabRegisterBtn = document.getElementById('tab-register-btn');
        const registerForm = document.getElementById('register-form');
        const authError = document.getElementById('auth-error');

        // Form fields
        const loginUsernameInput = document.getElementById('login-username');
        const loginPasswordInput = document.getElementById('login-password');
        const registerUsernameInput = document.getElementById('register-username');
        const registerPasswordInput = document.getElementById('register-password');
        const registerConfirmInput = document.getElementById('register-confirm-password');

        function showAuthError(message) {
            authError.textContent = message;
            authError.classList.remove('hidden');
            authError.scrollIntoView({ behavior: 'smooth' });
        }

        function hideAuthError() {
            authError.textContent = '';
            authError.classList.add('hidden');
        }

        // Tab Switching
        tabLoginBtn.addEventListener('click', () => {
            tabLoginBtn.classList.add('active');
            tabRegisterBtn.classList.remove('active');
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            hideAuthError();
        });

        tabRegisterBtn.addEventListener('click', () => {
            tabRegisterBtn.classList.add('active');
            tabLoginBtn.classList.remove('active');
            registerForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
            hideAuthError();
        });

        // Submit: Login
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAuthError();

            const username = loginUsernameInput.value.trim();
            const password = loginPasswordInput.value;

            try {
                const response = await fetch('/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Login failed.');
                }

                // Redirect to main dashboard
                window.location.href = '/';

            } catch (error) {
                showAuthError(error.message);
            }
        });

        // Submit: Registration
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideAuthError();

            const username = registerUsernameInput.value.trim();
            const password = registerPasswordInput.value;
            const confirmPassword = registerConfirmInput.value;

            if (password !== confirmPassword) {
                showAuthError('Passwords do not match.');
                return;
            }

            try {
                const response = await fetch('/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Registration failed.');
                }

                // Redirect to main dashboard (user is auto logged-in)
                window.location.href = '/';

            } catch (error) {
                showAuthError(error.message);
            }
        });
    }

    // ----------------------------------------------------
    // 2. DASHBOARD PAGE CODE
    // ----------------------------------------------------
    function initDashboardPage() {
        // DOM Element Declarations
        const setupView = document.getElementById('setup-view');
        const loadingView = document.getElementById('loading-view');
        const quizView = document.getElementById('quiz-view');
        const resultsView = document.getElementById('results-view');

        const subjectInput = document.getElementById('subject-input');
        const topicInput = document.getElementById('topic-input');
        const setupError = document.getElementById('setup-error');
        
        const quizTopicTitle = document.getElementById('quiz-topic-title');
        const quizProgressFill = document.getElementById('quiz-progress-fill');
        const questionsContainer = document.getElementById('questions-container');
        const quizForm = document.getElementById('quiz-form');
        
        const scoreValue = document.getElementById('score-value');
        const scoreTotal = document.getElementById('score-total');
        const scoreGrade = document.getElementById('score-grade');
        const scoreDesc = document.getElementById('score-desc');
        const resultsContainer = document.getElementById('results-container');
        const retryBtn = document.getElementById('retry-btn');

        // History Card Elements
        const toggleHistoryBtn = document.getElementById('toggle-history-btn');
        const historyCardContent = document.getElementById('history-card-content');
        const historyItemsContainer = document.getElementById('history-items-container');

        // Local Quiz State
        let quizQuestions = [];

        // Segmented Controls (Count and Level)
        const segmentCountBtns = document.querySelectorAll('.segment-count-btn');
        const segmentLevelBtns = document.querySelectorAll('.segment-level-btn');
        
        let selectedNumQuestions = 5;
        let selectedLevel = 'Intermediate';

        segmentCountBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                segmentCountBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedNumQuestions = parseInt(btn.getAttribute('data-value'), 10) || 5;
            });
        });

        segmentLevelBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                segmentLevelBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedLevel = btn.getAttribute('data-value') || 'Intermediate';
            });
        });

        // Switch between views helpers
        function showView(viewToShow) {
            const views = [setupView, loadingView, quizView, resultsView];
            views.forEach(view => {
                if (view === viewToShow) {
                    view.classList.remove('hidden');
                } else {
                    view.classList.add('hidden');
                }
            });
        }

        function showError(message) {
            setupError.textContent = message;
            setupError.classList.remove('hidden');
        }

        function hideError() {
            setupError.textContent = '';
            setupError.classList.add('hidden');
        }

        // Toggle History Card Visibility
        toggleHistoryBtn.addEventListener('click', () => {
            const isHidden = historyCardContent.classList.contains('hidden');
            
            if (isHidden) {
                historyCardContent.classList.remove('hidden');
                toggleHistoryBtn.classList.add('active');
                toggleHistoryBtn.querySelector('span').textContent = 'Hide History';
                loadHistoryData();
            } else {
                historyCardContent.classList.add('hidden');
                toggleHistoryBtn.classList.remove('active');
                toggleHistoryBtn.querySelector('span').textContent = 'Show History';
            }
        });

        // Fetch past attempts history from MongoDB
        async function loadHistoryData() {
            historyItemsContainer.innerHTML = '<p class="history-empty-text">Loading attempts history...</p>';

            try {
                const response = await fetch('/quiz-history');
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to fetch history.');
                }

                renderHistoryList(data.history);

            } catch (error) {
                console.error('History Fetch Error:', error);
                historyItemsContainer.innerHTML = `<p class="history-empty-text" style="color: var(--error);">Error loading history: ${error.message}</p>`;
            }
        }

        // Render History Items List
        function renderHistoryList(history) {
            historyItemsContainer.innerHTML = '';

            if (!history || history.length === 0) {
                historyItemsContainer.innerHTML = '<p class="history-empty-text">No quiz attempts yet. Generate a quiz above to start!</p>';
                return;
            }

            history.forEach(item => {
                const row = document.createElement('div');
                row.classList.add('history-item-row');

                // Topic and Date Metadata
                const metaGroup = document.createElement('div');
                metaGroup.classList.add('history-item-meta');

                const topicSpan = document.createElement('span');
                topicSpan.classList.add('history-item-topic');
                topicSpan.textContent = item.topic;

                const dateSpan = document.createElement('span');
                dateSpan.classList.add('history-item-date');
                dateSpan.textContent = item.timestamp;

                metaGroup.appendChild(topicSpan);
                metaGroup.appendChild(dateSpan);

                // Score Badge and Coloring class
                const scoreBadge = document.createElement('span');
                scoreBadge.classList.add('history-item-score-badge');
                scoreBadge.textContent = `${item.score} / ${item.total}`;

                const scorePercentage = (item.score / item.total) * 100;
                if (scorePercentage === 100) {
                    scoreBadge.classList.add('history-score-perfect');
                } else if (scorePercentage >= 80) {
                    scoreBadge.classList.add('history-score-good');
                } else if (scorePercentage >= 50) {
                    scoreBadge.classList.add('history-score-pass');
                } else {
                    scoreBadge.classList.add('history-score-fail');
                }

                row.appendChild(metaGroup);
                row.appendChild(scoreBadge);
                historyItemsContainer.appendChild(row);
            });
        }

        // Event Listener: Generate Quiz
        generateBtn.addEventListener('click', async () => {
            const subject = subjectInput.value.trim();
            const topic = topicInput.value.trim();
            if (!subject || !topic) {
                showError('Please enter both a Subject and a Topic before generating the quiz.');
                return;
            }

            hideError();
            showView(loadingView);

            try {
                const response = await fetch('/generate-quiz', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        subject: subject, 
                        topic: topic, 
                        level: selectedLevel, 
                        num_questions: selectedNumQuestions 
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Server returned an error.');
                }

                quizQuestions = data.questions;
                quizTopicTitle.textContent = `Topic: ${data.topic}`;
                
                renderQuiz(data.questions);
                updateProgressBar();
                showView(quizView);

            } catch (error) {
                console.error('Quiz Generation Error:', error);
                showView(setupView);
                showError(error.message || 'An unexpected error occurred. Please try again.');
            }
        });

        // Event Listener: Enter key inside inputs
        [subjectInput, topicInput].forEach(input => {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    generateBtn.click();
                }
            });
        });

        // Render Quiz Form
        function renderQuiz(questions) {
            questionsContainer.innerHTML = '';
            
            questions.forEach((q, qIndex) => {
                const questionBlock = document.createElement('div');
                questionBlock.classList.add('question-block');

                const questionText = document.createElement('p');
                questionText.classList.add('q-text');
                questionText.innerHTML = `<span class="q-number">Q${qIndex + 1}</span>${escapeHTML(q.question)}`;
                questionBlock.appendChild(questionText);

                const optionsList = document.createElement('div');
                optionsList.classList.add('options-list');

                q.options.forEach((option) => {
                    const label = document.createElement('label');
                    label.classList.add('option-item');

                    const input = document.createElement('input');
                    input.type = 'radio';
                    input.name = `question_${qIndex}`;
                    input.value = option;
                    input.required = true;
                    
                    input.addEventListener('change', updateProgressBar);

                    const labelContent = document.createElement('div');
                    labelContent.classList.add('option-label');
                    labelContent.innerHTML = `
                        <div class="check-circle"></div>
                        <span>${escapeHTML(option)}</span>
                    `;

                    label.appendChild(input);
                    label.appendChild(labelContent);
                    optionsList.appendChild(label);
                });

                questionBlock.appendChild(optionsList);
                questionsContainer.appendChild(questionBlock);
            });
        }

        // Update Progress Bar
        function updateProgressBar() {
            const total = quizQuestions.length;
            if (total === 0) {
                quizProgressFill.style.width = '0%';
                return;
            }

            let answeredCount = 0;
            for (let i = 0; i < total; i++) {
                const selection = document.querySelector(`input[name="question_${i}"]:checked`);
                if (selection) {
                    answeredCount++;
                }
            }

            const percentage = (answeredCount / total) * 100;
            quizProgressFill.style.width = `${percentage}%`;
        }

        // Event Listener: Submit Quiz Answers
        quizForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const answers = [];
            for (let i = 0; i < quizQuestions.length; i++) {
                const selection = document.querySelector(`input[name="question_${i}"]:checked`);
                answers.push(selection ? selection.value : '');
            }

            showView(loadingView);
            document.getElementById('loading-title').textContent = 'Evaluating your responses...';

            try {
                const response = await fetch('/submit-quiz', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ answers: answers })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Failed to submit quiz.');
                }

                document.getElementById('loading-title').textContent = 'Drafting your questions...';

                renderResults(data);
                showView(resultsView);

                // Dynamically update history list if currently open
                if (!historyCardContent.classList.contains('hidden')) {
                    loadHistoryData();
                }

            } catch (error) {
                console.error('Quiz Submission Error:', error);
                showView(quizView);
                alert(error.message || 'An error occurred while submitting. Please try again.');
            }
        });

        // Render Results View
        function renderResults(data) {
            scoreValue.textContent = data.score;
            scoreTotal.textContent = `/ ${data.total}`;
            
            const percentage = (data.score / data.total) * 100;
            if (percentage === 100) {
                scoreGrade.textContent = 'Perfect Score!';
                scoreDesc.textContent = 'Absolutely brilliant! You got every single question right.';
            } else if (percentage >= 80) {
                scoreGrade.textContent = 'Outstanding Work!';
                scoreDesc.textContent = 'Excellent grasp of the topic. You did extremely well.';
            } else if (percentage >= 50) {
                scoreGrade.textContent = 'Good Effort!';
                scoreDesc.textContent = 'Solid performance, but there is still room for improvement.';
            } else {
                scoreGrade.textContent = 'Keep Learning!';
                scoreDesc.textContent = 'A great opportunity to brush up on this topic and try again!';
            }

            resultsContainer.innerHTML = '';
            
            data.results.forEach((res, index) => {
                const card = document.createElement('div');
                card.classList.add('review-question-card');

                const badge = document.createElement('span');
                badge.classList.add('status-badge');
                if (res.is_correct) {
                    badge.classList.add('status-correct');
                    badge.textContent = 'Correct';
                } else {
                    badge.classList.add('status-incorrect');
                    badge.textContent = 'Incorrect';
                }
                card.appendChild(badge);

                const qText = document.createElement('p');
                qText.classList.add('review-q-text');
                qText.innerHTML = `<span class="q-number">Q${index + 1}</span>${escapeHTML(res.question)}`;
                card.appendChild(qText);

                res.options.forEach(option => {
                    const optDiv = document.createElement('div');
                    optDiv.classList.add('review-option');

                    let iconSVG = '';
                    if (option === res.correct_answer) {
                        optDiv.classList.add('correct-choice');
                        iconSVG = `
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        `;
                    } else if (option === res.user_answer && !res.is_correct) {
                        optDiv.classList.add('incorrect-choice');
                        iconSVG = `
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        `;
                    } else {
                        optDiv.classList.add('default');
                    }

                    optDiv.innerHTML = `${iconSVG}<span>${escapeHTML(option)}</span>`;
                    card.appendChild(optDiv);
                });

                resultsContainer.appendChild(card);
            });
        }

        // Retry / Restart
        retryBtn.addEventListener('click', () => {
            subjectInput.value = '';
            topicInput.value = '';
            quizQuestions = [];

            // Reset Segmented Controls
            segmentCountBtns.forEach(btn => {
                if (btn.getAttribute('data-value') === '5') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            selectedNumQuestions = 5;

            segmentLevelBtns.forEach(btn => {
                if (btn.getAttribute('data-value') === 'Intermediate') {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            selectedLevel = 'Intermediate';

            hideError();
            showView(setupView);
        });
    }

    // Helper: Escape HTML
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
