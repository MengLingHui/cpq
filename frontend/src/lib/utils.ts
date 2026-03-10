import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================
// 用户标识与隔离存储工具
// ============================================

const USER_ID_KEY = 'cpq_user_id';

/**
 * 获取或生成当前用户的唯一标识
 * 每个浏览器/设备会有独立的用户ID，实现数据隔离
 */
export function getUserId(): string {
  let userId = localStorage.getItem(USER_ID_KEY);
  if (!userId) {
    // 生成8位随机ID
    userId = Math.random().toString(36).substring(2, 10);
    localStorage.setItem(USER_ID_KEY, userId);
    console.log('[User] 生成新用户ID:', userId);
  }
  return userId;
}

/**
 * 重置用户ID（用于清除当前用户数据，重新开始）
 */
export function resetUserId(): void {
  localStorage.removeItem(USER_ID_KEY);
  console.log('[User] 用户ID已重置');
}

/**
 * 获取当前用户的数据存储键前缀
 */
function getUserKeyPrefix(): string {
  return `cpq_${getUserId()}_`;
}

/**
 * 用户隔离的本地存储工具
 */
export const userStorage = {
  /**
   * 保存数据（自动关联当前用户）
   */
  set<T>(key: string, value: T): void {
    const fullKey = `${getUserKeyPrefix()}${key}`;
    localStorage.setItem(fullKey, JSON.stringify(value));
  },

  /**
   * 读取数据（自动关联当前用户）
   */
  get<T>(key: string, defaultValue?: T): T | null {
    const fullKey = `${getUserKeyPrefix()}${key}`;
    const data = localStorage.getItem(fullKey);
    if (data === null) {
      return defaultValue ?? null;
    }
    try {
      return JSON.parse(data) as T;
    } catch {
      return defaultValue ?? null;
    }
  },

  /**
   * 删除数据
   */
  remove(key: string): void {
    const fullKey = `${getUserKeyPrefix()}${key}`;
    localStorage.removeItem(fullKey);
  },

  /**
   * 导出当前用户的所有数据
   */
  export(): Record<string, unknown> {
    const prefix = getUserKeyPrefix();
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        const shortKey = key.slice(prefix.length);
        try {
          data[shortKey] = JSON.parse(localStorage.getItem(key)!);
        } catch {
          data[shortKey] = localStorage.getItem(key);
        }
      }
    }
    return data;
  },

  /**
   * 导入数据到当前用户
   */
  import(data: Record<string, unknown>): void {
    const prefix = getUserKeyPrefix();
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
    }
  },

  /**
   * 清除当前用户的所有数据
   */
  clear(): void {
    const prefix = getUserKeyPrefix();
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  },

  /**
   * 获取当前用户已使用的存储大小（近似值，字节）
   */
  getSize(): number {
    const prefix = getUserKeyPrefix();
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        size += key.length + (localStorage.getItem(key)?.length || 0);
      }
    }
    return size * 2; // UTF-16 编码，每个字符2字节
  },

  /**
   * 获取当前用户ID
   */
  getUserId,
};
