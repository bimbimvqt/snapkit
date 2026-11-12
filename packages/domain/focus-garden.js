// One completed session is credited once, regardless of which window runs it.
export const spaces = ['forest', 'rain', 'cafe', 'night'];
export const plants = ['oak', 'pine', 'blossom'];
export const initialFocus = () => ({space:'forest',plant:'oak',sound:false,volume:0.35,completed:0,totalSeconds:0,sessionSeconds:1500,timer:{remaining:1500,deadline:null}});
const integer = (value, fallback, max) => Number.isInteger(value) && value >= 0 && value <= max ? value : fallback;
export function restoreFocus(value) {
  const state = initialFocus();
  if (!value || typeof value !== 'object') return state;
  if (spaces.includes(value.space)) state.space = value.space;
  if (plants.includes(value.plant)) state.plant = value.plant;
  if (typeof value.sound === 'boolean') state.sound=value.sound;
  if (Number.isFinite(value.volume) && value.volume>=0 && value.volume<=1) state.volume=value.volume;
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
    case 'sound':
      if(typeof action.value!=='boolean')throw Error('Invalid sound preference');
      return {...state,sound:action.value};
    case 'volume':
      if(!Number.isFinite(action.value)||action.value<0||action.value>1)throw Error('Invalid volume');
      return {...state,volume:action.value};
    case 'space':
      if (!spaces.includes(action.value)) throw Error('Invalid space');
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
