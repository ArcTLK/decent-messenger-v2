import { IndexableType } from "dexie";

export default interface Log {
    id?: IndexableType;
    text: string;
    timestamp: Date;
    group: string;
}