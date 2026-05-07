import { describe, it, expect } from 'vitest';
import { getPerspectiveLabel } from '../perspectiveLabel';

const tenants = [
  { id: 'tenant-001', name: '藤田建具店', title: '藤田建具店（Title）' },
  { id: 'tenant-002', name: '青年部', title: '' },
  { id: 'tenant-003', name: 'テナント3', title: undefined as unknown as string },
];

describe('getPerspectiveLabel', () => {
  it('filterMode="all" → "すべて"', () => {
    expect(getPerspectiveLabel('all', tenants)).toBe('すべて');
  });

  it('filterMode="personal" → "個人"', () => {
    expect(getPerspectiveLabel('personal', tenants)).toBe('個人');
  });

  it('filterMode="company" → "会社"', () => {
    expect(getPerspectiveLabel('company', tenants)).toBe('会社');
  });

  it('filterMode="someday" → "いつかやる"', () => {
    expect(getPerspectiveLabel('someday', tenants)).toBe('いつかやる');
  });

  it('テナントIDが一致する場合はtitleを返す', () => {
    expect(getPerspectiveLabel('tenant-001', tenants)).toBe('藤田建具店（Title）');
  });

  it('titleが空文字の場合はnameを返す', () => {
    expect(getPerspectiveLabel('tenant-002', tenants)).toBe('青年部');
  });

  it('titleがundefinedの場合はnameを返す', () => {
    expect(getPerspectiveLabel('tenant-003', tenants)).toBe('テナント3');
  });

  it('一致するテナントがない場合は "Unknown Tenant" を返す', () => {
    expect(getPerspectiveLabel('non-existent-id', tenants)).toBe('Unknown Tenant');
  });

  it('joinedTenantsが空配列の場合はfallbackを返す', () => {
    expect(getPerspectiveLabel('tenant-001', [])).toBe('Unknown Tenant');
  });
});
