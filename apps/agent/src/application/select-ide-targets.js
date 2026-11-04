import { readyTargets, selectedSet } from '../domain/device-selection.js';

// Ports are supplied by the HTTP composition root; this use case does no I/O itself.
export async function selectIDETargets(input, { devices, validateProject, listSets, saveSelection }) {
  const targets = readyTargets(input.ids, devices);
  await validateProject(targets);
  const setId = selectedSet(input.setId, targets, input.setId ? listSets() : []);
  await saveSelection({ targetIds: targets.map(device => device.id), selectedSetId: setId });
  return targets;
}
