import MessageStatus from "../enums/MessageStatus";

export default interface Message {
    content: string;
    status: MessageStatus;
    timestamp: {
        pending: Date,
        sent: Date,
        retry?: Date
    };
    sender_username: string;
    receiver_username: string;
}