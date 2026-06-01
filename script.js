const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI elements
const scoreEl = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State Variables
let gameActive = false;
let score = 0;
let keys = {};
let guards = [];

// Player configuration
const player = {
    x: 100,
    y: 300,
    radius: 12,
    speed: 3.5,
    angle: 0
};

// Input Handlers
window.addEventListener('keydown', (e) => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

// Static Obstacles / Walls map design
const walls = [
    { x: 250, y: 0, width: 40, height: 200 },
    { x: 250, y: 400, width: 40, height: 200 },
    { x: 500, y: 150, width: 40, height: 300 }
];

// Setup & Event Listeners
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);

function startGame() {
    score = 0;
    scoreEl.innerText = score;
    player.x = 80;
    player.y = 300;
    player.angle = 0;
    
    // Spawn initial guards
    spawnGuards();
    
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    gameActive = true;
    
    // Begin Main Game Loop
    requestAnimationFrame(gameLoop);
}

function spawnGuards() {
    guards = [
        {
            x: 400,
            y: 100,
            radius: 12,
            angle: Math.PI, // Facing left
            speed: 1.5,
            patrolMinY: 80,
            patrolMaxY: 520,
            dirY: 1,
            fov: Math.PI / 3, // 60 degrees vision cone
            viewDist: 160
        },
        {
            x: 650,
            y: 500,
            radius: 12,
            angle: -Math.PI / 2, // Facing up
            speed: 2,
            patrolMinY: 100,
            patrolMaxY: 500,
            dirY: -1,
            fov: Math.PI / 3,
            viewDist: 180
        }
    ];
}

// Function to handle one guard respawning after assassination
function respawnGuard(index) {
    guards[index].x = Math.random() * 300 + 400; // Random spawn on right half
    guards[index].y = Math.random() * 400 + 100;
}

// Check circle-to-rectangle collisions
function checkWallCollision(circle, wall) {
    let closestX = Math.max(wall.x, Math.min(circle.x, wall.x + wall.width));
    let closestY = Math.max(wall.y, Math.min(circle.y, wall.y + wall.height));
    
    let distanceX = circle.x - closestX;
    let distanceY = circle.y - closestY;
    let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    
    return distanceSquared < (circle.radius * circle.radius);
}

// Core loop processing
function update() {
    if (!gameActive) return;

    // Movement Calculation
    let moveX = 0;
    let moveY = 0;

    if (keys['w'] || keys['arrowup']) moveY -= player.speed;
    if (keys['s'] || keys['arrowdown']) moveY += player.speed;
    if (keys['a'] || keys['arrowleft']) moveX -= player.speed;
    if (keys['d'] || keys['arrowright']) moveX += player.speed;

    // Apply X movement and check canvas/wall limits
    player.x += moveX;
    if (player.x - player.radius < 0 || player.x + player.radius > canvas.width) player.x -= moveX;
    walls.forEach(wall => { if (checkWallCollision(player, wall)) player.x -= moveX; });

    // Apply Y movement and check canvas/wall limits
    player.y += moveY;
    if (player.y - player.radius < 0 || player.y + player.radius > canvas.height) player.y -= moveY;
    walls.forEach(wall => { if (checkWallCollision(player, wall)) player.y -= moveY; });

    // Set player rotation based on input vector
    if (moveX !== 0 || moveY !== 0) {
        player.angle = Math.atan2(moveY, moveX);
    }

    // AI Guard Mechanics
    guards.forEach((guard, index) => {
        // Move guard up/down map
        guard.y += guard.speed * guard.dirY;
        if (guard.y <= guard.patrolMinY || guard.y >= guard.patrolMaxY) {
            guard.dirY *= -1;
            guard.angle = guard.dirY > 0 ? Math.PI / 2 : -Math.PI / 2; // Look way they walk
        }

        // 1. Stealth Mechanics: Detection check (Is player in Vision Cone?)
        let dx = player.x - guard.x;
        let dy = player.y - guard.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < guard.viewDist) {
            let angleToPlayer = Math.atan2(dy, dx);
            let diffAngle = angleToPlayer - guard.angle;

            // Normalize angle diff to (-PI to PI)
            while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
            while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

            // Trigger detection if within FOV arc
            if (Math.abs(diffAngle) < guard.fov / 2) {
                gameActive = false;
                gameOverScreen.classList.add('active');
            }
        }

        // 2. Assassination Mechanic: Takedown from behind
        if (distance < (player.radius + guard.radius + 8)) {
            let angleToGuard = Math.atan2(guard.y - player.y, guard.x - player.x);
            let approachAngleDiff = angleToGuard - guard.angle;

            while (approachAngleDiff < -Math.PI) approachAngleDiff += Math.PI * 2;
            while (approachAngleDiff > Math.PI) approachAngleDiff -= Math.PI * 2;

            // If player approaches within a 90-degree threshold behind the guard
            if (Math.abs(approachAngleDiff) < Math.PI / 2) {
                score++;
                scoreEl.innerText = score;
                respawnGuard(index);
            }
        }
    });
}

function draw() {
    // Clear display frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Render Level Map Environments
    ctx.fillStyle = '#1f2833';
    walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
        ctx.strokeStyle = '#4ed9a8';
        ctx.lineWidth = 1;
        ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
    });

    // Render Guards along with Vision Fields
    guards.forEach(guard => {
        // Draw Flashlight Vision Cone Arc
        ctx.fillStyle = 'rgba(231, 76, 60, 0.15)';
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.arc(
            guard.x, guard.y, 
            guard.viewDist, 
            guard.angle - guard.fov / 2, 
            guard.angle + guard.fov / 2
        );
        ctx.closePath();
        ctx.fill();

        // Guard Entity Body
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
        ctx.fill();

        // Direction Indicator Line
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.x + Math.cos(guard.angle) * 15, guard.y + Math.sin(guard.angle) * 15);
        ctx.stroke();
    });

    // Render Player Entity
    ctx.fillStyle = '#4ed9a8';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#4ed9a8';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0; // reset effects flag

    // Player Direction Indicator Line
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.angle) * 15, player.y + Math.sin(player.angle) * 15);
    ctx.stroke();
}

function gameLoop() {
    update();
    draw();
    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}
