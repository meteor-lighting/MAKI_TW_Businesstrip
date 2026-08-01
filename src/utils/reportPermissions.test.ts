import assert from 'node:assert/strict';
import test from 'node:test';
import { canEditReport, isReportOwner } from './reportPermissions.ts';

const ownerAuthId = '11111111-1111-1111-1111-111111111111';

test('recognizes a report owner by Supabase auth UUID', () => {
    assert.equal(isReportOwner(ownerAuthId, ownerAuthId), true);
});

test('does not confuse an employee code with the report owner UUID', () => {
    assert.equal(isReportOwner(ownerAuthId, 'H001'), false);
});

test('allows a regular user to edit their own report', () => {
    assert.equal(canEditReport(ownerAuthId, { authId: ownerAuthId, role: 'user' }), true);
});

test('keeps another user read-only', () => {
    assert.equal(canEditReport(ownerAuthId, {
        authId: '22222222-2222-2222-2222-222222222222',
        role: 'user',
    }), false);
});

test('allows an administrator to edit any report', () => {
    assert.equal(canEditReport(ownerAuthId, {
        authId: '22222222-2222-2222-2222-222222222222',
        role: 'admin',
    }), true);
});
