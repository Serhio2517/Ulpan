/* ========================================
   Ulpan Helper — Main Application Logic
   ======================================== */

// ========================================
// State
// ========================================

const state = {
    vocabulary: [],
    selectedLessons: [1, 2, 3, 4, 5],
    availableWords: [],
    learnedWordIds: [],
    currentWord: null,
    currentVerbForm: null,   // Which verb form is shown in quiz (m_sg or f_sg)
    sessionQueue: [],       // Words remaining in session
    sessionCompleted: [],   // Words answered correctly this session
    sessionRetries: 0,      // Number of retry slots remaining
    maxRetries: 0,          // Max retries (10% of available words)
    currentLetterIndex: 0,
    targetLetters: []
};

// ========================================
// DOM Elements
// ========================================

const elements = {
    // Screens
    homeScreen: document.getElementById('home-screen'),
    quizScreen: document.getElementById('quiz-screen'),
    resultScreen: document.getElementById('result-screen'),
    writingScreen: document.getElementById('writing-screen'),

    // Home
    lessonCheckboxes: document.getElementById('lesson-checkboxes'),
    lessonList: document.getElementById('lesson-list'),
    lessonPicker: document.getElementById('lesson-picker'),
    selectLessonsBtn: document.getElementById('select-lessons-btn'),
    applyLessonsBtn: document.getElementById('apply-lessons-btn'),
    availableWords: document.getElementById('available-words'),
    learnedWords: document.getElementById('learned-words'),
    startBtn: document.getElementById('start-btn'),

    // Quiz
    backHome: document.getElementById('back-home'),
    quizProgress: document.getElementById('quiz-progress'),
    hebrewDisplay: document.getElementById('hebrew-display'),
    optionsContainer: document.getElementById('options-container'),

    // Result
    resultStatus: document.getElementById('result-status'),
    cardImage: document.getElementById('card-image'),
    resultHebrew: document.getElementById('result-hebrew'),
    resultTranscription: document.getElementById('result-transcription'),
    resultTranslation: document.getElementById('result-translation'),
    writingBtn: document.getElementById('writing-btn'),
    nextBtn: document.getElementById('next-btn'),

    // Writing
    backResult: document.getElementById('back-result'),
    writingImage: document.getElementById('writing-image'),
    writingTranscription: document.getElementById('writing-transcription'),
    letterSlots: document.getElementById('letter-slots'),
    keyboard: document.getElementById('keyboard'),
    backspaceBtn: document.getElementById('backspace-btn')
};

// ========================================
// Initialization
// ========================================

async function init() {
    await loadVocabulary();
    loadProgress();
    updateStats();
    setupEventListeners();
}

async function loadVocabulary() {
    try {
        const response = await fetch('data/vocabulary.json');
        const data = await response.json();
        state.vocabulary = data.words;
        console.log(`Loaded ${state.vocabulary.length} words`);
    } catch (error) {
        console.error('Error loading vocabulary:', error);
        state.vocabulary = [];
    }
}

function loadProgress() {
    const saved = localStorage.getItem('ulpanProgress');
    if (saved) {
        const progress = JSON.parse(saved);
        state.selectedLessons = progress.selectedLessons || [1, 2, 3, 4, 5];
        state.learnedWordIds = progress.learnedWordIds || [];
    }
    // Update checkboxes to match saved state
    const checkboxes = elements.lessonCheckboxes.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.checked = state.selectedLessons.includes(parseInt(cb.value));
    });
    // Update lesson list display
    elements.lessonList.textContent = state.selectedLessons.sort((a, b) => a - b).join(', ');
}

function saveProgress() {
    localStorage.setItem('ulpanProgress', JSON.stringify({
        selectedLessons: state.selectedLessons,
        learnedWordIds: state.learnedWordIds
    }));
}

// ========================================
// Event Listeners
// ========================================

function setupEventListeners() {
    // Home - Lesson selector
    elements.selectLessonsBtn.addEventListener('click', toggleLessonPicker);
    elements.applyLessonsBtn.addEventListener('click', applyLessons);
    elements.startBtn.addEventListener('click', startSession);
    elements.backHome.addEventListener('click', () => showScreen('home'));

    // Result
    elements.writingBtn.addEventListener('click', startWritingMode);
    elements.nextBtn.addEventListener('click', nextWord);
    elements.backResult.addEventListener('click', () => showScreen('result'));

    // Keyboard
    elements.keyboard.addEventListener('click', handleKeyPress);

    // iOS Safari touch feedback fix
    // :active doesn't work on iOS without touch event handlers
    setupTouchFeedback();
}

// iOS Safari touch feedback
function setupTouchFeedback() {
    const buttons = document.querySelectorAll('.btn-secondary, .btn-primary, .btn-icon, .key, .option-btn');

    buttons.forEach(btn => {
        btn.addEventListener('touchstart', function (e) {
            this.classList.add('pressed');
        }, { passive: true });

        btn.addEventListener('touchend', function (e) {
            this.classList.remove('pressed');
        }, { passive: true });

        btn.addEventListener('touchcancel', function (e) {
            this.classList.remove('pressed');
        }, { passive: true });
    });

    // Also handle dynamically created buttons (like quiz options)
    document.addEventListener('touchstart', function (e) {
        const btn = e.target.closest('.option-btn, .key');
        if (btn) btn.classList.add('pressed');
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        const btn = e.target.closest('.option-btn, .key');
        if (btn) btn.classList.remove('pressed');
    }, { passive: true });
}

// ========================================
// Screen Navigation
// ========================================

function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

    switch (screenName) {
        case 'home':
            elements.homeScreen.classList.add('active');
            break;
        case 'quiz':
            elements.quizScreen.classList.add('active');
            break;
        case 'result':
            elements.resultScreen.classList.add('active');
            break;
        case 'writing':
            elements.writingScreen.classList.add('active');
            break;
    }
}

// ========================================
// Progress Management
// ========================================

function toggleLessonPicker() {
    elements.lessonPicker.classList.toggle('hidden');
}

function applyLessons() {
    // Get selected lessons from checkboxes
    const checkboxes = elements.lessonCheckboxes.querySelectorAll('input[type="checkbox"]:checked');
    state.selectedLessons = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (state.selectedLessons.length === 0) {
        alert('Выберите хотя бы один урок!');
        return;
    }

    // Update the summary display
    elements.lessonList.textContent = state.selectedLessons.sort((a, b) => a - b).join(', ');

    // Collapse the picker
    elements.lessonPicker.classList.add('hidden');

    saveProgress();
    updateStats();
}

function updateStats() {
    // Filter words by selected lessons
    // lesson: 0 = common phrases, included in ALL selections
    state.availableWords = state.vocabulary.filter(w => {
        const wordLesson = w.lesson;
        // Include if: lesson is 0 (common) OR lesson is in selected list
        return wordLesson === 0 || state.selectedLessons.includes(wordLesson);
    });
    const learnedCount = state.learnedWordIds.length;

    elements.availableWords.textContent = state.availableWords.length;
    elements.learnedWords.textContent = learnedCount;
}

// ========================================
// Quiz Mode
// ========================================

// Helper: get Hebrew text for display
// For verbs: shows random singular form (m_sg or f_sg)
// Stores which form was used in state.currentVerbForm
function getHebrewDisplay(word) {
    if (word.type === 'verb' && word.forms) {
        // Pick random singular form for quiz
        const forms = ['m_sg', 'f_sg'];
        const formKey = forms[Math.floor(Math.random() * forms.length)];
        state.currentVerbForm = formKey;
        return word.forms[formKey]?.hebrew || word.infinitive || '';
    }
    return word.hebrew || word.infinitive || '';
}

// Helper: get transcription for the currently displayed form
function getTranscription(word) {
    if (word.type === 'verb' && word.forms && state.currentVerbForm) {
        return word.forms[state.currentVerbForm]?.transcription || word.infinitive_transcription || '';
    }
    return word.transcription || word.infinitive_transcription || '';
}

function startSession() {
    if (state.availableWords.length < 4) {
        alert('Недостаточно слов для тренировки. Выберите больше уроков.');
        return;
    }

    // Initialize session with all available words shuffled
    state.sessionQueue = shuffleArray([...state.availableWords]);
    state.sessionCompleted = [];
    state.maxRetries = Math.ceil(state.availableWords.length * 0.1); // 10% extra for retries
    state.sessionRetries = 0;

    showQuizWord();
    showScreen('quiz');
}

function showQuizWord() {
    // Take next word from queue
    state.currentWord = state.sessionQueue[0];

    // Update progress indicator (completed / total including retries)
    const completed = state.sessionCompleted.length;
    const total = state.availableWords.length;
    elements.quizProgress.textContent = `${completed + 1} / ${total}`;

    // Show Hebrew word (handle verbs with 'infinitive' field)
    elements.hebrewDisplay.textContent = getHebrewDisplay(state.currentWord);

    // Generate options
    const options = generateOptions(state.currentWord);
    renderOptions(options);
}

function generateOptions(correctWord) {
    const options = [correctWord];

    // Get distractors from ALL vocabulary (not just selected lessons)
    // This ensures we always have enough options
    const candidates = state.vocabulary.filter(w => w.id !== correctWord.id && w.translation);
    const shuffled = shuffleArray(candidates);

    // Take 7 distractors (or as many as available)
    const numDistractors = Math.min(7, shuffled.length);
    for (let i = 0; i < numDistractors; i++) {
        options.push(shuffled[i]);
    }

    return shuffleArray(options);
}

function renderOptions(options) {
    elements.optionsContainer.innerHTML = '';

    options.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option.translation;
        btn.dataset.id = option.id;
        btn.addEventListener('click', () => handleOptionClick(option));
        elements.optionsContainer.appendChild(btn);
    });
}

function handleOptionClick(selectedOption) {
    const isCorrect = selectedOption.id === state.currentWord.id;

    // Disable all buttons
    const buttons = elements.optionsContainer.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        btn.disabled = true;
        if (parseInt(btn.dataset.id) === state.currentWord.id) {
            btn.classList.add('correct');
        } else if (parseInt(btn.dataset.id) === selectedOption.id) {
            btn.classList.add('wrong');
        }
    });

    // Remove current word from queue
    state.sessionQueue.shift();

    if (isCorrect) {
        // Add to completed (won't appear again this session)
        state.sessionCompleted.push(state.currentWord);

        // Mark as learned globally
        if (!state.learnedWordIds.includes(state.currentWord.id)) {
            state.learnedWordIds.push(state.currentWord.id);
            saveProgress();
            updateStats();
        }
    } else {
        // Wrong answer: add to end of queue if retries available
        if (state.sessionRetries < state.maxRetries) {
            state.sessionQueue.push(state.currentWord);
            state.sessionRetries++;
        }
    }

    // Show result after delay
    setTimeout(() => {
        showResult(isCorrect);
    }, 600);
}

// ========================================
// Result Screen
// ========================================

function showResult(isCorrect) {
    // Update status
    elements.resultStatus.textContent = isCorrect ? '✓ ПРАВИЛЬНО!' : '✗ НЕПРАВИЛЬНО';
    elements.resultStatus.className = 'result-status ' + (isCorrect ? 'success' : 'error');

    const word = state.currentWord;
    const verbFormsEl = document.getElementById('verb-forms');

    // Check if this is a verb with forms
    if (word.type === 'verb' && word.forms) {
        // Show the forms the user saw in quiz at the top
        const displayedForm = word.forms[state.currentVerbForm];
        elements.resultHebrew.textContent = displayedForm?.hebrew || word.infinitive;
        elements.resultTranscription.textContent = displayedForm?.transcription || word.infinitive_transcription;
        elements.resultTranslation.textContent = word.translation;

        // Populate all 5 verb forms
        document.getElementById('form-m-sg').textContent = word.forms.m_sg?.hebrew || '';
        document.getElementById('form-m-sg-trans').textContent = word.forms.m_sg?.transcription || '';
        document.getElementById('form-f-sg').textContent = word.forms.f_sg?.hebrew || '';
        document.getElementById('form-f-sg-trans').textContent = word.forms.f_sg?.transcription || '';
        document.getElementById('form-m-pl').textContent = word.forms.m_pl?.hebrew || '';
        document.getElementById('form-m-pl-trans').textContent = word.forms.m_pl?.transcription || '';
        document.getElementById('form-f-pl').textContent = word.forms.f_pl?.hebrew || '';
        document.getElementById('form-f-pl-trans').textContent = word.forms.f_pl?.transcription || '';
        document.getElementById('form-inf').textContent = word.infinitive || '';
        document.getElementById('form-inf-trans').textContent = word.infinitive_transcription || '';

        verbFormsEl.style.display = 'block';
    } else {
        // Regular word - hide verb forms table
        verbFormsEl.style.display = 'none';
        elements.resultHebrew.textContent = getHebrewDisplay(word);
        elements.resultTranscription.textContent = getTranscription(word);
        elements.resultTranslation.textContent = word.translation;
    }

    // Update image (placeholder for now)
    elements.cardImage.innerHTML = '<div class="placeholder-image">🖼️</div>';

    showScreen('result');
}

function nextWord() {
    if (state.sessionQueue.length === 0) {
        // Session complete
        const total = state.availableWords.length;
        const correct = state.sessionCompleted.length;
        alert(`Сессия завершена! \nПравильно: ${correct} / ${total} 🎉`);
        showScreen('home');
        return;
    }

    showQuizWord();
    showScreen('quiz');
}

// ========================================
// Writing Mode
// ========================================

function startWritingMode() {
    // Extract letters (remove nikud/vowel marks) - handle verbs
    state.targetLetters = extractLetters(getHebrewDisplay(state.currentWord));
    state.currentLetterIndex = 0;

    // Update UI
    elements.writingTranscription.textContent = getTranscription(state.currentWord);
    elements.writingImage.innerHTML = '<div class="placeholder-image">🖼️</div>';

    // Create letter slots
    renderLetterSlots();

    showScreen('writing');
}

function extractLetters(hebrewWord) {
    // Remove nikud (vowel points) - Unicode range 0x0591-0x05C7
    const withoutNikud = hebrewWord.replace(/[\u0591-\u05C7]/g, '');
    return [...withoutNikud].filter(char => /[\u05D0-\u05EA\u05DA-\u05DF]/.test(char));
}

function renderLetterSlots() {
    elements.letterSlots.innerHTML = '';

    state.targetLetters.forEach((letter, index) => {
        const slot = document.createElement('div');
        slot.className = 'letter-slot';
        slot.dataset.index = index;
        if (index === 0) slot.classList.add('active');
        elements.letterSlots.appendChild(slot);
    });
}

function handleKeyPress(e) {
    const key = e.target.closest('.key');
    if (!key) return;

    if (key.id === 'backspace-btn') {
        handleBackspace();
        return;
    }

    const letter = key.dataset.letter;
    if (!letter) return;

    checkLetter(letter);
}

function checkLetter(letter) {
    const targetLetter = state.targetLetters[state.currentLetterIndex];
    const slot = elements.letterSlots.children[state.currentLetterIndex];

    // Handle final forms (sofit) - allow both regular and final form
    const isCorrect = isLetterMatch(letter, targetLetter);

    slot.textContent = letter;

    if (isCorrect) {
        slot.classList.remove('active');
        slot.classList.add('correct');
        state.currentLetterIndex++;

        if (state.currentLetterIndex >= state.targetLetters.length) {
            // Word complete!
            setTimeout(() => {
                nextWord();
            }, 500);
        } else {
            // Activate next slot
            elements.letterSlots.children[state.currentLetterIndex].classList.add('active');
        }
    } else {
        slot.classList.add('wrong');
        setTimeout(() => {
            slot.classList.remove('wrong');
            slot.textContent = '';
        }, 300);
    }
}

function isLetterMatch(input, target) {
    // Direct match
    if (input === target) return true;

    // Final form equivalents
    const finalForms = {
        'כ': 'ך', 'ך': 'כ',
        'מ': 'ם', 'ם': 'מ',
        'נ': 'ן', 'ן': 'נ',
        'פ': 'ף', 'ף': 'פ',
        'צ': 'ץ', 'ץ': 'צ'
    };

    return finalForms[input] === target;
}

function handleBackspace() {
    if (state.currentLetterIndex > 0) {
        // Move back
        elements.letterSlots.children[state.currentLetterIndex].classList.remove('active');
        state.currentLetterIndex--;

        const slot = elements.letterSlots.children[state.currentLetterIndex];
        slot.classList.remove('correct');
        slot.classList.add('active');
        slot.textContent = '';
    }
}

// ========================================
// Utility Functions
// ========================================

function shuffleArray(array) {
    const shuffled = [...array];
    // Fisher-Yates shuffle with extra randomization
    for (let i = shuffled.length - 1; i > 0; i--) {
        // Mix in timestamp for better randomness
        const random = Math.random() + (Date.now() % 1000) / 10000;
        const j = Math.floor((random % 1) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ========================================
// Start App
// ========================================

document.addEventListener('DOMContentLoaded', init);
