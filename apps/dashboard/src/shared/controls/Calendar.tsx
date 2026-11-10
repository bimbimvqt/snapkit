import {DayPicker} from 'react-day-picker';
import {vi,enUS} from 'react-day-picker/locale';
import 'react-day-picker/style.css';

export default function Calendar({language,selected,onSelect}:{language:string;selected?:Date;onSelect:(date:Date|undefined)=>void}){
 return <DayPicker mode="single" locale={language==='vi'?vi:enUS} selected={selected} defaultMonth={selected} autoFocus onSelect={onSelect}/>;
}
