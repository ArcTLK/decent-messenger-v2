import { IndexableType } from "dexie";
import MessageStatus from "../../enums/MessageStatus";
import BaseMessage from "./BaseMessage";
import PayloadMessage from "./PayloadMessage";

export default interface StoredMessage extends BaseMessage, PayloadMessage {    
    status: MessageStatus;
    retry: boolean;
    retries: Date[];
    id?: IndexableType;
    sentAt?: number;
}