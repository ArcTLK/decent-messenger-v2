import { IndexableType } from "dexie";
import LogType from "../enums/LogType";
import Database from '../utils/Database';


export default interface Log {
    id?: IndexableType;
    text: string;
    timestamp: Date;
    groupName: string;
    groupId: string;
    done: number;
    type: LogType;
}

export function addLog(text: string, groupId: string, groupName: string, type: LogType = LogType.Info, done: number = 0) {
    Database.logs.add({
        text,
        timestamp: new Date(),
        groupName,
        groupId,
        done,
        type
    });
}