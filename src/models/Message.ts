import { IndexableType } from "dexie";
import MessageStatus from "../enums/MessageStatus";

export default interface Message {
    // create digest for these
    content: string;
    status: MessageStatus;
    senderUsername: string;
    receiverUsername: string;
    nonce: string;
    createdAt: Date;


    // and not these
    sentAt?: Date;
    retriedAt?: Date;
    retries?: number;
    id?: IndexableType;
}