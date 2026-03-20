/**
 * Windows system user detection
 * Uses child_process to query local accounts and current session user.
 */

import { execSync } from 'child_process';
import os from 'os';

// System accounts to exclude from the user list
const SYSTEM_ACCOUNTS = new Set([
  'administrator', 'defaultaccount', 'wdagutilityaccount', 'guest',
  'defaultuser0', 'homeuserhub',
]);

export function getWindowsUsers(): string[] {
  try {
    const output = execSync('net user', { encoding: 'utf8', timeout: 5000 });
    const lines = output.split('\n');

    const users: string[] = [];
    let inUserSection = false;

    for (const line of lines) {
      // The user list starts after the "---" separator line
      if (line.includes('---')) { inUserSection = !inUserSection; continue; }
      if (!inUserSection) continue;
      // Each line can have up to 3 usernames in columns separated by whitespace
      const names = line.trim().split(/\s{2,}/).filter(Boolean);
      for (const name of names) {
        const clean = name.trim();
        if (clean && !SYSTEM_ACCOUNTS.has(clean.toLowerCase())) {
          users.push(clean);
        }
      }
    }

    return users;
  } catch {
    return [];
  }
}

export function getCurrentWindowsUser(): string {
  try {
    return execSync('whoami', { encoding: 'utf8', timeout: 3000 }).trim();
  } catch {
    return os.userInfo().username;
  }
}
