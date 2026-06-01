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

// Big map boundaries
const world = { width: 1440, height: 1120 };
const camera = { x: 0, y: 0 };

// Player entity with added physics vectors
const player = {
    x: 60, y: 60,
    targetWorldX: 60, targetWorldY: 60,
    radius: 11, speed: 4.2,
    angle: 0, hp: 100, maxHp: 100,
    visionRadius: 180,
    vx: 0, vy: 0 // Physics momentum storage variables
};

// Tight Strategy Block-Maze Structural Algorithm Generator
function generateDenseTacticalMaze(level) {
    const layoutWalls = [];
    const pathSize = 40;  
    const wallSize = 40;  
    const step = pathSize + wallSize; 

    // Hard borders
    layoutWalls.push({ x: 0, y: 0, w: world.width, h: wallSize });
    layoutWalls.push({ x: 0, y: world.height - wallSize, w: world.width, h: wallSize });
    layoutWalls.push({ x: 0, y: 0, w: wallSize, h: world.height });
    layoutWalls.push({ x: world.width - wallSize, y: 0, w: wallSize, h: world.height });

    for (let x = step; x < world.width - wallSize; x += step) {
        for (let y = step; y < world.height - wallSize; y += step) {
            let seed = Math.sin(x * 0.05) + Math.cos(y * 0.05) + Math.sin(level * 5);
            let pseudoRandom = Math.abs(seed) % 1;

            if (pseudoRandom > 0.28) {
                layoutWalls.push({ x: x, y: y, w: wallSize, h: wallSize });
                if (pseudoRandom > 0.65) {
                    layoutWalls.push({ x: x - pathSize, y: y, w: pathSize, h: wallSize });
                } else if (pseudoRandom > 0.45) {
                    layoutWalls.push({ x: x, y: y - pathSize, w: wallSize, h: pathSize });
                }
            }
        }
    }
    return layoutWalls.filter(w => !(w.x < 160 && w.y < 160));
}

function translateInputsToWorld(e) {
    const rect = canvas.getBoundingClientRect();
    let screenX = e.clientX - rect.left;
    let screenY = e.clientY - rect.top;
    player.targetWorldX = Math.max(player.radius + 40, Math.min(world.width - player.radius - 40, screenX + camera.x));
    player.targetWorldY = Math.max(player.radius + 40, Math.min(world.height - player.radius - 40, screenY + camera.y));
}

canvas.addEventListener('mousedown', (e) => { isDragging = true; translateInputsToWorld(e); });
canvas.addEventListener('mousemove', (e) => { if (isDragging) translateInputsToWorld(e); });
window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('touchstart', (e) => { isDragging = true; translateInputsToWorld(e.touches[0]); e.preventDefault(); }, {passive: false});
canvas.addEventListener('touchmove', (e) => { if (isDragging) { translateInputsToWorld(e.touches[0]); e.preventDefault(); } }, {passive: false});
canvas.addEventListener('touchend', () => { isDragging = false; });

document.getElementById('start-btn').addEventListener('click', () => initializeTacticalSector(1));
document.getElementById('next-btn').addEventListener('click', () => initializeTacticalSector(currentLevel + 1));
document.getElementById('victory-btn').addEventListener('click', () => initializeTacticalSector(1));
document.getElementById('restart-btn').addEventListener('click', () => initializeTacticalSector(currentLevel));

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

function getSafeWorldWaypoint() {
    let attempts = 0;
    while(attempts < 600) {
        let wx = Math.random() * (world.width - 160) + 80;
        let wy = Math.random() * (world.height - 160) + 80;
        if (!checkWallCollision(wx, wy, 16) && Math.sqrt((wx - 60)**2 + (wy - 60)**2) > 300) {
            return { x: wx, y: wy };
        }
        attempts++;
    }
    return { x: 220, y: 220 };
}

function initializeTacticalSector(lvl) {
    currentLevel = lvl;
    walls = generateDenseTacticalMaze(currentLevel);
    
    levelEl.innerText = `${currentLevel}/${maxLevels}`;
    if (lvl === 1) gemsCollected = 0;
    gemCountEl.innerText = gemsCollected;

    player.x = 60; player.y = 60;
    player.targetWorldX = 60; player.targetWorldY = 60;
    player.hp = player.maxHp;
    player.angle = 0;
    player.vx = 0; player.vy = 0; // Clear residual vectors

    bullets = []; gems = [];
    populateSectorGuards();

    startScreen.classList.remove('active');
    levelScreen.classList.remove('active');
    victoryScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');

    gameActive = true;
    requestAnimationFrame(gameLoop);
}

function populateSectorGuards() {
    guards = [];
    let roster = [];

    if (currentLevel === 1) roster = ['beginner', 'beginner', 'beginner'];
    else if (currentLevel === 2) roster = ['beginner', 'better', 'better'];
    else if (currentLevel === 3) roster = ['beginner', 'better', 'heavy', 'heavy'];
    else if (currentLevel === 4) roster = ['better', 'better', 'heavy', 'heavy'];
    else roster = ['better', 'heavy', 'heavy', 'heavy', 'heavy'];

    roster.forEach(type => {
        let spawn = getSafeWorldWaypoint();
        let targetWP = getSafeWorldWaypoint();
        
        guards.push({
            x: spawn.x, y: spawn.y,
            wpX: targetWP.x, wpY: targetWP.y,
            radius: 12, angle: Math.random() * Math.PI*2,
            type: type,
            state: 'patrol',
            suspiciousTimer: 0,
            speed: type === 'better' ? 2.2 : (type === 'heavy' ? 1.3 : 1.7),
            chaseSpeed: type === 'better' ? 2.8 : (type === 'heavy' ? 1.8 : 2.3),
            shotCooldown: 0,
            maxCooldown: type === 'better' ? 20 : (type === 'heavy' ? 60 : 40),
            damage: type === 'heavy' ? 40 : 15,
            viewDist: type === 'heavy' ? 220 : 160, 
            fov: type === 'heavy' ? Math.PI/3.5 : Math.PI/2.4,
            color: type === 'better' ? '#0044ff' : (type === 'heavy' ? '#ff3366' : '#00f3ff'),
            optimalDistance: 120 // Target radius threshold where AI stalls and backs up
        });
    });
    guardCountEl.innerText = guards.length;
}

function update() {
    if (!gameActive) return;

    // Movement Engine Tracking Input Vector
    let pDx = player.targetWorldX - player.x;
    let pDy = player.targetWorldY - player.y;
    let pDist = Math.sqrt(pDx*pDx + pDy*pDy);

    let moveX = 0;
    let moveY = 0;

    if (pDist > 4) {
        player.angle = Math.atan2(pDy, pDx);
        moveX = Math.cos(player.angle) * player.speed;
        moveY = Math.sin(player.angle) * player.speed;
    }

    // Integrate Physics Knockback Forces
    let totalX = moveX + player.vx;
    let totalY = moveY + player.vy;

    if (!checkWallCollision(player.x + totalX, player.y, player.radius)) player.x += totalX;
    if (!checkWallCollision(player.x, player.y + totalY, player.radius)) player.y += totalY;

    // Apply linear dampening/friction decay to knockback velocity
    player.vx *= 0.85;
    player.vy *= 0.85;
    if (Math.abs(player.vx) < 0.1) player.vx = 0;
    if (Math.abs(player.vy) < 0.1) player.vy = 0;

    // Camera Window Interpolation
    camera.x = Math.max(0, Math.min(world.width - canvas.width, player.x - canvas.width / 2));
    camera.y = Math.max(0, Math.min(world.height - canvas.height, player.y - canvas.height / 2));

    // Handle Ballistic Impact Vectors and Knockback Triggers
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        let bDx = player.x - b.x;
        let bDy = player.y - b.y;
        if (Math.sqrt(bDx*bDx + bDy*bDy) < player.radius) {
            player.hp -= b.damage;
            
            // Apply knockback momentum matching bullet angle heading
            let knockPower = b.damage * 0.6; // Heavy bullets punch back drastically harder
            player.vx += Math.cos(b.angle) * knockPower;
            player.vy += Math.sin(b.angle) * knockPower;

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

    // AI Space-Aware Tactical Spacing Engine
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
            
            let moveAngle = guard.angle;
            let speedFactor = guard.chaseSpeed;

            // Kiting Mechanism: If too close, reverse movement heading to step backwards
            if (distToPlayer < guard.optimalDistance) {
                moveAngle = guard.angle + Math.PI; // Run directly backward away from player
                speedFactor *= 1.2; // Extra speed burst to backpedal from ambush charges
            } else if (distToPlayer > guard.optimalDistance && distToPlayer < guard.optimalDistance + 20) {
                speedFactor = 0; // Hold ground at perfect shooting distance
            }

            let cx = Math.cos(moveAngle) * speedFactor;
            let cy = Math.sin(moveAngle) * speedFactor;
            
            if (!checkWallCollision(guard.x + cx, guard.y, guard.radius)) guard.x += cx;
            if (!checkWallCollision(guard.x, guard.y + cy, guard.radius)) guard.y += cy;

            if (guard.shotCooldown === 0) {
                bullets.push({ x: guard.x, y: guard.y, angle: guard.angle, speed: 6.5, damage: guard.damage });
                guard.shotCooldown = guard.maxCooldown;
            }
        } else {
            if (guard.state === 'chase') {
                guard.state = 'suspicious';
                guard.suspiciousTimer = 120;
            }

            if (guard.state === 'suspicious') {
                guard.suspiciousTimer--;
                guard.angle += 0.05 * Math.sin(guard.suspiciousTimer * 0.1);

                if (guard.suspiciousTimer <= 0) {
                    guard.state = 'patrol';
                    let wp = getSafeWorldWaypoint();
                    guard.wpX = wp.x; guard.wpY = wp.y;
                }
            } else if (guard.state === 'patrol') {
                let wDx = guard.wpX - guard.x;
                let wDy = guard.wpY - guard.y;
                let wDist = Math.sqrt(wDx*wDx + wDy*wDy);

                if (wDist < 20) {
                    let wp = getSafeWorldWaypoint();
                    guard.wpX = wp.x; guard.wpY = wp.y;
                } else {
                    guard.angle = Math.atan2(wDy, wDx);
                    let sx = Math.cos(guard.angle) * guard.speed;
                    let sy = Math.sin(guard.angle) * guard.speed;
                    
                    if (checkWallCollision(guard.x + sx, guard.y + sy, guard.radius)) {
                        let wp = getSafeWorldWaypoint();
                        guard.wpX = wp.x; guard.wpY = wp.y;
                    } else {
                        guard.x += sx;
                        guard.y += sy;
                    }
                }
            }
        }

        // Execution Check (Must ambush from behind to neutralize)
        if (distToPlayer < (player.radius + guard.radius + 10)) {
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

    // Gems loop
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
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    // Map Grid Floor Matrix
    ctx.fillStyle = '#030508';
    ctx.fillRect(0, 0, world.width, world.height);
    
    // Draw Level Layout blocks
    ctx.fillStyle = '#0a0e17';
    ctx.strokeStyle = '#121929';
    ctx.lineWidth = 1.5;
    walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    });

    // Draw Drop Gems
    gems.forEach(gem => {
        let dist = Math.sqrt((player.x - gem.x)**2 + (player.y - gem.y)**2);
        if (dist <= player.visionRadius) {
            ctx.fillStyle = '#00f3ff';
            ctx.beginPath(); ctx.arc(gem.x, gem.y, 4, 0, Math.PI*2); ctx.fill();
        }
    });

    // Draw Laser Projectiles
    ctx.fillStyle = '#ffb800';
    bullets.forEach(b => {
        let dist = Math.sqrt((player.x - b.x)**2 + (player.y - b.y)**2);
        if (dist <= player.visionRadius) {
            ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI*2); ctx.fill();
        }
    });

    // Draw Guards
    guards.forEach(guard => {
        let dist = Math.sqrt((player.x - guard.x)**2 + (player.y - guard.y)**2);
        if (dist > player.visionRadius) return; 

        let coneAlpha = 'rgba(0, 243, 255,';
        if (guard.state === 'chase') coneAlpha = 'rgba(255, 51, 102,';
        if (guard.state === 'suspicious') coneAlpha = 'rgba(255, 184, 0,';

        let viewGrad = ctx.createRadialGradient(guard.x, guard.y, 4, guard.x, guard.y, guard.viewDist);
        viewGrad.addColorStop(0, `${coneAlpha}0.20)`);
        viewGrad.addColorStop(1, `${coneAlpha}0.0)`);

        ctx.fillStyle = viewGrad;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.arc(guard.x, guard.y, guard.viewDist, guard.angle - guard.fov/2, guard.angle + guard.fov/2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = guard.color;
        ctx.beginPath(); ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI*2); ctx.fill();

        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.x + Math.cos(guard.angle)*14, guard.y + Math.sin(guard.angle)*14);
        ctx.stroke();

        if (guard.state === 'chase' || guard.state === 'suspicious') {
            ctx.fillStyle = guard.state === 'chase' ? '#ff3366' : '#ffb800';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 18);
        }
    });

    // Draw Master Assassin
    ctx.fillStyle = '#00f3ff';
    ctx.shadowBlur = 12; ctx.shadowColor = '#00f3ff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // Target tracking indicators
    if (Math.sqrt((player.targetWorldX - player.x)**2 + (player.targetWorldY - player.y)**2) > 15) {
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
        ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.targetWorldX, player.targetWorldY); ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.strokeStyle = '#00f3ff';
        ctx.beginPath(); ctx.arc(player.targetWorldX, player.targetWorldY, 4, 0, Math.PI*2); stroke();
    }

    // Health UI metric block
    let barW = 30; let barH = 3;
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 10, barW, barH);
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 10, barW * (player.hp / player.maxHp), barH);

    ctx.restore(); 

    // Vignette Screen Overlay Mask (Tactical Fog)
    let screenPlayerX = player.x - camera.x;
    let screenPlayerY = player.y - camera.y;

    let fogGradient = ctx.createRadialGradient(
        screenPlayerX, screenPlayerY, player.visionRadius * 0.4, 
        screenPlayerX, screenPlayerY, player.visionRadius        
    );
    fogGradient.addColorStop(0, 'rgba(0,0,0,0)');
    fogGradient.addColorStop(0.8, 'rgba(0,0,0,0.85)');
    fogGradient.addColorStop(1, 'rgba(0,0,0,1)');

    ctx.fillStyle = fogGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function gameLoop() {
    update();
    draw();
    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}