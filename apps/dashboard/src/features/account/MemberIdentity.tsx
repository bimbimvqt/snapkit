import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {avatarSource,type Avatar} from './avatars';
import {signedInUser} from './account.js';
import {t} from '../../shared/ui/use-language';
type Person={userId:string;name:string;email?:string;avatar?:Avatar};
const Members=createContext<Person[]>([]);
export function MemberProvider({members,children}:{members:Person[];children:ReactNode}){
 const [self,setSelf]=useState<{id:string;name:string;avatar?:Avatar}|null>(signedInUser);
 useEffect(()=>{const update=(event:Event)=>setSelf((event as CustomEvent).detail);document.addEventListener('snapkit:account-profile',update);return()=>document.removeEventListener('snapkit:account-profile',update);},[]);
 return <Members.Provider value={members.map(member=>self?.id===member.userId?{...member,name:self.name,avatar:self.avatar}:member)}>{children}</Members.Provider>;
}
export function useMemberProfiles<T extends Person>(members:T[]):T[]{const profiles=useContext(Members);return members.map(member=>{const profile=profiles.find(profile=>profile.userId===member.userId);return profile?{...member,name:profile.name,avatar:profile.avatar}:member;});}
export function MemberIdentity({userId,name}:{userId?:string;name?:string}){
 const member=useContext(Members).find(member=>member.userId===userId),label=member?.name||member?.email||name||t(userId?'Former member':'Unassigned'),src=avatarSource(member?.avatar);
 return <span className="member-identity"><span className="member-avatar" aria-hidden="true">{src?<img src={src} alt="" loading="lazy"/>:label.trim().slice(0,1).toLocaleUpperCase()}</span><span>{label}</span></span>;
}
