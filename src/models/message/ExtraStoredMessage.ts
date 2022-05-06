import { IndexableType } from "dexie";

export default interface ExtraStoredMessage {    
    messageId: IndexableType;
    encryptedPayload: string;
    digitalSignature: string;
    id?: IndexableType;
}