document.addEventListener('DOMContentLoaded', () => {
    // DOM Elemek
    const canvas = document.getElementById('dartboard');
    const ctx = canvas.getContext('2d');
    const verticalProgressValue = document.getElementById('vertical-progress-value');
    const horizontalProgressValue = document.getElementById('horizontal-progress-value');
    const playerSetupDiv = document.getElementById('player-setup');
    const scoreboardDiv = document.getElementById('scoreboard');
    const addPlayerButton = document.getElementById('add-player');
    const startGameButton = document.getElementById('start-game');
    const playerInputsDiv = document.getElementById('player-inputs');
    const playerScoresDiv = document.getElementById('player-scores');
    const currentPlayerSpan = document.getElementById('current-player');
    const gameModeSelect = document.getElementById('game-mode-select');
    const remainingThrowsSpan = document.getElementById('remaining-throws');

    // Játékállapot
    let players = [];
    let currentPlayerIndex = 0;
    let throwsLeft = 3;
    let gameMode = 501; // Alapértelmezett játékmód
    let gameRunning = false;
    let aimingState = 'x'; // 'x', 'y', 'done'
    let progressX = 0;
    let progressY = 0;
    let directionX = 1;
    let directionY = 1;
    let speed = 2;

    let thrownDarts = []; // { x, y, playerIndex }
    let scorePopup = null; // { text, x, y }

    // --- UI Kezelés ---

    // Játékos hozzáadása
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

    // Játék indítása
    startGameButton.addEventListener('click', () => {
        // Játékmód beolvasása
        gameMode = parseInt(gameModeSelect.value, 10);

        const colors = ['#3498db', '#e74c3c', '#f1c40f', '#2ecc71']; // Kék, piros, sárga, zöld
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
            updateScoreboard();
            startTurn();
            gameLoop();
        }
    });

    // Ponttábla frissítése
    function updateScoreboard() {
        playerScoresDiv.innerHTML = '';
        players.forEach((player, index) => {
            const playerScoreP = document.createElement('p');
            playerScoreP.innerHTML = `<span>${player.name}:</span> ${player.score}`;
            if (index === currentPlayerIndex) {
                playerScoreP.style.fontWeight = 'bold';
                playerScoreP.style.color = player.color;
            }
            playerScoresDiv.appendChild(playerScoreP);
        });
        if (players[currentPlayerIndex]) {
            const currentPlayer = players[currentPlayerIndex];
            currentPlayerSpan.textContent = currentPlayer.name;
            currentPlayerSpan.style.color = currentPlayer.color;
        }
        remainingThrowsSpan.textContent = throwsLeft;
    }

    // --- Rajzoló Funkciók ---

    function drawDartboard() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const boardRadius = canvas.width / 2 * 0.85; // A tábla sugara (kisebb, mint a vászon)
        const textRadius = boardRadius + 20; // A számok sugara

        // Szektorok és pontok
        const sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
        const colors = ['#000', '#f0d9b5'];

        // Szektorok rajzolása
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 - (Math.PI / 20) - (Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, boardRadius, angle, angle + Math.PI / 10);
            ctx.closePath();
            ctx.fillStyle = colors[i % 2];
            ctx.fill();
            ctx.stroke();
        }

        // Körök rajzolása (a bullseye-t külön kezeljük)
        const rings = [
            { r: boardRadius, color: 'green', width: boardRadius * 0.05 }, // dupla
            { r: boardRadius * 0.6, color: 'red', width: boardRadius * 0.05 },   // tripla
        ];

        rings.forEach(ring => {
             ctx.beginPath();
             ctx.arc(centerX, centerY, ring.r, 0, Math.PI * 2, false);
             ctx.strokeStyle = ring.color;
             ctx.lineWidth = ring.width;
             ctx.stroke();
        });

        // Bullseye kitöltése (a szektorok fölé rajzoljuk)
        // Sima bull
        ctx.beginPath();
        ctx.arc(centerX, centerY, boardRadius * 0.15, 0, Math.PI * 2, false);
        ctx.fillStyle = 'green';
        ctx.fill();
        // Dupla bull
        ctx.beginPath();
        ctx.arc(centerX, centerY, boardRadius * 0.07, 0, Math.PI * 2, false);
        ctx.fillStyle = 'red';
        ctx.fill();


        // Pontszámok kiírása a táblára
        ctx.fillStyle = 'white';
        ctx.font = `bold ${boardRadius * 0.12}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 20; i++) {
            // A szög korrekciója, hogy a szám a szektor közepére essen
            const angle = (i / 20) * Math.PI * 2 - (Math.PI / 2);
            const x = centerX + Math.cos(angle) * textRadius;
            const y = centerY + Math.sin(angle) * textRadius;
            ctx.fillText(sectors[i], x, y);
        }
    }

    function drawCrosshair() {
        if (aimingState === 'done') return;

        // A progress 0-100 -> canvas 0-width/height
        const x = (progressX / 100) * canvas.width;
        const y = (1 - (progressY / 100)) * canvas.height; // Y-t megfordítjuk

        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;

        // Függőleges vonal
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();

        // Vízszintes vonal
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    function drawDarts() {
        thrownDarts.forEach(dart => {
            ctx.beginPath();
            ctx.arc(dart.x, dart.y, 6, 0, Math.PI * 2);
            ctx.fillStyle = players[dart.playerIndex].color;
            ctx.fill();
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }

    function drawScorePopup() {
        if (!scorePopup) return;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.font = 'bold 24px Arial';
        const textWidth = ctx.measureText(scorePopup.text).width;
        ctx.fillRect(scorePopup.x - textWidth / 2 - 10, scorePopup.y - 30, textWidth + 20, 40);

        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(scorePopup.text, scorePopup.x, scorePopup.y - 10);
    }

    // --- Játékmenet ---

    function gameLoop() {
        if (!gameRunning) return;

        // Vászon törlése és újrarajzolása
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawDartboard();
        drawDarts();

        // Progress bar-ok mozgatása
        if (aimingState === 'x') {
            progressX += directionX * speed;
            if (progressX > 100 || progressX < 0) {
                directionX *= -1;
                progressX = Math.max(0, Math.min(100, progressX));
            }
            horizontalProgressValue.style.width = `${progressX}%`;
        } else if (aimingState === 'y') {
            progressY += directionY * speed;
            if (progressY > 100 || progressY < 0) {
                directionY *= -1;
                progressY = Math.max(0, Math.min(100, progressY));
            }
            verticalProgressValue.style.height = `${progressY}%`;
        }

        drawCrosshair();
        drawScorePopup();

        requestAnimationFrame(gameLoop);
    }

    function handleKeyPress(e) {
        if (e.code !== 'Space' || !gameRunning || aimingState === 'done') {
            return;
        }
        e.preventDefault();

        if (aimingState === 'x') {
            aimingState = 'y'; // Váltás Y célzásra
        } else if (aimingState === 'y') {
            aimingState = 'done'; // Célzás vége, dobás
            throwDart();
        }
    }

    function throwDart() {
        const x = (progressX / 100) * canvas.width;
        const y = (1 - (progressY / 100)) * canvas.height;

        thrownDarts.push({ x, y, playerIndex: currentPlayerIndex });

        const { points, type } = getScore(x, y);
        const currentPlayer = players[currentPlayerIndex];
        const originalScore = currentPlayer.score;

        // Visszajelzés a dobásról
        let popupText = `${type.charAt(0).toUpperCase()}${type.slice(1)} ${points}`;
        if (type === 'miss') popupText = "Miss!";
        if (type === 'double' && points === 50) popupText = "BULLSEYE!";

        scorePopup = { text: popupText, x: x, y: y - 20 };
        setTimeout(() => scorePopup = null, 1000); // 1 másodperc múlva eltűnik

        currentPlayer.score -= points;

        // 1. Győzelem ellenőrzése
        if (currentPlayer.score === 0 && type === 'double') {
            updateScoreboard();
            setTimeout(() => {
                alert(`${currentPlayer.name} nyert!`);
                gameRunning = false;
            }, 100);
            return;
        }

        // 2. Bust ellenőrzése
        if (currentPlayer.score < 2 || (currentPlayer.score === 0 && type !== 'double')) {
            // Bust! Visszaállítjuk a pontszámot és a körnek vége.
            currentPlayer.score = originalScore;
            throwsLeft = 0;
        } else {
            throwsLeft--;
        }

        updateScoreboard();

        if (throwsLeft === 0) {
            // Következő játékos jön
            setTimeout(() => {
                currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
                startTurn();
            }, 2000); // 2 másodperc a következő kör előtt
        } else {
            // Következő dobás ugyanannak a játékosnak
            setTimeout(startThrow, 1000);
        }
    }

    function getScore(x, y) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const boardRadius = canvas.width / 2 * 0.85; // Ugyanaz a sugár, mint a rajzolásnál

        const dx = x - centerX;
        const dy = y - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const result = { points: 0, type: 'miss' };

        // Táblán kívül
        if (dist > boardRadius) return result;

        // Bullseye
        if (dist <= boardRadius * 0.07) { // Dupla bull
            result.points = 50;
            result.type = 'double';
            return result;
        }
        if (dist <= boardRadius * 0.15) { // Sima bull
            result.points = 25;
            result.type = 'single';
            return result;
        }

        // Szektor meghatározása
        let angle = Math.atan2(dy, dx) + Math.PI / 20 + Math.PI / 2;
        if (angle < 0) angle += Math.PI * 2;
        const sectorIndex = Math.floor((angle * 10) / Math.PI) % 20;
        const sectors = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
        let baseScore = sectors[sectorIndex];
        result.points = baseScore;
        result.type = 'single';

        // Multiplikátorok
        // Dupla gyűrű (a legkülső)
        if (dist > boardRadius * 0.95 && dist <= boardRadius) {
            result.points = baseScore * 2;
            result.type = 'double';
        }
        // Tripla gyűrű
        else if (dist > boardRadius * 0.55 && dist <= boardRadius * 0.6) {
            result.points = baseScore * 3;
            result.type = 'triple';
        }

        return result;
    }

    function startTurn() {
        throwsLeft = 3;
        thrownDarts = []; // Dobások törlése minden kör elején
        updateScoreboard();
        startThrow();
    }

    function startThrow() {
        progressX = 50;
        progressY = 50;
        aimingState = 'x';
        updateScoreboard();
    }

    // --- Kezdeti beállítás ---
    document.addEventListener('keydown', handleKeyPress);
    drawDartboard();
});