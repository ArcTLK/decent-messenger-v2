import MessageStatus from "../../enums/MessageStatus";

export default interface BaseMessage {
    // create digest for these
    senderUsername: string;
    receiverUsername: string;
    nonce: string;
    createdAt: number; // timestamp
}