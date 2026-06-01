const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const levelEl = document.getElementById('current-level');
const gemCountEl = document.getElementById('gem-count');
const guardCountEl = document.getElementById('guard-count');
const startScreen = document.getElementById('start-screen');
const levelScreen = document.getElementById('level-screen');
const victoryScreen = document.getElementById('victory-screen');
const gameOverScreen = document.getElementById('game-over-screen');

// Game Initialization State Tracking Variables
let gameActive = false;
let currentLevel = 1;
const maxLevels = 5;
let gemsCollected = 0;
let isDragging = false;

let guards = [];
let gems = [];
let bullets = [];
let walls = [];

// Global Map World Limits
const world = {
    width: 1600,
    height: 1200
};

// Dynamic Following View Camera Tracking Window
const camera = {
    x: 0,
    y: 0
};

const player = {
    x: 80, y: 80,
    targetWorldX: 80, targetWorldY: 80,
    radius: 12, speed: 5.0,
    angle: 0, hp: 100, maxHp: 100
};

// Procedural Dynamic Maze Multiplier Array Generators
function generateMassiveMazeLayout(level) {
    const layoutWalls = [];
    const cellSize = 200; // Expanded spatial cell sizing block paths

    // Outer Map Isolation Structural Perimeter Bound Enclosures
    layoutWalls.push({ x: 0, y: 0, w: world.width, h: 20 });
    layoutWalls.push({ x: 0, y: world.height - 20, w: world.width, h: 20 });
    layoutWalls.push({ x: 0, y: 0, w: 20, h: world.height });
    layoutWalls.push({ x: world.width - 20, y: 0, w: 20, h: world.height });

    // Built-in Seed Map Maze Blueprints for 1600x1200 grid array spans
    const architectureTemplates = {
        1: [
            { c: 1, r: 1, w: true, h: false }, { c: 2, r: 3, w: false, h: true },
            { c: 4, r: 1, w: true, h: true },  { c: 5, r: 4, w: true, h: false },
            { c: 3, r: 2, w: false, h: true }, { c: 6, r: 2, w: true, h: true },
            { c: 2, r: 5, w: true, h: false }, { c: 4, r: 4, w: false, h: true }
        ],
        2: [
            { c: 2, r: 1, w: true, h: true },  { c: 3, r: 4, w: true, h: false },
            { c: 1, r: 3, w: false, h: true }, { c: 5, r: 2, w: true, h: true },
            { c: 6, r: 4, w: true, h: false }, { c: 4, r: 3, w: false, h: true },
            { c: 3, r: 1, w: true, h: false }, { c: 5, r: 5, w: false, h: true }
        ],
        3: [
            { c: 1, r: 2, w: true, h: true },  { c: 4, r: 2, w: true, h: true },
            { c: 3, r: 4, w: false, h: true }, { c: 6, r: 1, w: true, h: false },
            { c: 2, r: 3, w: true, h: false }, { c: 5, r: 4, w: true, h: true },
            { c: 4, r: 5, w: true, h: false }, { c: 2, r: 1, w: false, h: true }
        ],
        4: [
            { c: 3, r: 1, w: true, h: true },  { c: 1, r: 4, w: true, h: true },
            { c: 5, r: 3, w: true, h: false }, { c: 2, r: 2, w: false, h: true },
            { c: 6, r: 4, w: true, h: true },  { c: 4, r: 4, w: true, h: false },
            { c: 3, r: 3, w: false, h: true }, { c: 5, r: 1, w: true, h: true }
        ],
        5: [
            { c: 2, r: 2, w: true, h: true },  { c: 5, r: 1, w: true, h: true },
            { c: 1, r: 4, w: false, h: true }, { c: 4, r: 3, w: true, h: false },
            { c: 6, r: 3, w: true, h: true },  { c: 3, r: 5, w: true, h: false },
            { c: 2, r: 4, w: false, h: true }, { c: 5, r: 4, w: true, h: true }
        ]
    };

    const template = architectureTemplates[level] || architectureTemplates[1];
    
    // Extrapolate internal grid layouts into solid canvas coordinate objects
    template.forEach(block => {
        let lx = block.c * cellSize;
        let ly = block.r * cellSize;
        if (block.w) layoutWalls.push({ x: lx, y: ly, w: 30, h: 260 });
        if (block.h) layoutWalls.push({ x: lx, y: ly, w: 260, h: 30 });
    });

    return layoutWalls;
}

// Convert Screen Space Inputs to Absolute World Coordinates System
function translateInputsToWorld(e) {
    const rect = canvas.getBoundingClientRect();
    let screenX = e.clientX - rect.left;
    let screenY = e.clientY - rect.top;

    // Relative offset adding system mapping camera tracking states
    player.targetWorldX = Math.max(player.radius + 20, Math.min(world.width - player.radius - 20, screenX + camera.x));
    player.targetWorldY = Math.max(player.radius + 20, Math.min(world.height - player.radius - 20, screenY + camera.y));
}

canvas.addEventListener('mousedown', (e) => { isDragging = true; translateInputsToWorld(e); });
canvas.addEventListener('mousemove', (e) => { if (isDragging) translateInputsToWorld(e); });
window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('touchstart', (e) => { isDragging = true; translateInputsToWorld(e.touches[0]); e.preventDefault(); }, {passive: false});
canvas.addEventListener('touchmove', (e) => { if (isDragging) { translateInputsToWorld(e.touches[0]); e.preventDefault(); } }, {passive: false});
canvas.addEventListener('touchend', () => { isDragging = false; });

document.getElementById('start-btn').addEventListener('click', () => initializeFloorSector(1));
document.getElementById('next-btn').addEventListener('click', () => initializeFloorSector(currentLevel + 1));
document.getElementById('victory-btn').addEventListener('click', () => initializeFloorSector(1));
document.getElementById('restart-btn').addEventListener('click', () => initializeFloorSector(currentLevel));

function checkWallCollision(x, y, radius) {
    for (let wall of walls) {
        let closestX = Math.max(wall.x, Math.min(x, wall.x + wall.w));
        let closestY = Math.max(wall.y, Math.min(y, wall.y + wall.h));
        if (((x - closestX)**2 + (y - closestY)**2) < (radius * radius)) return true;
    }
    return false;
}

function isLineOfSightBlocked(x1, y1, x2, y2) {
    for (let wall of walls) {
        if (lineIntersectsRect(x1, y1, x2, y2, wall)) return true;
    }
    return false;
}

function lineIntersectsRect(x1, y1, x2, y2, rect) {
    let minX = rect.x, maxX = rect.x + rect.w;
    let minY = rect.y, maxY = rect.y + rect.h;
    if ((x1 < minX && x2 < minX) || (x1 > maxX && x2 > maxX) || (y1 < minY && y2 < minY) || (y1 > maxY && y2 > maxY)) return false;
    
    let m = (y2 - y1) / (x2 - x1);
    let c = y1 - m * x1;
    
    let yAtLeft = m * minX + c;
    if (yAtLeft >= minY && yAtLeft <= maxY) return true;
    let yAtRight = m * maxX + c;
    if (yAtRight >= minY && yAtRight <= maxY) return true;
    
    return false;
}

function getRandomWorldWaypoint() {
    let attempts = 0;
    while(attempts < 400) {
        let wx = Math.random() * (world.width - 150) + 75;
        let wy = Math.random() * (world.height - 150) + 75;
        // Keep initial level spawns clear of player start bubble
        if (!checkWallCollision(wx, wy, 25) && Math.sqrt((wx - 80)**2 + (wy - 80)**2) > 250) {
            return { x: wx, y: wy };
        }
        attempts++;
    }
    return { x: 800, y: 600 };
}

function initializeFloorSector(lvl) {
    currentLevel = lvl;
    walls = generateMassiveMazeLayout(currentLevel);
    
    levelEl.innerText = `${currentLevel}/${maxLevels}`;
    if (lvl === 1) gemsCollected = 0;
    gemCountEl.innerText = gemsCollected;

    // Force positioning coordinates back into starting camp
    player.x = 80; player.y = 80;
    player.targetWorldX = 80; player.targetWorldY = 80;
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

    // Maintained scaled configurations based on original requirements criteria matrix
    if (currentLevel === 1) roster = ['beginner', 'beginner', 'beginner'];
    else if (currentLevel === 2) roster = ['beginner', 'better', 'better'];
    else if (currentLevel === 3) roster = ['beginner', 'better', 'heavy', 'heavy'];
    else if (currentLevel === 4) roster = ['better', 'better', 'heavy', 'heavy'];
    else roster = ['better', 'heavy', 'heavy', 'heavy', 'heavy'];

    roster.forEach(type => {
        let spawn = getRandomWorldWaypoint();
        let targetWP = getRandomWorldWaypoint();
        
        guards.push({
            x: spawn.x, y: spawn.y,
            wpX: targetWP.x, wpY: targetWP.y,
            radius: 14, angle: Math.random() * Math.PI*2,
            type: type,
            state: 'patrol',
            suspiciousTimer: 0,
            speed: type === 'better' ? 2.4 : (type === 'heavy' ? 1.4 : 1.8),
            chaseSpeed: type === 'better' ? 3.4 : (type === 'heavy' ? 2.2 : 2.7),
            shotCooldown: 0,
            maxCooldown: type === 'better' ? 18 : (type === 'heavy' ? 55 : 35),
            damage: type === 'heavy' ? 35 : 12,
            viewDist: type === 'heavy' ? 240 : 190,
            fov: type === 'heavy' ? Math.PI/3.2 : Math.PI/2.4,
            color: type === 'better' ? '#0044ff' : (type === 'heavy' ? '#ff3366' : '#00f3ff')
        });
    });
    guardCountEl.innerText = guards.length;
}

function update() {
    if (!gameActive) return;

    // Movement Calculations tracking vector targets
    let pDx = player.targetWorldX - player.x;
    let pDy = player.targetWorldY - player.y;
    let pDist = Math.sqrt(pDx*pDx + pDy*pDy);

    if (pDist > 4) {
        player.angle = Math.atan2(pDy, pDx);
        let stepX = Math.cos(player.angle) * player.speed;
        let stepY = Math.sin(player.angle) * player.speed;

        if (!checkWallCollision(player.x + stepX, player.y, player.radius)) player.x += stepX;
        if (!checkWallCollision(player.x, player.y + stepY, player.radius)) player.y += stepY;
    }

    // Camera Tracking Locking Mechanics: Clamped directly over player positioning context
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    // Handle Camera layout boundaries limits
    camera.x = Math.max(0, Math.min(world.width - canvas.width, camera.x));
    camera.y = Math.max(0, Math.min(world.height - canvas.height, camera.y));

    // Handle Ballistics Engine loop operations
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

        if (b.x < 0 || b.x > world.width || b.y < 0 || b.y > world.height || checkWallCollision(b.x, b.y, 2)) {
            bullets.splice(i, 1);
        }
    }

    // AI Sentry State Control Core Updates Loops
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

        if (hasLOS) {
            guard.state = 'chase';
            guard.angle = Math.atan2(gDy, gDx);
            
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
            if (guard.state === 'chase') {
                guard.state = 'suspicious';
                guard.suspiciousTimer = 120; // 120 frames = 2 seconds suspicious delay holding states
            }

            if (guard.state === 'suspicious') {
                guard.suspiciousTimer--;
                guard.angle += 0.04 * Math.sin(guard.suspiciousTimer * 0.1);

                if (guard.suspiciousTimer <= 0) {
                    guard.state = 'patrol';
                    let wp = getRandomWorldWaypoint();
                    guard.wpX = wp.x; guard.wpY = wp.y;
                }
            } else if (guard.state === 'patrol') {
                let wDx = guard.wpX - guard.x;
                let wDy = guard.wpY - guard.y;
                let wDist = Math.sqrt(wDx*wDx + wDy*wDy);

                if (wDist < 20) {
                    let wp = getRandomWorldWaypoint();
                    guard.wpX = wp.x; guard.wpY = wp.y;
                } else {
                    guard.angle = Math.atan2(wDy, wDx);
                    let sx = Math.cos(guard.angle) * guard.speed;
                    let sy = Math.sin(guard.angle) * guard.speed;
                    
                    if (checkWallCollision(guard.x + sx, guard.y + sy, guard.radius)) {
                        let wp = getRandomWorldWaypoint();
                        guard.wpX = wp.x; guard.wpY = wp.y;
                    } else {
                        guard.x += sx;
                        guard.y += sy;
                    }
                }
            }
        }

        // Hit Takedown Processing Evaluation
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

    // Collect Rewards Logic Loop
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

    ctx.save();
    // Translate rendering matrix context relative to viewport scrolling window values offsets
    ctx.translate(-camera.x, -camera.y);

    // Floor Grid Network Render Core Maps
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, world.width, world.height);
    ctx.strokeStyle = 'rgba(24, 34, 54, 0.25)';
    ctx.lineWidth = 1;
    let gridSize = 50;
    for(let x=0; x<world.width; x+=gridSize) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,world.height); ctx.stroke(); }
    for(let y=0; y<world.height; y+=gridSize){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(world.width,y); ctx.stroke(); }

    // Render Geometric Walls Matrix
    ctx.fillStyle = '#111724';
    ctx.strokeStyle = '#1d273d';
    ctx.lineWidth = 2;
    walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    });

    // Render Gems
    gems.forEach(gem => {
        ctx.fillStyle = '#00f3ff';
        ctx.shadowBlur = 10; ctx.shadowColor = '#00f3ff';
        ctx.beginPath(); ctx.arc(gem.x, gem.y, 5, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    });

    // Render Projectiles
    ctx.fillStyle = '#ffb800';
    bullets.forEach(b => {
        ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI*2); ctx.fill();
    });

    // Render Guards along with Alert status structures
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

        ctx.fillStyle = guard.color;
        ctx.beginPath(); ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI*2); ctx.fill();

        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.x + Math.cos(guard.angle)*16, guard.y + Math.sin(guard.angle)*16);
        ctx.stroke();

        if (guard.state === 'chase' || guard.state === 'suspicious') {
            ctx.fillStyle = guard.state === 'chase' ? '#ff3366' : '#ffb800';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 20);
        }
    });

    // Render Player Character Avatar Entity
    ctx.fillStyle = '#00f3ff';
    ctx.shadowBlur = 12; ctx.shadowColor = '#00f3ff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Movement Aim Reticle Target indicator path lines
    if (Math.sqrt((player.targetWorldX - player.x)**2 + (player.targetWorldY - player.y)**2) > 15) {
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
        ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.targetWorldX, player.targetWorldY); ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.strokeStyle = '#00f3ff';
        ctx.beginPath(); ctx.arc(player.targetWorldX, player.targetWorldY, 5, 0, Math.PI*2); ctx.stroke();
    }

    // Health Vitals Gauge Bar UI
    let barW = 36; let barH = 4;
    ctx.fillStyle = '#111724';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 12, barW, barH);
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 12, barW * (player.hp / player.maxHp), barH);

    ctx.restore(); // Restore base transform context matrix references
}

function gameLoop() {
    update();
    draw();
    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}