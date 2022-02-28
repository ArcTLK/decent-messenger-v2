import MessageStatus from "../enums/MessageStatus";
import Contact from "./Contact";

export default interface Message {
    content: string;
    status: MessageStatus;
    timestamp: {
        pending: Date,
        sent: Date,
        acknowledged: Date
    };
    sender: Contact;
    receiver: Contact;
}