import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileSnapshot} from '../../apps/dashboard/src/shared/state/reconcile.js';
test('workspace snapshots retain unchanged branches and reconcile membership removals and reorders',()=>{
 const first={id:'one',tasks:[{id:'a',version:1,criteria:[{id:'c',done:false}]},{id:'b',version:1}],members:[{id:'user'}]};
 assert.equal(reconcileSnapshot(first,structuredClone(first)),first);
 const updated=reconcileSnapshot(first,{...structuredClone(first),tasks:[{...first.tasks[0],version:2},first.tasks[1]]});
 assert.notEqual(updated,first);assert.equal(updated.members,first.members);assert.equal(updated.tasks[1],first.tasks[1]);assert.equal(updated.tasks[0].criteria,first.tasks[0].criteria);
 const reordered=reconcileSnapshot(updated,{...updated,tasks:[updated.tasks[1],updated.tasks[0]],members:[]});
 assert.equal(reordered.tasks[0],updated.tasks[1]);assert.equal(reordered.members.length,0);assert.equal(reconcileSnapshot(reordered,{id:'two'}).tasks,undefined);
});
