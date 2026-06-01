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

// Big map configurations
const world = { width: 1440, height: 1120 };
const camera = { x: 0, y: 0, zoom: 2.0 };

const player = {
    x: 60, y: 60,
    targetWorldX: 60, targetWorldY: 60,
    radius: 11, speed: 4.2,
    angle: 0, hp: 100, maxHp: 100,
    vx: 0, vy: 0,
    isMoving: false
};

// Tight Strategy Block-Maze Structural Algorithm Generator
function generateDenseTacticalMaze(level) {
    const layoutWalls = [];
    const pathSize = 40;  
    const wallSize = 40;  
    const step = pathSize + wallSize; 

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
    player.targetWorldX = Math.max(player.radius + 40, Math.min(world.width - player.radius - 40, (screenX / camera.zoom) + camera.x));
    player.targetWorldY = Math.max(player.radius + 40, Math.min(world.height - player.radius - 40, (screenY / camera.zoom) + camera.y));
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

// Ray-to-Line Intersection Helper for Raycast System
function getIntersection(ray, segment) {
    const r_px = ray.x1, r_py = ray.y1;
    const r_dx = ray.x2 - ray.x1, r_dy = ray.y2 - ray.y1;

    const s_px = segment.x1, s_py = segment.y1;
    const s_dx = segment.x2 - segment.x1, s_dy = segment.y2 - segment.y1;

    const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
    const s_mag = Math.sqrt(s_dx * s_dx + s_dy * s_dy);

    if (r_dx / r_mag === s_dx / s_mag && r_dy / r_mag === s_dy / s_mag) return null;

    const T2 = (r_dx * (s_py - r_py) + r_dy * (r_px - s_px)) / (s_dx * r_dy - s_dy * r_dx);
    const T1 = (s_px + s_dx * T2 - r_px) / r_dx;

    if (T1 < 0 || T1 > 1 || T2 < 0 || T2 > 1) return null;

    return {
        x: r_px + r_dx * T1,
        y: r_py + r_dy * T1,
        param: T1
    };
}

// Checks if a raw line segment passes through any structural map block
function isLineOfSightBlocked(x1, y1, x2, y2) {
    const ray = { x1: x1, y1: y1, x2: x2, y2: y2 };
    for (let wall of walls) {
        const lines = [
            { x1: wall.x, y1: wall.y, x2: wall.x + wall.w, y2: wall.y },
            { x1: wall.x + wall.w, y1: wall.y, x2: wall.x + wall.w, y2: wall.y + wall.h },
            { x1: wall.x + wall.w, y1: wall.y + wall.h, x2: wall.x, y2: wall.y + wall.h },
            { x1: wall.x, y1: wall.y + wall.h, x2: wall.x, y2: wall.y }
        ];
        for (let line of lines) {
            if (getIntersection(ray, line)) return true;
        }
    }
    return false;
}

// Dynamic Vision Endpoint Calculator (Stops light field arcs cleanly at wall faces)
function getVisionRayEndpoint(guard, angle) {
    const ray = {
        x1: guard.x,
        y1: guard.y,
        x2: guard.x + Math.cos(angle) * guard.viewDist,
        y2: guard.y + Math.sin(angle) * guard.viewDist
    };

    let closestIntersect = null;

    for (let wall of walls) {
        const lines = [
            { x1: wall.x, y1: wall.y, x2: wall.x + wall.w, y2: wall.y },
            { x1: wall.x + wall.w, y1: wall.y, x2: wall.x + wall.w, y2: wall.y + wall.h },
            { x1: wall.x + wall.w, y1: wall.y + wall.h, x2: wall.x, y2: wall.y + wall.h },
            { x1: wall.x, y1: wall.y + wall.h, x2: wall.x, y2: wall.y }
        ];
        for (let line of lines) {
            const intersect = getIntersection(ray, line);
            if (intersect) {
                if (!closestIntersect || intersect.param < closestIntersect.param) {
                    closestIntersect = intersect;
                }
            }
        }
    }
    return closestIntersect ? { x: closestIntersect.x, y: closestIntersect.y } : { x: ray.x2, y: ray.y2 };
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
    player.vx = 0; player.vy = 0;
    player.isMoving = false;

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
            optimalDistance: 120,
            hearRadius: 90 // Sensation bubble width threshold
        });
    });
    guardCountEl.innerText = guards.length;
}

function update() {
    if (!gameActive) return;

    // Movement engine tracking
    let pDx = player.targetWorldX - player.x;
    let pDy = player.targetWorldY - player.y;
    let pDist = Math.sqrt(pDx*pDx + pDy*pDy);

    let moveX = 0;
    let moveY = 0;
    player.isMoving = false;

    if (pDist > 4) {
        player.angle = Math.atan2(pDy, pDx);
        moveX = Math.cos(player.angle) * player.speed;
        moveY = Math.sin(player.angle) * player.speed;
        player.isMoving = true;
    }

    let totalX = moveX + player.vx;
    let totalY = moveY + player.vy;

    if (!checkWallCollision(player.x + totalX, player.y, player.radius)) player.x += totalX;
    if (!checkWallCollision(player.x, player.y + totalY, player.radius)) player.y += totalY;

    player.vx *= 0.85; player.vy *= 0.85;

    camera.x = Math.max(0, Math.min(world.width - (canvas.width / camera.zoom), player.x - (canvas.width / camera.zoom) / 2));
    camera.y = Math.max(0, Math.min(world.height - (canvas.height / camera.zoom), player.y - (canvas.height / camera.zoom) / 2));

    // Projectile tracking loops
    for (let i = bullets.length - 1; i >= 0; i--) {
        let b = bullets[i];
        b.x += Math.cos(b.angle) * b.speed;
        b.y += Math.sin(b.angle) * b.speed;

        let bDx = player.x - b.x;
        let bDy = player.y - b.y;
        if (Math.sqrt(bDx*bDx + bDy*bDy) < player.radius) {
            player.hp -= b.damage;
            let knockPower = b.damage * 0.55; 
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

    // AI Guard Spacing & Audio Tracking Engines
    for (let i = guards.length - 1; i >= 0; i--) {
        let guard = guards[i];
        if (guard.shotCooldown > 0) guard.shotCooldown--;

        let gDx = player.x - guard.x;
        let gDy = player.y - guard.y;
        let distToPlayer = Math.sqrt(gDx*gDx + gDy*gDy);

        let hasLOS = false;
        
        // Sight Check with Raycast Validation
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

        // Footstep Vibration Awareness Engine
        if (!hasLOS && guard.state === 'patrol' && player.isMoving && distToPlayer < guard.hearRadius) {
            if (!isLineOfSightBlocked(guard.x, guard.y, player.x, player.y)) {
                guard.state = 'suspicious';
                guard.suspiciousTimer = 120; // 2 seconds scan status loop delay
                guard.wpX = player.x; guard.wpY = player.y; // Set last known source position coordinates
                guard.angle = Math.atan2(gDy, gDx); // Spin cleanly toward noise footprint
            }
        }

        if (hasLOS) {
            guard.state = 'chase';
            guard.angle = Math.atan2(gDy, gDx);
            
            let moveAngle = guard.angle;
            let speedFactor = guard.chaseSpeed;

            if (distToPlayer < guard.optimalDistance) {
                moveAngle = guard.angle + Math.PI; 
                speedFactor *= 1.25; 
            } else if (distToPlayer > guard.optimalDistance && distToPlayer < guard.optimalDistance + 15) {
                speedFactor = 0; 
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
                
                // Head toward investigation path target if noted
                let wpDx = guard.wpX - guard.x;
                let wpDy = guard.wpY - guard.y;
                let wpDist = Math.sqrt(wpDx*wpDx + wpDy*wpDy);

                if (wpDist > 15) {
                    guard.angle = Math.atan2(wpDy, wpDx);
                    let sx = Math.cos(guard.angle) * guard.speed;
                    let sy = Math.sin(guard.angle) * guard.speed;
                    if (!checkWallCollision(guard.x + sx, guard.y + sy, guard.radius)) {
                        guard.x += sx; guard.y += sy;
                    }
                } else {
                    guard.angle += 0.05 * Math.sin(guard.suspiciousTimer * 0.1); // Look around in alert state
                }

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

        // Takedown logic from behind
        if (distToPlayer < (player.radius + guard.radius + 10)) {
            let approachAngle = Math.atan2(guard.y - player.y, guard.x - player.x) - guard.angle;
            while (approachAngle < -Math.PI) approachAngle += Math.PI * 2;
            while (approachAngle > Math.PI) approachAngle -= Math.PI * 2;

            if (Math.abs(approachAngle) < Math.PI / 1.5) {
                // Trigger Kill Alert Loop to notify nearby sentries
                guards.forEach((otherGuard) => {
                    if (otherGuard !== guard && otherGuard.state === 'patrol') {
                        let oDx = guard.x - otherGuard.x;
                        let oDy = guard.y - otherGuard.y;
                        let distToKill = Math.sqrt(oDx*oDx + oDy*oDy);
                        if (distToKill < 150) { // 150px listening distance for nearby kills
                            otherGuard.state = 'suspicious';
                            otherGuard.suspiciousTimer = 150;
                            otherGuard.wpX = guard.x; otherGuard.wpY = guard.y; // Alert target waypoint to weapon point source
                        }
                    }
                });

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

    // Gem loop processing
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
    
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Map base background mesh
    ctx.fillStyle = '#030508';
    ctx.fillRect(0, 0, world.width, world.height);
    
    // Draw Barriers
    ctx.fillStyle = '#0e131f';
    ctx.strokeStyle = '#182136';
    ctx.lineWidth = 1.5;
    walls.forEach(wall => {
        ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
        ctx.strokeRect(wall.x, wall.y, wall.w, wall.h);
    });

    // Draw Drops
    ctx.fillStyle = '#00f3ff';
    gems.forEach(gem => {
        ctx.beginPath(); ctx.arc(gem.x, gem.y, 4, 0, Math.PI*2); ctx.fill();
    });

    // Draw Bullets
    ctx.fillStyle = '#ffb800';
    bullets.forEach(b => {
        ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI*2); ctx.fill();
    });

    // Draw Guards with Wall-Occluded Dynamic Field Arcs
    guards.forEach(guard => {
        let coneColor = 'rgba(0, 243, 255, 0.15)';
        if (guard.state === 'chase') coneColor = 'rgba(255, 51, 102, 0.15)';
        if (guard.state === 'suspicious') coneColor = 'rgba(255, 184, 0, 0.15)';

        ctx.fillStyle = coneColor;
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);

        // Raycast Vision Generation Loop
        const rayCount = 20; // Number of tracking precision slices across FOV profile width
        const startAngle = guard.angle - guard.fov / 2;
        const angleIncrement = guard.fov / rayCount;

        for (let j = 0; j <= rayCount; j++) {
            let currentAngle = startAngle + (angleIncrement * j);
            let endpoint = getVisionRayEndpoint(guard, currentAngle);
            ctx.lineTo(endpoint.x, endpoint.y);
        }

        ctx.closePath();
        ctx.fill();

        // Draw Guard entity body
        ctx.fillStyle = guard.color;
        ctx.beginPath(); ctx.arc(guard.x, guard.y, guard.radius, 0, Math.PI*2); ctx.fill();

        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.x + Math.cos(guard.angle)*14, guard.y + Math.sin(guard.angle)*14);
        ctx.stroke();

        if (guard.state === 'chase' || guard.state === 'suspicious') {
            ctx.fillStyle = guard.state === 'chase' ? '#ff3366' : '#ffb800';
            ctx.font = 'bold 12px sans-serif'; 
            ctx.textAlign = 'center';
            ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 15);
        }
    });

    // Draw Master Assassin Operative
    ctx.fillStyle = '#00f3ff';
    ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2); ctx.fill();

    // Visual tracking path indicators
    if (Math.sqrt((player.targetWorldX - player.x)**2 + (player.targetWorldY - player.y)**2) > 15) {
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(player.targetWorldX, player.targetWorldY); ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.strokeStyle = '#00f3ff';
        ctx.beginPath(); ctx.arc(player.targetWorldX, player.targetWorldY, 3, 0, Math.PI*2); ctx.stroke();
    }

    // Health UI floating bars block
    let barW = 30; let barH = 3;
    ctx.fillStyle = '#0e131f';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 10, barW, barH);
    ctx.fillStyle = '#00f3ff';
    ctx.fillRect(player.x - barW/2, player.y - player.radius - 10, barW * (player.hp / player.maxHp), barH);

    ctx.restore(); 
}

function gameLoop() {
    update();
    draw();
    if (gameActive) {
        requestAnimationFrame(gameLoop);
    }
}