export const TICK_RATE = 60;
export const ISLAND_RADIUS = 42;
const STEP = 1 / TICK_RATE;
const EPSILON = 1e-9;

export const initialInput = () => ({
  move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false,
});

function seedRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function distance(a, b) {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
}

function inRange(a, b, radius) {
  return distance(a, b) <= radius + EPSILON;
}

function randomPoint(random, minRadius, maxRadius, height = 0) {
  const angle = random() * 2 * Math.PI;
  const radius = Math.sqrt(minRadius ** 2 + random() * (maxRadius ** 2 - minRadius ** 2));
  return [Math.sin(angle) * radius, height, Math.cos(angle) * radius];
}

export class Night {
  constructor(tuning, seed, scenario = {}) {
    this.tuning = tuning;
    this.random = seedRandom(seed);
    this.tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.duration = scenario.time_left_s ?? tuning.night1_duration_s;
    this.player = {
      pos: [...(scenario.player?.pos ?? [0, 0, 0])],
      carried: scenario.player?.carried ?? 0,
      flames: scenario.player?.flames ?? tuning.flames,
      heading: 0,
      verticalSpeed: 0,
      invulnerableUntil: 0,
    };
    this.pulseReadyAt = 0;
    this.previousInput = initialInput();
    this.events = [];
    this.randomMotes = scenario.random_motes ?? true;
    this.randomShades = scenario.random_shades ?? true;
    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.shadeIds = new Set(scenario.shades?.map((shade) => shade.id).filter(Boolean));
    this.lanterns = Array.from({ length: tuning.lantern_count_night1 }, (_, index) => {
      const angle = index * 2 * Math.PI / tuning.lantern_count_night1;
      const id = `L${index + 1}`;
      const update = scenario.lanterns?.find((lantern) => lantern.id === id);
      const deposited = update?.deposited ?? (update?.lit ? tuning.lantern_cost : 0);
      return {
        id,
        pos: [...(update?.pos ?? [Math.sin(angle) * 24, 0, Math.cos(angle) * 24])],
        lit: update?.lit ?? (deposited >= tuning.lantern_cost),
        deposited,
      };
    });
    const motePositions = scenario.motes ?? (this.randomMotes ? this.makeMotePositions() : []);
    this.motes = motePositions.map((pos) => this.makeMote(pos));
    const shades = scenario.shades ?? (this.randomShades
      ? Array.from({ length: 3 }, () => ({ pos: randomPoint(this.random, 25, 36, 0.8) }))
      : []);
    this.shades = shades.map(({ pos, id }) => this.makeShade(pos, id));
  }

  get timeLeft() {
    return Math.max(0, this.duration - this.tick / TICK_RATE);
  }

  makeMotePositions() {
    const positions = [];
    for (const lantern of this.lanterns) {
      const angle = Math.atan2(lantern.pos[0], lantern.pos[2]);
      for (let index = 0; index < 7; index++) {
        const radius = 4 + index * 2.75;
        const offset = (this.random() - 0.5) * 0.18;
        positions.push([Math.sin(angle + offset) * radius, 0, Math.cos(angle + offset) * radius]);
      }
    }
    for (let index = 0; index < 20; index++) positions.push(randomPoint(this.random, 6, 38));
    return positions;
  }

  makeMote(pos) {
    return { id: `M${this.nextMoteId++}`, pos: [...pos] };
  }

  makeShade(pos, requestedId) {
    let id = requestedId;
    while (!id) {
      const next = `S${this.nextShadeId++}`;
      if (!this.shadeIds.has(next)) id = next;
    }
    this.shadeIds.add(id);
    return { id, pos: [...pos], state: 'chase', stunnedUntil: 0 };
  }

  emit(name, data) {
    this.events.push({ type: 'event', tick: this.tick, name, data });
  }

  step(input = initialInput()) {
    if (this.state !== 'playing') return [];
    this.tick++;
    this.events = [];
    this.movePlayer(input);
    this.collectMotes();
    if (input.interact && !this.previousInput.interact) this.deposit();

    if (this.lanterns.every((lantern) => lantern.lit)) {
      this.finish('won', 'all_lit');
    } else {
      if (input.pulse && !this.previousInput.pulse) this.pulse();
      this.spawnEntities();
      this.moveShades();
      if (this.player.flames === 0) this.finish('lost', 'no_flames');
      else if (this.timeLeft === 0) this.finish('lost', 'dawn');
    }
    this.previousInput = { ...input };
    return this.events;
  }

  movePlayer(input) {
    const { player } = this;
    const [x, z] = input.move;
    const yaw = (input.cam_yaw_deg % 360) * Math.PI / 180;
    const scale = this.tuning.player_speed * STEP / Math.max(1, Math.hypot(x, z));
    const dx = (x * Math.cos(yaw) + z * Math.sin(yaw)) * scale;
    const dz = (-x * Math.sin(yaw) + z * Math.cos(yaw)) * scale;
    if (dx || dz) {
      player.heading = Math.atan2(dx, dz);
      const previousRadius = Math.hypot(player.pos[0], player.pos[2]);
      player.pos[0] += dx;
      player.pos[2] += dz;
      const radius = Math.hypot(player.pos[0], player.pos[2]);
      if (radius > ISLAND_RADIUS && previousRadius <= ISLAND_RADIUS + EPSILON) {
        player.pos[0] *= ISLAND_RADIUS / radius;
        player.pos[2] *= ISLAND_RADIUS / radius;
      }
    }
    if (input.jump && !this.previousInput.jump && player.pos[1] <= 0) player.verticalSpeed = 6;
    if (player.pos[1] > 0 || player.verticalSpeed > 0) {
      player.pos[1] = Math.max(0, player.pos[1] + player.verticalSpeed * STEP);
      player.verticalSpeed -= 16 * STEP;
      if (player.pos[1] === 0) player.verticalSpeed = 0;
    }
  }

  collectMotes() {
    const { player, tuning } = this;
    this.motes = this.motes.filter((mote) => {
      if (player.carried >= tuning.carry_capacity || !inRange(player.pos, mote.pos, tuning.pickup_radius)) return true;
      player.carried++;
      this.score += tuning.score.per_mote;
      this.emit('mote_picked', { carried: player.carried });
      return false;
    });
  }

  nearbyLantern() {
    let closest;
    let nearest = this.tuning.interact_radius + EPSILON;
    for (const lantern of this.lanterns) {
      const range = distance(this.player.pos, lantern.pos);
      if (!lantern.lit && range < nearest) {
        closest = lantern;
        nearest = range;
      }
    }
    return closest;
  }

  deposit() {
    const lantern = this.nearbyLantern();
    if (!lantern || !this.player.carried) return;
    const amount = Math.min(this.player.carried, this.tuning.lantern_cost - lantern.deposited);
    if (amount <= 0) return;
    this.player.carried -= amount;
    lantern.deposited += amount;
    this.emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited === this.tuning.lantern_cost) {
      lantern.lit = true;
      this.score += this.tuning.score.per_lantern;
      this.emit('lantern_lit', { lantern_id: lantern.id });
    }
  }

  pulse() {
    const { player, tuning } = this;
    if (this.tick < this.pulseReadyAt || player.carried < tuning.pulse_cost) return;
    player.carried -= tuning.pulse_cost;
    this.pulseReadyAt = this.tick + Math.round(tuning.pulse_cooldown_s * TICK_RATE);
    const stunnedIds = [];
    for (const shade of this.shades) {
      if (!inRange(player.pos, shade.pos, tuning.pulse_radius)) continue;
      const range = distance(shade.pos, player.pos);
      const dx = range ? (shade.pos[0] - player.pos[0]) / range : 1;
      const dz = range ? (shade.pos[2] - player.pos[2]) / range : 0;
      shade.pos[0] += dx * tuning.pulse_push_m;
      shade.pos[2] += dz * tuning.pulse_push_m;
      shade.state = 'stunned';
      shade.stunnedUntil = this.tick + Math.round(tuning.pulse_stun_s * TICK_RATE);
      stunnedIds.push(shade.id);
      this.score += tuning.score.per_stun;
    }
    this.emit('pulse', { stunned_ids: stunnedIds });
  }

  spawnEntities() {
    if (this.randomMotes && this.tick % (10 * TICK_RATE) === 0 && this.motes.length < 40) {
      this.motes.push(this.makeMote(randomPoint(this.random, 3, 35)));
    }
    if (this.randomShades && this.tick % (25 * TICK_RATE) === 0 && this.shades.length < 6) {
      const shade = this.makeShade(randomPoint(this.random, 29, 39, 0.8));
      this.shades.push(shade);
      this.emit('shade_spawned', { id: shade.id });
    }
  }

  moveShades() {
    const { player, tuning } = this;
    const litLanterns = this.lanterns.filter((lantern) => lantern.lit);
    const playerSafe = litLanterns.some((lantern) => inRange(player.pos, lantern.pos, tuning.safe_radius));
    for (const shade of this.shades) {
      const stunned = this.tick < shade.stunnedUntil;
      if (!stunned) shade.state = 'chase';
      for (const lantern of litLanterns) {
        const range = distance(shade.pos, lantern.pos);
        if (range >= tuning.safe_radius) continue;
        const dx = range ? (shade.pos[0] - lantern.pos[0]) / range : 1;
        const dz = range ? (shade.pos[2] - lantern.pos[2]) / range : 0;
        shade.pos[0] = lantern.pos[0] + dx * tuning.safe_radius;
        shade.pos[2] = lantern.pos[2] + dz * tuning.safe_radius;
      }
      if (stunned) continue;
      const range = distance(shade.pos, player.pos);
      if (range > EPSILON) {
        const move = Math.min(range, tuning.shade_speed * STEP) / range;
        const next = [
          shade.pos[0] + (player.pos[0] - shade.pos[0]) * move,
          shade.pos[1],
          shade.pos[2] + (player.pos[2] - shade.pos[2]) * move,
        ];
        if (!litLanterns.some((lantern) => distance(next, lantern.pos) < tuning.safe_radius - EPSILON)) {
          shade.pos = next;
        }
      }
      if (!playerSafe && player.flames > 0 && this.tick >= player.invulnerableUntil
          && inRange(shade.pos, player.pos, tuning.shade_hit_radius)) {
        player.flames--;
        player.invulnerableUntil = this.tick + Math.round(tuning.invuln_s * TICK_RATE);
        this.emit('player_hit', { by: 'shade', flames: player.flames, dropped: 0 });
      }
    }
  }

  finish(result, reason) {
    this.state = result;
    if (result === 'won') {
      const { score } = this.tuning;
      this.score += Math.floor(this.timeLeft) * score.per_second_left + this.player.flames * score.per_flame_left;
    }
    this.emit('game_over', { result, reason });
  }

  snapshot() {
    const roundPosition = (pos) => pos.map((value) => Math.round(value * 1000) / 1000);
    const { pos, flames, carried } = this.player;
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.tick, state: this.state,
      time_left_s: this.timeLeft, score: this.score,
      player: { pos: roundPosition(pos), flames, carried },
      lanterns: this.lanterns.map((lantern) => ({ ...lantern, pos: roundPosition(lantern.pos) })),
      shades: this.shades.map(({ id, pos: shadePos, state }) => ({ id, pos: roundPosition(shadePos), state })),
      motes_active: this.motes.length,
      motes: this.motes.map((mote) => ({ id: mote.id, pos: roundPosition(mote.pos) })),
    };
  }
}
