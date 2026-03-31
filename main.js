const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlay = document.getElementById("overlay");
const restartButton = document.getElementById("restartButton");
const menuButton = document.getElementById("menuButton");
const clearLeaderboardButton = document.getElementById("clearLeaderboardButton");
const leaderboardList = document.getElementById("leaderboardList");
const rulesList = document.getElementById("rulesList");
const rulesTitle = document.getElementById("rulesTitle");

const playerNameLabel = document.getElementById("playerNameLabel");
const gameLabel = document.getElementById("gameLabel");
const scoreLabel = document.getElementById("scoreLabel");
const livesLabel = document.getElementById("livesLabel");
const progressLabel = document.getElementById("progressLabel");
const progressTitleLabel = document.getElementById("progressTitleLabel");
const shipLabel = document.getElementById("shipLabel");
const weaponLabel = document.getElementById("weaponLabel");
const specialLabel = document.getElementById("specialLabel");
const dangerLabel = document.getElementById("dangerLabel");
const dangerChip = document.getElementById("dangerChip");

const STORAGE_KEY = "coachpro-arcade-leaderboard";
const PROFILE_KEY = "coachpro-arcade-profile";
const PLAYER_SHIP_SRC = "./player_spaceship.png";
const ENEMY_SHIP_SRC = "./enemy_spaceship.png";
const ENEMY2_SHIP_SRC = "./enemy2.png";
const ENEMY3_SHIP_SRC = "./enemy3.png";
const BOSS_SHIP_SRC = "./boss_spaceship.png";
const BOSS_LEVEL2_SHIP_SRC = "./boss_level2.png";
const BOSS2_SHIP_SRC = "./boss2.png";
const SHIP_DEFS = {
  starter: { id: "starter", name: "Базовый", asset: PLAYER_SHIP_SRC, cost: 0, description: "Стандартный одиночный выстрел.", weapon: "starter" },
  mk1: { id: "mk1", name: "МК-1", asset: "./mk1.png", cost: 1500, description: "Стреляет двумя пулями сразу.", weapon: "double" },
  mk2: { id: "mk2", name: "МК-2", asset: "./mk2.png", cost: 3200, description: "Раз в 5 секунд выпускает энергетический луч.", weapon: "beam" },
  mk3: { id: "mk3", name: "МК-3", asset: "./mk3.png", cost: 5600, description: "Стреляет ракетами со взрывом по области.", weapon: "rocket" },
  mk4: { id: "mk4", name: "МК-4", asset: "./mk4.png", cost: 9200, description: "Стреляет огненными шарами очень быстро и больно.", weapon: "fireball" }
};
const GAME_RULES = {
  menu: [
    "Введи имя игрока, выбери корабль и запускай SPACE INVADERS.",
    "Очки за прохождение попадают в таблицу рекордов и копятся как кредиты для магазина.",
    "Во время игры доступны рестарт и возврат в главное меню."
  ],
  invaders: [
    "Двигай корабль стрелками или клавишами A и D.",
    "Стреляй пробелом и не подпускай флот слишком низко.",
    "Теперь режим состоит из трех уровней, и после каждой волны появляется свой босс.",
    "Враги уровня 2 быстрее на 15%, а враги уровня 3 имеют по 2 HP.",
    "Подбирай power-up: +1 восстанавливает жизнь, +100 дает быстрый бонус, а +500 выпадает очень редко."
  ]
};

const app = {
  screen: "menu",
  playerName: "Гость",
  lastFrame: performance.now(),
  keys: new Set(),
  gameOverSaved: false,
  profile: loadProfile(),
  assets: {
    playerShip: loadImage(PLAYER_SHIP_SRC),
    enemyShip: loadImage(ENEMY_SHIP_SRC),
    enemy2Ship: loadImage(ENEMY2_SHIP_SRC),
    enemy3Ship: loadImage(ENEMY3_SHIP_SRC),
    bossShip: loadImage(BOSS_SHIP_SRC),
    bossLevel2Ship: loadImage(BOSS_LEVEL2_SHIP_SRC),
    boss2Ship: loadImage(BOSS2_SHIP_SRC),
    shopShips: Object.fromEntries(Object.values(SHIP_DEFS).map((ship) => [ship.id, loadImage(ship.asset)]))
  },
  invaders: null
};

function createInvadersState() {
  const selectedShip = getSelectedShip();
  return {
    player: { x: canvas.width / 2 - 34, y: canvas.height - 78, width: 68, height: 68, speed: 360 },
    bullets: [],
    enemyBullets: [],
    enemies: createInvaderWave(1),
    boss: null,
    explosions: [],
    powerUps: [],
    beams: [],
    enemyDirection: 1,
    enemySpeed: 36,
    enemyStepDown: 18,
    enemyShootInterval: 0.85,
    shootCooldown: 0,
    enemyShootTimer: 0,
    bossRocketTimer: 0,
    bossRocketTelegraphTimer: 0,
    bossHitFlash: 0,
    playerHitFlash: 0,
    playerHealFlash: 0,
    floatingTexts: [],
    screenShake: 0,
    level: 1,
    bossStage: 0,
    playerShotLevel: 1,
    rapidFireTimer: 0,
    selectedShipId: selectedShip.id,
    specialCooldown: selectedShip.weapon === "beam" ? 5 : 0,
    phase: "wave",
    score: 0,
    lives: 3
  };
}

function getWeaponLabel(ship) {
  switch (ship.weapon) {
    case "double":
      return "Двойной выстрел";
    case "beam":
      return "Энерголуч";
    case "rocket":
      return "AOE-ракеты";
    case "fireball":
      return "Огненные шары";
    default:
      return "Стандартный выстрел";
  }
}

function getSpecialStatus(game, ship) {
  if (!game) {
    return "Вне боя";
  }

  if (ship.weapon === "beam") {
    return game.specialCooldown <= 0 ? "Луч готов" : `Луч: ${game.specialCooldown.toFixed(1)}с`;
  }

  if (ship.weapon === "rocket") {
    return "Взрыв по области";
  }

  if (ship.weapon === "fireball") {
    return "Высокий DPS";
  }

  if (ship.weapon === "double") {
    return "2 снаряда за залп";
  }

  return "Готов";
}

function getDangerStatus(game) {
  if (!game) {
    return { text: "Нет угроз", safe: true };
  }

  if (game.phase === "boss" && game.boss?.telegraphActive) {
    return { text: "Ракета босса!", safe: false };
  }

  if (game.phase === "boss" && game.bossStage === 2 && game.boss?.invulnerable) {
    return { text: "Щит босса активен", safe: false };
  }

  if (game.phase === "boss" && game.bossStage === 3) {
    return { text: "Самонаводящиеся снаряды", safe: false };
  }

  if (game.phase === "boss" && game.bossStage === 2) {
    return { text: "Усиленный залп и ракеты", safe: false };
  }

  return { text: "Нет угроз", safe: true };
}

function updateHud({
  game = "Меню",
  score = 0,
  lives = 0,
  progressTitle = "Прогресс",
  progress = 0,
  shipName = "Базовый",
  weapon = "Стандартный выстрел",
  special = "Вне боя",
  danger = "Нет угроз",
  dangerSafe = true
} = {}) {
  playerNameLabel.textContent = app.playerName;
  gameLabel.textContent = game;
  scoreLabel.textContent = String(score);
  livesLabel.textContent = String(lives);
  progressTitleLabel.textContent = progressTitle;
  progressLabel.textContent = String(progress);
  shipLabel.textContent = shipName;
  weaponLabel.textContent = weapon;
  specialLabel.textContent = special;
  dangerLabel.textContent = danger;
  dangerChip.classList.toggle("safe", dangerSafe);
}

function setRules(mode) {
  const rules = GAME_RULES[mode];
  rulesList.innerHTML = "";
  rules.forEach((rule) => {
    const item = document.createElement("li");
    item.textContent = rule;
    rulesList.append(item);
  });
  rulesTitle.textContent = mode === "invaders" ? "SPACE INVADERS" : "Как играть";
}

function getLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveLeaderboard(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function renderLeaderboard() {
  const entries = getLeaderboard();
  leaderboardList.innerHTML = "";

  if (!entries.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "leaderboard-empty";
    emptyItem.textContent = "Пока нет результатов. Запусти любую игру и поставь первый рекорд.";
    leaderboardList.append(emptyItem);
    return;
  }

  entries.forEach((entry) => {
    const item = document.createElement("li");
    const metaWrap = document.createElement("div");
    const name = document.createElement("strong");
    const meta = document.createElement("span");
    const score = document.createElement("strong");

    name.textContent = entry.name;
    meta.className = "leaderboard-meta";
    meta.textContent = `${entry.game} • ${entry.date}`;
    score.textContent = String(entry.score);

    metaWrap.append(name, meta);
    item.append(metaWrap, score);
    leaderboardList.append(item);
  });
}

function persistScore(game, score) {
  if (app.gameOverSaved) {
    return;
  }

  const entries = getLeaderboard();
  entries.push({
    name: app.playerName,
    game,
    score,
    date: new Date().toLocaleDateString("ru-RU")
  });

  entries.sort((a, b) => b.score - a.score);
  saveLeaderboard(entries.slice(0, 12));
  app.profile.credits += score;
  app.profile.lifetimeScore += score;
  saveProfile();
  app.gameOverSaved = true;
  renderLeaderboard();
}

function showMenu() {
  app.screen = "menu";
  app.gameOverSaved = false;
  const ship = getSelectedShip();
  updateHud({
    game: "SPACE INVADERS",
    shipName: ship.name,
    weapon: getWeaponLabel(ship),
    special: "Вне боя",
    danger: "Нет угроз",
    dangerSafe: true
  });
  setRules("menu");

  overlay.innerHTML = `
    <div class="overlay-card">
      <p class="eyebrow">Main Menu</p>
      <h2>Запуск боя и магазин кораблей</h2>
      <p>Введи имя игрока, выбери свой корабль и запускай SPACE INVADERS. Очки за прохождение сохраняются в таблице рекордов и превращаются в кредиты для магазина.</p>
      <div class="game-facts">
        <span class="fact-chip">Кредиты: ${app.profile.credits}</span>
        <span class="fact-chip">Всего очков: ${app.profile.lifetimeScore}</span>
        <span class="fact-chip">Выбран: ${escapeHtml(getSelectedShip().name)}</span>
      </div>
      <label class="player-input">
        <span>Имя игрока</span>
        <input id="playerNameInput" type="text" maxlength="16" placeholder="Например, Alex" value="${escapeHtml(app.playerName === "Гость" ? "" : app.playerName)}">
      </label>
      <div class="menu-grid">
        <article class="game-card">
          <p class="eyebrow">Campaign</p>
          <h3>SPACE INVADERS</h3>
          <p>Три уровня, три босса, магазин кораблей и постоянный прогресс между сессиями.</p>
          <div class="game-facts">
            <span class="fact-chip">A / D</span>
            <span class="fact-chip">Пробел</span>
            <span class="fact-chip">3 уровня</span>
          </div>
          <div class="menu-card-actions">
            <button class="primary-button start-invaders-button" type="button">Играть в SPACE INVADERS</button>
          </div>
        </article>
        <article class="game-card">
          <p class="eyebrow">Hangar</p>
          <h3>Магазин кораблей</h3>
          <p>Открой ангар, чтобы купить новые корпуса, выбрать активный корабль и посмотреть вооружение.</p>
          <div class="game-facts">
            <span class="fact-chip">${app.profile.ownedShips.length} куплено</span>
            <span class="fact-chip">${escapeHtml(getSelectedShip().name)}</span>
          </div>
          <div class="menu-card-actions">
            <button class="ghost-button open-shop-button" type="button">Открыть магазин</button>
          </div>
        </article>
      </div>
    </div>
  `;

  overlay.classList.add("visible");

  const input = overlay.querySelector("#playerNameInput");
  overlay.querySelector(".start-invaders-button").addEventListener("click", () => {
    app.playerName = input.value.trim() || "Гость";
    startGame();
  });
  overlay.querySelector(".open-shop-button").addEventListener("click", () => {
    app.playerName = input.value.trim() || "Гость";
    showShopMenu();
  });
}

function showShopMenu() {
  app.screen = "menu";
  const ship = getSelectedShip();
  updateHud({
    game: "SPACE INVADERS",
    shipName: ship.name,
    weapon: getWeaponLabel(ship),
    special: "Ангар",
    danger: "Нет угроз",
    dangerSafe: true
  });
  setRules("menu");

  overlay.innerHTML = `
    <div class="overlay-card">
      <p class="eyebrow">Hangar</p>
      <h2>Магазин кораблей</h2>
      <p>Покупай новые корпуса за кредиты и выбирай активный корабль для следующего забега.</p>
      <div class="game-facts">
        <span class="fact-chip">Кредиты: ${app.profile.credits}</span>
        <span class="fact-chip">Всего очков: ${app.profile.lifetimeScore}</span>
        <span class="fact-chip">Выбран: ${escapeHtml(getSelectedShip().name)}</span>
      </div>
      <div class="menu-grid">
        ${renderShopCards()}
      </div>
      <div class="menu-card-actions">
        <button class="ghost-button back-to-main-button" type="button">Назад в меню</button>
      </div>
    </div>
  `;

  overlay.classList.add("visible");
  overlay.querySelector(".back-to-main-button").addEventListener("click", showMenu);

  overlay.querySelectorAll(".shop-action-button").forEach((button) => {
    button.addEventListener("click", () => {
      const shipId = button.dataset.shipId;
      const ship = SHIP_DEFS[shipId];
      const owned = app.profile.ownedShips.includes(shipId);

      if (!owned) {
        if (app.profile.credits < ship.cost) {
          return;
        }
        app.profile.credits -= ship.cost;
        app.profile.ownedShips.push(shipId);
      }

      app.profile.selectedShipId = shipId;
      saveProfile();
      showShopMenu();
    });
  });
}

function showGameOver(title, description) {
  overlay.innerHTML = `
    <div class="overlay-card">
      <p class="eyebrow">Result</p>
      <h2>${title}</h2>
      <p>${description}</p>
      <div class="game-facts">
        <span class="fact-chip">Игрок: ${escapeHtml(app.playerName)}</span>
        <span class="fact-chip">Режим: SPACE INVADERS</span>
        <span class="fact-chip">Кредиты: ${app.profile.credits}</span>
      </div>
      <div class="menu-grid">
        <article class="game-card">
          <h3>Повторить</h3>
          <p>Сразу перезапустить текущий режим и попытаться побить свой же рекорд.</p>
          <div class="menu-card-actions">
            <button id="playAgainButton" class="primary-button" type="button">Играть еще</button>
          </div>
        </article>
        <article class="game-card">
          <h3>Вернуться в меню</h3>
          <p>Выбрать другую игру, сменить имя игрока или просто посмотреть таблицу рекордов.</p>
          <div class="menu-card-actions">
            <button id="backToMenuButton" class="ghost-button" type="button">Главное меню</button>
          </div>
        </article>
      </div>
    </div>
  `;

  overlay.classList.add("visible");
  overlay.querySelector("#playAgainButton").addEventListener("click", () => startGame());
  overlay.querySelector("#backToMenuButton").addEventListener("click", showMenu);
}

function startGame() {
  app.screen = "playing";
  app.gameOverSaved = false;
  overlay.classList.remove("visible");
  app.invaders = createInvadersState();
  setRules("invaders");
  syncInvadersHud();
}

function restartCurrentGame() {
  startGame();
}

function finishCurrentGame(victory, score) {
  if (app.screen !== "playing") {
    return;
  }

  app.screen = "gameover";
  const gameTitle = "SPACE INVADERS";
  persistScore(gameTitle, score);
  showGameOver(
    victory ? "Победа!" : "Игра окончена",
    victory
      ? `Ты прошел режим "${gameTitle}" и набрал ${score} очков.`
      : `Раунд "${gameTitle}" завершен. Итоговый счет: ${score} очков.`
  );
}

function syncInvadersHud() {
  const selectedShip = SHIP_DEFS[app.invaders.selectedShipId] || SHIP_DEFS.starter;
  const enemiesLeft = app.invaders.enemies.filter((enemy) => enemy.alive).length;
  const bossHp = app.invaders.boss ? app.invaders.boss.hp : 0;
  const danger = getDangerStatus(app.invaders);
  updateHud({
    game: `SPACE INVADERS L${app.invaders.level}`,
    score: app.invaders.score,
    lives: app.invaders.lives,
    progressTitle: app.invaders.phase === "boss" ? "Босс HP" : "Враги",
    progress: app.invaders.phase === "boss" ? bossHp : enemiesLeft,
    shipName: selectedShip.name,
    weapon: getWeaponLabel(selectedShip),
    special: getSpecialStatus(app.invaders, selectedShip),
    danger: danger.text,
    dangerSafe: danger.safe
  });
}

function pushFloatingText(game, x, y, text, color) {
  game.floatingTexts.push({
    x,
    y,
    text,
    color,
    life: 0.7
  });
}

function damagePlayer(game, amount, source = "hit") {
  const playerCenterX = game.player.x + game.player.width / 2;
  const playerCenterY = game.player.y + game.player.height / 2;
  game.lives -= amount;
  game.playerHitFlash = 1;
  game.screenShake = Math.max(game.screenShake, source === "rocket" ? 0.42 : 0.28);
  game.explosions.push({
    x: playerCenterX,
    y: playerCenterY,
    radius: source === "rocket" ? 36 : 24,
    life: 0.2,
    color: source === "rocket" ? "rgba(255, 123, 0, 0.42)" : "rgba(255, 93, 115, 0.42)"
  });
  pushFloatingText(game, playerCenterX, game.player.y - 12, `-${amount} HP`, "#ff8fa3");
}

function drawMenuBackdrop() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#050b14");
  gradient.addColorStop(1, "#11263d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(123, 223, 242, 0.15)";
  for (let i = 0; i < 120; i += 1) {
    ctx.fillRect((i * 83) % canvas.width, (i * 47) % canvas.height, 2, 2);
  }

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.textAlign = "center";
  ctx.font = '700 34px "Manrope", sans-serif';
  ctx.fillText("CoachPro Arcade", canvas.width / 2, canvas.height / 2 - 18);
  ctx.font = '500 18px "Manrope", sans-serif';
  ctx.fillText("Меню выбора игры открыто поверх игрового поля", canvas.width / 2, canvas.height / 2 + 18);
}

function bossIsInvulnerable(game) {
  return game.phase === "boss" && game.bossStage === 2 && Boolean(game.boss?.invulnerable);
}

function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.ownedShips)) {
      return {
        credits: parsed.credits || 0,
        lifetimeScore: parsed.lifetimeScore || 0,
        ownedShips: parsed.ownedShips.includes("starter") ? parsed.ownedShips : ["starter", ...parsed.ownedShips],
        selectedShipId: parsed.selectedShipId || "starter"
      };
    }
  } catch (error) {
    return {
      credits: 0,
      lifetimeScore: 0,
      ownedShips: ["starter"],
      selectedShipId: "starter"
    };
  }

  return {
    credits: 0,
    lifetimeScore: 0,
    ownedShips: ["starter"],
    selectedShipId: "starter"
  };
}

function saveProfile() {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(app.profile));
}

function getSelectedShip() {
  return SHIP_DEFS[app.profile.selectedShipId] || SHIP_DEFS.starter;
}

function renderShopCards() {
  return Object.values(SHIP_DEFS)
    .map((ship) => {
      const owned = app.profile.ownedShips.includes(ship.id);
      const selected = app.profile.selectedShipId === ship.id;
      const buttonLabel = selected ? "Выбран" : owned ? "Выбрать" : `Купить за ${ship.cost}`;
      const disabled = !owned && app.profile.credits < ship.cost;

      return `
        <article class="game-card">
          <p class="eyebrow">Shop</p>
          <img class="shop-preview" src="${ship.asset}" alt="${ship.name}">
          <h3>${ship.name}</h3>
          <p>${ship.description}</p>
          <div class="game-facts">
            <span class="fact-chip">${owned ? "Куплен" : `${ship.cost} кредитов`}</span>
            <span class="fact-chip">${ship.weapon.toUpperCase()}</span>
          </div>
          <div class="menu-card-actions">
            <button class="primary-button shop-action-button" data-ship-id="${ship.id}" type="button" ${disabled || selected ? "disabled" : ""}>${buttonLabel}</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function drawInvadersBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#030916");
  gradient.addColorStop(1, "#101c35");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.14)";
  for (let i = 0; i < 140; i += 1) {
    ctx.fillRect((i * 67) % canvas.width, (i * 97) % canvas.height, 2, 2);
  }

  ctx.strokeStyle = "rgba(123,223,242,0.08)";
  ctx.strokeRect(54, 60, canvas.width - 108, canvas.height - 120);
}

function updateInvaders(delta) {
  const game = app.invaders;
  const moveAxis =
    (app.keys.has("ArrowRight") || app.keys.has("KeyD") ? 1 : 0) -
    (app.keys.has("ArrowLeft") || app.keys.has("KeyA") ? 1 : 0);

  game.player.x += moveAxis * game.player.speed * delta;
  game.player.x = clamp(game.player.x, 24, canvas.width - game.player.width - 24);

  game.shootCooldown = Math.max(0, game.shootCooldown - delta);
  game.rapidFireTimer = Math.max(0, game.rapidFireTimer - delta);
  game.specialCooldown = Math.max(0, game.specialCooldown - delta);

  if (game.rapidFireTimer <= 0 && game.playerShotLevel > 1) {
    game.playerShotLevel = 1;
  }

  const selectedShip = SHIP_DEFS[game.selectedShipId] || SHIP_DEFS.starter;

  if (selectedShip.weapon === "beam" && game.specialCooldown === 0) {
    fireBeamSpecial(game);
    game.specialCooldown = 5;
  }

  if (app.keys.has("Space") && game.shootCooldown === 0) {
    spawnPlayerShot(game);
    game.shootCooldown = getPlayerShotCooldown(game);
  }

  if (game.phase === "wave") {
    game.enemyShootTimer += delta;
    let turn = false;
    game.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      enemy.x += game.enemyDirection * game.enemySpeed * delta;
      if (enemy.x <= 60 || enemy.x + enemy.width >= canvas.width - 60) {
        turn = true;
      }
    });

    if (turn) {
      game.enemyDirection *= -1;
      game.enemies.forEach((enemy) => {
        if (enemy.alive) {
          enemy.y += game.enemyStepDown;
        }
      });
    }
  } else if (game.boss) {
    game.boss.x += game.boss.direction * game.boss.speed * delta;
    if (game.boss.x <= 90 || game.boss.x + game.boss.width >= canvas.width - 90) {
      game.boss.direction *= -1;
    }
  }

  game.bullets.forEach((bullet) => {
    bullet.y -= bullet.speed * delta;
  });
  game.enemyBullets.forEach((bullet) => {
    if (bullet.type === "zigzag") {
      bullet.waveTime += delta;
      bullet.x += Math.sin(bullet.waveTime * bullet.waveFreq) * bullet.waveAmplitude * delta;
    } else if (bullet.type === "homing") {
      bullet.homingTime += delta;
      if (bullet.homingTime <= 1) {
        const targetX = game.player.x + game.player.width / 2;
        const targetY = game.player.y + game.player.height / 2;
        const dx = targetX - (bullet.x + bullet.width / 2);
        const dy = targetY - (bullet.y + bullet.height / 2);
        const distance = Math.max(1, Math.hypot(dx, dy));
        const desiredVx = (dx / distance) * bullet.speed * 0.72;
        bullet.vx += (desiredVx - bullet.vx) * 0.085;
      }
      bullet.x += bullet.vx * delta;
    } else {
      bullet.x += bullet.vx * delta;
    }
    bullet.y += bullet.speed * delta;
  });
  game.explosions.forEach((explosion) => {
    explosion.life -= delta;
  });
  game.floatingTexts.forEach((text) => {
    text.y -= 36 * delta;
    text.life -= delta;
  });
  game.powerUps.forEach((powerUp) => {
    powerUp.y += powerUp.speed * delta;
    powerUp.spin += delta * 7;
  });
  game.bossHitFlash = Math.max(0, game.bossHitFlash - delta * 2.6);
  game.playerHitFlash = Math.max(0, game.playerHitFlash - delta * 3.8);
  game.playerHealFlash = Math.max(0, game.playerHealFlash - delta * 2.4);
  game.screenShake = Math.max(0, game.screenShake - delta * 4);

  if (game.phase === "wave" && game.enemyShootTimer >= game.enemyShootInterval) {
    const aliveEnemies = game.enemies.filter((enemy) => enemy.alive);
    if (aliveEnemies.length) {
      const shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      const hitbox = getEnemyHitbox(shooter);
      game.enemyBullets.push({
        x: hitbox.x + hitbox.width / 2 - 2,
        y: hitbox.y + hitbox.height + 2,
        width: 4,
        height: 14,
        vx: 0,
        speed: shooter.level === 3 ? 280 + Math.random() * 55 : 260 + Math.random() * 50,
        damage: shooter.level === 3 ? 2 : 1
      });
    }
    game.enemyShootTimer = 0;
  }

  if (game.phase === "boss" && game.boss) {
    applyBossPhaseTuning(game);
    game.enemyShootTimer += delta;
    game.bossRocketTimer += delta;
    game.bossRocketTelegraphTimer = Math.max(0, game.bossRocketTelegraphTimer - delta);

    if (game.bossStage === 2) {
      if (game.boss.invulnerable) {
        game.boss.invulnerabilityTimer = Math.max(0, game.boss.invulnerabilityTimer - delta);
        if (game.boss.invulnerabilityTimer === 0) {
          game.boss.invulnerable = false;
        }
      } else {
        game.boss.invulnerabilityCooldownTimer += delta;
        if (game.boss.invulnerabilityCooldownTimer >= game.boss.invulnerabilityCooldown) {
          game.boss.invulnerable = true;
          game.boss.invulnerabilityTimer = game.boss.invulnerabilityDuration;
          game.boss.invulnerabilityCooldownTimer = 0;
          pushFloatingText(game, game.boss.x + game.boss.width / 2, game.boss.y - 12, "ЩИТ", "#67e8f9");
        }
      }
    }

    if (game.bossStage === 3) {
      if (game.enemyShootTimer >= game.boss.homingInterval) {
        spawnBossHoming(game);
        game.enemyShootTimer = 0;
      }
    } else if (game.enemyShootTimer >= game.boss.spreadInterval) {
      spawnBossSpread(game);
      game.enemyShootTimer = 0;
    }

    if (!game.boss.telegraphActive && game.bossRocketTimer >= game.boss.rocketCooldown - game.boss.telegraphDuration) {
      game.boss.telegraphActive = true;
      game.bossRocketTelegraphTimer = game.boss.telegraphDuration;
    }

    if (game.bossRocketTimer >= game.boss.rocketCooldown) {
      spawnBossRocket(game);
      game.bossRocketTimer = 0;
      game.boss.telegraphActive = false;
      game.bossRocketTelegraphTimer = 0;
    }
  }

  game.bullets.forEach((bullet) => {
    if (game.phase === "wave") {
      game.enemies.forEach((enemy) => {
        if (!enemy.alive || bullet.hit) {
          return;
        }
        if (rectsOverlap(bullet, getEnemyHitbox(enemy))) {
          bullet.hit = true;
          if (bullet.kind === "rocket") {
            triggerPlayerRocketExplosion(game, bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
            return;
          }

          enemy.hp -= bullet.damage || 1;

          if (enemy.hp <= 0) {
            enemy.alive = false;
            game.score += enemy.points;
            game.screenShake = Math.max(game.screenShake, 0.16);
            game.explosions.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              radius: enemy.level === 3 ? 30 : enemy.level === 2 ? 26 : 22,
              life: 0.22,
              color: enemy.level === 3 ? "rgba(123, 223, 242, 0.42)" : enemy.level === 2 ? "rgba(255, 183, 3, 0.45)" : "rgba(255, 93, 115, 0.35)"
            });
            maybeSpawnPowerUp(game, enemy);
          } else {
            game.explosions.push({
              x: enemy.x + enemy.width / 2,
              y: enemy.y + enemy.height / 2,
              radius: 16,
              life: 0.12,
              color: "rgba(255,255,255,0.45)"
            });
          }
        }
      });
    } else if (game.boss && !bullet.hit && rectsOverlap(bullet, game.boss)) {
      bullet.hit = true;
      if (bossIsInvulnerable(game)) {
        game.explosions.push({
          x: bullet.x,
          y: bullet.y,
          radius: 16,
          life: 0.12,
          color: "rgba(103, 232, 249, 0.48)"
        });
        return;
      }
      if (bullet.kind === "rocket") {
        triggerPlayerRocketExplosion(game, bullet.x + bullet.width / 2, bullet.y + bullet.height / 2);
        return;
      }

      game.boss.hp -= bullet.damage || 1;
      game.score += bullet.scoreValue || 120;
      game.bossHitFlash = 1;
      game.screenShake = Math.max(game.screenShake, 0.24);
      game.explosions.push({
        x: bullet.x,
        y: bullet.y,
        radius: 18,
        life: 0.2,
        color: "rgba(123,223,242,0.8)"
      });
    }
  });

  game.enemyBullets.forEach((bullet) => {
    if (bullet.type === "rocket" && bullet.y + bullet.height >= game.player.y + game.player.height / 2) {
      bullet.hit = true;
      triggerRocketExplosion(game, bullet);
      return;
    }

    if (!bullet.hit && rectsOverlap(bullet, game.player)) {
      bullet.hit = true;
      damagePlayer(game, bullet.damage || 1, bullet.type === "rocket" ? "rocket" : "bullet");
    }
  });

  game.powerUps.forEach((powerUp) => {
    if (rectsOverlap(powerUp, game.player)) {
      powerUp.collected = true;
      applyPowerUp(game, powerUp.kind);
    }
  });

  game.bullets = game.bullets.filter((bullet) => bullet.y + bullet.height >= 0 && !bullet.hit);
  game.enemyBullets = game.enemyBullets.filter((bullet) => bullet.y <= canvas.height + 80 && !bullet.hit);
  game.explosions = game.explosions.filter((explosion) => explosion.life > 0);
  game.floatingTexts = game.floatingTexts.filter((text) => text.life > 0);
  game.powerUps = game.powerUps.filter((powerUp) => powerUp.y <= canvas.height + 40 && !powerUp.collected);
  game.beams = game.beams.filter((beam) => {
    beam.life -= delta;
    return beam.life > 0;
  });

  if (game.lives <= 0) {
    syncInvadersHud();
    finishCurrentGame(false, game.score);
    return;
  }

  if (game.phase === "wave" && game.enemies.some((enemy) => enemy.alive && enemy.y + enemy.height >= game.player.y - 8)) {
    syncInvadersHud();
    finishCurrentGame(false, game.score);
    return;
  }

  if (game.phase === "wave" && game.enemies.every((enemy) => !enemy.alive)) {
    if (game.level === 1) {
      spawnBoss(game);
    } else if (game.level === 2) {
      spawnSecondBoss(game);
    } else if (game.level === 3) {
      spawnThirdBoss(game);
    } else {
      syncInvadersHud();
      finishCurrentGame(true, game.score);
      return;
    }
  }

  if (game.phase === "boss" && game.boss && game.boss.hp <= 0) {
    if (game.bossStage === 1) {
      startInvaderLevelTwo(game);
    } else if (game.bossStage === 2) {
      startInvaderLevelThree(game);
    } else {
      syncInvadersHud();
      finishCurrentGame(true, game.score);
    }
    return;
  }

  syncInvadersHud();
}

function drawInvaders() {
  const game = app.invaders;
  drawInvadersBackground();

  ctx.save();
  if (game.screenShake > 0) {
    const offsetX = (Math.random() - 0.5) * 14 * game.screenShake;
    const offsetY = (Math.random() - 0.5) * 14 * game.screenShake;
    ctx.translate(offsetX, offsetY);
  }

  drawSpriteOrFallback(
    app.assets.shopShips[game.selectedShipId] || app.assets.playerShip,
    game.player.x,
    game.player.y,
    game.player.width,
    game.player.height,
    drawPlayerFallback
  );

  if (game.playerHealFlash > 0) {
    ctx.fillStyle = `rgba(131, 227, 119, ${0.14 * game.playerHealFlash})`;
    roundRect(ctx, game.player.x - 2, game.player.y - 2, game.player.width + 4, game.player.height + 4, 16);
    ctx.fill();
  }

  if (game.playerHitFlash > 0) {
    ctx.fillStyle = `rgba(255, 93, 115, ${0.16 * game.playerHitFlash})`;
    roundRect(ctx, game.player.x - 2, game.player.y - 2, game.player.width + 4, game.player.height + 4, 16);
    ctx.fill();
  }

  game.enemies.forEach((enemy) => {
    if (!enemy.alive) {
      return;
    }
    const spriteX = enemy.x + (enemy.width - enemy.drawWidth) / 2;
    const spriteY = enemy.y + (enemy.height - enemy.drawHeight) / 2;
    drawSpriteOrFallback(
      app.assets[enemy.spriteKey] || app.assets.enemyShip,
      spriteX,
      spriteY,
      enemy.drawWidth,
      enemy.drawHeight,
      drawEnemyFallback,
      true
    );
  });

  if (game.phase === "boss" && game.boss) {
    drawBossHealthBar(game);
    drawSpriteOrFallback(
      game.bossStage === 3 ? app.assets.boss2Ship : game.bossStage === 2 ? app.assets.bossLevel2Ship : app.assets.bossShip,
      game.boss.x,
      game.boss.y,
      game.boss.width,
      game.boss.height,
      drawBossFallback,
      true
    );

    if (game.bossStage === 2 && game.boss.invulnerable) {
      const shieldAlpha = 0.2 + Math.sin(performance.now() / 70) * 0.08;
      ctx.strokeStyle = `rgba(103, 232, 249, ${Math.max(0.16, shieldAlpha)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.ellipse(
        game.boss.x + game.boss.width / 2,
        game.boss.y + game.boss.height / 2,
        game.boss.width * 0.62,
        game.boss.height * 0.5,
        0,
        0,
        Math.PI * 2
      );
      ctx.stroke();

      ctx.fillStyle = `rgba(103, 232, 249, ${Math.max(0.08, shieldAlpha * 0.55)})`;
      ctx.beginPath();
      ctx.ellipse(
        game.boss.x + game.boss.width / 2,
        game.boss.y + game.boss.height / 2,
        game.boss.width * 0.6,
        game.boss.height * 0.48,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      ctx.fillStyle = "#67e8f9";
      ctx.textAlign = "center";
      ctx.font = '700 15px "Manrope", sans-serif';
      ctx.fillText("ЩИТ АКТИВЕН", game.boss.x + game.boss.width / 2, game.boss.y - 10);
    }
  }

  drawThreatReticle(game);

  game.bullets.forEach((bullet) => {
    drawPlayerBulletSprite(bullet);
  });

  game.enemyBullets.forEach((bullet) => {
    drawEnemyBulletSprite(bullet);
  });

  game.explosions.forEach((explosion) => {
    ctx.strokeStyle = explosion.color;
    ctx.lineWidth = explosion.radius > 60 ? 8 : 4;
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, explosion.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = explosion.color.replace(/0\.\d+\)/, "0.12)");
    ctx.beginPath();
    ctx.arc(explosion.x, explosion.y, Math.max(8, explosion.radius * 0.25), 0, Math.PI * 2);
    ctx.fill();
  });

  game.floatingTexts.forEach((text) => {
    ctx.fillStyle = text.color;
    ctx.globalAlpha = Math.max(0, Math.min(1, text.life / 0.7));
    ctx.textAlign = "center";
    ctx.font = '700 15px "Manrope", sans-serif';
    ctx.fillText(text.text, text.x, text.y);
    ctx.globalAlpha = 1;
  });

  if (game.phase === "boss" && game.boss && game.boss.telegraphActive) {
    drawBossTelegraph(game);
  }

  game.powerUps.forEach((powerUp) => {
    drawPowerUp(powerUp);
  });

  game.beams.forEach((beam) => {
    ctx.fillStyle = "rgba(123,223,242,0.32)";
    ctx.fillRect(beam.x, 0, beam.width, beam.height);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(beam.x + beam.width / 2 - 4, 0, 8, beam.height);
  });

  if (game.phase === "boss" && game.bossHitFlash > 0 && game.boss) {
    ctx.fillStyle = `rgba(255,255,255,${0.22 * game.bossHitFlash})`;
    roundRect(ctx, game.boss.x, game.boss.y, game.boss.width, game.boss.height, 18);
    ctx.fill();
  }

  ctx.restore();
}

function frame(now) {
  const delta = Math.min((now - app.lastFrame) / 1000, 0.033);
  app.lastFrame = now;

  if (app.screen === "menu") {
    drawMenuBackdrop();
  } else {
    if (app.screen === "playing") {
      updateInvaders(delta);
    }
    drawInvaders();
  }

  requestAnimationFrame(frame);
}

function roundRect(context, x, y, width, height, radius) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function loadImage(src) {
  const image = new Image();
  image.src = src;
  return image;
}

function drawSpriteOrFallback(image, x, y, width, height, fallback, rotate180 = false) {
  if (image && image.complete && image.naturalWidth > 0) {
    if (rotate180) {
      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(image, -width / 2, -height / 2, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(image, x, y, width, height);
    }
    return;
  }

  fallback(x, y, width, height);
}

function drawPlayerFallback(x, y, width, height) {
  ctx.fillStyle = "#83e377";
  ctx.beginPath();
  ctx.moveTo(x, y + height);
  ctx.lineTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height);
  ctx.closePath();
  ctx.fill();
}

function drawEnemyFallback(x, y, width, height) {
  ctx.fillStyle = "#ffb703";
  roundRect(ctx, x, y, width, height, 8);
  ctx.fill();
  ctx.fillStyle = "#081120";
  ctx.fillRect(x + 10, y + 10, 7, 7);
  ctx.fillRect(x + width - 17, y + 10, 7, 7);
  ctx.fillRect(x + 12, y + height - 10, width - 24, 4);
}

function createInvaderWave(level) {
  const enemies = [];
  const rows = 4;
  const cols = 9;
  const isLevelTwo = level === 2;
  const isLevelThree = level === 3;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const width = isLevelThree ? 40 : isLevelTwo ? 36 : 52;
      const height = isLevelThree ? 40 : isLevelTwo ? 36 : 52;
      const drawWidth = isLevelThree ? 48 : isLevelTwo ? 42 : 52;
      const drawHeight = isLevelThree ? 48 : isLevelTwo ? 42 : 52;
      enemies.push({
        x: 110 + col * 80,
        y: 90 + row * 56,
        width,
        height,
        drawWidth,
        drawHeight,
        alive: true,
        hp: isLevelThree ? 2 : 1,
        maxHp: isLevelThree ? 2 : 1,
        level,
        spriteKey: isLevelThree ? "enemy3Ship" : isLevelTwo ? "enemy2Ship" : "enemyShip",
        points: (40 - row * 5) + (isLevelThree ? 35 : isLevelTwo ? 20 : 0)
      });
    }
  }

  return enemies;
}

function getEnemyHitbox(enemy) {
  return {
    x: enemy.x,
    y: enemy.y,
    width: enemy.width,
    height: enemy.height
  };
}

function drawBossFallback(x, y, width, height) {
  ctx.fillStyle = "#d9d9e2";
  ctx.beginPath();
  ctx.moveTo(x + width / 2, y);
  ctx.lineTo(x + width, y + height * 0.82);
  ctx.lineTo(x + width * 0.74, y + height * 0.66);
  ctx.lineTo(x + width * 0.26, y + height * 0.66);
  ctx.lineTo(x, y + height * 0.82);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#5e5a74";
  ctx.beginPath();
  ctx.moveTo(x + width * 0.5, y + height * 0.2);
  ctx.lineTo(x + width * 0.76, y + height * 0.56);
  ctx.lineTo(x + width * 0.24, y + height * 0.56);
  ctx.closePath();
  ctx.fill();
}

function spawnBoss(game) {
  game.phase = "boss";
  game.bossStage = 1;
  game.boss = {
    x: canvas.width / 2 - 88,
    y: 70,
    width: 176,
    height: 176,
    hp: 5,
    maxHp: 5,
    speed: 140,
    direction: 1,
    spreadInterval: 0.7,
    rocketCooldown: 5,
    telegraphDuration: 0.8,
    telegraphActive: false
  };
  game.enemyShootTimer = 0;
  game.bossRocketTimer = 0;
  game.bossRocketTelegraphTimer = 0;
}

function spawnSecondBoss(game) {
  game.phase = "boss";
  game.bossStage = 2;
  game.boss = {
    x: canvas.width / 2 - 98,
    y: 56,
    width: 196,
    height: 196,
    hp: 30,
    maxHp: 30,
    speed: 185,
    direction: 1,
    spreadInterval: 0.45,
    rocketCooldown: 3.4,
    invulnerable: false,
    invulnerabilityCooldown: 5,
    invulnerabilityDuration: 1,
    invulnerabilityCooldownTimer: 0,
    invulnerabilityTimer: 0,
    telegraphDuration: 0.9,
    telegraphActive: false
  };
  game.enemyShootTimer = 0;
  game.bossRocketTimer = 0;
  game.bossRocketTelegraphTimer = 0;
  game.enemyBullets = [];
  game.powerUps = [];
  game.explosions.push({
    x: canvas.width / 2,
    y: 150,
    radius: 56,
    life: 0.5,
    color: "rgba(255, 93, 115, 0.34)"
  });
  game.screenShake = Math.max(game.screenShake, 0.5);
}

function spawnThirdBoss(game) {
  game.phase = "boss";
  game.bossStage = 3;
  game.boss = {
    x: canvas.width / 2 - 108,
    y: 42,
    width: 216,
    height: 216,
    hp: 100,
    maxHp: 100,
    speed: 220,
    direction: 1,
    spreadInterval: 0.34,
    rocketCooldown: 2.6,
    homingInterval: 1.15,
    telegraphDuration: 1,
    telegraphActive: false
  };
  game.enemyShootTimer = 0;
  game.bossRocketTimer = 0;
  game.bossRocketTelegraphTimer = 0;
  game.enemyBullets = [];
  game.powerUps = [];
  game.explosions.push({
    x: canvas.width / 2,
    y: 144,
    radius: 58,
    life: 0.55,
    color: "rgba(189, 224, 254, 0.34)"
  });
  game.screenShake = Math.max(game.screenShake, 0.62);
}

function startInvaderLevelTwo(game) {
  game.level = 2;
  game.phase = "wave";
  game.bossStage = 0;
  game.boss = null;
  game.enemies = createInvaderWave(2);
  game.enemyDirection = 1;
  game.enemySpeed = 36 * 1.15;
  game.enemyShootInterval = 0.85 / 1.5;
  game.enemyShootTimer = 0;
  game.enemyBullets = [];
  game.powerUps = [];
  game.playerShotLevel = 1;
  game.rapidFireTimer = 0;
  game.explosions.push({
    x: canvas.width / 2,
    y: 170,
    radius: 44,
    life: 0.45,
    color: "rgba(255, 183, 3, 0.26)"
  });
  game.screenShake = Math.max(game.screenShake, 0.42);
}

function startInvaderLevelThree(game) {
  game.level = 3;
  game.phase = "wave";
  game.bossStage = 0;
  game.boss = null;
  game.enemies = createInvaderWave(3);
  game.enemyDirection = 1;
  game.enemySpeed = 36 * 1.3;
  game.enemyShootInterval = 0.42;
  game.enemyShootTimer = 0;
  game.enemyBullets = [];
  game.powerUps = [];
  game.playerShotLevel = 1;
  game.rapidFireTimer = 0;
  game.explosions.push({
    x: canvas.width / 2,
    y: 160,
    radius: 48,
    life: 0.45,
    color: "rgba(189, 224, 254, 0.28)"
  });
  game.screenShake = Math.max(game.screenShake, 0.5);
}

function spawnBossSpread(game) {
  const boss = game.boss;
  const originX = boss.x + boss.width / 2;
  const originY = boss.y + boss.height - 12;
  const pattern = game.bossStage === 3 ? [-220, -120, 0, 120, 220] : game.bossStage === 2 ? [-170, -60, 60, 170] : [-120, 0, 120];
  pattern.forEach((vx) => {
    game.enemyBullets.push({
      x: originX - 3,
      y: originY,
      width: 6,
      height: 18,
      vx,
      speed: 240,
      damage: 1,
      type: "spread"
    });
  });
}

function spawnBossRocket(game) {
  const boss = game.boss;
  game.enemyBullets.push({
    x: boss.x + boss.width / 2 - 7,
    y: boss.y + boss.height - 6,
    width: 14,
    height: 26,
    vx: 0,
    speed: game.bossStage === 3 ? 300 : game.bossStage === 2 ? 260 : 210,
    damage: 0,
    type: "rocket",
    splashRadius: game.bossStage === 3 ? 128 : game.bossStage === 2 ? 110 : 90
  });
}

function spawnBossHoming(game) {
  const boss = game.boss;
  const originX = boss.x + boss.width / 2;
  const originY = boss.y + boss.height - 8;
  const spawnOffsets = [-40, 40];

  spawnOffsets.forEach((offset) => {
    game.enemyBullets.push({
      x: originX + offset - 7,
      y: originY,
      width: 14,
      height: 14,
      vx: offset > 0 ? 30 : -30,
      speed: 360,
      damage: 1,
      type: "homing",
      homingTime: 0
    });
  });
}

function triggerRocketExplosion(game, rocket) {
  const centerX = rocket.x + rocket.width / 2;
  const centerY = rocket.y + rocket.height / 2;
  const playerCenterX = game.player.x + game.player.width / 2;
  const playerCenterY = game.player.y + game.player.height / 2;
  const distance = Math.hypot(centerX - playerCenterX, centerY - playerCenterY);

  game.explosions.push({
    x: centerX,
    y: centerY,
    radius: rocket.splashRadius,
    life: 0.35,
    color: "rgba(255,123,0,0.32)"
  });

  if (distance <= rocket.splashRadius) {
    damagePlayer(game, 2, "rocket");
  }
}

function triggerPlayerRocketExplosion(game, centerX, centerY) {
  const splashRadius = 92;
  game.screenShake = Math.max(game.screenShake, 0.28);
  game.explosions.push({
    x: centerX,
    y: centerY,
    radius: splashRadius,
    life: 0.24,
    color: "rgba(249, 65, 68, 0.34)"
  });

  if (game.phase === "wave") {
    game.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }

      const enemyCenterX = enemy.x + enemy.width / 2;
      const enemyCenterY = enemy.y + enemy.height / 2;
      const distance = Math.hypot(centerX - enemyCenterX, centerY - enemyCenterY);

      if (distance > splashRadius) {
        return;
      }

      enemy.hp -= 3;

      if (enemy.hp <= 0) {
        enemy.alive = false;
        game.score += enemy.points;
        maybeSpawnPowerUp(game, enemy);
        game.explosions.push({
          x: enemyCenterX,
          y: enemyCenterY,
          radius: enemy.level === 3 ? 30 : enemy.level === 2 ? 26 : 22,
          life: 0.2,
          color: "rgba(255, 183, 3, 0.38)"
        });
      } else {
        game.explosions.push({
          x: enemyCenterX,
          y: enemyCenterY,
          radius: 16,
          life: 0.12,
          color: "rgba(255,255,255,0.4)"
        });
      }
    });
    return;
  }

  if (game.boss) {
    const bossCenterX = game.boss.x + game.boss.width / 2;
    const bossCenterY = game.boss.y + game.boss.height / 2;
    const distance = Math.hypot(centerX - bossCenterX, centerY - bossCenterY);

    if (bossIsInvulnerable(game)) {
      game.explosions.push({
        x: bossCenterX,
        y: bossCenterY,
        radius: 24,
        life: 0.12,
        color: "rgba(103, 232, 249, 0.48)"
      });
      return;
    }

    if (distance <= splashRadius + Math.max(game.boss.width, game.boss.height) * 0.25) {
      game.boss.hp -= 3;
      game.score += 220;
      game.bossHitFlash = 1;
      game.explosions.push({
        x: bossCenterX,
        y: bossCenterY,
        radius: 28,
        life: 0.16,
        color: "rgba(255, 183, 3, 0.42)"
      });
    }
  }
}

function applyBossPhaseTuning(game) {
  const boss = game.boss;

  if (game.bossStage === 3) {
    if (boss.hp <= 3) {
      boss.speed = 310;
      boss.homingInterval = 0.48;
      boss.rocketCooldown = 1.9;
      return;
    }

    if (boss.hp <= 7) {
      boss.speed = 265;
      boss.homingInterval = 0.78;
      boss.rocketCooldown = 2.2;
      return;
    }

    boss.speed = 220;
    boss.homingInterval = 1.15;
    boss.rocketCooldown = 2.6;
    return;
  }

  if (game.bossStage === 2) {
    if (boss.hp <= 2) {
      boss.speed = 260;
      boss.spreadInterval = 0.26;
      boss.rocketCooldown = 2.2;
      return;
    }

    if (boss.hp <= 5) {
      boss.speed = 220;
      boss.spreadInterval = 0.34;
      boss.rocketCooldown = 2.8;
      return;
    }

    boss.speed = 185;
    boss.spreadInterval = 0.45;
    boss.rocketCooldown = 3.4;
    return;
  }

  if (boss.hp <= 1) {
    boss.speed = 220;
    boss.spreadInterval = 0.36;
    boss.rocketCooldown = 2.8;
    return;
  }

  if (boss.hp <= 3) {
    boss.speed = 175;
    boss.spreadInterval = 0.52;
    boss.rocketCooldown = 4;
    return;
  }

  boss.speed = 140;
  boss.spreadInterval = 0.7;
  boss.rocketCooldown = 5;
}

function drawBossHealthBar(game) {
  const boss = game.boss;
  const barWidth = 320;
  const barHeight = 16;
  const x = canvas.width / 2 - barWidth / 2;
  const y = 26;
  const fillWidth = Math.max(0, (boss.hp / boss.maxHp) * barWidth);

  ctx.fillStyle = "rgba(6, 14, 27, 0.82)";
  roundRect(ctx, x, y, barWidth, barHeight, 999);
  ctx.fill();

  if (fillWidth > 0) {
    ctx.fillStyle = "#ff5d73";
    roundRect(ctx, x, y, fillWidth, barHeight, Math.min(999, fillWidth / 2));
    ctx.fill();
  }

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, barWidth, barHeight, 999);
  ctx.stroke();

  ctx.fillStyle = "#f7f9fc";
  ctx.textAlign = "center";
  ctx.font = '700 14px "Manrope", sans-serif';
  ctx.fillText(`BOSS ${game.bossStage} HP: ${boss.hp} / ${boss.maxHp}`, canvas.width / 2, y - 8);
}

function drawPlayerBulletSprite(bullet) {
  if (bullet.kind === "rocket") {
    ctx.fillStyle = "rgba(249, 65, 68, 0.22)";
    ctx.fillRect(bullet.x - 4, bullet.y + 8, bullet.width + 8, bullet.height + 16);
    ctx.fillStyle = "#f94144";
    roundRect(ctx, bullet.x, bullet.y, bullet.width, bullet.height, 6);
    ctx.fill();
    ctx.fillStyle = "#ffd166";
    ctx.fillRect(bullet.x + 2, bullet.y + bullet.height - 9, bullet.width - 4, 6);
    return;
  }

  if (bullet.kind === "fireball") {
    const centerX = bullet.x + bullet.width / 2;
    const centerY = bullet.y + bullet.height / 2;
    const radius = bullet.width / 2;
    const gradient = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, radius + 8);
    gradient.addColorStop(0, "rgba(255, 240, 180, 1)");
    gradient.addColorStop(0.45, "rgba(255, 157, 0, 0.95)");
    gradient.addColorStop(1, "rgba(255, 123, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff7b00";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffe29a";
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.45, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  ctx.fillStyle = "rgba(123, 223, 242, 0.28)";
  ctx.fillRect(bullet.x - 2, bullet.y - 8, bullet.width + 4, bullet.height + 12);
  ctx.fillStyle = "#7bdff2";
  roundRect(ctx, bullet.x, bullet.y, bullet.width, bullet.height, 999);
  ctx.fill();
  ctx.fillStyle = "#f7f9fc";
  roundRect(ctx, bullet.x + 1, bullet.y + 2, Math.max(1, bullet.width - 2), Math.max(4, bullet.height - 6), 999);
  ctx.fill();
}

function drawEnemyBulletSprite(bullet) {
  if (bullet.type === "rocket") {
    const centerX = bullet.x + bullet.width / 2;
    const pulse = 0.2 + Math.sin(performance.now() / 85) * 0.08;
    ctx.strokeStyle = `rgba(255, 224, 102, ${Math.max(0.12, pulse)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, canvas.height - 42, Math.max(24, bullet.splashRadius * 0.34), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ff7b00";
    roundRect(ctx, bullet.x, bullet.y, bullet.width, bullet.height, 6);
    ctx.fill();
    ctx.fillStyle = "#ffe066";
    ctx.fillRect(bullet.x + 3, bullet.y + bullet.height - 10, bullet.width - 6, 6);
    return;
  }

  if (bullet.type === "homing") {
    const centerX = bullet.x + bullet.width / 2;
    const centerY = bullet.y + bullet.height / 2;
    const pulse = 0.24 + Math.sin(performance.now() / 60) * 0.1;
    ctx.fillStyle = `rgba(217, 70, 239, ${Math.max(0.14, pulse)})`;
    ctx.beginPath();
    ctx.arc(centerX, centerY, bullet.width / 2 + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#d946ef";
    ctx.beginPath();
    ctx.arc(centerX, centerY, bullet.width / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#67e8f9";
    ctx.beginPath();
    ctx.arc(centerX, centerY, bullet.width / 4, 0, Math.PI * 2);
    ctx.fill();

    if (bullet.homingTime <= 1) {
      ctx.strokeStyle = `rgba(103, 232, 249, ${Math.max(0.2, pulse + 0.08)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, bullet.width / 2 + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    return;
  }

  if (bullet.type === "zigzag") {
    ctx.fillStyle = "rgba(189, 224, 254, 0.24)";
    roundRect(ctx, bullet.x - 2, bullet.y - 3, bullet.width + 4, bullet.height + 6, 999);
    ctx.fill();
    ctx.fillStyle = "#bde0fe";
    roundRect(ctx, bullet.x, bullet.y, bullet.width, bullet.height, 999);
    ctx.fill();
    return;
  }

  ctx.fillStyle = "rgba(255, 93, 115, 0.22)";
  roundRect(ctx, bullet.x - 2, bullet.y - 4, bullet.width + 4, bullet.height + 10, 999);
  ctx.fill();
  ctx.fillStyle = "#ff5d73";
  roundRect(ctx, bullet.x, bullet.y, bullet.width, bullet.height, 999);
  ctx.fill();
  ctx.fillStyle = "#ffd1d8";
  roundRect(ctx, bullet.x + 1, bullet.y + 2, Math.max(1, bullet.width - 2), Math.max(4, bullet.height - 6), 999);
  ctx.fill();
}

function drawThreatReticle(game) {
  const playerCenterX = game.player.x + game.player.width / 2;
  const playerCenterY = game.player.y + game.player.height / 2;
  const trackingThreat = game.enemyBullets.some((bullet) => bullet.type === "homing" && bullet.homingTime <= 1);
  const laneThreat =
    game.phase === "boss" &&
    game.boss &&
    game.boss.telegraphActive &&
    Math.abs((game.boss.x + game.boss.width / 2) - playerCenterX) <= 60;

  if (!trackingThreat && !laneThreat) {
    return;
  }

  const pulse = 0.35 + Math.sin(performance.now() / 70) * 0.14;
  ctx.save();
  ctx.strokeStyle = laneThreat ? `rgba(255, 224, 102, ${pulse})` : `rgba(103, 232, 249, ${pulse})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(playerCenterX, playerCenterY, game.player.width * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = laneThreat ? "#ffe066" : "#67e8f9";
  ctx.textAlign = "center";
  ctx.font = '700 12px "Manrope", sans-serif';
  ctx.fillText(laneThreat ? "УХОДИ ИЗ ЗОНЫ" : "ЗАХВАТ ЦЕЛИ", playerCenterX, game.player.y - 10);
  ctx.restore();
}

function drawBossTelegraph(game) {
  const boss = game.boss;
  const alphaPulse = 0.28 + Math.sin(performance.now() / 70) * 0.14;
  const laneWidth = 120;
  const laneX = boss.x + boss.width / 2 - laneWidth / 2;

  ctx.fillStyle = `rgba(255, 123, 0, ${Math.max(0.1, alphaPulse - 0.05)})`;
  ctx.fillRect(laneX, boss.y + boss.height - 10, laneWidth, canvas.height - (boss.y + boss.height - 10));
  ctx.strokeStyle = `rgba(255, 224, 102, ${Math.max(0.18, alphaPulse + 0.08)})`;
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.strokeRect(laneX + 1.5, boss.y + boss.height - 8.5, laneWidth - 3, canvas.height - (boss.y + boss.height - 10));
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(boss.x + boss.width / 2, canvas.height - 42, 34, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#ffe066";
  ctx.textAlign = "center";
  ctx.font = '700 16px "Manrope", sans-serif';
  ctx.fillText("РАКЕТА!", boss.x + boss.width / 2, boss.y + boss.height + 22);
}

function spawnPlayerShot(game) {
  const centerX = game.player.x + game.player.width / 2;
  const ship = SHIP_DEFS[game.selectedShipId] || SHIP_DEFS.starter;
  let pattern = [0];
  let width = 4;
  let height = 14;
  let speed = 520;
  let damage = 1;
  let kind = "bullet";
  let scoreValue = 120;

  if (ship.weapon === "double") {
    pattern = [-10, 10];
  } else if (ship.weapon === "rocket") {
    width = 10;
    height = 22;
    speed = 380;
    damage = 3;
    kind = "rocket";
    scoreValue = 180;
  } else if (ship.weapon === "fireball") {
    width = 12;
    height = 12;
    speed = 480;
    damage = 2;
    kind = "fireball";
    scoreValue = 160;
  } else if (game.playerShotLevel > 1) {
    pattern = [-14, 0, 14];
  }

  pattern.forEach((offset) => {
    game.bullets.push({
      x: centerX - width / 2 + offset,
      y: game.player.y - 10,
      width,
      height,
      speed,
      damage,
      kind,
      scoreValue
    });
  });
}

function maybeSpawnPowerUp(game, enemy) {
  const chance = enemy.level === 2 ? 0.18 : 0.1;
  if (Math.random() > chance) {
    return;
  }

  const roll = Math.random();
  let kind = "heal";

  if (roll < 0.08) {
    kind = "score500";
  } else if (roll < 0.58) {
    kind = "score100";
  }

  game.powerUps.push({
    x: enemy.x + enemy.width / 2 - 14,
    y: enemy.y + enemy.height / 2 - 14,
    width: 28,
    height: 28,
    speed: 110,
    kind,
    spin: 0,
    collected: false
  });
}

function applyPowerUp(game, kind) {
  if (kind === "score500") {
    game.score += 500;
    pushFloatingText(game, game.player.x + game.player.width / 2, game.player.y - 12, "+500", "#ffd166");
    game.explosions.push({
      x: game.player.x + game.player.width / 2,
      y: game.player.y + game.player.height / 2,
      radius: 34,
      life: 0.24,
      color: "rgba(255, 215, 0, 0.45)"
    });
    return;
  }

  if (kind === "score100") {
    game.score += 100;
    pushFloatingText(game, game.player.x + game.player.width / 2, game.player.y - 12, "+100", "#7bdff2");
    game.explosions.push({
      x: game.player.x + game.player.width / 2,
      y: game.player.y + game.player.height / 2,
      radius: 28,
      life: 0.22,
      color: "rgba(123,223,242,0.4)"
    });
    return;
  }

  game.lives = Math.min(game.lives + 1, 5);
  game.playerHealFlash = 1;
  pushFloatingText(game, game.player.x + game.player.width / 2, game.player.y - 12, "+1 HP", "#83e377");
  game.explosions.push({
    x: game.player.x + game.player.width / 2,
    y: game.player.y + game.player.height / 2,
    radius: 26,
    life: 0.24,
    color: "rgba(131,227,119,0.4)"
  });
}

function drawPowerUp(powerUp) {
  ctx.save();
  ctx.translate(powerUp.x + powerUp.width / 2, powerUp.y + powerUp.height / 2);
  ctx.rotate(powerUp.spin);
  ctx.fillStyle =
    powerUp.kind === "score500"
      ? "#ffd166"
      : powerUp.kind === "score100"
        ? "#7bdff2"
        : "#83e377";
  roundRect(ctx, -powerUp.width / 2, -powerUp.height / 2, powerUp.width, powerUp.height, 8);
  ctx.fill();
  ctx.fillStyle = "#081120";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = '700 12px "Manrope", sans-serif';
  ctx.fillText(powerUp.kind === "score500" ? "+500" : powerUp.kind === "score100" ? "+100" : "+1", 0, 1);
  ctx.restore();
}

function getPlayerShotCooldown(game) {
  const ship = SHIP_DEFS[game.selectedShipId] || SHIP_DEFS.starter;

  if (ship.weapon === "fireball") {
    return 0.09;
  }

  if (ship.weapon === "rocket") {
    return 0.42;
  }

  if (ship.weapon === "double") {
    return 0.24;
  }

  return game.playerShotLevel > 1 ? 0.18 : 0.28;
}

function fireBeamSpecial(game) {
  const beamWidth = 42;
  const beamX = game.player.x + game.player.width / 2 - beamWidth / 2;
  const beam = {
    x: beamX,
    width: beamWidth,
    height: game.player.y,
    life: 0.35
  };

  game.beams.push(beam);
  game.screenShake = Math.max(game.screenShake, 0.18);

  if (game.phase === "wave") {
    game.enemies.forEach((enemy) => {
      if (!enemy.alive) {
        return;
      }
      const hitbox = getEnemyHitbox(enemy);
      if (beamX < hitbox.x + hitbox.width && beamX + beamWidth > hitbox.x) {
        enemy.alive = false;
        game.score += enemy.points;
      }
    });
  } else if (game.boss) {
    if (bossIsInvulnerable(game)) {
      game.explosions.push({
        x: game.boss.x + game.boss.width / 2,
        y: game.boss.y + game.boss.height / 2,
        radius: 32,
        life: 0.14,
        color: "rgba(103,223,242,0.5)"
      });
      return;
    }
    if (beamX < game.boss.x + game.boss.width && beamX + beamWidth > game.boss.x) {
      game.boss.hp -= 10;
      game.score += 300;
      game.bossHitFlash = 1;
    }
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

document.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space", "KeyA", "KeyD"].includes(event.code)) {
    event.preventDefault();
  }
  app.keys.add(event.code);
});

document.addEventListener("keyup", (event) => {
  app.keys.delete(event.code);
});

restartButton.addEventListener("click", restartCurrentGame);
menuButton.addEventListener("click", showMenu);
clearLeaderboardButton.addEventListener("click", () => {
  saveLeaderboard([]);
  renderLeaderboard();
});

renderLeaderboard();
showMenu();
requestAnimationFrame(frame);
