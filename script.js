document.addEventListener('DOMContentLoaded', () => {

    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const menuScreen = document.getElementById('menu-screen');
    const gameScreen = document.getElementById('game-screen');
    const questListContainer = document.getElementById('quest-list');
    const backgroundImage = document.getElementById('background-image');
    const storyText = document.getElementById('story-text');
    const choicesContainer = document.getElementById('choices');
    const exitToMenuBtn = document.getElementById('exit-to-menu-btn');
    const gameUI = document.querySelector('.game-ui');
    const navAllBtn = document.getElementById('nav-all');
    const navSavedBtn = document.getElementById('nav-saved');
    const searchInput = document.getElementById('search-input');

    const SAVE_KEY = 'telegramQuestSaveData_v5';
    let currentQuestData = null; 
    let currentQuestId = null; 
    let currentMenuTab = 'all';

    const quests = [
        {
            id: 'curseofthethrone',
            title: 'Проклятие Трона',
            description: 'A horror text quest about a person trapped in a void, trying to escape.',
            coverImage: 'assets/covers/output-8.jpg',
            totalEndings: 5
        },
        {
            id: 'ashesofthegrandline', 
            title: 'Пепел Гранд Лайн',
            description: '-',
            coverImage: 'assets/covers/dark-anime-2d-cover-luffy-s-torn-straw-hat-floating-o.jpg',
            totalEndings: 5
        },
        { 
            id: 'lasttide', 
            title: 'Последний Прилив', 
            description: '-',
            coverImage: 'assets/covers/output-93.jpg',
            totalEndings: 5
        },
        { 
            id: 'silence.exe', 
            title: 'Тишина.exe', 
            description: '-',
            coverImage: 'assets/covers/65a6548da4f811f0a086eaba8e646487-1.jpeg',
            isDev: true,
            totalEndings: 5
        },
        { 
            id: 'fracture', 
            title: 'ПЕРЕЛОМ', 
            description: 'A psychedelic text quest about how a crack in a mirror turns into a rift in your consciousness.',
            coverImage: 'assets/covers/1883afbca4dc11f0a4d34e9350978b9a-1.jpeg',
            isDev: true,
            totalEndings: 1
        }
    ];

    function displayQuests() {
        questListContainer.innerHTML = '';
        const savedData = loadData();
        const bookmarkedQuests = savedData?.bookmarkedQuests || [];
        const lastReadTimestamps = savedData?.lastReadTimestamps || {};
        const searchTerm = searchInput.value.toLowerCase().trim();

        // Фильтруем квесты по вкладке и поиску
        let questsToDisplay = quests.filter(quest => {
            const matchesSearch = quest.title.toLowerCase().includes(searchTerm);
            if (!matchesSearch) return false;

            if (currentMenuTab === 'saved') {
                return bookmarkedQuests.includes(quest.id) && !quest.isDev;
            }
            return true;
        });

        // Сортируем сохраненные по дате последнего прочтения
        if (currentMenuTab === 'saved') {
            questsToDisplay.sort((a, b) => {
                const timeA = lastReadTimestamps[a.id] || 0;
                const timeB = lastReadTimestamps[b.id] || 0;
                return timeB - timeA; // Сортировка по убыванию
            });
        }
        
        if (questsToDisplay.length === 0) {
            let message = 'НИЧЕГО НЕ НАЙДЕНО.';
            if (searchTerm === '' && currentMenuTab === 'saved') {
                message = 'ВЫ ЕЩЕ НЕ ДОБАВИЛИ КВЕСТЫ В СОХРАНЕННЫЕ.';
            }
            questListContainer.innerHTML = `<p class="empty-list-message">${message}</p>`;
            return;
        }

        questsToDisplay.forEach(quest => {
            const hasContinue = savedData?.currentProgress?.questId === quest.id;
            const completionData = savedData?.questCompletion?.[quest.id];
            const isBookmarked = bookmarkedQuests.includes(quest.id);
            
            const card = document.createElement('div');
            card.className = `quest-card ${quest.isDev ? 'dev' : ''}`;
            
            let statusBadge = '';
            
            // Статус "В разработке" имеет приоритет
            if (quest.isDev) {
                 statusBadge = '<div class="dev-badge">В РАЗРАБОТКЕ</div>';
            } else if (hasContinue) {
                statusBadge = '<div class="continue-badge">ПРОДОЛЖИТЬ</div>';
            } else if (completionData) {
                if (completionData.status === 'failed') {
                    statusBadge = '<div class="failed-badge">ПРОВАЛ</div>';
                } else if (completionData.status === 'completed') {
                    statusBadge = '<div class="completed-badge">ЗАВЕРШЕНО</div>';
                }
            }

            let endingsCounterHTML = '';
            if (quest.totalEndings && quest.totalEndings > 0) {
                const endingsFoundCount = completionData?.endingsFound?.length || 0;
                endingsCounterHTML = `<div class="endings-counter">КОНЦОВКИ: ${endingsFoundCount}/${quest.totalEndings}</div>`;
            }

            const bookmarkButtonHTML = `
                <button class="bookmark-button ${isBookmarked ? 'bookmarked' : ''}" data-quest-id="${quest.id}">
                    <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                    </svg>
                </button>
            `;

            card.innerHTML = `
                <div class="card-bg-pattern"></div>
                <div class="cover-image-container">
                    <img src="${quest.coverImage}" alt="${quest.title}" class="cover-image">
                    ${!quest.isDev ? bookmarkButtonHTML : ''}
                    ${statusBadge}
                    <div class="hover-overlay"></div>
                </div>
                <div class="card-content">
                    ${endingsCounterHTML}
                    <h2>${quest.title}</h2>
                </div>
            `;
            
            if (!quest.isDev) {
                card.addEventListener('click', (e) => {
                    if (e.target.closest('.bookmark-button')) return;
                    startQuest(quest, hasContinue ? savedData.currentProgress.sceneId : null);
                });
            }

            questListContainer.appendChild(card);
        });
        
        document.querySelectorAll('.bookmark-button').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleBookmark(button.dataset.questId);
            });
        });
    }

    function toggleBookmark(questId) {
        const savedData = loadData();
        const index = savedData.bookmarkedQuests.indexOf(questId);
        if (index > -1) {
            savedData.bookmarkedQuests.splice(index, 1);
        } else {
            savedData.bookmarkedQuests.push(questId);
        }
        // Обновляем метку времени, чтобы квест "поднялся"
        savedData.lastReadTimestamps[questId] = Date.now();
        saveData(savedData);
        displayQuests();
    }

    function switchScreen(screen) {
        if (screen === 'menu') {
            menuScreen.classList.remove('hidden');
            gameScreen.classList.add('hidden');
        } else {
            menuScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
        }
    }

    async function startQuest(quest, sceneIdToLoad) {
        if (quest.isDev) return;
        
        // ИЗМЕНЕНО: Эта строка удалена, т.к. `sound: 'on'` теперь в <head>
        // adConfig({ sound: 'on' });

        // Это функция, которая реально запускает игру.
        const loadGame = async () => {
            currentQuestId = quest.id;

            // Обновляем метку времени для сортировки
            const savedData = loadData();
            savedData.lastReadTimestamps[quest.id] = Date.now();
            saveData(savedData);

            try {
                const response = await fetch(`quests/${quest.id}.json?v=${Date.now()}`);
                if (!response.ok) throw new Error('Network response was not ok');
                const questData = await response.json();
                currentQuestData = questData;

                switchScreen('game');

                if (sceneIdToLoad) {
                    renderScene(sceneIdToLoad);
                } else {
                    renderScene(currentQuestData.startScene);
                }
            } catch (error) {
                console.error('Failed to load quest data:', error);
                alert('Не удалось загрузить данные квеста. Попробуйте позже.');
            }
        };
        
        let adHasFinished = false;

        // 1. Устанавливаем таймер
        const adTimeout = setTimeout(() => {
            if (adHasFinished) return;
            adHasFinished = true;
            console.warn('Ad timed out. Starting quest anyway.');
            loadGame();
        }, 3000); // 3 секунды ожидания

        // 2. Пытаемся показать рекламу
        adBreak({
            type: 'start',
            name: `start_quest_${quest.id}`,
            beforeAd: () => {
                console.log('Реклама начинается...');
            },
            afterAd: () => {
                 console.log('Реклама (возможно) завершена.');
            },
            // ИЗМЕНЕНО: Обновлен коллбэк в соответствии с вашим примером
            adBreakDone: (p) => {
                if (adHasFinished) return; // Игра уже запущена по таймауту
                
                clearTimeout(adTimeout); // Отменяем таймер
                adHasFinished = true;
                
                // Новый лог из примера
                console.log('breakStatus=', p?.breakStatus, p);
                
                console.log('Рекламный блок завершен, запускаем игру.');
                loadGame();
            }
        });
    }
    
    function renderScene(sceneId) {
        const scene = currentQuestData.scenes[sceneId];
        if (!scene) {
            console.error(`Сцена с ID "${sceneId}" не найдена!`);
            goToMainMenu(true); // Принудительный выход в меню
            return;
        }

        backgroundImage.src = scene.backgroundImage;
        storyText.innerHTML = `<p>${scene.text.replace(/\n/g, '</p><p>')}</p>`;
        choicesContainer.innerHTML = '';

        if (scene.choices && scene.choices.length > 0) {
            scene.choices.forEach(choice => {
                const button = document.createElement('button');
                button.className = 'choice-button';
                button.innerHTML = `<span class="choice-text">${choice.text}</span><div class="choice-hover-effect"></div>`;
                
                button.addEventListener('click', () => {
                    button.blur(); // "Тушим" кнопку
                    
                    if (choice.nextScene === 'main_menu') {
                        if (scene.isEnding) {
                            updateCompletionStatus(scene);
                        }
                        goToMainMenu(true);
                    } else {
                        renderScene(choice.nextScene);
                    }
                });
                choicesContainer.appendChild(button);
            });
        }
        
        // Сохраняем прогресс только если это не конец
        if (!scene.isEnding) {
            saveCurrentProgress(sceneId);
        }
    }
    
    function updateCompletionStatus(endingScene) {
        const savedData = loadData();
        if (!savedData.questCompletion[currentQuestId]) {
            savedData.questCompletion[currentQuestId] = { endingsFound: [] };
        }
        
        const questStats = savedData.questCompletion[currentQuestId];
        questStats.status = endingScene.endingType === 'defeat' ? 'failed' : 'completed';
        
        if (endingScene.endingId && !questStats.endingsFound.includes(endingScene.endingId)) {
            questStats.endingsFound.push(endingScene.endingId);
        }
        saveData(savedData);
    }
    
    function saveData(data) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    }

    function loadData() {
        const savedDataJSON = localStorage.getItem(SAVE_KEY);
        try {
            const data = savedDataJSON ? JSON.parse(savedDataJSON) : {};
            // Инициализация полей, если их нет, для избежания ошибок
            if (!data.bookmarkedQuests) data.bookmarkedQuests = [];
            if (!data.questCompletion) data.questCompletion = {};
            if (!data.lastReadTimestamps) data.lastReadTimestamps = {};
            // data.currentProgress проверяется при загрузке
            return data;
        } catch (e) {
            console.error("Ошибка чтения сохранения:", e);
            localStorage.removeItem(SAVE_KEY);
            return { bookmarkedQuests: [], questCompletion: {}, lastReadTimestamps: {} };
        }
    }

    function saveCurrentProgress(sceneId) {
        const savedData = loadData();
        savedData.currentProgress = {
            questId: currentQuestId,
            sceneId: sceneId
        };
        saveData(savedData);
    }

    async function loadInitialState() {
        // Всегда показываем меню при запуске
        gameScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
        displayQuests();
    }

    function goToMainMenu(isEnding = false) {
        if (isEnding) {
            const savedData = loadData();
            savedData.currentProgress = null; 
            saveData(savedData);
        }
        
        gameScreen.classList.add('hidden');
        menuScreen.classList.remove('hidden');
        currentQuestData = null;
        currentQuestId = null;
        displayQuests();
    }

    function handleNavClick(tab) {
        currentMenuTab = tab;
        navAllBtn.classList.toggle('active', tab === 'all');
        navSavedBtn.classList.toggle('active', tab === 'saved');
        displayQuests();
    }

    // --- Инициализация и обработчики событий ---
    
    exitToMenuBtn.addEventListener('click', () => goToMainMenu(false));
    navAllBtn.addEventListener('click', () => handleNavClick('all'));
    navSavedBtn.addEventListener('click', () => handleNavClick('saved'));
    searchInput.addEventListener('input', displayQuests);

    // Логика скрытия UI по долгому нажатию
    let pressTimer;
    gameScreen.addEventListener('mousedown', (e) => {
        if (e.target.closest('button')) return;
        pressTimer = setTimeout(() => gameUI.classList.add('hidden-ui'), 200);
    });
    gameScreen.addEventListener('mouseup', () => {
        clearTimeout(pressTimer);
        gameUI.classList.remove('hidden-ui');
    });
    gameScreen.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
        gameUI.classList.remove('hidden-ui');
    });
    gameScreen.addEventListener('touchstart', (e) => {
        if (e.target.closest('button')) return;
        e.preventDefault();
        pressTimer = setTimeout(() => gameUI.classList.add('hidden-ui'), 200);
    }, { passive: false });
    gameScreen.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
        gameUI.classList.remove('hidden-ui');
    });

    loadInitialState();
});

