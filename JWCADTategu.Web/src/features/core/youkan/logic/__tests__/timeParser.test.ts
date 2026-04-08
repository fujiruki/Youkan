import { describe, it, expect } from 'vitest';
import { parseTimeInput, formatMinutes } from '../timeParser';

describe('parseTimeInput', () => {
  it('数値のみ → 分として解釈', () => {
    expect(parseTimeInput('90')).toBe(90);
    expect(parseTimeInput('30')).toBe(30);
    expect(parseTimeInput('0')).toBe(0);
  });

  it('m付き → 分', () => {
    expect(parseTimeInput('30m')).toBe(30);
    expect(parseTimeInput('45m')).toBe(45);
    expect(parseTimeInput('0m')).toBe(0);
  });

  it('h付き → 時間を分に変換', () => {
    expect(parseTimeInput('1h')).toBe(60);
    expect(parseTimeInput('2h')).toBe(120);
    expect(parseTimeInput('1.5h')).toBe(90);
    expect(parseTimeInput('0.5h')).toBe(30);
    expect(parseTimeInput('2.5h')).toBe(150);
  });

  it('前後の空白を無視', () => {
    expect(parseTimeInput('  30m  ')).toBe(30);
    expect(parseTimeInput(' 1h ')).toBe(60);
    expect(parseTimeInput(' 90 ')).toBe(90);
  });

  it('不正な入力 → null', () => {
    expect(parseTimeInput('')).toBeNull();
    expect(parseTimeInput('abc')).toBeNull();
    expect(parseTimeInput('h')).toBeNull();
    expect(parseTimeInput('m')).toBeNull();
  });

  it('負の値 → null', () => {
    expect(parseTimeInput('-10')).toBeNull();
    expect(parseTimeInput('-1h')).toBeNull();
  });
});

describe('formatMinutes', () => {
  it('60分未満 → Xm形式', () => {
    expect(formatMinutes(30)).toBe('30m');
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(15)).toBe('15m');
  });

  it('60分ちょうど → 1h', () => {
    expect(formatMinutes(60)).toBe('1h');
  });

  it('60分以上 → X.Xh形式', () => {
    expect(formatMinutes(90)).toBe('1.5h');
    expect(formatMinutes(120)).toBe('2h');
    expect(formatMinutes(150)).toBe('2.5h');
  });

  it('0 → 空文字', () => {
    expect(formatMinutes(0)).toBe('');
  });

  it('undefined/null → 空文字', () => {
    expect(formatMinutes(undefined)).toBe('');
    expect(formatMinutes(null)).toBe('');
  });
});
