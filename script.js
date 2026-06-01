const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

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
let walls = [];

const player = {
    x: 50, y: 50,
    targetX: 50, targetY: 50,
    radius: 12, speed: 4.8,
    angle: 0, hp: 100, maxHp: 100
};

// Tactical Automated Maze Grid Architecture Matrix Generators
function generateMazeLayout(level) {
    const layoutWalls = [];
    const cellSize = 100;
    const cols = 8;
    const rows = 6;

    // Outer Boundary Isolation Structural Perimeter Walls
    layoutWalls.push({ x: 0, y: 0, w: 800, h: 15 });
    layoutWalls.push({ x: 0, y: 585, w: 800, h: 15 });
    layoutWalls.push({ x: 0, y: 0, w: 15, h: 600 });
    layoutWalls.push({ x: 785, y: 0, w: 15, h: 600 });

    // Built-in Seed Map Maze Blueprints
    const maps = {
        1: [
            { c: 1, r: 1, w: true, h: false }, { c: 3, r: 1, w: false, h: true },
            { c: 5, r: 2, w: true, h: true },  { c: 2, r: 4, w: true, h: false },
            { c: 6, r: 3, w: false, h: true }, { c: 4, r: 4, w: true, h: true }
        ],
        2: [
            { c: 2, r: 1, w: true, h: true },  { c: 4, r: 2, w: true, h: false },
            { c: 1, r: 3, w: false, h: true }, { c: 5, r: 4, w: true, h: true },
            { c: 6, r: 1, w: true, h: false }, { c: 3, r: 3, w: false, h: true }
        ],
        3: [
            { c: 2, r: 2, w: true, h: true },  { c: 4, r: 1, w: true, h: true },
            { c: 6, r: 4, w: true, h: false }, { c: 1, r: 4, w: true, h: true },
            { c: 3, r: 3, w: true, h: false }, { c: 5, r: 2, w: false, h: true }
        ],
        4: [
            { c: 1, r: 2, w: true, h: true },  { c: 3, r: 4, w: true, h: true },
            { c: 5, r: 1, w: true, h: true },  { c: 4, r: 3, w: true, h: false },
            { c: 6, r: 2, w: false, h: true }, { c: 2, r: 3, w: true, h: true }
        ],
        5: [
            { c: 2, r: 1, w: true, h: true },  { c: 4, r: 4, w: true, h: true },
            { c: 3, r: 2, w: true, h: false }, { c: 1, r: 3, w: false, h: true },
            { c: 6, r: 3, w: true, h: true },  { c: 5, r: 1, w: true, h: false }
        ]
    };

    const template = maps[level] || maps[1];
    
    // Extrapolate internal grid layouts into solid canvas map coordinates
    template.forEach(block => {
        let lx = block.c * cellSize;
        let ly = block.r * cellSize;
        if (block.w) layoutWalls.push({ x: lx, y: ly, w: 25, h: 140 });
        if (block.h) layoutWalls.push({ x: lx, y: ly, w: 140, h: 25 });
    });

    return layoutWalls;
}

// Vector Touch & Cursor Mechanics
function trackInput(e) {
    const rect = canvas.getBoundingClientRect();
    player.targetX = Math.max(player.radius + 15, Math.min(canvas.width - player.radius - 15, e.clientX - rect.left));
    player.targetY = Math.max(player.radius + 15, Math.min(canvas.height - player.radius - 15, e.clientY - rect.top));
}

canvas.addEventListener('mousedown', (e) => { isDragging = true; trackInput(e); });
canvas.addEventListener('mousemove', (e) => { if (isDragging) trackInput(e); });
window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('touchstart', (e) => { isDragging = true; trackInput(e.touches[0]); e.preventDefault(); }, {passive: false});
canvas.addEventListener('touchmove', (e) => { if (isDragging) { trackInput(e.touches[0]); e.preventDefault(); } }, {passive: false});
canvas.addEventListener('touchend', () => { isDragging = false; });

document.getElementById('start-btn').addEventListener('click', () => initiateFloor(1));
document.getElementById('next-btn').addEventListener('click', () => initiateFloor(currentLevel + 1));
document.getElementById('victory-btn').addEventListener('click', () => initiateFloor(1));
document.getElementById('restart-btn').addEventListener('click', () => initiateFloor(currentLevel));

function checkWallCollision(x, y, radius) {
    for (let wall of walls) {
        let closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
        let closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
        if (((x - closestX)**2 + (y - closestY)**2) < (radius * radius)) return true;
    }
    return false;
}

// Line-of-sight calculation to check if walls block a guard's vision
function isLineOfSightBlocked(x1, y1, x2, y2) {
    for (let wall of walls) {
        if (lineIntersectsRect(x1, y1, x2, y2, wall)) return true;
    }
    return false;
}

function lineIntersectsRect(x1, y1, x2, y2, rect) {
    let minX = rect.x, maxX = rect.x + rect.w;
    let minY = rect.y, maxY = rect.y + rect.h;
    
    // Cohen-Sutherland tracking algorithms simplify checks
    if ((x1 < minX && x2 < minX) || (x1 > maxX && x2 > maxX) || (y1 < minY && y2 < minY) || (y1 > maxY && y2 > maxY)) return false;
    
    // Quick approximation intersection bounding check
    let m = (y2 - y1) / (x2 - x1);
    let c = y1 - m * x1;
    
    let yAtLeft = m * minX + c;
    if (yAtLeft >= minY && yAtLeft <= maxY) return true;
    let yAtRight = m * maxX + c;
    if (yAtRight >= minY && yAtRight <= maxY) return true;
    
    return false;
}

function getRandomWaypoint() {
    let attempts = 0;
    while(attempts < 300) {
        let wx = Math.random() * (canvas.width - 100) + 50;
        let wy = Math.random() * (canvas.height - 100) + 50;
        if (!checkWallCollision(wx, wy, 20)) return { x: wx, y: wy };
        attempts++;
    }
    return { x: 400, y: 300 };
}

function initiateFloor(lvl) {
    currentLevel = lvl;
    walls = generateMazeLayout(currentLevel);
    
    levelEl.innerText = `${currentLevel}/${maxLevels}`;
    if (lvl === 1) gemsCollected = 0;
    gemCountEl.innerText = gemsCollected;

    player.x = 60; player.y = 60;
    player.targetX = 60; player.targetY = 60;
    player.hp = player.maxHp;
    player.angle = 0;

    bullets = []; gems = [];
    populateGuards();

    startScreen.classList.remove('active');
    levelScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');

    gameActive = true;
    requestAnimationFrame(gameLoop);
}

function populateGuards() {
    guards = [];
    let roster = [];

    if (currentLevel === 1) roster = ['beginner', 'beginner', 'beginner'];
    else if (currentLevel === 2) roster = ['beginner', 'better', 'better'];
    else if (currentLevel === 3) roster = ['beginner', 'better', 'heavy', 'heavy'];
    else if (currentLevel === 4) roster = ['better', 'better', 'heavy', 'heavy'];
    else roster = ['better', 'heavy', 'heavy', 'heavy', 'heavy'];

    roster.forEach(type => {
        let spawn = getRandomWaypoint();
        let targetWP = getRandomWaypoint();
        
        guards.push({
            x: spawn.x, y: spawn.y,
            wpX: targetWP.x, wpY: targetWP.y,
            radius: 14, angle: Math.random() * Math.PI*2,
            type: type,
            state: 'patrol', // Options: 'patrol', 'chase', 'suspicious'
            suspiciousTimer: 0,
            speed: type === 'better' ? 2.5 : (type === 'heavy' ? 1.5 : 1.9),
            chaseSpeed: type === 'better' ? 3.5 : (type === 'heavy' ? 2.3 : 2.8),
            shotCooldown: 0,
            maxCooldown: type === 'better' ? 18 : (type === 'heavy' ? 55 : 35),
            damage: type === 'heavy' ? 35 : 12,
            viewDist: type === 'heavy' ? 230 : 180,
            fov: type === 'heavy' ? Math.PI/3.2 : Math.PI/2.4,
            color: type === 'better' ? '#0044ff' : (type === 'heavy' ? '#ff3366' : '#00f3ff')
        });
    });
    guardCountEl.innerText = guards.length;
}

function update() {
    if (!gameActive) return;

    // Smooth movement logic
    let pDx = player.targetX - player.x;
    let pDy = player.targetY - player.y;
    let pDist = Math.sqrt(pDx*pDx + pDy*pDy);

    if (pDist > 4) {
        player.angle = Math.atan2(pDy, pDx);
        let stepX = Math.cos(player.angle) * player.speed;
        let stepY = Math.sin(player.angle) * player.speed;

        if (!checkWallCollision(player.x + stepX, player.y, player.radius)) player.x += stepX;
        if (!checkWallCollision(player.x, player.y + stepY, player.radius)) player.y += stepY;
    }

    // Ballistics tracking physics logic
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        let bDx = player.x - b.x;
        let bDy = player.y - b.y;
        if (Math.sqrt(bDx*bDx + bDy*bDy) < player.radius) {
            player.hp -= b.damage;
            bullets.splice(i, 1);
            if (player.hp <= 0) {
                gameActive = false;
                gameOverScreen.classList.add('active');
            }
            continue;
        }

        if (b.x < 0 || b.x > canvas.width || b.y < 0 || b.y > canvas.height || checkWallCollision(b.x, b.y, 2)) {
            bullets.splice(i, 1);
        }
    }

    // Comprehensive State Machine for AI Guard Systems
    for (let i = guards.length - 1; i >= 0; i--) {
        let guard = guards[i];
        if (guard.shotCooldown > 0) guard.shotCooldown--;

        let gDx = player.x - guard.x;
        let gDy = player.y - guard.y;
        let distToPlayer = Math.sqrt(gDx*gDx + gDy*gDy);

        let hasLOS = false;
        if (distToPlayer < guard.viewDist) {
            let angleToPlayer = Math.atan2(gDy, gDx);
            let angleDiff = angleToPlayer - guard.angle;

            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

            if (Math.abs(angleDiff) < guard.fov / 2) {
                if (!isLineOfSightBlocked(guard.x, guard.y, player.x, player.y)) {
                    hasLOS = true;
                }
            }
        }

        // State Machine execution branches
        if (hasLOS) {
            guard.state = 'chase';
            guard.angle = Math.atan2(gDy, gDx);
            
            // Move directly towards player position coords
            let cSpeed = guard.chaseSpeed;
            let cx = Math.cos(guard.angle) * cSpeed;
            let cy = Math.sin(guard.angle) * cSpeed;
            if (!checkWallCollision(guard.x + cx, guard.y, guard.radius)) guard.x += cx;
            if (!checkWallCollision(guard.x, guard.y + cy, guard.radius)) guard.y += cy;

            if (guard.shotCooldown === 0) {
                bullets.push({ x: guard.x, y: guard.y, angle: guard.angle, speed: 7, damage: guard.damage });
                guard.shotCooldown = guard.maxCooldown;
            }
        } else {
            // Player lost from sight or behind a wall
            if (guard.state === 'chase') {
                guard.state = 'suspicious';
                guard.suspiciousTimer = 120; // 120 frames = exactly 2 seconds
            }

            if (guard.state === 'suspicious') {
                guard.suspiciousTimer--;
                // Scan by rotating back and forth on the spot
                guard.angle += 0.04 * Math.sin(guard.suspiciousTimer * 0.1);

                if (guard.suspiciousTimer <= 0) {
                    guard.state = 'patrol';
                    let wp = getRandomWaypoint();
                    guard.wpX = wp.x; guard.wpY = wp.y;
                }
            } else if (guard.state === 'patrol') {
                // Return to normal map wandering routines
                let wDx = guard.wpX - guard.x;
                let wDy = guard.wpY - guard.y;
                let wDist = Math.sqrt(wDx*wDx + wDy*wDy);

                if (wDist < 15) {
                    let wp = getRandomWaypoint();
                    guard.wpX = wp.x; guard.wpY = wp.y;
                } else {
                    guard.angle = Math.atan2(wDy, wDx);
                    let sx = Math.cos(guard.angle) * guard.speed;
                    let sy = Math.sin(guard.angle) * guard.speed;
                    
                    // If stuck running into walls while wandering, pick a completely fresh target waypoint
                    if (checkWallCollision(guard.x + sx, guard.y + sy, guard.radius)) {
                        let wp = getRandomWaypoint();
                        guard.wpX = wp.x; guard.wpY = wp.y;
                    } else {
                        guard.x += sx;
                        guard.y += sy;
                    }
                }
            }
        }

        // Takedown logic from behind
        if (distToPlayer < (player.radius + guard.radius + 12)) {
            let approachAngle = Math.atan2(guard.y - player.y, guard.x - player.x) - guard.angle;
            while (approachAngle < -Math.PI) approachAngle += Math.PI * 2;
            while (approachAngle > Math.PI) approachAngle -= Math.PI * 2;

            if (Math.abs(approachAngle) < Math.PI / 1.5) {
                gems.push({ x: guard.x, y: guard.y, val: guard.type === 'heavy' ? 30 : 15 });
                guards.splice(i, 1);
                guardCountEl.innerText = guards.length;

                if (guards.length === 0) {
                    gameActive = false;
                    if (currentLevel === maxLevels) victoryScreen.classList.add('active');
                    else levelScreen.classList.add('active');
                }
            }
        }
    }

    // Process Gem pickups
    for (let i = gems.length - 1; i >= 0; i--) {
        let gem = gems[i];
        if (Math.sqrt((player.x - gem.x)**2 + (player.y - gem.y)**2) < player.radius + 10) {
            gemsCollected += gem.val;
            gemCountEl.innerText = gemsCollected;
            gems.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Floor Base Map mesh layout grid
    ctx.fillStyle = '#06080d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw walls
    ctx.fillStyle = '#141b29';
    ctx.strokeStyle = '#222d42';
    ctx.lineWidth = 2;
    walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    });

    // Draw gems
    gems.forEach(gem => {
        ctx.fillStyle = '#00f3ff';
        ctx.shadowBlur = 10; ctx.shadowColor = '#00f3ff';
        ctx.beginPath(); ctx.arc(gem.x, gem.y, 5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Draw bullets
    ctx.fillStyle = '#ffb800';
    bullets.forEach(b => {
        ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI*2); ctx.fill();
    });

    // Draw guards with context alerts
    guards.forEach(guard => {
        let coneAlpha = 'rgba(0, 243, 255,';
        if (guard.state === 'chase') coneAlpha = 'rgba(255, 51, 102,';
        if (guard.state === 'suspicious') coneAlpha = 'rgba(255, 184, 0,';

        let viewGrad = ctx.createRadialGradient(guard.x, guard.y, 5, guard.x, guard.y, guard.viewDist);
        viewGrad.addColorStop(0, `${coneAlpha}0.22)`);
        viewGrad.addColorStop(1, `${coneAlpha}0.0)`);

        ctx.fillStyle = viewGrad;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.arc(guard.x, guard.y, guard.viewDist, guard.angle - guard.fov/2, guard.angle + guard.fov/2);
        ctx.closePath();
        ctx.fill();

        // Render Guard entity body core
        ctx.fillStyle = guard.color;
        ctx.beginPath(); ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI*2); ctx.fill();

        // Weapon pointer tip nozzle line
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.x + Math.cos(guard.angle)*16, guard.y + Math.sin(guard.angle)*16);
        ctx.stroke();

        // Visual Context Status Alert Symbols Overlay Rendering System
        if (guard.state === 'chase' || guard.state === 'suspicious') {
            ctx.fillStyle = guard.state === 'chase' ? '#ff3366' : '#ffb800';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 20);
        }
    });

    // Render Master Assassin Operative Avatar Entity
    ctx.fillStyle = '#00f3ff';
    ctx.shadowBlur = 12; ctx.shadowColor = '#00f3ff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Movement path indicator tracking vector line
    if (Math.sqrt((player.targetX - player.x)**2 + (player.targetY - player.y)**2) > 15) {
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.2)';
        ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.targetX, player.targetY); ctx.stroke();
        ctx.setLineDash([]);
    }

    // Floating UI Vitals Bar
    let barW = 36; let barH = 4;
    ctx.fillStyle = '#141b29';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 12, barW, barH);
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 12, barW * (player.hp / player.maxHp), barH);
}

function gameLoop() {
    update();
    draw();
    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}