import MessageStatus from "../../enums/MessageStatus";

export default interface BaseMessage {
    // create digest for these
    senderUsername: string;
    receiverUsername: string;
    createdAt: number;
    nonce: string;
}