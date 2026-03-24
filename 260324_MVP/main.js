// --- Constants and Configuration ---
const COLORS = [
    {
        id: 'black',
        name: '검정',
        hex: '#000000',
        key: 'a',
        imgText: '버튼사진/텍스트/약병_검정_글자.svg',
        imgColor: '버튼사진/텍스트/약병_검정.svg'
    },
    {
        id: 'yellow',
        name: '노랑',
        hex: '#F0E442',
        key: 's',
        imgText: '버튼사진/텍스트/약병_노랑_글자.svg',
        imgColor: '버튼사진/텍스트/약병_노랑.svg'
    },
    {
        id: 'blue',
        name: '파랑',
        hex: '#0072B2',
        key: 'd',
        imgText: '버튼사진/텍스트/약병_파랑_글자.svg',
        imgColor: '버튼사진/텍스트/약병_파랑.svg'
    },
    {
        id: 'orange',
        name: '주황',
        hex: '#E69F00',
        key: 'f',
        imgText: '버튼사진/텍스트/약병_주황_글자.svg',
        imgColor: '버튼사진/텍스트/약병_주황.svg'
    },
    {
        id: 'red',
        name: '빨강',
        hex: '#D56127',
        key: 'g',
        imgText: '버튼사진/텍스트/약병_빨강_글자.svg',
        imgColor: '버튼사진/텍스트/약병_빨강.svg'
    },
    {
        id: 'green',
        name: '초록',
        hex: '#009E73',
        key: 'h',
        imgText: '버튼사진/텍스트/약병_초록_글자.svg',
        imgColor: '버튼사진/텍스트/약병_초록.svg'
    }
];

const CONFIG = {
    BLOCKS: [
        {
            id: 'COLOR_NO_AUDIO',
            icon: '🔇',
            title: '색상 반응 (음성 없음)',
            desc: ''
        },
        {
            id: 'COLOR_WITH_AUDIO',
            icon: '🔊',
            title: '색상 반응 (음성 포함)',
            desc: ''
        }
    ],
    SOA: -100, // Audio 100ms before text
    TRIAL_DURATION_MS: 3000,
    FEEDBACK_MS: 500,
    TRIAL_COUNT: 60
};

// --- Helper Functions ---
function generateTrials(blockType, colorCount, count = 60) {
    const trials = [];
    const activeColors = COLORS.slice(0, colorCount);
    
    for (let i = 0; i < count; i++) {
        const colorIdx = Math.floor(Math.random() * activeColors.length);
        const wordIdx = Math.floor(Math.random() * activeColors.length);
        const actualAudioIdx = (blockType === 'COLOR_WITH_AUDIO') ? Math.floor(Math.random() * activeColors.length) : -1;

        trials.push({
            id: i,
            text: activeColors[wordIdx].name,
            color: activeColors[colorIdx].hex,
            audioText: actualAudioIdx !== -1 ? activeColors[actualAudioIdx].name : '',
            targetKey: activeColors[colorIdx].key // Always respond to color
        });
    }
    return trials;
}

// --- Audio System ---
class AudioSystem {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.init();
    }
    init() {
        const loadVoices = () => {
            const voices = this.synth.getVoices();
            this.voice = voices.find(v => v.lang === 'ko-KR' || v.lang.includes('ko')) || voices[0];
        };
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = loadVoices;
        }
        loadVoices();
    }
    speak(text) {
        return new Promise((resolve) => {
            if (!this.synth) {
                resolve();
                return;
            }
            this.synth.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = this.voice;
            utterance.rate = 1.2;

            let resolved = false;
            const finish = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            utterance.onstart = finish;
            setTimeout(finish, 150);
            this.synth.speak(utterance);
        });
    }
}
const audioSystem = new AudioSystem();

// --- Main App Logic ---
class StroopApp {
    constructor() {
        this.currentBlockIdx = 0;
        this.selectedButtonType = 'text'; // 'text' or 'color'
        this.selectedColorCount = 4;
        this.trials = [];
        this.currentTrialIdx = 0;
        this.state = 'START'; // START, BUTTON_MENU, AUDIO_MENU, COLOR_COUNT_MENU, INSTRUCTIONS, TASK, FEEDBACK, RESULTS
        this.results = [];
        this.startTime = 0;
        this.canRespond = false;

        this.el = {
            content: document.getElementById('screen-content')
        };
        this.init();
    }
    init() {
        this.render();
    }
    setState(newState) {
        this.state = newState;
        this.render();
    }
    render() {
        this.el.content.innerHTML = '';
        const container = document.createElement('div');
        container.className = this.state === 'TASK' ? 'instant' : 'fade-in';

        switch (this.state) {
            case 'START':
                container.innerHTML = `
                    <h1>Visual Audio Stroop Task</h1>
                    <p class="description">인지 조절 능력을 측정하는 검사입니다.<br>최대한 빠르고 정확하게 응답해 주세요.</p>
                    <button class="primary" id="btn-start">검사 시작하기</button>
                `;
                setTimeout(() => {
                    const btn = document.getElementById('btn-start');
                    if (btn) btn.onclick = () => this.setState('BUTTON_MENU');
                }, 0);
                break;

            case 'AUDIO_MENU':
                container.innerHTML = `
                    <h1>2. 검사 모드 선택</h1>
                    <p class="description">글자 색에 해당하는 버튼을 누르세요.</p>
                    <div class="menu-grid">
                        ${CONFIG.BLOCKS.map((block, idx) => `
                            <div class="menu-card" data-idx="${idx}">
                                <div class="icon">${block.icon}</div>
                                <h3>${block.title}</h3>
                                <p>${block.desc}</p>
                            </div>
                        `).join('')}
                    </div>
                    <button class="primary" style="margin-top: 2rem; background: #475569;" id="btn-back">뒤로 가기</button>
                `;
                setTimeout(() => {
                    const cards = document.querySelectorAll('.menu-card');
                    cards.forEach(card => {
                        card.onclick = () => {
                            this.currentBlockIdx = parseInt(card.dataset.idx);
                            this.setState('COLOR_COUNT_MENU');
                        };
                    });
                    document.getElementById('btn-back').onclick = () => this.setState('BUTTON_MENU');
                }, 0);
                break;

            case 'BUTTON_MENU':
                container.innerHTML = `
                    <h1>1. 버튼 유형 선택</h1>
                    <p class="description">응답 시 사용할 버튼의 형태를 선택해 주세요.</p>
                    <div class="menu-grid">
                        <div class="menu-card" data-type="text">
                            <div class="icon">🔤</div>
                            <h3>텍스트형 버튼</h3>
                            <p>글자만 적힌 버튼입니다.</p>
                            <div class="button-preview">
                                <img src="버튼사진/텍스트/약병_파랑_글자.svg" style="width: 60px;">
                            </div>
                        </div>
                        <div class="menu-card" data-type="color">
                            <div class="icon">🎨</div>
                            <h3>색상형 버튼</h3>
                            <p>색깔만 있는 버튼입니다.</p>
                            <div class="button-preview">
                                <img src="버튼사진/텍스트/약병_파랑.svg" style="width: 60px;">
                            </div>
                        </div>
                    </div>
                    <button class="primary" style="margin-top: 2rem; background: #475569;" id="btn-back">뒤로 가기</button>
                `;
                setTimeout(() => {
                    const cards = document.querySelectorAll('.menu-card');
                    cards.forEach(card => {
                        card.onclick = () => {
                            this.selectedButtonType = card.dataset.type;
                            this.setState('AUDIO_MENU');
                        };
                    });
                    document.getElementById('btn-back').onclick = () => this.setState('START');
                }, 0);
                break;

            case 'COLOR_COUNT_MENU':
                container.innerHTML = `
                    <h1>3. 자극 색상 수 선택</h1>
                    <p class="description">검사에 사용될 색깔의 개수를 선택해 주세요.</p>
                    <div class="menu-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
                        ${[2, 3, 4, 5, 6].map(count => `
                            <div class="menu-card" data-count="${count}">
                                <div class="icon">${count}</div>
                                <h3>색 ${count}개</h3>
                                <div class="color-preview-chips" style="display: flex; gap: 4px; margin-top: 10px;">
                                    ${COLORS.slice(0, count).map(c => `
                                        <div style="width: 15px; height: 15px; border-radius: 50%; background: ${c.hex}; border: 1px solid rgba(0,0,0,0.1);"></div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <button class="primary" style="margin-top: 2rem; background: #475569;" id="btn-back">뒤로 가기</button>
                `;
                setTimeout(() => {
                    const cards = document.querySelectorAll('.menu-card');
                    cards.forEach(card => {
                        card.onclick = () => {
                            this.selectedColorCount = parseInt(card.dataset.count);
                            this.setState('INSTRUCTIONS');
                        };
                    });
                    document.getElementById('btn-back').onclick = () => this.setState('BUTTON_MENU');
                }, 0);
                break;

            case 'INSTRUCTIONS':
                const block = CONFIG.BLOCKS[this.currentBlockIdx];
                const activeColors = COLORS.slice(0, this.selectedColorCount);
                container.innerHTML = `
                    <h1>${block.title} 지침</h1>
                    <div class="instruction-box">
                        <p class="description">${block.desc}</p>
                        <p class="description highlight">아래의 <b>버튼을 마우스로 클릭</b>하여 최대한 빠르고 정확하게 응답하세요.</p>
                    </div>
                    <div class="response-buttons preview">
                        ${activeColors.map(c => `
                            <div class="color-btn-wrapper">
                                <img src="${this.selectedButtonType === 'text' ? c.imgText : c.imgColor}" class="color-btn-img">
                            </div>
                        `).join('')}
                    </div>
                    <button class="primary" id="btn-begin">준비되었습니다</button>
                    <button class="primary secondary" id="btn-back-button">뒤로 가기</button>
                `;
                setTimeout(() => {
                    document.getElementById('btn-begin').onclick = () => this.startBlock();
                    document.getElementById('btn-back-button').onclick = () => this.setState('COLOR_COUNT_MENU');
                }, 0);
                break;

            case 'TASK':
                const trial = this.trials[this.currentTrialIdx];
                const taskColors = COLORS.slice(0, this.selectedColorCount);
                container.innerHTML = `
                    <div class="stimulus-container">
                        <div class="mode-indicator">
                            현재 모드: ${CONFIG.BLOCKS[this.currentBlockIdx].title} | 색상: ${this.selectedColorCount}개
                        </div>
                        <div class="audio-icon" id="audio-icon">🔊</div>
                        <div class="word-card">
                            <div class="word-display" id="word-display" style="color: transparent;">${trial.text}</div>
                        </div>
                        <div class="response-buttons" id="task-buttons">
                            ${taskColors.map(c => `
                                <div class="color-btn-wrapper" data-ans-key="${c.key}">
                                    <img src="${this.selectedButtonType === 'text' ? c.imgText : c.imgColor}" class="color-btn-img">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                setTimeout(() => {
                    const btns = document.querySelectorAll('.color-btn-wrapper');
                    btns.forEach(btn => {
                        btn.onclick = () => {
                            if (this.canRespond) {
                                this.handleResponse(btn.dataset.ansKey);
                            }
                        };
                    });
                }, 0);
                break;

            case 'FEEDBACK':
                const lastResult = this.results[this.results.length - 1];
                container.innerHTML = `
                    <div class="stimulus-container">
                        <div class="feedback ${lastResult.correct ? 'good' : 'wrong'}">
                            ${lastResult.correct ? '<div class="ring"></div>' : '<div class="cross"></div>'}
                        </div>
                    </div>
                `;
                break;

            case 'RESULTS':
                const correctCount = this.results.filter(r => r.correct).length;
                const validResults = this.results.filter(r => r.correct && r.rt > 0);
                const avgRt = validResults.length > 0
                    ? Math.floor(validResults.reduce((acc, r) => acc + r.rt, 0) / validResults.length)
                    : 0;
                container.innerHTML = `
                    <h1>결과 리포트</h1>
                    <div class="description">${CONFIG.BLOCKS[this.currentBlockIdx].title}</div>
                    <div class="description">
                        버튼 유형: ${this.selectedButtonType === 'text' ? '텍스트형' : '색상형'}<br>
                        색상 수: ${this.selectedColorCount}개<br>
                        정답률: ${Math.round((correctCount / this.trials.length) * 100)}%<br>
                        평균 반응 속도: ${avgRt}ms
                    </div>
                    <button class="primary" id="btn-menu">메뉴로 돌아가기</button>
                `;
                setTimeout(() => {
                    const btn = document.getElementById('btn-menu');
                    if (btn) btn.onclick = () => this.setState('BUTTON_MENU');
                }, 0);
                break;
        }

        this.el.content.appendChild(container);

        if (this.state === 'TASK') {
            this.runTrial();
        }
    }
    startBlock() {
        const blockId = CONFIG.BLOCKS[this.currentBlockIdx].id;
        this.trials = generateTrials(blockId, this.selectedColorCount, CONFIG.TRIAL_COUNT);
        this.currentTrialIdx = 0;
        this.results = [];
        this.canRespond = false; // Reset response flag
        this.setState('TASK');
    }
    async runTrial() {
        const trial = this.trials[this.currentTrialIdx];
        const audioIcon = document.getElementById('audio-icon');
        const wordDisplay = document.getElementById('word-display');
        const currentBlock = CONFIG.BLOCKS[this.currentBlockIdx];
        
        // Reset state for new trial
        this.canRespond = false;
        if (wordDisplay) wordDisplay.style.color = 'transparent';
        if (audioIcon) audioIcon.classList.remove('active');

        if (currentBlock.id === 'COLOR_WITH_AUDIO' && trial.audioText) {
            // Audio 100ms before text
            if (audioIcon) audioIcon.classList.add('active');
            audioSystem.speak(trial.audioText);
            await new Promise(r => setTimeout(r, Math.abs(CONFIG.SOA)));
            if (wordDisplay) wordDisplay.style.color = trial.color;
        } else {
            // No audio or No Audio mode
            if (wordDisplay) wordDisplay.style.color = trial.color;
        }
        
        this.startTime = performance.now();
        this.canRespond = true;

        this.trialTimeout = setTimeout(() => {
            if (this.canRespond) {
                console.log(`[TRIAL ${this.currentTrialIdx + 1}] Timeout - No response`);
                this.recordResponse(null, false);
            }
        }, CONFIG.TRIAL_DURATION_MS);
    }
    handleResponse(key) {
        if (!this.canRespond || this.state !== 'TASK') return;

        // Immediately prevent further responses
        this.canRespond = false;
        clearTimeout(this.trialTimeout);

        const trial = this.trials[this.currentTrialIdx];
        const rt = performance.now() - this.startTime;
        const correct = (key === trial.targetKey);

        // Enhanced Debugging
        const targetColorObj = COLORS.find(c => c.key === trial.targetKey);
        const inputColorObj = COLORS.find(c => c.key === key);
        console.group(`[TRIAL ${this.currentTrialIdx + 1}] Response Log`);
        console.log(`- Word Content: ${trial.text}`);
        console.log(`- Word Color: ${targetColorObj ? targetColorObj.name : 'Unknown'} (${trial.color})`);
        console.log(`- Audio Played: ${trial.audioText || 'None'}`);
        console.log(`- User Input: ${key} (${inputColorObj ? inputColorObj.name : 'Unknown'})`);
        console.log(`- Expected Key: ${trial.targetKey}`);
        console.log(`- Result: ${correct ? '✅ CORRECT' : '❌ WRONG'}`);
        console.log(`- Response Time: ${Math.round(rt)}ms`);
        console.groupEnd();

        this.recordResponse(key, correct, rt);
    }
    recordResponse(key, correct, rt = 0) {
        this.canRespond = false;
        this.results.push({ correct, rt });
        this.setState('FEEDBACK');

        setTimeout(() => {
            this.nextTrial();
        }, CONFIG.FEEDBACK_MS);
    }
    nextTrial() {
        this.currentTrialIdx++;
        if (this.currentTrialIdx < this.trials.length) {
            this.setState('TASK');
        } else {
            this.setState('RESULTS');
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new StroopApp();
});
