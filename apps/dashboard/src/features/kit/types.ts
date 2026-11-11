import type {StorageVolume} from './StorageVolumes';
export type Recipe={openEditor:boolean;compose:boolean;ports:number[];deviceIds:string[]};
export type KitFile={id:string;name:string;size:number;sha256:string;addedAt:string;taskId:string};
export type KitSnapshot={context:{name:string;framework:string;branch:string;changed:number;connected:boolean;composeAvailable:boolean};recipe:Recipe;files:KitFile[];lastStartedAt:string|null;demo:boolean};
export type KitJob={id:string;kind:string;status:'running'|'complete'|'attention';startedAt:number;currentStep?:string;results:{step:string;ok:boolean;message?:string}[]};
export type Ready={checkedAt:number;checks:{id:string;title:string;status:string;detail:string}[];ports:{port:number;busy:boolean}[];docker:boolean|null};
export type Machine={checkedAt:number;platform:string;memory:{total:number;used:number};disk:{free:number;total:number;name?:string}|null;volumes?:StorageVolume[];uptime:number;processes:{pid:number;name:string;cpu?:number;memory:number}[];caches:{name:string;bytes:number;partial:boolean}[]};
