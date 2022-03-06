import { IndexableType } from "dexie";
import MessageStatus from "../enums/MessageStatus";

export default interface Message {
    // create digest for these
    content: string;
    status: MessageStatus;
    senderUsername: string;
    receiverUsername: string;
    nonce: string;
    createdAt: number; // timestamp


    // and not these
    _ignore?: {
        sentAt?: Date;
        retriedAt?: Date;
        retries?: number;
    }
    id?: IndexableType;
}