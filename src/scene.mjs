import { ISLAND_RADIUS } from './simulation.mjs';

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
  uniform vec2 u_rotation;
  varying vec3 v_world, v_normal;
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
  }
`;

const fragmentShader = `
  precision mediump float;
  uniform vec3 u_color;
  uniform float u_emission, u_dawn;
  uniform vec4 u_lamps[5];
  varying vec3 v_world, v_normal;
  varying float v_depth;
  void main() {
    vec3 normal = normalize(v_normal);
    float moon = max(0.0, dot(normal, normalize(vec3(-0.5, 0.9, -0.35))));
    vec3 light = vec3(0.41, 0.47, 0.68) + moon * vec3(0.4, 0.44, 0.5) + u_dawn * vec3(0.23, 0.18, 0.1);
    for (int i = 0; i < 5; i++) {
      vec3 delta = u_lamps[i].xyz - v_world;
      float reach = max(0.0, 1.0 - length(delta) / 13.0);
      float facing = 0.5 + 0.5 * max(0.0, dot(normal, normalize(delta + vec3(0.001))));
      light += u_lamps[i].w * reach * reach * facing * vec3(1.3, 0.73, 0.23);
    }
    vec3 base = u_color * light + (u_color * 0.8 + vec3(0.15)) * u_emission;
    float fog = smoothstep(19.0, 76.0, v_depth);
    vec3 fogColor = mix(vec3(0.13, 0.16, 0.28), vec3(0.32, 0.24, 0.42), u_dawn);
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
  return { buffer, count: vertices.length / 6 };
}

const palette = {
  grass: [0.19, 0.34, 0.31], cliff: [0.29, 0.26, 0.41], trail: [0.33, 0.38, 0.35],
  rock: [0.34, 0.37, 0.49], bark: [0.28, 0.22, 0.31], pine: [0.15, 0.29, 0.31],
  pineTop: [0.22, 0.42, 0.40], mint: [0.39, 0.66, 0.56], moon: [0.73, 0.80, 0.92],
  gold: [1, 0.65, 0.23], whiteGold: [1, 0.88, 0.56], oldGold: [0.62, 0.44, 0.31],
  bronze: [0.44, 0.27, 0.24], glass: [0.32, 0.25, 0.35], plum: [0.18, 0.10, 0.27],
  violet: [0.59, 0.33, 0.86], hudViolet: [0.57, 0.59, 0.89],
  cloak: [0.71, 0.26, 0.17], sash: [0.33, 0.52, 0.53], skin: [0.94, 0.63, 0.47],
  straw: [0.91, 0.65, 0.31], boot: [0.23, 0.16, 0.22], shadow: [0.11, 0.21, 0.23],
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
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
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
      disc: meshFor(gl, lathe([[1, 0], [0, 0]], 56)),
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
    const eye = [x - Math.sin(orbit) * cameraDistance, y * 0.3 + cameraHeight, z - Math.cos(orbit) * cameraDistance];
    const target = [x + Math.sin(orbit) * 3, 1.6 + y * 0.4, z + Math.cos(orbit) * 3];
    gl.uniformMatrix4fv(location.projection, false, perspective(width / height));
    gl.uniformMatrix4fv(location.view, false, lookAt(eye, target));
    gl.uniform1f(location.dawn, night.lanterns.filter((lantern) => lantern.lit).length / 5);
    gl.uniform4fv(location['lamps[0]'], night.lanterns.flatMap(({ pos, lit }) => [pos[0], pos[1] + 3, pos[2], lit ? 1 : 0]));

    this.draw('cliff', [0, -0.08, 0], [ISLAND_RADIUS, 1.7, ISLAND_RADIUS], palette.cliff);
    this.draw('disc', [0, 0, 0], [ISLAND_RADIUS, 1, ISLAND_RADIUS], palette.grass);
    this.draw('disc', [0, 0.012, 0], [4.6, 1, 4.6], palette.trail);
    for (const { type, x: px, z: pz, size } of this.scenery) {
      if (Math.hypot(px - x, pz - z) > 54 && !preview) continue;
      if (type === 'tree') {
        this.draw('cylinder', [px, 0, pz], [0.19 * size, 2.55 * size, 0.19 * size], palette.bark);
        this.draw('cone', [px, 1.5 * size, pz], [1.6 * size, 3.3 * size, 1.6 * size], palette.pine, px);
        this.draw('cone', [px, 2.65 * size, pz], [1.17 * size, 2.7 * size, 1.17 * size], palette.pineTop, px);
      } else {
        this.draw('sphere', [px, 0.16 * size, pz], [size, size * 0.52, size * 0.74], palette.rock, px);
        if (px > 0) this.draw('diamond', [px + size, 0.45 * size, pz], [0.16, 0.49 * size, 0.16], palette.mint, pz, 0.24);
      }
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
    this.hero(night, time);
    if (pulseAge < 0.36) {
      const radius = 0.5 + pulseAge / 0.36 * (night.tuning.pulse_radius - 0.5);
      for (let index = 0; index < 32; index++) {
        const angle = index * TAU / 32;
        this.draw('diamond', [x + Math.sin(angle) * radius, y + 0.7, z + Math.cos(angle) * radius],
          [0.12, 0.18, 0.12], palette.gold, angle, 0.85);
      }
    }
  }

  lantern({ pos: [x, y, z], lit, deposited }, time) {
    this.draw('disc', [x, y + 0.014, z], [lit ? 3.2 : 1.8, 1, lit ? 3.2 : 1.8], lit ? palette.oldGold : palette.trail);
    this.draw('cylinder', [x, y, z], [1.15, 0.24, 1.15], palette.rock);
    this.draw('cylinder', [x, y + 0.24, z], [0.32, 2.36, 0.32], palette.bronze);
    this.draw('cylinder', [x, y + 2.37, z], [0.75, 0.22, 0.75], palette.oldGold);
    this.draw('sphere', [x, y + 3.03, z], [0.77, 0.59, 0.77], lit ? palette.gold : palette.glass, 0, lit ? 0.9 : deposited * 0.06);
    this.draw('cone', [x, y + 3.47, z], [0.96, 0.65, 0.96], palette.bronze, Math.PI / 8);
    this.draw('diamond', [x, y + 4.2, z], [0.16, 0.22, 0.16], palette.straw, time, lit ? 0.8 : 0.2);
    if (lit) {
      for (let index = 0; index < 6; index++) {
        const angle = index * TAU / 6 + time * 0.7;
        this.draw('diamond', [x + Math.sin(angle) * 1.45, y + 2.4 + Math.sin(angle * 2) * 0.55, z + Math.cos(angle) * 1.45],
          [0.06, 0.12, 0.06], palette.whiteGold, angle, 0.85);
      }
    }
  }

  shade({ pos: [x, y, z], state }, player, time) {
    const angle = Math.atan2(player[0] - x, player[2] - z);
    const body = Math.max(0.75, y) + Math.sin(time * 4 + x) * 0.13;
    this.draw('disc', [x, 0.018, z], [0.88, 1, 0.88], palette.shadow);
    this.draw('bell', [x, body - 0.57, z], [0.71, 1.43, 0.66], palette.plum, angle);
    this.draw('sphere', [x, body + 0.52, z], [0.59, 0.59, 0.58], palette.plum, angle);
    for (const side of [-1, 1]) {
      const px = x + Math.cos(angle) * side * 0.22 + Math.sin(angle) * 0.51;
      const pz = z - Math.sin(angle) * side * 0.22 + Math.cos(angle) * 0.51;
      this.draw('sphere', [px, body + 0.55, pz], [0.117, 0.08, 0.10], palette.violet, angle, 0.85);
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
