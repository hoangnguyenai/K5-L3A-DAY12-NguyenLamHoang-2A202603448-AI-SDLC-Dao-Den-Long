export const ISLAND_RADIUS = 40;
export const horizontalDistance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

function ring(radius, count, offset = 0, center = 0, y = 0) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (offset + index * 360 / count) * Math.PI / 180;
    return [center + radius * Math.cos(angle), y, radius * Math.sin(angle)];
  });
}

export function mapFor(night) {
  if (night === 2) return {
    name: 'Đảo Cau', radius: 28, centers: [0, 70], shadeInterval: 420, shadeLimit: 8,
    lanterns: [[0, 0, 20], [17, 0, -10], [-17, 0, -10], [70, 0, 20], [87, 0, -10], [53, 0, -10]],
    motePoints: [...ring(10, 4), ...ring(22, 8), ...ring(10, 4, 0, 70), ...ring(22, 8, 0, 70)],
    shadePoints: [...ring(26, 8, 22.5), ...ring(26, 8, 22.5, 70)],
    pads: [{ pos: [20, 0, 18], target: [70, 0, 0], vertical: 14, speed: 24 },
      { pos: [50, 0, -18], target: [0, 0, 0], vertical: 14, speed: 24 }],
    charms: [[35, 0, 0]],
  };
  if (night === 3) return {
    name: 'Đảo Chuông', radius: 45, centers: [0], shadeInterval: 360, shadeLimit: 10,
    lanterns: [[0, 6, 6], [18, 3, 10], [-18, 3, 10], [35, 0, -10], [-35, 0, -10], [20, 0, -35], [-20, 0, -35]],
    motePoints: [...ring(34, 18), ...Array.from({ length: 8 }, (_, index) => {
      const angle = (index + 1) * 20 * Math.PI / 180;
      return [18 * Math.cos(angle), 3, 18 * Math.sin(angle)];
    }), ...ring(5, 4, 45, 0, 6)],
    shadePoints: ring(43, 16), pads: [{ pos: [0, 3, 13], target: [0, 3, 0], vertical: 12, speed: 8 }],
    charms: [[30, 0, 25], [-30, 0, 25]],
  };
  return {
    name: 'Đảo Bến', radius: 40, centers: [0], shadeInterval: 480, shadeLimit: 6,
    lanterns: [[0, 0, 25], [23.8, 0, 7.7], [14.7, 0, -20.2], [-14.7, 0, -20.2], [-23.8, 0, 7.7]],
    motePoints: [...ring(12, 8), ...ring(33, 16)], shadePoints: ring(37, 12, 15), pads: [], charms: [],
  };
}

export function terrainHeight(night, x, z) {
  if (night === 2) {
    if (Math.hypot(x, z) <= 28 || Math.hypot(x - 70, z) <= 28 || (x >= 26 && x <= 44 && Math.abs(z) <= 2)) return 0;
    return -Infinity;
  }
  const radius = Math.hypot(x, z);
  if (radius > (night === 3 ? 45 : 40)) return -Infinity;
  if (night !== 3) return 0;
  if (radius <= 8) return 6;
  if (radius >= 12 && radius <= 24 && z > 0) return 3;
  for (const angle of [Math.PI / 6, 5 * Math.PI / 6]) {
    const along = x * Math.cos(angle) + z * Math.sin(angle);
    const across = -x * Math.sin(angle) + z * Math.cos(angle);
    if (along >= 24 && along <= 30 && Math.abs(across) <= 1.5) return (30 - along) / 2;
  }
  return 0;
}
