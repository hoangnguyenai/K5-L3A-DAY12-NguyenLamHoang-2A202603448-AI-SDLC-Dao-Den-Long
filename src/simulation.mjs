import { mapFor, terrainHeight, horizontalDistance as distance } from './maps.mjs';
export { ISLAND_RADIUS } from './maps.mjs';
export const TICK_RATE = 60;
const DT = 1 / TICK_RATE;
const EPS = 1e-8;
const round = (value) => Math.round(value * 1000) / 1000;
const position = (pos) => pos.map(round);
const idOrder = new Intl.Collator('en', { numeric: true });
const order = (a, b) => idOrder.compare(a.id, b.id);
export const initialInput = () => ({ move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false });
const counters = (object, keys) => { for (const key of keys) object[key] = Math.max(0, object[key] - 1); };

export class Night {
  constructor(tuning, seed, scenario = {}, night = 1) {
    this.tuning = tuning;
    this.night = night;
    this.map = mapFor(night);
    this.seed = seed >>> 0;
    this.tick = 0;
    this.simTick = 0;
    this.state = 'playing';
    this.score = 0;
    this.time = scenario.time_left_s ?? tuning[`night${night}_duration_s`];
    this.initialTime = this.time;
    const supplied = scenario.player ?? {};
    const pos = [...(supplied.pos ?? [0, 0, 0])];
    this.player = {
      pos, vel: [0, 0, 0], grounded: pos[1] <= terrainHeight(night, pos[0], pos[2]) + EPS,
      flames: supplied.flames ?? 3, carried: supplied.carried ?? 0, heading: 0,
      invuln: supplied.invuln_ticks ?? 0, dashCd: supplied.dash_cd_ticks ?? 0,
      pulseCd: supplied.pulse_cd_ticks ?? 0, charm: supplied.charm_ticks ?? 0,
      dashTicks: 0, dashDir: [0, 1], launch: null, respawn: 0,
    };
    // Điểm xuất phát chuẩn của Đêm 3 nằm dưới sàn tầng 2. Đứng yên tại đây cho tới khi ra khỏi chân tháp.
    this.successfulLights = supplied.successful_lights ?? 0;
    this.previousInput = initialInput();
    this.events = [];
    this.wind = { active: false, dir_deg: 0 };
    this.windEnabled = scenario.wind_enabled ?? night === 3;
    this.randomMotes = scenario.random_motes ?? true;
    this.randomShades = scenario.random_shades ?? true;
    this.randomDrifters = scenario.random_drifters ?? night > 1;
    this.nextMote = 1;
    this.nextShade = 1;
    this.nextDrifter = 1;
    this.lanterns = this.map.lanterns.map((defaultPos, index) => {
      const id = `L${index + 1}`;
      const update = scenario.lanterns?.find((lantern) => lantern.id === id) ?? {};
      const deposited = update.deposited ?? (update.lit ? 10 : 0);
      const lit = update.lit ?? deposited >= (update.ever_lit ? tuning.relight_cost : tuning.lantern_cost);
      return { id, pos: [...(update.pos ?? defaultPos)], deposited, lit, ever_lit: lit || Boolean(update.ever_lit),
        relit_count: 0, fuelUnits: lit ? Math.round((update.fuel ?? tuning.fuel_max) * 60) : 0 };
    });
    this.motes = [];
    if (scenario.motes) {
      this.motes = scenario.motes.map((mote) => Array.isArray(mote)
        ? this.makeMote(mote) : this.makeMote(mote.pos, mote.kind, mote.ttl_ticks ?? Math.round((mote.ttl_s ?? 8) * 60), mote.id));
    } else if (this.randomMotes) {
      const available = [...this.map.motePoints];
      for (let index = 0; index < 20; index++) {
        this.motes.push(this.makeMote(available.splice(Math.floor(this.random() * available.length), 1)[0]));
      }
    }
    this.usedShadeIds = new Set(scenario.shades?.map((shade) => shade.id).filter(Boolean));
    this.shades = (scenario.shades ?? []).map((shade) => this.makeShade(shade));
    this.drifters = (scenario.drifters ?? []).map((drifter, index) => ({
      id: drifter.id ?? `D${index + 1}`, pos: [...drifter.pos], state: drifter.state ?? 'idle',
      stolen: drifter.stolen ?? 0, ticks: drifter.state_ticks_left ?? (drifter.state === 'flee' ? 240 : 0),
      stolenOnce: drifter.state === 'flee',
    }));
    this.usedDrifterIds = new Set(this.drifters.map((drifter) => drifter.id));
    this.charms = (scenario.charms ?? this.map.charms.map((charmPos, index) => ({ id: `C${index + 1}`, pos: charmPos })))
      .map((charm) => {
        const index = Number(charm.id.slice(1)) - 1;
        return { id: charm.id, pos: [...(charm.pos ?? this.map.charms[index] ?? [0, 0, 0])],
          available: charm.available ?? true, respawn: charm.respawn_ticks ?? Math.round((charm.respawn_s ?? 0) * 60) };
      });
  }

  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  get capacity() { return Math.min(this.tuning.capacity_max, this.tuning.carry_capacity + 2 * this.successfulLights); }

  get requiredLights() { return Math.ceil(this.tuning.win_ratio * this.lanterns.length); }

  burnFuel() {
    const t = this.tuning;
    for (const lamp of this.lanterns) {
      if (!lamp.lit) continue;
      const draining = this.shades.filter((shade) => shade.state === 'drain' && shade.target === lamp.id
        && distance(shade.pos, lamp.pos) <= 2 && lamp.fuelUnits < t.low_fuel_threshold * 60);
      lamp.fuelUnits = Math.max(0, lamp.fuelUnits - t.fuel_decay_per_s - t.drain_per_s * draining.length);
      for (const shade of draining) {
        if (++shade.drainTicks % 60 === 0) this.emit('fuel_drain', { lantern_id: lamp.id, shade_id: shade.id, fuel: Math.round(lamp.fuelUnits / 6) / 10 });
      }
      if (!lamp.fuelUnits) {
        lamp.lit = false;
        lamp.deposited = 0;
        this.emit('lantern_out', { lantern_id: lamp.id });
      }
    }
  }

  get timeLeft() { return this.time; }

  makeMote(pos, kind = 'random', ttl = 480, id) {
    return { id: id ?? `M${this.nextMote++}`, pos: [...pos], kind, ttl: kind === 'dropped' ? ttl : null, born: this.simTick };
  }

  makeShade(shade) {
    let id = shade.id;
    while (!id) {
      const candidate = `S${this.nextShade++}`;
      if (!this.usedShadeIds.has(candidate)) id = candidate;
    }
    this.usedShadeIds.add(id);
    return { id, pos: [...shade.pos], state: shade.state ?? 'wander', ticks: shade.state_ticks_left ?? 0,
      target: shade.target_lantern_id, drainTicks: 0, pushTicks: 0, pushDir: [1, 0], recoilDir: [1, 0] };
  }

  emit(name, data = {}) { this.events.push({ type: 'event', tick: this.tick, name, data }); }

  step(input = initialInput()) {
    if (this.state === 'won' || this.state === 'lost') return [];
    this.tick++;
    this.events = [];
    if (input.pause && !this.previousInput.pause) {
      this.state = this.state === 'paused' ? 'playing' : 'paused';
      this.emit(this.state === 'paused' ? 'paused' : 'resumed');
    }
    if (this.state === 'paused') {
      this.previousInput = { ...input };
      return this.events;
    }
    this.simTick++;
    this.time = Math.max(0, this.initialTime - this.simTick / 60);
    if (this.simTick === 1) this.emit('night_start', { night: this.night });
    const p = this.player;
    counters(p, ['invuln', 'dashCd', 'pulseCd', 'charm']);
    for (const shade of this.shades) counters(shade, ['ticks']);
    for (const drifter of this.drifters) {
      if (drifter.state === 'flee' && --drifter.ticks <= 0) drifter.state = 'removed';
    }
    this.drifters = this.drifters.filter((drifter) => drifter.state !== 'removed');
    this.motes = this.motes.filter((mote) => mote.kind !== 'dropped' || --mote.ttl > 0);
    for (const charm of this.charms) {
      if (!charm.available && charm.respawn > 0 && --charm.respawn === 0) charm.available = true;
    }
    this.burnFuel();
    this.updateWind();
    const waiting = p.respawn > 0;
    if (waiting) {
      if (--p.respawn === 0) {
        p.pos = [0, 0, 0]; p.vel = [0, 0, 0]; p.grounded = true; p.invuln = 90;
      }
    } else {
      this.movePlayer(input);
      if (p.pos[1] < -10) this.fall();
    }
    if (!waiting && !p.respawn && p.flames > 0) {
      this.collect();
      if (input.interact && !this.previousInput.interact) this.deposit();
    }
    this.updateSafeZones();
    if (!waiting && !p.respawn && p.flames > 0 && input.pulse && !this.previousInput.pulse) this.pulse();
    this.moveShades();
    this.moveDrifters();
    if (!waiting && !p.respawn && p.flames > 0) this.contacts();
    this.spawn();
    if (p.flames <= 0) this.finish('lost', 'no_flames');
    else if (this.time === 0) {
      const survived = this.lanterns.filter((lamp) => lamp.lit).length >= this.requiredLights;
      this.finish(survived ? 'won' : 'lost', survived ? 'dawn_survived' : 'dawn');
    }
    this.previousInput = { ...input };
    return this.events;
  }

  updateWind() {
    const phase = this.simTick % 1800;
    if (this.windEnabled && this.simTick >= 1800 && phase === 0) this.wind.dir_deg = this.random() * 360;
    this.wind.active = this.windEnabled && this.simTick >= 1800 && phase < 300;
  }

  movePlayer(input) {
    const p = this.player;
    const [mx, mz] = input.move;
    const yaw = input.cam_yaw_deg * Math.PI / 180;
    const length = Math.max(1, Math.hypot(mx, mz));
    const direction = [(mx * Math.cos(yaw) + mz * Math.sin(yaw)) / length,
      (-mx * Math.sin(yaw) + mz * Math.cos(yaw)) / length];
    if (mx || mz) p.heading = Math.atan2(direction[0], direction[1]);
    if (input.jump && !this.previousInput.jump && p.grounded) { p.vel[1] = 7; p.grounded = false; }
    if (p.grounded) {
      const pad = this.map.pads.find(({ pos }) => distance(p.pos, pos) <= 1 && Math.abs(p.pos[1] - pos[1]) < 0.2);
      if (pad) {
        const range = distance(p.pos, pad.target);
        p.launch = [(pad.target[0] - p.pos[0]) / range * pad.speed, (pad.target[2] - p.pos[2]) / range * pad.speed];
        p.vel[1] = pad.vertical; p.grounded = false;
      }
    }
    if (input.dash && !this.previousInput.dash && p.dashTicks === 0 && (p.dashCd === 0 || p.charm > 0)) {
      p.dashTicks = 12;
      p.dashCd = p.charm > 0 ? 0 : 90;
      const scale = Math.hypot(...direction);
      p.dashDir = scale ? direction.map((value) => value / scale) : [Math.sin(p.heading), Math.cos(p.heading)];
      this.emit('dash');
    }
    const speed = p.charm > 0 ? 7.2 : 6;
    const motion = p.dashTicks ? p.dashDir.map((value) => value * 14) : p.launch ?? direction.map((value) => value * speed);
    p.vel[0] = motion[0]; p.vel[2] = motion[1];
    if (this.wind.active) {
      p.vel[0] += Math.cos(this.wind.dir_deg * Math.PI / 180) * 2;
      p.vel[2] += Math.sin(this.wind.dir_deg * Math.PI / 180) * 2;
    }
    const old = [...p.pos];
    const nx = p.pos[0] + p.vel[0] * DT;
    const nz = p.pos[2] + p.vel[2] * DT;
    const floor = terrainHeight(this.night, nx, nz);
    const oldFloor = terrainHeight(this.night, old[0], old[2]);
    const towerBlocked = this.night === 3 && Math.hypot(nx, nz) < 2 && Math.hypot(old[0], old[2]) >= 2 && old[1] < 14;
    const wall = floor > old[1] + 0.12 && floor - oldFloor > 0.2;
    if (!towerBlocked && !wall) { p.pos[0] = nx; p.pos[2] = nz; }
    else { p.vel[0] = 0; p.vel[2] = 0; }
    let ground = terrainHeight(this.night, p.pos[0], p.pos[2]);
    if (this.night === 3 && oldFloor === 6 && old[1] < 0.2 && p.grounded) ground = 0;
    if (p.dashTicks > 0) {
      p.dashTicks--;
      // Giữ độ cao khi lướt, vận tốc nhảy tiếp tục sau khi lướt kết thúc.
      if (p.grounded && ground < p.pos[1] - EPS) p.grounded = false;
    } else if (p.grounded && ground >= p.pos[1] - 0.12 && ground <= p.pos[1] + 0.12) {
      p.pos[1] = ground;
      p.vel[1] = 0;
    } else {
      p.grounded = false;
      p.pos[1] += p.vel[1] * DT;
      p.vel[1] -= 20 * DT;
      if (p.vel[1] <= 0 && old[1] >= ground - EPS && p.pos[1] <= ground) {
        p.pos[1] = ground; p.vel[1] = 0; p.grounded = true; p.launch = null;
      }
    }
  }

  collect() {
    const p = this.player;
    const near = (pos) => distance(p.pos, pos) <= 1 + EPS && Math.abs(p.pos[1] - pos[1]) <= 1.5 + EPS;
    this.motes = this.motes.filter((mote) => {
      if (mote.born >= this.simTick || p.carried >= this.capacity || !near(mote.pos)) return true;
      p.carried++; this.emit('mote_picked', { carried: p.carried }); return false;
    });
    for (const charm of this.charms) {
      if (!charm.available || !near(charm.pos)) continue;
      charm.available = false; charm.respawn = 2700; p.charm = 600;
      this.emit('charm_picked', { charm_id: charm.id, charm_ticks: 600 });
    }
  }

  nearbyLantern() {
    return this.lanterns.filter((lantern) => (!lantern.lit || lantern.fuelUnits < this.tuning.fuel_max * 60) && distance(this.player.pos, lantern.pos) <= 2 + EPS)
      .sort((a, b) => distance(this.player.pos, a.pos) - distance(this.player.pos, b.pos) || order(a, b))[0];
  }

  deposit() {
    const lantern = this.nearbyLantern();
    if (!lantern || !this.player.carried) return;
    const t = this.tuning;
    if (lantern.lit) {
      const max = t.fuel_max * 60;
      const unit = t.fuel_per_mote * 60;
      const amount = Math.min(this.player.carried, Math.ceil((max - lantern.fuelUnits) / unit));
      if (!amount) return;
      this.player.carried -= amount;
      lantern.fuelUnits = Math.min(max, lantern.fuelUnits + amount * unit);
      this.score += amount * t.score.per_deposit;
      this.emit('refuel', { lantern_id: lantern.id, amount, fuel: Math.round(lantern.fuelUnits / 6) / 10 });
      return;
    }
    const cost = lantern.ever_lit ? t.relight_cost : t.lantern_cost;
    const amount = Math.min(this.player.carried, cost - lantern.deposited);
    if (amount <= 0) return;
    this.player.carried -= amount; lantern.deposited += amount; this.score += amount * t.score.per_deposit;
    this.emit('deposit', { lantern_id: lantern.id, amount, deposited: lantern.deposited });
    if (lantern.deposited >= cost) {
      const relight = lantern.ever_lit;
      lantern.lit = true;
      lantern.ever_lit = true;
      lantern.fuelUnits = t.fuel_max * 60;
      if (relight) lantern.relit_count++;
      this.successfulLights++;
      this.score += relight ? t.score.per_relight : t.score.per_lantern;
      this.emit('lantern_lit', { lantern_id: lantern.id, relight });
    }
  }

  away(from, target) {
    const range = distance(from, target);
    return range ? [(from[0] - target[0]) / range, (from[2] - target[2]) / range] : [1, 0];
  }

  updateSafeZones() {
    for (const shade of this.shades) {
      const inside = this.lanterns.find((lantern) => lantern.lit && lantern.fuelUnits >= this.tuning.low_fuel_threshold * 60 && distance(shade.pos, lantern.pos) < 6 - EPS);
      if (inside) {
        const direction = this.away(shade.pos, inside.pos);
        const step = Math.min(6 - distance(shade.pos, inside.pos), 6 / 30);
        shade.pos[0] += direction[0] * step; shade.pos[2] += direction[1] * step;
      }
      shade.safe = Boolean(inside);
    }
  }

  pulse() {
    const p = this.player;
    if (p.pulseCd > 0 || p.carried < 3) return;
    p.carried -= 3; p.pulseCd = 180;
    const center = [p.pos[0], p.pos[1] + 0.8, p.pos[2]];
    const hit = (pos) => Math.hypot(...pos.map((value, index) => value - center[index])) <= 5 + EPS;
    const stunnedIds = [];
    for (const shade of this.shades) {
      if (!hit(shade.pos)) continue;
      this.score += shade.state === 'drain' ? this.tuning.score.per_drain_stun : this.tuning.score.per_stun;
      shade.state = 'stunned'; shade.ticks = 120; shade.pushTicks = 15; shade.pushDir = this.away(shade.pos, p.pos);
      stunnedIds.push(shade.id);
    }
    for (const drifter of this.drifters) {
      if (!hit(drifter.pos)) continue;
      if (drifter.state === 'chase') {
        drifter.state = 'flee'; drifter.ticks = 240; drifter.stolenOnce = true;
      } else if (drifter.state === 'flee' && drifter.stolen > 0) {
        const amount = drifter.stolen;
        this.dropMotes(amount, drifter.pos, false);
        drifter.stolen = 0; drifter.ticks = 120;
        this.emit('drifter_drop', { drifter_id: drifter.id, amount });
      }
    }
    this.emit('pulse', { stunned_ids: stunnedIds });
  }

  shiftShade(shade, dx, dz) {
    const next = [shade.pos[0] + dx, shade.pos[1], shade.pos[2] + dz];
    const floor = terrainHeight(this.night, next[0], next[2]);
    if (!Number.isFinite(floor) || Math.abs(floor + 0.8 - shade.pos[1]) > 1.5) return;
    if (this.night === 3 && Math.hypot(next[0], next[2]) < 2) return;
    if (this.lanterns.some((lantern) => lantern.lit && lantern.fuelUnits >= this.tuning.low_fuel_threshold * 60 && distance(next, lantern.pos) < 6 - EPS)) return;
    shade.pos = [next[0], floor + 0.8, next[2]];
  }

  moveShades(wanderOnly = false) {
    for (const shade of this.shades) {
      if (shade.state === 'drain') {
        const lamp = this.lanterns.find((item) => item.id === shade.target);
        if (!lamp?.lit || lamp.fuelUnits >= this.tuning.low_fuel_threshold * 60 || distance(shade.pos, lamp.pos) > 2) {
          shade.state = 'wander';
          shade.target = undefined;
          continue;
        }
        if (distance(shade.pos, this.player.pos) > 6) continue;
        shade.state = 'chase';
      }
      if (shade.safe) continue;
      if (shade.state === 'stunned') {
        if (shade.pushTicks > 0) {
          this.shiftShade(shade, shade.pushDir[0] * 4 / 15, shade.pushDir[1] * 4 / 15);
          shade.pushTicks--;
        }
        if (shade.ticks > 0) continue;
        shade.state = 'wander';
        continue;
      }
      if (shade.state === 'recoil') {
        this.shiftShade(shade, shade.recoilDir[0] * 2 / 60, shade.recoilDir[1] * 2 / 60);
        if (shade.ticks === 0) shade.state = 'wander';
        continue;
      }
      if (shade.state === 'spawning') {
        if (shade.ticks > 0) continue;
        shade.state = 'wander';
      }
      const range = distance(shade.pos, this.player.pos);
      if (!wanderOnly && range <= 12) shade.state = 'chase';
      if (range > 18) shade.state = 'wander';
      let target;
      let direction;
      if (shade.state === 'chase') direction = this.away(this.player.pos, shade.pos);
      else {
        const targets = this.lanterns.filter((lamp) => !lamp.lit || lamp.fuelUnits < this.tuning.low_fuel_threshold * 60);
        targets.sort((a, b) => Number(b.lit) - Number(a.lit) || distance(shade.pos, a.pos) - distance(shade.pos, b.pos) || order(a, b));
        target = targets[0];
        if (!target) continue;
        shade.target = target.id;
        direction = this.away(target.pos, shade.pos);
      }
      const speed = shade.state === 'chase' ? (this.night === 3 ? 4.5 : 4) : 2;
      if (!target?.lit || distance(shade.pos, target.pos) > 2) {
        this.shiftShade(shade, direction[0] * speed / 60, direction[1] * speed / 60);
      }
      if (target?.lit && distance(shade.pos, target.pos) <= 2) {
        shade.state = 'drain';
        shade.drainTicks = 0;
      }
    }
  }

  moveDrifters() {
    const p = this.player;
    for (const drifter of this.drifters) {
      if (drifter.state !== 'flee') drifter.state = p.carried >= 5 && distance(p.pos, drifter.pos) <= 15 ? 'chase' : 'idle';
      let direction;
      if (drifter.state === 'chase') direction = this.away(p.pos, drifter.pos);
      else if (drifter.state === 'flee') direction = this.away(drifter.pos, p.pos);
      else direction = [Math.cos(this.simTick / 120), Math.sin(this.simTick / 120)];
      const speed = drifter.state === 'idle' ? 2 : 7;
      drifter.pos[0] += direction[0] * speed / 60; drifter.pos[2] += direction[1] * speed / 60;
    }
  }

  dropMotes(amount, origin, scatter = true) {
    for (let index = 0; index < amount; index++) {
      const angle = this.random() * Math.PI * 2;
      const radius = scatter ? 1.5 + this.random() : 0;
      const x = origin[0] + Math.cos(angle) * radius;
      const z = origin[2] + Math.sin(angle) * radius;
      const ground = terrainHeight(this.night, x, z);
      this.motes.push(this.makeMote([x, Number.isFinite(ground) ? ground : origin[1], z], 'dropped'));
    }
  }

  contacts() {
    const p = this.player;
    for (const drifter of [...this.drifters].sort(order)) {
      if (drifter.state !== 'chase' || drifter.stolenOnce || distance(p.pos, drifter.pos) > 1.2 + EPS) continue;
      const amount = Math.min(3, p.carried);
      p.carried -= amount; drifter.stolen = amount; drifter.stolenOnce = true;
      drifter.state = 'flee'; drifter.ticks = 240;
      this.emit('drifter_steal', { drifter_id: drifter.id, amount, carried: p.carried });
    }
    if (p.invuln > 0) return;
    const shade = [...this.shades].sort(order).find((candidate) => !candidate.safe
      && ['wander', 'chase'].includes(candidate.state) && distance(p.pos, candidate.pos) <= 1 + EPS
      && Math.abs(p.pos[1] - candidate.pos[1]) <= 1.5 + EPS);
    if (!shade) return;
    const dropped = Math.floor(p.carried / 2);
    p.carried -= dropped; p.flames--; p.invuln = 90;
    this.dropMotes(dropped, p.pos);
    shade.state = 'recoil'; shade.ticks = 60; shade.recoilDir = this.away(shade.pos, p.pos);
    this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
  }

  fall() {
    const p = this.player;
    const lost = p.carried;
    p.flames--; p.carried = 0; p.respawn = 60; p.vel = [0, 0, 0]; p.launch = null; p.dashTicks = 0;
    this.emit('player_hit', { by: 'fall', flames: p.flames, dropped: 0, lost });
  }

  spawn() {
    if (this.randomMotes && this.simTick % 240 === 0 && this.motes.filter((mote) => mote.kind === 'random').length < 30) {
      const empty = this.map.motePoints.filter((point) => !this.motes.some((mote) => distance(mote.pos, point) < 0.01 && Math.abs(mote.pos[1] - point[1]) < 0.01));
      if (empty.length) this.motes.push(this.makeMote(empty[Math.floor(this.random() * empty.length)]));
    }
    if (this.randomShades && this.simTick >= 300 && (this.simTick - 300) % this.map.shadeInterval === 0) {
      const count = this.simTick === 300 ? 2 : 1;
      for (let index = 0; index < count && this.shades.length < this.map.shadeLimit; index++) {
        const points = this.map.shadePoints.filter((point) => distance(point, this.player.pos) >= 15
          && !this.shades.some((shade) => distance(point, shade.pos) < 1));
        if (!points.length) break;
        const pos = [...points[Math.floor(this.random() * points.length)]];
        pos[1] += 0.8;
        const shade = this.makeShade({ pos, state: 'spawning', state_ticks_left: 1 });
        this.shades.push(shade); this.emit('shade_spawned', { id: shade.id });
      }
    }
    if (this.night > 1 && this.randomDrifters && this.simTick % 1200 === 0 && this.drifters.length < 2) {
      let id;
      do { id = `D${this.nextDrifter++}`; } while (this.usedDrifterIds.has(id));
      this.usedDrifterIds.add(id);
      const point = this.map.shadePoints[Math.floor(this.random() * this.map.shadePoints.length)];
      this.drifters.push({ id, pos: [point[0], point[1] + 0.8, point[2]], state: 'idle', stolen: 0, ticks: 0, stolenOnce: false });
    }
  }

  finish(result, reason) {
    this.state = result;
    if (result === 'won') {
      this.score += this.player.flames * this.tuning.score.per_flame_left;
      for (const lamp of this.lanterns) if (lamp.lit) this.score += this.tuning.score.per_lit_at_dawn + Math.floor(lamp.fuelUnits / 60);
    }
    this.emit('game_over', { result, reason });
  }

  snapshot() {
    const p = this.player;
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.simTick, night: this.night, state: this.state,
      time_left_s: this.timeLeft, score: this.score, wind: { ...this.wind },
      player: { pos: position(p.pos), vel: position(p.vel), grounded: p.grounded,
        flames: p.flames, carried: p.carried, capacity: this.capacity, invuln: p.invuln > 0,
        dash_cd_s: p.dashCd / 60, pulse_cd_s: p.pulseCd / 60, charm_s: p.charm / 60 },
      lanterns: this.lanterns.map(({ fuelUnits, pos, ...lamp }) => ({ ...lamp, pos: position(pos), fuel: Math.round(fuelUnits / 6) / 10 })),
      shades: this.shades.map(({ id, pos, state }) => ({ id, pos: position(pos), state })),
      motes_active: this.motes.length,
      motes: this.motes.map(({ id, pos, kind, ttl }) => ({ id, pos: position(pos), kind, ttl_s: ttl === null ? null : ttl / 60 })),
      drifters: this.drifters.map(({ id, pos, state, stolen }) => ({ id, pos: position(pos), state, stolen })),
      charms: this.charms.map(({ id, pos, available, respawn }) => ({ id, pos: position(pos), available, respawn_s: respawn / 60 })),
    };
  }
}
