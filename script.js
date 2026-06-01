const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gemCountEl = document.getElementById('gem-count');
const killCountEl = document.getElementById('kill-count');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

let gameActive = false;
let gemsCollected = 0;
let totalKills = 0;
let guards = [];
let gems = [];
let bullets = [];

// Player Definition (Hunter Assassin Style)
const player = {
    x: 100,
    y: 300,
    targetX: 100,
    targetY: 300,
    radius: 14,
    speed: 5.5,
    angle: 0,
    hp: 100,
    maxHp: 100
};

// Static Map Obstacles
const walls = [
    { x: 180, y: 0, w: 40, h: 220 },
    { x: 180, y: 380, w: 40, h: 220 },
    { x: 380, y: 150, w: 50, h: 300 },
    { x: 580, y: 0, w: 40, h: 250 },
    { x: 580, y: 350, w: 40, h: 250 }
];

// Click-to-Move Vector Tracking
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    player.targetX = e.clientX - rect.left;
    player.targetY = e.clientY - rect.top;
});

startBtn.addEventListener('click', initGame);
restartBtn.addEventListener('click', initGame);

function initGame() {
    gemsCollected = 0;
    totalKills = 0;
    gemCountEl.innerText = gemsCollected;
    killCountEl.innerText = totalKills;
    
    player.x = 80;
    player.y = 300;
    player.targetX = 80;
    player.targetY = 300;
    player.hp = player.maxHp;
    player.angle = 0;

    gems = [];
    bullets = [];
    spawnInitialGuards();

    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    gameActive = true;

    requestAnimationFrame(gameLoop);
}

function spawnInitialGuards() {
    guards = [
        { x: 280, y: 100, radius: 14, angle: 0, speed: 2.2, patrolMinY: 80, patrolMaxY: 520, dirY: 1, hp: 100, fov: Math.PI/2.5, viewDist: 200, shotCooldown: 0 },
        { x: 500, y: 500, radius: 14, angle: Math.PI, speed: 1.8, patrolMinY: 100, patrolMaxY: 500, dirY: -1, hp: 100, fov: Math.PI/2.5, viewDist: 220, shotCooldown: 0 },
        { x: 700, y: 150, radius: 14, angle: Math.PI, speed: 2.5, patrolMinY: 60, patrolMaxY: 540, dirY: 1, hp: 100, fov: Math.PI/2.5, viewDist: 180, shotCooldown: 0 }
    ];
}

function checkWallCollision(x, y, radius) {
    for (let wall of walls) {
        let closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
        let closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
        let distX = x - closestX;
        let distY = y - closestY;
        if ((distX * distX + distY * distY) < (radius * radius)) {
            return true;
        }
    }
    return false;
}

function update() {
    if (!gameActive) return;

    // --- 1. Player Pathfinding/Movement Logic ---
    let dx = player.targetX - player.x;
    let dy = player.targetY - player.y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 4) {
        player.angle = Math.atan2(dy, dx);
        let stepX = Math.cos(player.angle) * player.speed;
        let stepY = Math.sin(player.angle) * player.speed;

        // Wall Sliding and Bounds checks
        if (!checkWallCollision(player.x + stepX, player.y, player.radius) && player.x + stepX > 0 && player.x + stepX < canvas.width) {
            player.x += stepX;
        }
        if (!checkWallCollision(player.x, player.y + stepY, player.radius) && player.y + stepY > 0 && player.y + stepY < canvas.height) {
            player.y += stepY;
        }
    }

    // --- 2. Bullet Mechanics ---
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        // Bullet hit player
        let pDx = player.x - b.x;
        let pDy = player.y - b.y;
        if (Math.sqrt(pDx*pDx + pDy*pDy) < player.radius) {
            player.hp -= 15; // Take Damage
            bullets.splice(i, 1);
            if (player.hp <= 0) {
                gameActive = false;
                gameOverScreen.classList.add('active');
            }
            continue;
        }

        // Bullet out of bounds or hits walls
        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height || checkWallCollision(b.x, b.y, 2)) {
            bullets.splice(i, 1);
        }
    }

    // --- 3. Guard Intelligence & Processing ---
    guards.forEach((guard, gIdx) => {
        // Linear Patrol Engine
        guard.y += guard.speed * guard.dirY;
        if (guard.y <= guard.patrolMinY || guard.y >= guard.patrolMaxY) {
            guard.dirY *= -1;
        }
        // Smooth vision rotations based on movement heading
        guard.angle = guard.dirY > 0 ? Math.PI / 2 : -Math.PI / 2;

        if (guard.shotCooldown > 0) guard.shotCooldown--;

        // Line-of-sight tracking checks
        let gDx = player.x - guard.x;
        let gDy = player.y - guard.y;
        let distToPlayer = Math.sqrt(gDx * gDx + gDy * gDy);

        if (distToPlayer < guard.viewDist) {
            let angleToPlayer = Math.atan2(gDy, gDx);
            let angleDiff = angleToPlayer - guard.angle;

            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            // Player is captured inside the guard's flashlight field
            if (Math.abs(angleDiff) < guard.fov / 2) {
                guard.angle = angleToPlayer; // Track player visually
                if (guard.shotCooldown === 0) {
                    bullets.push({ x: guard.x, y: guard.y, angle: angleToPlayer, speed: 8 });
                    guard.shotCooldown = 35; // Weapon fire cadence delay
                }
            }
        }

        // Takedown zone mechanics (Instant Auto Attack from Behind)
        if (distToPlayer < (player.radius + guard.radius + 15)) {
            let approachAngleDiff = Math.atan2(guard.y - player.y, guard.x - player.x) - guard.angle;
            while (approachAngleDiff < -Math.PI) approachAngleDiff += Math.PI * 2;
            while (approachAngleDiff > Math.PI) approachAngleDiff -= Math.PI * 2;

            // Successful strike from the side or behind
            if (Math.abs(approachAngleDiff) < Math.PI / 1.8) {
                totalKills++;
                killCountEl.innerText = totalKills;

                // Drop Loot Reward Gems
                gems.push({ x: guard.x, y: guard.y, val: 5 });
                
                // Respawn Guard back into cycle
                guard.x = Math.random() * 400 + 350;
                guard.y = Math.random() * 400 + 100;
                guard.hp = 100;
            }
        }
    });

    // --- 4. Gem Gathering Engine ---
    for (let i = gems.length - 1; i >= 0; i--) {
        let gem = gems[i];
        let gemDx = player.x - gem.x;
        let gemDy = player.y - gem.y;
        if (Math.sqrt(gemDx*gemDx + gemDy*gemDy) < player.radius + 10) {
            gemsCollected += gem.val;
            gemCountEl.innerText = gemsCollected;
            gems.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Floor Base grid styling
    ctx.fillStyle = '#11141a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Obstacles Layer
    ctx.fillStyle = '#1e2330';
    walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = '#2c354a';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    });

    // Gems Layer
    gems.forEach(gem => {
        ctx.fillStyle = '#00ecc6';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ecc6';
        ctx.beginPath();
        ctx.arc(gem.x, gem.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Projectiles Layer
    ctx.fillStyle = '#ff9f43';
    bullets.forEach(b => {
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });

    // Guards Layer
    guards.forEach(guard => {
        // Red alert alert cone arc rendering
        ctx.fillStyle = 'rgba(255, 56, 56, 0.12)';
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.arc(guard.x, guard.y, guard.viewDist, guard.angle - guard.fov/2, guard.angle + guard.fov/2);
        ctx.closePath();
        ctx.fill();

        // Outer Alert Ring Frame
        ctx.strokeStyle = 'rgba(255, 56, 56, 0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Guard Character Entity
        ctx.fillStyle = '#ff3838';
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
        ctx.fill();

        // Direction orientation weapon tip indicator
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
        ctx.stroke();
    });

    // Player Avatar Character Entity
    ctx.fillStyle = '#00ecc6';
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#00ecc6';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Movement Aim Reticle Target indicator line 
    let dx = player.targetX - player.x;
    let dy = player.targetY - player.y;
    if (Math.sqrt(dx*dx + dy*dy) > 10) {
        ctx.strokeStyle = 'rgba(0, 236, 198, 0.25)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.targetX, player.targetY);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash flag reset
    }

    // Health Status Bar overlay
    let barW = 40;
    let barH = 5;
    ctx.fillStyle = '#2c354a';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 12, barW, barH);
    ctx.fillStyle = '#00ecc6';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 12, barW * (player.hp / player.maxHp), barH);
}

function gameLoop() {
    update();
    draw();
    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}