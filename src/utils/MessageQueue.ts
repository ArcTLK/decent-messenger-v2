import { Globals } from "../Constants";
import MessageStatus from "../enums/MessageStatus";
import Message from "../models/Message";
import { sendMessageToUser } from "./Peer";

export default class MessageQueue {
    messages: Message[] = [];

    constructor() {
        setInterval(() => {
            if (this.messages.length > 0) {
                // retry sending messages
                // this.retrySendingMessages();
            }
        }, Globals.messageRetryInterval);
    }

    retrySendingMessages() {
        const now = new Date().getTime();

        this.messages.forEach(item => {
            // check state
            if (item.status === MessageStatus.Pending) {
                if (!item.timestamp.retry || (now - item.timestamp.retry.getTime() >= Globals.messageRetryInterval)) {
                    sendMessageToUser(item.receiver_username, item.content).then(() => {
                        console.log(`Message "${item.content}" marked as Sent`);
                        item.status = MessageStatus.Sent;

                        // remove message from queue
                    });

                    // check for acknowledgment and other stuff
                }
            }
        });
    }

    addMessage(message: Message) {
        console.log('Added message "' + message.content + '" to queue');
        this.messages.push(message);
        this.retrySendingMessages();
    }
}

export const messageQueue = new MessageQueue();