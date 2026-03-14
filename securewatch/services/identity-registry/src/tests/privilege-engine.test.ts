/**
 * PrivilegeEngine tests — grant, revoke, most-restrictive conflict resolution.
 */

import { describe, it, expect, vi } from 'vitest';
import { mergeRestrictive } from '../privilege-engine.js';
import type { Action } from '@securewatch/types';

describe('mergeRestrictive', () => {
  it('returns all false when no grant sets', () => {
    const result = mergeRestrictive([]);
    expect(result.READ).toBe(false);
    expect(result.WRITE).toBe(false);
  });

  it('returns granted actions when single grant set', () => {
    const result = mergeRestrictive([['READ', 'WRITE'] as Action[]]);
    expect(result.READ).toBe(true);
    expect(result.WRITE).toBe(true);
    expect(result.DELETE).toBe(false);
  });

  it('DENY beats ALLOW — most restrictive wins', () => {
    // Group A grants READ+WRITE, Group B grants READ only
    // Result: only READ (WRITE denied because Group B does not grant it)
    const result = mergeRestrictive([
      ['READ', 'WRITE'] as Action[],
      ['READ'] as Action[],
    ]);
    expect(result.READ).toBe(true);
    expect(result.WRITE).toBe(false);
  });

  it('all actions denied when any grant set denies all', () => {
    const result = mergeRestrictive([
      ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'EXPORT'] as Action[],
      [] as Action[],
    ]);
    expect(result.READ).toBe(false);
    expect(result.WRITE).toBe(false);
    expect(result.DELETE).toBe(false);
  });

  it('all actions allowed when all grant sets allow all', () => {
    const all: Action[] = ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'EXPORT'];
    const result = mergeRestrictive([all, all]);
    expect(result.READ).toBe(true);
    expect(result.WRITE).toBe(true);
    expect(result.DELETE).toBe(true);
    expect(result.EXECUTE).toBe(true);
    expect(result.EXPORT).toBe(true);
  });

  it('three groups — most restrictive across all three', () => {
    const result = mergeRestrictive([
      ['READ', 'WRITE', 'EXECUTE'] as Action[],
      ['READ', 'EXECUTE'] as Action[],
      ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'EXPORT'] as Action[],
    ]);
    // Only READ and EXECUTE appear in all three
    expect(result.READ).toBe(true);
    expect(result.EXECUTE).toBe(true);
    expect(result.WRITE).toBe(false);   // missing from group 2
    expect(result.DELETE).toBe(false);  // missing from groups 1 and 2
    expect(result.EXPORT).toBe(false);  // missing from groups 1 and 2
  });
});
