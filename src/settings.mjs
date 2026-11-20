const STORAGE_KEY = 'dao-den-long.settings.v1';
const defaults = { volume: 0.35, sensitivity: 1 };

export function loadSettings(storage) {
  const settings = { ...defaults };
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (Number.isFinite(saved?.volume)) settings.volume = Math.min(1, Math.max(0, saved.volume));
    if (Number.isFinite(saved?.sensitivity)) settings.sensitivity = Math.min(2, Math.max(0.25, saved.sensitivity));
  } catch {
    // Dùng mặc định nếu dữ liệu hỏng hoặc trình duyệt chặn lưu trữ.
  }
  return settings;
}

export function saveSettings(storage, settings) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
