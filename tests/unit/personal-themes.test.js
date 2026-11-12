import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {initialFocus,restoreFocus,changeFocus} from '../../packages/domain/focus-garden.js';
import {themeTokens,contrast,cleanTheme} from '../../packages/domain/personal-themes.js';
const theme=()=>({id:'custom-'+randomUUID(),name:'My sunset',scene:'gradient',accent:'#ff7799',background:'#552233'});
test('custom themes can be created, edited, restored and deleted without losing focus progress',()=>{
 const custom=theme();let state={...initialFocus(),completed:5,totalSeconds:7500};
 state=changeFocus(state,{type:'theme:save',theme:custom});assert.equal(state.space,custom.id);
 state=changeFocus(state,{type:'theme:save',theme:{...custom,name:'Updated'}});assert.equal(state.themes.length,5);
 state=restoreFocus(JSON.parse(JSON.stringify({...state,sound:true,volume:0.5})));
 assert.equal(state.themes.at(-1).name,'Updated');assert.equal(state.space,custom.id);assert.equal('sound' in state,false);
 assert.throws(()=>changeFocus(state,{type:'theme:delete',value:'forest'}));
 state=changeFocus(state,{type:'theme:delete',value:custom.id});assert.equal(state.space,'forest');assert.equal(state.completed,5);assert.equal(state.totalSeconds,7500);
});
test('full custom library survives restoration and rejects malformed entries',()=>{
 let state=initialFocus();for(let i=0;i<64;i++)state=changeFocus(state,{type:'theme:save',theme:theme()});
 assert.equal(restoreFocus(state).themes.length,68);assert.throws(()=>changeFocus(state,{type:'theme:save',theme:theme()}));
 for(const invalid of [{name:''},{accent:'red'},{id:'forest'},{scene:'bogus'},{name:'bad\nname'}])assert.throws(()=>cleanTheme({...theme(),...invalid}));
 assert.equal(restoreFocus({themes:[{id:'bogus'}]}).themes.length,4);
});
test('extreme custom palettes keep text and controls readable in light and dark modes',()=>{
 for(const background of ['#ffffff','#000000','#ff0000','#00ff00','#0000ff'])for(const accent of ['#ffffff','#000000','#ff00ff','#ffff00'])for(const light of [true,false]){
  const colors=themeTokens({...theme(),background,accent},light);
  assert.ok(contrast(colors['--text'],colors['--surface'])>=4.5);
  assert.ok(contrast(colors['--muted'],colors['--surface'])>=4.5);
  assert.ok(contrast(colors['--accent'],colors['--bg'])>=3);
  assert.ok(contrast(colors['--accent-ink'],colors['--accent'])>=4.5);
 }
});
