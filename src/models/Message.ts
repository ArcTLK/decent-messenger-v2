import { IndexableType } from "dexie";
import MessageStatus from "../enums/MessageStatus";

export default interface Message {
    // create digest for these
    content: string;
    status: MessageStatus;
    senderUsername: string;
    receiverUsername: string;
    nonce: string;
    serial: number;

    // and not these
    timestamp: {
        pending: Date,
        sent: Date,
        retry?: Date
    };
    retries?: number;
    id?: IndexableType;
}