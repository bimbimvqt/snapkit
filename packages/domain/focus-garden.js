// One completed session is credited once, regardless of which window runs it.
import {presetThemes,restoreThemes,cleanTheme,isPresetTheme} from './personal-themes.js';
export const spaces = presetThemes.map(theme=>theme.id);
export const plants = ['oak', 'pine', 'blossom'];
export const initialFocus = () => ({space:'forest',themes:restoreThemes(),plant:'oak',completed:0,totalSeconds:0,sessionSeconds:1500,timer:{remaining:1500,deadline:null}});
const integer = (value, fallback, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
export function restoreFocus(value) {
  const state = initialFocus();
  if (!value || typeof value !== 'object') return state;
  state.themes=restoreThemes(value.themes);
  if (state.themes.some(theme=>theme.id===value.space)) state.space = value.space;
  if (plants.includes(value.plant)) state.plant = value.plant;
  state.completed = integer(value.completed, 0, 1000000);
  state.totalSeconds = integer(value.totalSeconds, 0, Number.MAX_SAFE_INTEGER - 86400);
  if ([300,900,1500,2700,3600].includes(value.sessionSeconds)) state.sessionSeconds = value.sessionSeconds;
  const timer = value.timer;
  if (timer && Number.isInteger(timer.remaining) && timer.remaining >= 0 && timer.remaining <= 86400 && (timer.deadline === null || (Number.isFinite(timer.deadline) && timer.deadline > 0 && timer.deadline <= Date.now() + 86400000))) state.timer = {remaining:timer.remaining,deadline:timer.deadline};
  return state;
}
export function settleFocus(state, now = Date.now()) {
  if (state.timer.deadline === null || state.timer.deadline > now) return state;
  return {...state,completed:state.completed+1,totalSeconds:state.totalSeconds+state.sessionSeconds,timer:{remaining:0,deadline:null}};
}
export function changeFocus(previous, action, now = Date.now()) {
  const state = settleFocus(previous, now);
  switch (action?.type) {
    case 'theme:save': {
      const theme=cleanTheme(action.theme),existing=state.themes.some(item=>item.id===theme.id);
      if(!existing&&state.themes.length>=68)throw Error('Theme library is full');
      return {...state,space:theme.id,themes:existing?state.themes.map(item=>item.id===theme.id?theme:item):[...state.themes,theme]};
    }
    case 'theme:delete':
      if(isPresetTheme(action.value)||!state.themes.some(item=>item.id===action.value))throw Error('Invalid personal theme');
      return {...state,space:state.space===action.value?'forest':state.space,themes:state.themes.filter(item=>item.id!==action.value)};
    case 'space':
      if (!state.themes.some(theme=>theme.id===action.value)) throw Error('Invalid space');
      return {...state,space:action.value};
    case 'plant':
      if (!plants.includes(action.value)) throw Error('Invalid plant');
      return {...state,plant:action.value};
    case 'duration':
    case 'reset': {
      if (![300,900,1500,2700,3600].includes(action.seconds)) throw Error('Invalid duration');
      if (action.type === 'duration' && state.timer.deadline !== null) throw Error('Pause first');
      return {...state,sessionSeconds:action.seconds,timer:{remaining:action.seconds,deadline:null}};
    }
    case 'toggle': {
      if (state.timer.deadline !== null) return {...state,timer:{remaining:Math.max(0,Math.ceil((state.timer.deadline-now)/1000)),deadline:null}};
      const remaining = state.timer.remaining || state.sessionSeconds || 1500;
      return {...state,timer:{remaining,deadline:now+remaining*1000}};
    }
    default: throw Error('Invalid focus action');
  }
}
export function gardenProgress(state) {
  const minutes = Math.floor(state.totalSeconds / 60), trees = Math.floor(minutes / 100), growth = minutes % 100;
  return {minutes,trees,growth,stage:growth===0?0:growth<25?1:growth<60?2:3,remaining:100-growth};
}
