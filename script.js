const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Selection Links
const levelEl = document.getElementById('current-level');
const gemCountEl = document.getElementById('gem-count');
const guardCountEl = document.getElementById('guard-count');
const startScreen = document.getElementById('start-screen');
const levelScreen = document.getElementById('level-screen');
const victoryScreen = document.getElementById('victory-screen');
const gameOverScreen = document.getElementById('game-over-screen');

let gameActive = false;
let currentLevel = 1;
const maxLevels = 5;
let gemsCollected = 0;
let isDragging = false;

let guards = [];
let gems = [];
let bullets = [];
let particles = [];

// Hero Configuration
const player = {
    x: 70,
    y: 325,
    targetX: 70,
    targetY: 325,
    radius: 14,
    speed: 5.2,
    angle: 0,
    hp: 100,
    maxHp: 100
};

// Map Level Geometry Architectures
const levelsWallConfig = {
    1: [
        { x: 220, y: 0, w: 50, h: 260 },
        { x: 220, y: 390, w: 50, h: 260 },
        { x: 500, y: 180, w: 50, h: 290 }
    ],
    2: [
        { x: 200, y: 120, w: 50, h: 410 },
        { x: 480, y: 0, w: 50, h: 240 },
        { x: 480, y: 410, w: 50, h: 240 },
        { x: 700, y: 150, w: 50, h: 350 }
    ],
    3: [
        { x: 180, y: 0, w: 40, h: 450 },
        { x: 380, y: 200, w: 40, h: 450 },
        { x: 580, y: 0, w: 40, h: 450 },
        { x: 740, y: 200, w: 40, h: 300 }
    ],
    4: [
        { x: 150, y: 100, w: 200, h: 50 },
        { x: 150, y: 450, w: 200, h: 50 },
        { x: 500, y: 100, w: 50, h: 450 },
        { x: 700, y: 250, w: 150, h: 50 }
    ],
    5: [
        { x: 200, y: 0, w: 40, h: 220 },
        { x: 200, y: 430, w: 40, h: 220 },
        { x: 420, y: 150, w: 60, h: 350 },
        { x: 680, y: 0, w: 40, h: 250 },
        { x: 680, y: 400, w: 40, h: 250 },
        { x: 200, y: 300, w: 120, h: 40 }
    ]
};

let walls = [];

// Native Vector Tracking Engines
function updateTargetPos(e) {
    const rect = canvas.getBoundingClientRect();
    player.targetX = Math.max(player.radius, Math.min(canvas.width - player.radius, e.clientX - rect.left));
    player.targetY = Math.max(player.radius, Math.min(canvas.height - player.radius, e.clientY - rect.top));
}

canvas.addEventListener('mousedown', (e) => { isDragging = true; updateTargetPos(e); });
canvas.addEventListener('mousemove', (e) => { if (isDragging) updateTargetPos(e); });
window.addEventListener('mouseup', () => { isDragging = false; });

// Support Touch Devices For Dragging
canvas.addEventListener('touchstart', (e) => { isDragging = true; updateTargetPos(e.touches[0]); e.preventDefault(); }, {passive: false});
canvas.addEventListener('touchmove', (e) => { if (isDragging) { updateTargetPos(e.touches[0]); e.preventDefault(); } }, {passive: false});
canvas.addEventListener('touchend', () => { isDragging = false; });

// Dynamic Button Bindings
document.getElementById('start-btn').addEventListener('click', () => setupSector(1));
document.getElementById('next-btn').addEventListener('click', () => setupSector(currentLevel + 1));
document.getElementById('victory-btn').addEventListener('click', () => setupSector(1));
document.getElementById('restart-btn').addEventListener('click', () => setupSector(currentLevel));

function createExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            radius: Math.random() * 3 + 2,
            alpha: 1,
            color: color
        });
    }
}

// Validation Engines To Clear Safe Positions (Prevents spawning items inside obstacles)
function isPositionInsideWall(x, y, padding = 15) {
    for (let wall of walls) {
        if (x + padding > wall.x && x - padding < wall.x + wall.w &&
            y + padding > wall.y && y - padding < wall.y + wall.h) {
            return true;
        }
    }
    return false;
}

function getSafePosition() {
    let attempts = 0;
    while (attempts < 200) {
        let rx = Math.random() * (canvas.width - 200) + 150; // Keep away from initial safe zone spawn point
        let ry = Math.random() * (canvas.height - 100) + 50;
        if (!isPositionInsideWall(rx, ry, 25)) {
            return { x: rx, y: ry };
        }
        attempts++;
    }
    return { x: 450, y: 325 }; // Structural fallback map center coordinate
}

function setupSector(lvl) {
    currentLevel = lvl;
    walls = levelsWallConfig[currentLevel] || levelsWallConfig[1];
    
    levelEl.innerText = `${currentLevel}/${maxLevels}`;
    if(lvl === 1) { gemsCollected = 0; }
    gemCountEl.innerText = gemsCollected;

    // Reset Player Profile parameters
    player.x = 70; player.y = 325;
    player.targetX = 70; player.targetY = 325;
    player.hp = player.maxHp;
    player.angle = 0;

    bullets = []; particles = []; gems = [];
    buildSectorThreats();

    // Clear Screens
    startScreen.classList.remove('active');
    levelScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');

    gameActive = true;
    requestAnimationFrame(gameLoop);
}

function buildSectorThreats() {
    guards = [];
    // Scaling level difficulty matrix configurations
    // Level 1: 3 Beginners | Level 2: 2 Beg, 2 Bet | Level 3: 1 Beg, 2 Bet, 1 Hvy | Level 4: 3 Bet, 2 Hvy | Level 5: 2 Bet, 4 Hvy
    let distribution = [];
    if (currentLevel === 1) distribution = ['beginner', 'beginner', 'beginner'];
    else if (currentLevel === 2) distribution = ['beginner', 'beginner', 'better', 'better'];
    else if (currentLevel === 3) distribution = ['beginner', 'better', 'better', 'heavy'];
    else if (currentLevel === 4) distribution = ['better', 'better', 'better', 'heavy', 'heavy'];
    else distribution = ['better', 'better', 'heavy', 'heavy', 'heavy', 'heavy'];

    distribution.forEach(type => {
        let pos = getSafePosition();
        let guardProfile = {
            x: pos.x, y: pos.y,
            radius: 14, angle: Math.random() * Math.PI * 2,
            speed: type === 'better' ? 2.6 : (type === 'heavy' ? 1.4 : 1.9),
            type: type,
            dirY: Math.random() > 0.5 ? 1 : -1,
            patrolMinY: Math.random() * 100 + 50,
            patrolMaxY: Math.random() * 150 + 450,
            shotCooldown: 0,
            maxCooldown: type === 'better' ? 16 : (type === 'heavy' ? 60 : 38),
            damage: type === 'heavy' ? 34 : 10,
            bulletSpeed: type === 'heavy' ? 10 : (type === 'better' ? 7.5 : 5.5),
            viewDist: type === 'heavy' ? 240 : 200,
            fov: type === 'heavy' ? Math.PI / 3 : Math.PI / 2.2, // Heavy has tighter but deeper vision focus
            color: type === 'better' ? '#0044ff' : (type === 'heavy' ? '#ff3366' : '#00f3ff')
        };
        guards.push(guardProfile);
    });
    guardCountEl.innerText = guards.length;
}

function checkCircleWallCollision(x, y, radius) {
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

    // Smooth Slide Trajectory Drag Motion Movement Tracking
    let dx = player.targetX - player.x;
    let dy = player.targetY - player.y;
    let distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 4) {
        player.angle = Math.atan2(dy, dx);
        let stepX = Math.cos(player.angle) * player.speed;
        let stepY = Math.sin(player.angle) * player.speed;

        if (!checkCircleWallCollision(player.x + stepX, player.y, player.radius)) player.x += stepX;
        if (!checkCircleWallCollision(player.x, player.y + stepY, player.radius)) player.y += stepY;
    }

    // Process Environmental Particles Engine
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.alpha -= 0.025;
        if (p.alpha <= 0) particles.splice(i, 1);
    }

    // Process Ballistic Vectors Engine
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        let pDx = player.x - b.x;
        let pDy = player.y - b.y;
        if (Math.sqrt(pDx*pDx + pDy*pDy) < player.radius) {
            player.hp -= b.damage;
            createExplosion(b.x, b.y, '#ffb800');
            bullets.splice(i, 1);
            if (player.hp <= 0) {
                gameActive = false;
                gameOverScreen.classList.add('active');
            }
            continue;
        }

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height || checkCircleWallCollision(b.x, b.y, 2)) {
            bullets.splice(i, 1);
        }
    }

    // Process AI Tracking Logic Loop
    for (let i = guards.length - 1; i >= 0; i--) {
        let guard = guards[i];
        
        // Adaptive Level Patrol Path System
        guard.y += guard.speed * guard.dirY;
        if (guard.y <= guard.patrolMinY || guard.y >= guard.patrolMaxY || checkCircleWallCollision(guard.x, guard.y + (guard.speed * guard.dirY), guard.radius)) {
            guard.dirY *= -1;
        }
        guard.angle = guard.dirY > 0 ? Math.PI / 2 : -Math.PI / 2;

        if (guard.shotCooldown > 0) guard.shotCooldown--;

        let gDx = player.x - guard.x;
        let gDy = player.y - guard.y;
        let distToPlayer = Math.sqrt(gDx * gDx + gDy * gDy);

        if (distToPlayer < guard.viewDist) {
            let angleToPlayer = Math.atan2(gDy, gDx);
            let angleDiff = angleToPlayer - guard.angle;

            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            if (Math.abs(angleDiff) < guard.fov / 2) {
                guard.angle = angleToPlayer; // Dynamic visual tracking lock-on
                if (guard.shotCooldown === 0) {
                    bullets.push({ x: guard.x, y: guard.y, angle: angleToPlayer, speed: guard.bulletSpeed, damage: guard.damage });
                    guard.shotCooldown = guard.maxCooldown;
                }
            }
        }

        // Execution Kill Zone Evaluation logic
        if (distToPlayer < (player.radius + guard.radius + 15)) {
            let strikeAngle = Math.atan2(guard.y - player.y, guard.x - player.x) - guard.angle;
            while (strikeAngle < -Math.PI) strikeAngle += Math.PI * 2;
            while (strikeAngle > Math.PI) strikeAngle -= Math.PI * 2;

            // Attack validation criteria: Approach from behind
            if (Math.abs(strikeAngle) < Math.PI / 1.6) {
                createExplosion(guard.x, guard.y, guard.color);
                
                // Safe dynamic generation algorithm for drops
                if(!isPositionInsideWall(guard.x, guard.y, 8)) {
                    gems.push({ x: guard.x, y: guard.y, val: guard.type === 'heavy' ? 25 : (guard.type === 'better' ? 15 : 10) });
                } else {
                    let fallbackPos = getSafePosition();
                    gems.push({ x: fallbackPos.x, y: fallbackPos.y, val: 10 });
                }

                guards.splice(i, 1);
                guardCountEl.innerText = guards.length;

                // Level Phase Progression Check Engine
                if (guards.length === 0) {
                    gameActive = false;
                    if (currentLevel === maxLevels) {
                        victoryScreen.classList.add('active');
                    } else {
                        levelScreen.classList.add('active');
                    }
                }
            }
        }
    }

    // Collect Rewards Logic Loop
    for (let i = gems.length - 1; i >= 0; i--) {
        let gem = gems[i];
        let gemDx = player.x - gem.x;
        let gemDy = player.y - gem.y;
        if (Math.sqrt(gemDx*gemDx + gemDy*gemDy) < player.radius + 12) {
            gemsCollected += gem.val;
            gemCountEl.innerText = gemsCollected;
            createExplosion(gem.x, gem.y, '#00f3ff');
            gems.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Grid Floor Pattern Map Mesh Matrix
    ctx.fillStyle = '#070a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(30, 45, 75, 0.15)';
    ctx.lineWidth = 1;
    let gridSize = 40;
    for(let x=0; x<canvas.width; x+=gridSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for(let y=0; y<canvas.height; y+=gridSize){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    // Render Geometric Fortified Wall Obstacles
    walls.forEach(wall => {
        // Drop shadows
        ctx.fillStyle = 'rgba(2, 4, 7, 0.6)';
        ctx.fillRect(wall.x + 6, wall.y + 6, wall.w, wall.h);

        // Core Solid Barrier structures
        ctx.fillStyle = '#101622';
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeStyle = '#1f2b42';
        ctx.lineWidth = 2;
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);

        // Glowing Core Accents
        ctx.fillStyle = 'rgba(0, 243, 255, 0.02)';
        ctx.fillRect(wall.x + 2, wall.y + 2, wall.w - 4, wall.h - 4);
    });

    // Render Reward Crypto Gems Elements
    gems.forEach(gem => {
        ctx.fillStyle = '#00f3ff';
        ctx.shadowBlur = 12; ctx.shadowColor = '#00f3ff';
        ctx.beginPath();
        ctx.arc(gem.x, gem.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Render Ballistic Laser Projectiles
    bullets.forEach(b => {
        ctx.fillStyle = '#ffb800';
        ctx.shadowBlur = 8; ctx.shadowColor = '#ffb800';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Render Dynamic Alpha Particles Engine
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Render Threat Patrol Vectors Area Field Cones
    guards.forEach(guard => {
        let viewGrad = ctx.createRadialGradient(guard.x, guard.y, 10, guard.x, guard.y, guard.viewDist);
        let alphaColor = guard.type === 'heavy' ? 'rgba(255, 51, 102,' : (guard.type === 'better' ? 'rgba(0, 68, 255,' : 'rgba(0, 243, 255,');
        viewGrad.addColorStop(0, `${alphaColor} 0.25)`);
        viewGrad.addColorStop(0.4, `${alphaColor} 0.12)`);
        viewGrad.addColorStop(1, `${alphaColor} 0.0)`);

        ctx.fillStyle = viewGrad;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.arc(guard.x, guard.y, guard.viewDist, guard.angle - guard.fov/2, guard.angle + guard.fov/2);
        ctx.closePath();
        ctx.fill();

        // Hostile Entity Core Ring Structure
        ctx.fillStyle = guard.color;
        ctx.shadowBlur = 10; ctx.shadowColor = guard.color;
        ctx.beginPath();
        ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Visual weapon weapon pointer nozzle indicators
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.x + Math.cos(guard.angle) * 18, guard.y + Math.sin(guard.angle) * 18);
        ctx.stroke();
    });

    // Render Hero Operative Character Entity
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 15; ctx.shadowColor = '#00f3ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    // Inner cybercore layer accent rings
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Direct Target Waypoint Path Vector UI Guide line
    if (isDragging || Math.sqrt((player.targetX - player.x)**2 + (player.targetY - player.y)**2) > 15) {
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(player.x, player.y);
        ctx.lineTo(player.targetX, player.targetY);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Reticle target node
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(player.targetX, player.targetY, 6, 0, Math.PI*2);
        ctx.stroke();
    }

    // Float Vitals Metric Progress Gauge Bar UI layout block
    let barW = 44; let barH = 5;
    ctx.fillStyle = '#101622';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 14, barW, barH);
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 14, barW * (player.hp / player.maxHp), barH);
}

function gameLoop() {
    update();
    draw();
    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}