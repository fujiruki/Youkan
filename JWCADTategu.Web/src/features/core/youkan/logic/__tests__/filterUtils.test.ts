import { describe, it, expect } from 'vitest';
import { isTenantFilter, isCompanyContext, getSelectedTenantId } from '../filterUtils';

describe('isTenantFilter', () => {
    it('"all" は false を返す', () => {
        expect(isTenantFilter('all')).toBe(false);
    });

    it('"personal" は false を返す', () => {
        expect(isTenantFilter('personal')).toBe(false);
    });

    it('"company" は false を返す', () => {
        expect(isTenantFilter('company')).toBe(false);
    });

    it('テナントID文字列（"t_697a247b03bfc"）は true を返す', () => {
        expect(isTenantFilter('t_697a247b03bfc')).toBe(true);
    });
});

describe('isCompanyContext', () => {
    it('"all" は false を返す', () => {
        expect(isCompanyContext('all')).toBe(false);
    });

    it('"personal" は false を返す', () => {
        expect(isCompanyContext('personal')).toBe(false);
    });

    it('"company" は true を返す', () => {
        expect(isCompanyContext('company')).toBe(true);
    });

    it('テナントID文字列は true を返す', () => {
        expect(isCompanyContext('t_xxxx')).toBe(true);
    });
});

describe('getSelectedTenantId', () => {
    it('"all" は null を返す', () => {
        expect(getSelectedTenantId('all')).toBeNull();
    });

    it('"personal" は null を返す', () => {
        expect(getSelectedTenantId('personal')).toBeNull();
    });

    it('"company" は null を返す', () => {
        expect(getSelectedTenantId('company')).toBeNull();
    });

    it('テナントID文字列はその文字列自身を返す', () => {
        expect(getSelectedTenantId('t_xxxx')).toBe('t_xxxx');
    });
});
