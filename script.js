// --- CONSTANTS ---
const SAVE_KEY = 'telegramQuestProgress_v2';

// --- GLOBAL STATE ---
let quests = [
    {
        id: 'forest-adventure',
        title: 'Тишина.exe',
        coverImage: 'https://placehold.co/300x400/0a0a0a/1a1a1a?text=01',
        isDev: false,
        totalEndings: 5 
    },
    {
        id: 'space-odyssey',
        title: 'QUEST_02',
        coverImage: 'https://placehold.co/300x400/0a0a0a/1a1a1a?text=02',
        isDev: true,
        totalEndings: 4
    },
    {
        id: 'castle-mystery',
        title: 'QUEST_03',
        coverImage: 'https://placehold.co/300x400/0a0a0a/1a1a1a?text=03',
        isDev: true,
        totalEndings: 1
    },
    {
        id: 'pirate-treasure',
        title: 'QUEST_04',
        coverImage: 'https://placehold.co/300x400/0a0a0a/1a1a1a?text=04',
        isDev: true,
        totalEndings: 8
    }
];

let currentQuestId = null;
let currentQuestData = null;
let progress = {};
let currentMenuTab = 'all'; // 'all' or 'saved'

// --- TELEGRAM API ---
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

// --- DOM ELEMENTS ---
const app = document.getElementById('app');
const menuScreen = document.getElementById('menu-screen');
const gameScreen = document.getElementById('game-screen');
const questListContainer = document.getElementById('quest-list');
const backgroundImage = document.getElementById('background-image');
const storyText = document.getElementById('story-text');
const choicesContainer = document.getElementById('choices');
const exitToMenuBtn = document.getElementById('exit-to-menu-btn');
const navAll = document.getElementById('nav-all');
const navSaved = document.getElementById('nav-saved');
const searchInput = document.getElementById('search-input');
const gameUI = document.querySelector('.game-ui');
const gameBackground = document.querySelector('.game-background');

// --- HELPER FUNCTIONS ---

/**
 * Загружает данные прогресса из localStorage.
 */
function loadProgress() {
    const savedProgressJSON = localStorage.getItem(SAVE_KEY);
    return savedProgressJSON ? JSON.parse(savedProgressJSON) : { quests: {}, bookmarks: [] };
}

/**
 * Сохраняет данные прогресса в localStorage.
 */
function saveProgress() {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

/**
 * Отображает список квестов в меню.
 */
function displayQuests() {
    const savedProgress = loadProgress();
    const searchTerm = searchInput.value.toLowerCase();
    
    // 1. Сортируем квесты (для вкладки "Сохраненные")
    const sortedQuests = [...quests].sort((a, b) => {
        const questA = savedProgress.quests[a.id] || {};
        const questB = savedProgress.quests[b.id] || {};
        return (questB.lastPlayed || 0) - (questA.lastPlayed || 0);
    });

    // 2. Фильтруем квесты
    const filteredQuests = sortedQuests.filter(quest => {
        // Фильтр по названию
        const matchesSearch = quest.title.toLowerCase().includes(searchTerm);
        if (!matchesSearch) return false;

        // Фильтр по вкладкам
        if (currentMenuTab === 'all') {
            return true; // Показываем все (с учетом поиска)
        }
        if (currentMenuTab === 'saved') {
            return progress.bookmarks.includes(quest.id); // Показываем только сохраненные
        }
        return true;
    });

    // 3. Отрисовываем квесты
    questListContainer.innerHTML = '';
    if (filteredQuests.length === 0) {
        questListContainer.innerHTML = `<p class="search-empty">Ничего не найдено.</p>`;
    }

    filteredQuests.forEach(quest => {
        const questProgress = savedProgress.quests[quest.id] || {};
        const isBookmarked = progress.bookmarks.includes(quest.id);

        const card = document.createElement('div');
        card.className = `quest-card ${quest.isDev ? 'dev' : ''}`;
        
        let badgesHTML = '';

        // Статус "В разработке" (имеет приоритет)
        if (quest.isDev) {
            badgesHTML += `<div class="dev-badge">DEV</div>`;
        } else {
            // Статус прохождения
            switch (questProgress.status) {
                case 'victory':
                    badgesHTML += `<div class="status-badge victory">ЗАВЕРШЕНО</div>`;
                    break;
                case 'defeat':
                    badgesHTML += `<div class="status-badge defeat">ПРОВАЛ</div>`;
                    break;
                default:
                    // Статус "Продолжить"
                    if (questProgress.currentScene) {
                        badgesHTML += `<div class="continue-badge">ПРОДОЛЖИТЬ</div>`;
                    }
            }
        }

        // Счетчик концовок
        if (quest.totalEndings && quest.totalEndings > 0) {
            const foundEndings = questProgress.foundEndings ? questProgress.foundEndings.length : 0;
            badgesHTML += `<div class="endings-counter">${foundEndings} / ${quest.totalEndings}</div>`;
        }

        // Иконка закладки
        badgesHTML += `
            <button class="bookmark-button ${isBookmarked ? 'active' : ''}" data-quest-id="${quest.id}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                </svg>
            </button>
        `;

        card.innerHTML = `
            <div class="cover-image-container">
                <img src="${quest.coverImage}" alt="${quest.title}" class="cover-image">
                ${badgesHTML}
            </div>
            <div class="card-content">
                <h2>${quest.title}</h2>
            </div>
        `;

        // Добавляем клик только если не в разработке
        if (!quest.isDev) {
            card.querySelector('.cover-image-container').addEventListener('click', () => {
                startQuest(quest);
            });
        }
        
        questListContainer.appendChild(card);
    });

    // Навешиваем обработчики на иконки закладок
    document.querySelectorAll('.bookmark-button').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation(); // Не запускать квест при клике на закладку
            toggleBookmark(button.dataset.questId);
        });
    });
}

/**
 * Переключает экраны (меню / игра).
 */
function switchScreen(screen) {
    if (screen === 'menu') {
        menuScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        // Обновляем список на случай, если изменился статус "Продолжить"
        displayQuests();
    } else {
        menuScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    }
}

/**
 * Начинает квест (загружает данные и показывает рекламу).
 */
function startQuest(quest) {
    if (quest.isDev) return;
    
    // Сообщаем Google, что у нас есть звук (для H5 Ads)
    adConfig({ sound: 'on' });
    
    fetchQuestAndShowAd(quest);
}

/**
 * Шаг 1: Загружает JSON квеста, затем пытается показать рекламу.
 */
async function fetchQuestAndShowAd(quest) {
    const savedProgress = progress.quests[quest.id] || {};
    let loadedQuestData;

    try {
        const response = await fetch(`quests/${quest.id}.json?v=${Date.now()}`);
        if (!response.ok) {
            throw new Error(`Не удалось загрузить квест: ${response.statusText}`);
        }
        loadedQuestData = await response.json();
    } catch (error) {
        console.error(error);
        alert(`Ошибка загрузки квеста. Проверьте консоль.`);
        return;
    }

    // --- НОВАЯ ЛОГИКА С ТАЙМАУТОМ ---
    let adHasFinished = false;

    // 1. Устанавливаем таймер, который запустит игру, если реклама не загрузится
    const adTimeout = setTimeout(() => {
        if (adHasFinished) return; // Реклама уже отработала
        
        adHasFinished = true;
        console.warn('Ad timed out. Starting quest anyway.');
        launchGame(quest, loadedQuestData, savedProgress, 'ad_timeout');
    }, 3000); // 3 секунды ожидания

    // 2. Пытаемся показать рекламу
    adBreak({
        type: 'start',
        name: `start_quest_${quest.id}`,
        beforeAd: () => {
            console.log('Ad break: beforeAd');
            tg.expand(); // Разворачиваем приложение перед рекламой
        },
        afterAd: () => {
            console.log('Ad break: afterAd');
        },
        adBreakDone: (info) => {
            if (adHasFinished) {
                console.log('Ad finished, but quest already started by timeout.');
                return; // Игра уже запущена
            }
            
            clearTimeout(adTimeout); // Отменяем таймер
            adHasFinished = true;
            console.log('Ad break done, starting quest.', info);
            launchGame(quest, loadedQuestData, savedProgress, info.adBreakStatus);
        }
    });
}

/**
 * Шаг 2: Запускает игру (после рекламы или таймаута).
 */
function launchGame(quest, loadedQuestData, savedProgress, adStatus) {
    console.log(`Launching quest: ${quest.id}. Ad status: ${adStatus}`);
    
    currentQuestId = quest.id;
    currentQuestData = loadedQuestData;

    // Обновляем время последнего запуска
    if (!progress.quests[currentQuestId]) {
        progress.quests[currentQuestId] = { foundEndings: [] };
    }
    progress.quests[currentQuestId].lastPlayed = Date.now();
    saveProgress();

    switchScreen('game');

    // Решаем, с какой сцены начать
    if (savedProgress.currentScene && savedProgress.questId === quest.id) {
        renderScene(savedProgress.currentScene);
    } else {
        renderScene(currentQuestData.startScene);
    }
}

/**
 * Отрисовывает игровую сцену.
 */
function renderScene(sceneId) {
    const scene = currentQuestData.scenes[sceneId];
    if (!scene) {
        console.error(`Сцена "${sceneId}" не найдена!`);
        return;
    }

    // 1. Обновляем фон
    backgroundImage.src = scene.backgroundImage;

    // 2. Обновляем текст
    storyText.innerHTML = scene.text;

    // 3. Обновляем выборы
    choicesContainer.innerHTML = '';
    scene.choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = 'choice-button';
        button.innerHTML = `<span class="choice-text">${choice.text}</span><div class="choice-hover-effect"></div>`;
        
        button.addEventListener('click', () => {
            button.blur(); // Убираем фокус с кнопки, чтобы она "потухла"
            
            if (choice.nextScene === 'main_menu') {
                // Проверяем, является ли эта сцена концовкой
                if (scene.isEnding) {
                    updateCompletionStatus(scene);
                }
                goToMainMenu(true); // Завершить квест и очистить прогресс
            } else {
                renderScene(choice.nextScene);
            }
        });
        choicesContainer.appendChild(button);
    });

    // 4. Сохраняем прогресс (текущую сцену)
    if (progress.quests[currentQuestId]) {
        progress.quests[currentQuestId].currentScene = sceneId;
        saveProgress();
    }
}

/**
 * Обновляет статус прохождения квеста (победа/поражение, найденные концовки).
 */
function updateCompletionStatus(scene) {
    if (!progress.quests[currentQuestId]) {
        // Создаем запись, если ее нет (например, квест пройден за один раз)
        progress.quests[currentQuestId] = { foundEndings: [], lastPlayed: Date.now() };
    }
    const questProgress = progress.quests[currentQuestId];

    // 1. Обновляем статус (победа/провал)
    if (scene.endingType === 'victory') {
        questProgress.status = 'victory';
    } else if (scene.endingType === 'defeat') {
        questProgress.status = 'defeat';
    } else {
        // Если тип не указан, но это концовка, считаем нейтральным/победой
        questProgress.status = 'victory';
    }

    // 2. Добавляем УНИКАЛЬНУЮ концовку в список найденных
    if (scene.endingId && !questProgress.foundEndings.includes(scene.endingId)) {
        questProgress.foundEndings.push(scene.endingId);
    }
    
    saveProgress();
}

/**
 * Возвращает в главное меню.
 */
function goToMainMenu(clearQuestProgress) {
    if (clearQuestProgress && currentQuestId && progress.quests[currentQuestId]) {
        // Удаляем только прогресс *этого* квеста (сцену), но оставляем концовки
        delete progress.quests[currentQuestId].currentScene;
        console.log(`Прогресс для ${currentQuestId} очищен.`);
        saveProgress();
    }
    // Если clearQuestProgress = false (нажата кнопка "МЕНЮ"),
    // мы ничего не удаляем, и прогресс остается сохраненным.

    currentQuestId = null;
    currentQuestData = null;
    switchScreen('menu');
}

/**
 * Добавляет или удаляет квест из закладок.
 */
function toggleBookmark(questId) {
    const bookmarkIndex = progress.bookmarks.indexOf(questId);
    if (bookmarkIndex > -1) {
        // Удалить из закладок
        progress.bookmarks.splice(bookmarkIndex, 1);
    } else {
        // Добавить в закладки
        progress.bookmarks.push(questId);
    }
    saveProgress();
    displayQuests(); // Перерисовать меню, чтобы обновить иконки
}

/**
 * Переключает вкладки в меню.
 */
function switchMenuTab(tab) {
    currentMenuTab = tab;
    navAll.classList.toggle('active', tab === 'all');
    navSaved.classList.toggle('active', tab === 'saved');
    displayQuests();
}

/**
 * Скрывает/показывает игровой UI при долгом нажатии.
 */
function setupUIHiding() {
    let pressTimer = null;

    const startPress = (e) => {
        // Не скрывать, если нажатие на кнопку
        if (e.target.closest('button')) {
            return;
        }
        
        e.preventDefault();
        pressTimer = setTimeout(() => {
            gameUI.classList.add('hidden');
        }, 300); // 0.3 секунды для долгого нажатия
    };

    const endPress = (e) => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        gameUI.classList.remove('hidden');
    };

    gameBackground.addEventListener('mousedown', startPress);
    gameBackground.addEventListener('mouseup', endPress);
    gameBackground.addEventListener('mouseleave', endPress); // Если убрали палец за пределы

    gameBackground.addEventListener('touchstart', startPress, { passive: false });
    gameBackground.addEventListener('touchend', endPress);
    gameBackground.addEventListener('touchcancel', endPress);
}


// --- INITIALIZATION ---

/**
 * Загружает начальное состояние приложения.
 */
function loadInitialState() {
    progress = loadProgress();
    const savedQuestId = null; // Мы больше не загружаем квест при старте
    
    // Вместо авто-загрузки квеста, просто показываем меню
    displayQuests();
    switchScreen('menu');
}

// --- APP LAUNCH ---
document.addEventListener('DOMContentLoaded', () => {
    // Навигация по вкладкам
    navAll.addEventListener('click', () => switchMenuTab('all'));
    navSaved.addEventListener('click', () => switchMenuTab('saved'));

    // Поиск
    searchInput.addEventListener('input', displayQuests);

    // Кнопка "МЕНЮ" в игре
    exitToMenuBtn.addEventListener('click', () => goToMainMenu(false));

    // Скрытие UI в игре
    setupUIHiding();

    // Загрузка
    loadInitialState();
});

