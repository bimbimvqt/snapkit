export type Job={id:string;kind:string;label:string;createdAt:string;status:string;logs:string;error?:string;appId:string;deviceId:string;os:string;method?:string;workload?:string;version?:string;build?:string;metrics?:Record<string,number|null>;notes?:string[]};
export type Snapshot={demo:boolean;workspace:string;devices:{id:string;name:string;platform:string}[];jobs:Job[];active:string|null;mcp:{enabled:boolean;allowActions:boolean;lastUsed?:string;config:unknown}};
export type Difference={metric:string;before:number|null;after:number|null;delta:number|null;percent:number|null};
