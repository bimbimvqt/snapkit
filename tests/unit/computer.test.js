import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeComputer } from '../../apps/agent/src/modules/diagnostics/computer.js';
test('Mac display fields omit serial and machine identifiers', () => {
  const result = describeComputer('darwin', { machine_name: 'Mac mini', chip_type: 'Apple M4', serial_number: 'private', platform_UUID: 'private' }, { computer_name: 'Desk Mac', os_version: 'macOS 26.1' });
  assert.equal(result.form, 'mini'); assert.equal(result.chip, 'Apple M4'); assert.equal(result.name, 'Desk Mac'); assert.equal(result.osVersion, 'macOS 26.1'); assert.doesNotMatch(JSON.stringify(result), /private/);
  assert.equal(describeComputer('darwin', { machine_name: 'MacBook Pro' }).form, 'laptop');
});
test('Windows laptops and desktops retain processor and Windows build information', () => {
  const result = describeComputer('win32', { Model: ' Surface Laptop ', Processor: ' Snapdragon X Elite ', ChassisType: 10 }, { Caption: ' Microsoft Windows 11 Pro ', Version: '10.0.26100', BuildNumber: '26100' });
  assert.equal(result.form, 'laptop'); assert.equal(result.model, 'Surface Laptop'); assert.equal(result.chip, 'Snapdragon X Elite'); assert.equal(result.osName, 'Microsoft Windows 11 Pro'); assert.match(result.osVersion, /Build 26100/);
  assert.equal(describeComputer('win32', { PCSystemType: 1 }).form, 'desktop');
});
test('unavailable tools fall back without guessing a model or chip generation', () => {
  const result = describeComputer('darwin', {}, {}, { name: 'Workstation', chip: 'Apple Silicon', release: '25.1' });
  assert.equal(result.model, null); assert.equal(result.chip, 'Apple Silicon'); assert.equal(result.name, 'Workstation');
});
