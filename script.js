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
    let gameMode = 501;
    let gameRunning = false;
    let aimingState = 'x';
    let progressX = 0, progressY = 0;
    let directionX = 1, directionY = 1;
    let speed = 2;
    let thrownDarts = [];
    let scorePopup = null;

    // --- Központi Konfiguráció ---
    const boardConfig = {
        sectors: [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5],
        baseRadiusFactor: 0.85,
        rings: {
            double:     { outer: 1.00, inner: 0.95, color: '#d22' },
            triple:     { outer: 0.60, inner: 0.55, color: '#d22' },
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
        if (players[currentPlayerIndex]) {
            const p = players[currentPlayerIndex];
            currentPlayerSpan.textContent = p.name;
            currentPlayerSpan.style.color = p.color;
        }
        remainingThrowsSpan.textContent = throwsLeft;
    }

    // --- Rajzoló Funkciók ---
    function drawDartboard() {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const baseRadius = (canvas.width / 2) * boardConfig.baseRadiusFactor;
        const textRadius = baseRadius + 20;

        // Szektorok
        for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2 - (Math.PI / 20) - (Math.PI / 2);
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, baseRadius, angle, angle + Math.PI / 10);
            ctx.closePath();
            ctx.fillStyle = i % 2 === 0 ? '#000' : '#f0d9b5';
            ctx.fill();
        }

        // Gyűrűk (széles, kitöltött)
        Object.values(boardConfig.rings).forEach(ring => {
             if (ring === boardConfig.rings.bull || ring === boardConfig.rings.doubleBull) return;
             ctx.beginPath();
             ctx.arc(centerX, centerY, baseRadius * ring.outer, 0, 2 * Math.PI, false);
             ctx.arc(centerX, centerY, baseRadius * ring.inner, 0, 2 * Math.PI, true);
             ctx.fillStyle = ring.color;
             ctx.fill();
        });

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
        if (aimingState === 'done') return;
        const x = (progressX / 100) * canvas.width;
        const y = (1 - (progressY / 100)) * canvas.height;
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    function drawDarts() {
        thrownDarts.forEach(dart => {
            ctx.beginPath(); ctx.arc(dart.x, dart.y, 6, 0, 2 * Math.PI);
            ctx.fillStyle = players[dart.playerIndex].color;
            ctx.fill(); ctx.strokeStyle = 'black'; ctx.lineWidth = 2; ctx.stroke();
        });
    }

    function drawScorePopup() {
        if (!scorePopup) return;
        ctx.font = 'bold 24px Arial';
        const textWidth = ctx.measureText(scorePopup.text).width;
        const popupWidth = textWidth + 20;
        const popupHeight = 40;

        let x = scorePopup.x - popupWidth / 2;
        let y = scorePopup.y - popupHeight - 15; // A nyíl fölé pozícionáljuk

        // Dinamikus igazítás, hogy a vásznon belül maradjon
        if (x < 5) x = 5;
        if (x + popupWidth > canvas.width - 5) x = canvas.width - popupWidth - 5;
        if (y < 5) y = 5;

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
            horizontalProgressValue.style.width = `${progressX}%`;
        } else if (aimingState === 'y') {
            progressY += directionY * speed;
            if (progressY > 100 || progressY < 0) directionY *= -1;
            progressY = Math.max(0, Math.min(100, progressY));
            verticalProgressValue.style.height = `${progressY}%`;
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
        const currentPlayer = players[currentPlayerIndex];
        const originalScore = currentPlayer.score;
        const newScore = originalScore - points;

        let popupText = '';
        let isBust = false;

        if (newScore === 0 && type === 'double') {
            currentPlayer.score = 0;
            popupText = `WINNER!`;
            gameRunning = false;
        } else if (newScore < 2 || (newScore === 0 && type !== 'double')) {
            isBust = true;
            popupText = `Bust! (${points}) - Dupla kell a végén!`;
            throwsLeft = 0;
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
    drawDartboard();
});