import { ISLAND_RADIUS } from './simulation.mjs';
import { terrainHeight } from './maps.mjs';

const TAU = Math.PI * 2;
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const normalize = (a) => {
  const length = Math.hypot(...a);
  return length ? a.map((value) => value / length) : a;
};

function lookAt(eye, target) {
  const back = normalize(subtract(eye, target));
  const right = normalize(cross([0, 1, 0], back));
  const up = cross(back, right);
  return [
    right[0], up[0], back[0], 0,
    right[1], up[1], back[1], 0,
    right[2], up[2], back[2], 0,
    -dot(right, eye), -dot(up, eye), -dot(back, eye), 1,
  ];
}

function perspective(aspect) {
  const scale = 1 / Math.tan(Math.PI / 6);
  const near = 0.2;
  const far = 180;
  return [
    -scale / aspect, 0, 0, 0,
    0, scale, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, 2 * far * near / (near - far), 0,
  ];
}

const vertexShader = `
  attribute vec3 a_position;
  attribute vec3 a_normal;
  uniform mat4 u_projection, u_view;
  uniform vec3 u_origin, u_scale;
  uniform float u_dawn;
  uniform vec4 u_lamps[7];
  uniform vec2 u_rotation;
  varying vec3 v_world, v_normal;
  varying vec3 v_light;
  varying float v_depth;
  vec3 rotate(vec3 p) {
    return vec3(p.x * u_rotation.x + p.z * u_rotation.y, p.y,
      -p.x * u_rotation.y + p.z * u_rotation.x);
  }
  void main() {
    v_world = rotate(a_position * u_scale) + u_origin;
    v_normal = normalize(rotate(a_normal / u_scale));
    vec4 view = u_view * vec4(v_world, 1.0);
    v_depth = -view.z;
    gl_Position = u_projection * view;
    vec3 normal = normalize(v_normal);
    float moon = max(0.0, dot(normal, normalize(vec3(-0.5, 0.9, -0.35))));
    v_light = vec3(0.15 + 0.55 * u_dawn) + moon * vec3(0.25, 0.29, 0.36);
    for (int i = 0; i < 7; i++) {
      if (u_lamps[i].w > 0.0) {
        vec3 delta = u_lamps[i].xyz - v_world;
        float squaredDistance = dot(delta, delta);
        if (squaredDistance < 169.0) {
          float reach = 1.0 - sqrt(squaredDistance) / 13.0;
          float facing = 0.5 + 0.5 * max(0.0, dot(normal, normalize(delta + vec3(0.001))));
          v_light += reach * reach * facing * vec3(1.3, 0.73, 0.23);
        }
      }
    }

  }
`;

const fragmentShader = `
  precision mediump float;
  uniform vec3 u_color;
  uniform float u_emission, u_dawn;
  uniform vec4 u_lamps[7];
  varying vec3 v_world, v_normal;
  varying vec3 v_light;
  varying float v_depth;
  void main() {
    vec3 base = u_color * v_light + (u_color * 0.8 + vec3(0.15)) * u_emission;
    float fog = smoothstep(19.0, 76.0, v_depth);
    vec3 fogColor = vec3(0.106, 0.137, 0.314);
    gl_FragColor = vec4(mix(base, fogColor, fog * (1.0 - u_emission * 0.50)), 1.0);
  }
`;

function programFor(gl) {
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    gl.attachShader(program, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  return program;
}

function addTriangle(vertices, a, b, c) {
  const normal = normalize(cross(subtract(b, a), subtract(c, a)));
  if (normal.every((value) => value === 0)) return;
  for (const point of [a, b, c]) vertices.push(...point, ...normal);
}

function lathe(profile, sides) {
  const vertices = [];
  const point = ([radius, y], index) => [radius * Math.sin(index * TAU / sides), y, radius * Math.cos(index * TAU / sides)];
  for (let row = 0; row < profile.length - 1; row++) {
    for (let side = 0; side < sides; side++) {
      const a = point(profile[row], side);
      const b = point(profile[row], side + 1);
      const c = point(profile[row + 1], side + 1);
      const d = point(profile[row + 1], side);
      addTriangle(vertices, a, b, c);
      addTriangle(vertices, a, c, d);
    }
  }
  return vertices;
}

function meshFor(gl, vertices) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
  return { buffer, count: vertices.length / 6, vertices };
}

const rgb = (hex) => [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
const palette = {
  grass: rgb('#2F5D50'), cliff: rgb('#12384A'), trail: rgb('#C9B48A'),
  rock: rgb('#5B5F6E'), bark: rgb('#6B4A2F'), pine: rgb('#2F5D50'),
  pineTop: rgb('#2F5D50'), mint: rgb('#8FA3B8'), moon: rgb('#FFE9B0'),
  gold: rgb('#FFB347'), whiteGold: rgb('#FFF6C2'), oldGold: rgb('#F2C14E'),
  bronze: rgb('#6B4A2F'), glass: rgb('#5B5F6E'), plum: rgb('#120A1A'),
  violet: rgb('#7A3CFF'), hudViolet: rgb('#FFE58A'), stunned: rgb('#3A3450'),
  cloak: rgb('#E8E2D0'), sash: rgb('#C8102E'), skin: [0.94, 0.63, 0.47],
  straw: [0.91, 0.65, 0.31], boot: [0.23, 0.16, 0.22], shadow: [0.11, 0.21, 0.23],
  drifter: rgb('#8FA3B8'),
};

function scenery() {
  let seed = 54219;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const objects = [];
  for (let index = 0; index < 48; index++) {
    const angle = index * TAU / 48;
    const radius = 35 + random() * 5;
    objects.push({ type: 'tree', x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, size: 0.7 + random() * 0.8 });
  }
  for (let index = 0; index < 34; index++) {
    const angle = random() * TAU;
    const radius = 6 + random() * 33;
    objects.push({ type: 'stone', x: Math.sin(angle) * radius, z: Math.cos(angle) * radius, size: 0.2 + random() * 0.9 });
  }
  return objects;
}

export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false });
    if (!gl) throw new Error('Trình duyệt cần bật WebGL để hiển thị đảo.');
    this.gl = gl;
    const program = programFor(gl);
    gl.useProgram(program);
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    this.location = {};
    for (const key of ['projection', 'view', 'origin', 'scale', 'rotation', 'color', 'emission', 'dawn', 'lamps[0]']) {
      this.location[key] = gl.getUniformLocation(program, `u_${key}`);
    }
    this.position = gl.getAttribLocation(program, 'a_position');
    this.normal = gl.getAttribLocation(program, 'a_normal');
    gl.enableVertexAttribArray(this.position);
    gl.enableVertexAttribArray(this.normal);
    this.meshes = {
      disc: meshFor(gl, lathe(Array.from({ length: 9 }, (_, index) => [1 - index / 8, 0]), 48)),
      cliff: meshFor(gl, lathe([[0, -6], [0.64, -4], [0.88, -2], [1, 0]], 28)),
      sphere: meshFor(gl, lathe([[0, -1], [0.71, -0.71], [1, 0], [0.71, 0.71], [0, 1]], 12)),
      diamond: meshFor(gl, lathe([[0, -1], [1, 0], [0, 1]], 5)),
      cylinder: meshFor(gl, lathe([[0, 0], [1, 0], [1, 1], [0, 1]], 8)),
      cone: meshFor(gl, lathe([[0, 0], [1, 0], [0, 1]], 12)),
      bell: meshFor(gl, lathe([[0, 0], [1, 0], [0.78, 0.37], [0.44, 0.76], [0.15, 1], [0, 1]], 12)),
    };
    this.scenery = scenery();
  }

  draw(mesh, origin, scale, color, rotation = 0, emission = 0) {
    const gl = this.gl;
    const { location } = this;
    const geometry = this.meshes[mesh];
    if (this.recording) {
      const key = color.join(',') + ':' + emission;
      let batch = this.recording.get(key);
      if (!batch) {
        batch = { color, emission, vertices: [] };
        this.recording.set(key, batch);
      }
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      const values = geometry.vertices;
      for (let i = 0; i < values.length; i += 6) {
        const x = values[i] * scale[0], y = values[i + 1] * scale[1], z = values[i + 2] * scale[2];
        const normal = normalize([values[i + 3] / scale[0], values[i + 4] / scale[1], values[i + 5] / scale[2]]);
        batch.vertices.push(x * cos + z * sin + origin[0], y + origin[1], -x * sin + z * cos + origin[2],
          normal[0] * cos + normal[2] * sin, normal[1], -normal[0] * sin + normal[2] * cos);
      }
      return;
    }
    if (geometry !== this.lastMesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffer);
      gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, 24, 0);
      gl.vertexAttribPointer(this.normal, 3, gl.FLOAT, false, 24, 12);
      this.lastMesh = geometry;
    }
    gl.uniform3fv(location.origin, origin);
    gl.uniform3fv(location.scale, scale);
    gl.uniform2f(location.rotation, Math.cos(rotation), Math.sin(rotation));
    gl.uniform3fv(location.color, color);
    gl.uniform1f(location.emission, emission);
    gl.drawArrays(gl.TRIANGLES, 0, geometry.count);
  }

  render(night, yaw, time, pulseAge, preview) {
    const { canvas, gl, location } = this;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (!width || !height) return;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const [x, y, z] = night.player.pos;
    const orbit = preview ? 0.48 + Math.sin(time * 0.18) * 0.12 : yaw;
    const cameraDistance = preview ? 37 : 11.5;
    const cameraHeight = preview ? 24 : 7.2;
    this.orbit = orbit;
    const eye = [x - Math.sin(orbit) * cameraDistance, y + cameraHeight, z - Math.cos(orbit) * cameraDistance];
    const target = [x + Math.sin(orbit) * 3, 1.6 + y, z + Math.cos(orbit) * 3];
    this.projection = perspective(width / height);
    this.view = lookAt(eye, target);
    gl.uniformMatrix4fv(location.projection, false, this.projection);
    gl.uniformMatrix4fv(location.view, false, this.view);
    gl.uniform1f(location.dawn, night.lanterns.filter((lantern) => lantern.lit).length / night.lanterns.length);
    gl.uniform4fv(location['lamps[0]'], Array.from({ length: 7 }, (_, index) => {
      const lamp = night.lanterns[index];
      return lamp ? [lamp.pos[0], lamp.pos[1] + 3, lamp.pos[2], Number(lamp.lit)] : [0, 0, 0, 0];
    }).flat());

    if (this.cachedNight !== night.night) {
      for (const batch of this.staticBatches ?? []) gl.deleteBuffer(this.meshes[batch.key].buffer);
      this.recording = new Map();
    this.terrain(night);
    this.draw('disc', [0, 0.012, 0], [4.6, 1, 4.6], palette.trail);
    const objects = night.map.centers.flatMap((center) => this.scenery.map((object) => ({ ...object,
      x: center + object.x * night.map.radius / 40, z: object.z * night.map.radius / 40,
    })));
    for (const { type, x: px, z: pz, size } of objects) {
      const ground = terrainHeight(night.night, px, pz);
      if (type === 'tree') {
        this.draw('cylinder', [px, ground, pz], [0.19 * size, 2.55 * size, 0.19 * size], palette.bark);
        this.draw('cone', [px, ground + 1.5 * size, pz], [1.6 * size, 3.3 * size, 1.6 * size], palette.pine, px);
        this.draw('cone', [px, ground + 2.65 * size, pz], [1.17 * size, 2.7 * size, 1.17 * size], palette.pineTop, px);
      } else {
        this.draw('sphere', [px, ground + 0.16 * size, pz], [size, size * 0.52, size * 0.74], palette.rock, px);
        if (px > 0) this.draw('diamond', [px + size, ground + 0.45 * size, pz], [0.16, 0.49 * size, 0.16], palette.mint, pz, 0.24);
      }
    }

      this.staticBatches = [...this.recording.values()].map((batch, index) => {
        const key = 'static' + index;
        this.meshes[key] = meshFor(gl, batch.vertices);
        return { key, color: batch.color, emission: batch.emission };
      });
      this.recording = null;
      this.cachedNight = night.night;
    }
    for (const batch of this.staticBatches) {
      this.draw(batch.key, [0, 0, 0], [1, 1, 1], batch.color, 0, batch.emission);
    }
    for (const lantern of night.lanterns) this.lantern(lantern, time);
    for (const { pos, id } of night.motes) {
      const phase = time * 3 + Number(id.slice(1));
      this.draw('diamond', [pos[0], pos[1] + 0.72 + Math.sin(phase) * 0.2, pos[2]],
        [0.17, 0.25, 0.17], palette.whiteGold, time * 1.8, 1);
      this.draw('sphere', [pos[0] + 0.27, pos[1] + 0.81 + Math.cos(phase) * 0.26, pos[2] - 0.2],
        [0.045, 0.045, 0.045], palette.gold, 0, 0.8);
    }
    for (const shade of night.shades) this.shade(shade, night.player.pos, time);
    for (const drifter of night.drifters) {
      const [dx, dy, dz] = drifter.pos;
      this.draw('sphere', [dx, dy + Math.sin(time * 5) * 0.2, dz], [0.35, 0.2, 1.6], palette.drifter, time * 0.7, 0.3);
    }
    for (const charm of night.charms) {
      if (charm.available) {
        this.draw('diamond', [charm.pos[0], charm.pos[1] + 0.9, charm.pos[2]], [0.48, 0.7, 0.16], palette.gold, time, 0.3);
        this.draw('diamond', [charm.pos[0], charm.pos[1] + 0.9, charm.pos[2]], [0.35, 0.55, 0.19], palette.sash, time, 0.35);
      }
    }
    this.hero(night, time);
    if (this.pickupEffect) {
      const age = time - this.pickupEffect.time;
      if (age >= 0 && age < 0.6) {
        const [px, py, pz] = this.pickupEffect.pos;
        const progress = age / 0.6;
        for (let index = 0; index < 8; index++) {
          const angle = index * TAU / 8 + age * 5;
          const radius = (1 - progress) * 0.9 + 0.15;
          const size = 0.1 * (1 - progress) + 0.025;
          this.draw('diamond', [px + Math.sin(angle) * radius, py + 0.4 + progress * 1.3, pz + Math.cos(angle) * radius],
            [size, size * 1.8, size], palette.whiteGold, angle, 1);
        }
      } else this.pickupEffect = null;
    }
    if (pulseAge < 0.36) {
      const radius = 0.5 + pulseAge / 0.36 * (night.tuning.pulse_radius - 0.5);
      for (let index = 0; index < 32; index++) {
        const angle = index * TAU / 32;
        this.draw('diamond', [x + Math.sin(angle) * radius, y + 0.7, z + Math.cos(angle) * radius],
          [0.12, 0.18, 0.12], palette.gold, angle, 0.85);
      }
    }
  }

  pickup(pos, time) {
    this.pickupEffect = { pos: [...pos], time };
  }

  isOnScreen(pos) {
    if (!this.view) return true;
    const [x, y, z] = pos;
    const m = this.view;
    const vx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const vy = m[1] * x + m[5] * y + m[9] * z + m[13];
    const vz = m[2] * x + m[6] * y + m[10] * z + m[14];
    return vz < -0.2 && Math.abs(vx * this.projection[0] / -vz) <= 1
      && Math.abs(vy * this.projection[5] / -vz) <= 1;
  }

  terrain(night) {
    const map = night.map;
    for (const center of map.centers) {
      this.draw('cliff', [center, -0.08, 0], [map.radius, 1.7, map.radius], palette.cliff);
      this.draw('disc', [center, 0, 0], [map.radius, 1, map.radius], palette.grass);
    }
    if (night.night === 2) {
      for (let x = 26; x <= 44; x += 0.55) {
        this.draw('cylinder', [x, -0.16, 0], [0.32, 0.16, 2], palette.bark);
      }
    }
    if (night.night === 3) {
      for (let index = 0; index < 32; index++) {
        const a = index * Math.PI / 32;
        const b = (index + 1) * Math.PI / 32;
        const p = (r, angle, y) => [r * Math.cos(angle), y, r * Math.sin(angle)];
        const data = [];
        addTriangle(data, p(12, a, 3), p(24, b, 3), p(24, a, 3));
        addTriangle(data, p(12, a, 3), p(12, b, 3), p(24, b, 3));
        addTriangle(data, p(24, a, 0), p(24, b, 0), p(24, b, 3));
        addTriangle(data, p(24, a, 0), p(24, b, 3), p(24, a, 3));
        const key = 'terrace' + index;
        if (!this.meshes[key]) this.meshes[key] = meshFor(this.gl, data);
        this.draw(key, [0, 0, 0], [1, 1, 1], palette.grass);
      }
      this.draw('cylinder', [0, 0, 0], [8, 6, 8], palette.rock);
      this.draw('disc', [0, 6.01, 0], [8, 1, 8], palette.grass);
      this.draw('cylinder', [0, 6, 0], [2, 8, 2], palette.bark);
      this.draw('sphere', [0, 13, 0], [1.6, 1, 1.6], palette.gold);
      for (const angle of [Math.PI / 6, 5 * Math.PI / 6]) {
        const data = [];
        const p = (r, side, y) => [r * Math.cos(angle) - side * Math.sin(angle), y, r * Math.sin(angle) + side * Math.cos(angle)];
        addTriangle(data, p(30, -1.5, 0), p(24, 1.5, 3), p(30, 1.5, 0));
        addTriangle(data, p(30, -1.5, 0), p(24, -1.5, 3), p(24, 1.5, 3));
        const key = 'ramp' + angle;
        if (!this.meshes[key]) this.meshes[key] = meshFor(this.gl, data);
        this.draw(key, [0, 0.03, 0], [1, 1, 1], palette.trail);
      }
    }
    for (const pad of map.pads) {
      this.draw('cylinder', pad.pos, [1, 0.15, 1], palette.sash);
      this.draw('diamond', [pad.pos[0], pad.pos[1] + 0.3, pad.pos[2]], [0.5, 0.2, 0.5], palette.gold, 0, 0.6);
    }
  }

  lantern({ pos: [x, y, z], lit, deposited, fuelUnits }, time) {
    const fuel = fuelUnits / 60;
    const glow = fuel < 30 ? 0.55 + 0.35 * Math.cos(TAU * time) : 0.9;
    const radius = lit && fuel >= 30 ? 6 : 1.8;
    this.draw('disc', [x, y + 0.014, z], [radius, 1, radius], lit ? palette.oldGold : palette.trail);
    this.draw('cylinder', [x, y, z], [1.15, 0.24, 1.15], palette.rock);
    this.draw('cylinder', [x, y + 0.24, z], [0.32, 2.36, 0.32], palette.bronze);
    this.draw('cylinder', [x, y + 2.37, z], [0.75, 0.22, 0.75], palette.oldGold);
    this.draw('sphere', [x, y + 3.03, z], [0.77, lit ? 0.59 : 0.472, 0.77], lit ? palette.gold : palette.glass, 0, lit ? glow : deposited * 0.06);
    this.draw('cone', [x, y + 3.47, z], [0.96, 0.65, 0.96], palette.bronze, Math.PI / 8);
    this.draw('diamond', [x, y + 4.2, z], [0.16, 0.22, 0.16], palette.straw, time, lit ? 0.8 : 0.2);
    const horizontal = [Math.cos(this.orbit), -Math.sin(this.orbit)];
    const front = [-Math.sin(this.orbit), -Math.cos(this.orbit)];
    if (!lit) {
      for (let i = 0; i < 3; i++) {
        const offset = (i % 2) * 0.07;
        this.draw('diamond', [x + front[0] * 0.76 + horizontal[0] * offset, y + 2.91 + i * 0.10,
          z + front[1] * 0.76 + horizontal[1] * offset], [0.075, 0.10, 0.075], palette.shadow);
      }
    }
    if (lit) {
      const level = fuel / 100;
      this.draw('cylinder', [x, y + 4.65, z], [1.1, 0.13, 0.11], palette.bronze, this.orbit);
      this.draw('cylinder', [x + horizontal[0] * (level - 1), y + 4.67,
        z + horizontal[1] * (level - 1)], [level, 0.10, 0.16], palette.whiteGold, this.orbit, glow);
      for (let index = 0; index < 6; index++) {
        const angle = index * TAU / 6 + time * 0.7;
        this.draw('diamond', [x + Math.sin(angle) * 1.45, y + 2.4 + Math.sin(angle * 2) * 0.55, z + Math.cos(angle) * 1.45],
          [0.06, 0.12, 0.06], palette.whiteGold, angle, 0.85);
      }
    }
  }

  shade({ pos: [x, y, z], state }, player, time) {
    const angle = Math.atan2(player[0] - x, player[2] - z);
    const outline = this.accessibleColors ? rgb('#00B3FF') : palette.violet;
    const body = Math.max(0.75, y) + Math.sin(time * 4 + x) * 0.13;
    this.draw('disc', [x, 0.018, z], [0.88, 1, 0.88], palette.shadow);
    this.draw('cylinder', [x, body - 0.58, z], [0.72, 0.07, 0.67], outline, angle, 0.55);
    this.draw('bell', [x, body - 0.57, z], [0.71, 1.43, 0.66], state === 'stunned' ? palette.stunned : palette.plum, angle);
    this.draw('sphere', [x, body + 0.52, z], [0.59, 0.59, 0.58], state === 'stunned' ? palette.stunned : palette.plum, angle);
    for (const side of [-1, 1]) {
      const px = x + Math.cos(angle) * side * 0.22 + Math.sin(angle) * 0.51;
      const pz = z - Math.sin(angle) * side * 0.22 + Math.cos(angle) * 0.51;
      this.draw('sphere', [px, body + 0.55, pz], [0.117, 0.08, 0.10], outline, angle, 0.85);
    }
    if (state === 'stunned') this.draw('diamond', [x, body + 1.52, z], [0.17, 0.24, 0.17], palette.whiteGold, time * 2, 0.8);
  }

  hero(night, time) {
    const { pos: [x, y, z], heading, invulnerableUntil } = night.player;
    this.draw('disc', [x, 0.021, z], [0.62, 1, 0.62], palette.shadow);
    if (night.tick < invulnerableUntil && Math.floor(time * 13) % 2) return;
    const local = (px, py, pz) => [x + Math.cos(heading) * px + Math.sin(heading) * pz, y + py,
      z - Math.sin(heading) * px + Math.cos(heading) * pz];
    const walking = Math.hypot(...night.previousInput.move) > 0 && y < 0.05;
    for (const side of [-1, 1]) {
      const stride = walking ? Math.sin(time * 14) * 0.22 * side : 0;
      this.draw('sphere', local(side * 0.22, 0.19 + Math.max(0, stride / 2), stride), [0.18, 0.21, 0.29], palette.boot, heading);
    }
    this.draw('bell', local(0, 0.32, 0), [0.55, 1.12, 0.39], palette.cloak, heading);
    this.draw('cylinder', local(0, 0.68, 0), [0.475, 0.13, 0.345], palette.sash, heading);
    this.draw('sphere', local(0, 1.49, 0.03), [0.35, 0.39, 0.33], palette.skin, heading);
    this.draw('cylinder', local(0, 1.66, 0), [0.70, 0.06, 0.70], palette.bronze, heading);
    this.draw('cone', local(0, 1.72, 0), [0.72, 0.55, 0.72], palette.straw, heading);
    this.draw('cylinder', local(0.64, 1.21, 0.12), [0.028, 0.49, 0.028], palette.bronze, heading);
    this.draw('sphere', local(0.64, 1.19, 0.12), [0.15, 0.20, 0.15], palette.gold, heading, 0.94);
  }
}
