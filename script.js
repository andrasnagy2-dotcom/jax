document.addEventListener('DOMContentLoaded', () => {
    // DOM Elemek
    const canvas = document.getElementById('dartboard');
    const ctx = canvas.getContext('2d');
    const verticalProgressBar = document.getElementById('vertical-progress-bar');
    const verticalProgressValue = document.getElementById('vertical-progress-value');
    const horizontalProgressBar = document.getElementById('horizontal-progress-bar');
    const horizontalProgressValue = document.getElementById('horizontal-progress-value');
    const playerSetupDiv = document.getElementById('player-setup');
    const scoreboardDiv = document.getElementById('scoreboard');
    const addPlayerButton = document.getElementById('add-player');
    const startGameButton = document.getElementById('start-game');
    const playerInputsDiv = document.getElementById('player-inputs');
    const playerScoresDiv = document.getElementById('player-scores');
    const gameModeSelect = document.getElementById('game-mode-select');
    const remainingThrowsSpan = document.getElementById('remaining-throws');
    const muteButton = document.getElementById('mute-button');

    // Játékállapot
    let players = [];
    let currentPlayerIndex = 0;
    let throwsLeft = 3;
    let gameMode = 501;
    let gameRunning = false;
    let aimingState = 'x';
    let progressX = 0, progressY = 0;
    let directionX = 1, directionY = 1;
    let speed = 2;
    let thrownDarts = [];
    let scorePopup = null;
    let isMuted = false;

    // --- Audio Kezelés ---
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (isMuted || !audioCtx) return;

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime); // Hangerő

        switch (type) {
            case 'single':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // A4
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.2);
                break;
            case 'double':
                oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // E5
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
                // Második hang
                setTimeout(() => playSound('single'), 100);
                break;
            case 'triple':
                 oscillator.type = 'triangle';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.4);
                 // További hangok
                setTimeout(() => playSound('single'), 100);
                setTimeout(() => playSound('single'), 200);
                break;
            case 'bullseye':
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(523, audioCtx.currentTime); // C5
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.5);
                break;
            case 'miss':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(110, audioCtx.currentTime); // A2
                gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.3);
                break;
            case 'win':
                // Egyszerű dallam
                playSoundNote(880, 0); playSoundNote(1046, 150); playSoundNote(1318, 300);
                return; // A switch utáni start/stop nem kell
            case 'bust':
                oscillator.type = 'square';
                oscillator.frequency.setValueAtTime(200, audioCtx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
                break;
            default:
                return; // Ismeretlen típus esetén ne csináljon semmit
        }

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 1);
    }

    // Segédfüggvény a dallamokhoz
    function playSoundNote(frequency, startTime) {
        if (isMuted || !audioCtx) return;
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime + startTime / 1000);
        gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + (startTime + 100) / 1000);
        oscillator.start(audioCtx.currentTime + startTime / 1000);
        oscillator.stop(audioCtx.currentTime + (startTime + 150) / 1000);
    }

    // --- Dinamikus Méretezés ---
    function setProgressbarSizes() {
        // A tábla valós, kirajzolt átmérőjének kiszámítása a számokkal együtt,
        // hogy a progress bar-ok tökéletesen illeszkedjenek.
        const baseRadius = (canvas.width / 2) * boardConfig.baseRadiusFactor;
        const textRadius = baseRadius + 20; // A számok középpontjának sugara
        const fontSize = baseRadius * 0.12; // A betűméret, ahogy a drawDartboard-ban van

        // A teljes átmérő a számok külső széléig tart.
        // Mivel a textBaseline 'middle', a betűmagasság felét kell hozzáadni.
        const totalDiameter = (textRadius + (fontSize / 2)) * 2;

        horizontalProgressBar.style.width = `${totalDiameter}px`;
        verticalProgressBar.style.height = `${totalDiameter}px`;
    }

    // --- Központi Konfiguráció ---
    const boardConfig = {
        sectors: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5],
        baseRadiusFactor: 0.85,
        rings: {
            double:     { outer: 1.00, inner: 0.95, color1: '#d22', color2: '#292' },
            triple:     { outer: 0.60, inner: 0.55, color1: '#d22', color2: '#292' },
            bull:       { outer: 0.15, inner: 0.07, color: '#292' },
            doubleBull: { outer: 0.07, inner: 0.00, color: '#d22' }
        }
    };

    // --- UI Kezelés ---
    addPlayerButton.addEventListener('click', () => {
        const playerCount = playerInputsDiv.children.length;
        if (playerCount < 4) {
            const newInput = document.createElement('input');
            newInput.type = 'text';
            newInput.placeholder = `${playerCount + 1}. Játékos neve`;
            newInput.value = `Player ${playerCount + 1}`;
            playerInputsDiv.appendChild(newInput);
        }
    });

    muteButton.addEventListener('click', () => {
        // A böngészők korlátozzák az automatikus audio lejátszást.
        // Az első felhasználói interakcióra (kattintás) kell elindítani/folytatni a kontextust.
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        isMuted = !isMuted;
        muteButton.textContent = isMuted ? 'Hang be' : 'Némítás';
        muteButton.classList.toggle('muted', isMuted);
    });

    startGameButton.addEventListener('click', () => {
        gameMode = parseInt(gameModeSelect.value, 10);
        const colors = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71'];
        const nameInputs = playerInputsDiv.getElementsByTagName('input');
        players = Array.from(nameInputs).map((input, index) => ({
            name: input.value || `Player ${index + 1}`,
            score: gameMode,
            color: colors[index % colors.length]
        }));
        if (players.length > 0) {
            playerSetupDiv.style.display = 'none';
            scoreboardDiv.style.display = 'block';
            gameRunning = true;
            startTurn();
            gameLoop();
        }
    });

    function updateScoreboard() {
        playerScoresDiv.innerHTML = '';
        players.forEach((player, index) => {
            const p = document.createElement('p');
            p.innerHTML = `<span>${player.name}:</span> ${player.score}`;
            if (index === currentPlayerIndex) {
                p.style.fontWeight = 'bold';
                p.style.color = player.color;
            }
            playerScoresDiv.appendChild(p);
        });
        remainingThrowsSpan.textContent = throwsLeft;
    }

    // --- Rajzoló Funkciók ---
    function drawDartboard() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = (canvas.width / 2) * boardConfig.baseRadiusFactor;
        const textRadius = baseRadius + 20;

        // Szektorok és váltakozó színű gyűrűk
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 - (Math.PI / 20) - (Math.PI / 2);
            const sectorColor = i % 2 === 0 ? '#000' : '#f0d9b5';
            const ringColor = i % 2 === 0 ? boardConfig.rings.double.color1 : boardConfig.rings.double.color2;

            // Fő szektor
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, baseRadius, angle, angle + Math.PI / 10);
            ctx.closePath();
            ctx.fillStyle = sectorColor;
            ctx.fill();

            // Dupla gyűrű szegmens
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, baseRadius * boardConfig.rings.double.outer, angle, angle + Math.PI / 10);
            ctx.arc(centerX, centerY, baseRadius * boardConfig.rings.double.inner, angle + Math.PI / 10, angle, true);
            ctx.closePath();
            ctx.fillStyle = ringColor;
            ctx.fill();

            // Tripla gyűrű szegmens
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, baseRadius * boardConfig.rings.triple.outer, angle, angle + Math.PI / 10);
            ctx.arc(centerX, centerY, baseRadius * boardConfig.rings.triple.inner, angle + Math.PI / 10, angle, true);
            ctx.closePath();
            ctx.fillStyle = ringColor;
            ctx.fill();
        }

        // Bullseye (kitöltéssel)
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * boardConfig.rings.bull.outer, 0, 2 * Math.PI);
        ctx.fillStyle = boardConfig.rings.bull.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * boardConfig.rings.doubleBull.outer, 0, 2 * Math.PI);
        ctx.fillStyle = boardConfig.rings.doubleBull.color;
        ctx.fill();

        // Számok
        ctx.fillStyle = 'white';
        ctx.font = `bold ${baseRadius * 0.12}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 - (Math.PI / 2);
            const x = centerX + Math.cos(angle) * textRadius;
            const y = centerY + Math.sin(angle) * textRadius;
            ctx.fillText(boardConfig.sectors[i], x, y);
        }
    }

    function drawCrosshair() {
        // A célkereszt a felhasználói kérés alapján el lett távolítva a nehézség növelése érdekében.
    }

    function drawDarts() {
        const crossSize = 8; // A kereszt mérete
        ctx.strokeStyle = '#39FF14'; // Neon zöld szín
        ctx.lineWidth = 2;

        thrownDarts.forEach(dart => {
            // Vízszintes vonal
            ctx.beginPath();
            ctx.moveTo(dart.x - crossSize, dart.y);
            ctx.lineTo(dart.x + crossSize, dart.y);
            ctx.stroke();

            // Függőleges vonal
            ctx.beginPath();
            ctx.moveTo(dart.x, dart.y - crossSize);
            ctx.lineTo(dart.x, dart.y + crossSize);
            ctx.stroke();
        });
    }

    function drawScorePopup() {
        if (!scorePopup) return;
        ctx.font = 'bold 24px Arial';
        const textWidth = ctx.measureText(scorePopup.text).width;
        const popupWidth = textWidth + 20;
        const popupHeight = 40;

        let x = scorePopup.x - popupWidth / 2;
        let y = scorePopup.y - popupHeight - 15;

        // Dinamikus igazítás, hogy a vásznon belül maradjon
        if (x < 5) x = 5;
        if (x + popupWidth > canvas.width - 5) x = canvas.width - popupWidth - 5;
        if (y < 5) y = 5;
        if (y + popupHeight > canvas.height - 5) y = canvas.height - popupHeight - 5;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x, y, popupWidth, popupHeight);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scorePopup.text, x + popupWidth / 2, y + popupHeight / 2);
    }

    // --- Játékmenet ---
    function gameLoop() {
        if (!gameRunning) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawDartboard();
        drawDarts();
        if (aimingState === 'x') {
            progressX += directionX * speed;
            if (progressX > 100 || progressX < 0) directionX *= -1;
            progressX = Math.max(0, Math.min(100, progressX));
            horizontalProgressValue.style.left = `calc(${progressX}% - 1.5px)`;
        } else if (aimingState === 'y') {
            progressY += directionY * speed;
            if (progressY > 100 || progressY < 0) directionY *= -1;
            progressY = Math.max(0, Math.min(100, progressY));
            verticalProgressValue.style.bottom = `calc(${progressY}% - 1.5px)`;
        }
        drawCrosshair();
        drawScorePopup();
        requestAnimationFrame(gameLoop);
    }

    function handleKeyPress(e) {
        if (e.code !== 'Space' || !gameRunning || aimingState === 'done') return;
        e.preventDefault();
        if (aimingState === 'x') aimingState = 'y';
        else if (aimingState === 'y') {
            aimingState = 'done';
            throwDart();
        }
    }

    function throwDart() {
        const x = (progressX / 100) * canvas.width;
        const y = (1 - (progressY / 100)) * canvas.height;
        thrownDarts.push({ x, y, playerIndex: currentPlayerIndex });

        const { points, type } = getScore(x, y);

        // Hang lejátszása a találat típusa alapján
        if (points === 50) {
            playSound('bullseye');
        } else if (type !== 'miss') {
            playSound(type);
        } else {
            playSound('miss');
        }

        const currentPlayer = players[currentPlayerIndex];
        const originalScore = currentPlayer.score;
        const newScore = originalScore - points;

        let popupText = '';
        let isBust = false;

        if (newScore === 0 && type === 'double') {
            currentPlayer.score = 0;
            popupText = `WINNER!`;
            gameRunning = false;
            playSound('win');
        } else if (newScore < 2 || (newScore === 0 && type !== 'double')) {
            isBust = true;
            popupText = `Bust! (${points}) - Dupla kell a végén!`;
            throwsLeft = 0;
            playSound('bust');
        } else {
            currentPlayer.score = newScore;
            popupText = `${type.charAt(0).toUpperCase()}${type.slice(1)} ${points}`;
            if (points === 50) popupText = 'BULLSEYE!';
            throwsLeft--;
        }

        scorePopup = { text: popupText, x: x, y: y };
        setTimeout(() => scorePopup = null, isBust || !gameRunning ? 2000 : 1200);

        updateScoreboard();

        if (!gameRunning) {
            setTimeout(() => alert(`${currentPlayer.name} nyert!`), 100);
            return;
        }

        if (throwsLeft === 0) {
            setTimeout(() => {
                currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
                startTurn();
            }, 2000);
        } else {
            setTimeout(startThrow, 1000);
        }
    }

    function getScore(x, y) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = (canvas.width / 2) * boardConfig.baseRadiusFactor;
        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const R = (rFactor) => rFactor * baseRadius;

        if (dist > R(boardConfig.rings.double.outer)) {
            return { points: 0, type: 'miss' };
        }

        if (dist <= R(boardConfig.rings.doubleBull.outer)) {
            return { points: 50, type: 'double' };
        }
        if (dist <= R(boardConfig.rings.bull.outer)) {
            return { points: 25, type: 'single' };
        }

        let angle = Math.atan2(dy, dx) + Math.PI / 20 + Math.PI / 2;
        if (angle < 0) angle += 2 * Math.PI;
        const sectorIndex = Math.floor((angle * 10) / Math.PI) % 20;
        const baseScore = boardConfig.sectors[sectorIndex];

        let points = baseScore;
        let type = 'single';

        if (dist > R(boardConfig.rings.double.inner) && dist <= R(boardConfig.rings.double.outer)) {
            points = baseScore * 2;
            type = 'double';
        } else if (dist > R(boardConfig.rings.triple.inner) && dist <= R(boardConfig.rings.triple.outer)) {
            points = baseScore * 3;
            type = 'triple';
        }

        return { points, type };
    }

    function startTurn() {
        throwsLeft = 3;
        thrownDarts = [];
        updateScoreboard();
        startThrow();
    }

    function startThrow() {
        progressX = 50;
        progressY = 50;
        aimingState = 'x';
        updateScoreboard();
    }

    // Kezdeti beállítás
    document.addEventListener('keydown', handleKeyPress);
    window.addEventListener('resize', setProgressbarSizes);
    setProgressbarSizes(); // Első méretezés betöltéskor
    drawDartboard();
});