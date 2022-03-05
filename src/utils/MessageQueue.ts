import { Globals } from "../Constants";
import MessageStatus from "../enums/MessageStatus";
import Message from "../models/Message";
import Database from "./Database";
import { sendMessage } from "./Peer";
export default class MessageQueue {
    messages: Message[] = [];

    constructor() {
        // populate message queue from db
        Database.messages.where({
            status: MessageStatus.Pending
        }).toArray().then(messages => {
            if (messages) {
                this.messages.push(...messages);
            }
        });

        setInterval(() => {
            if (this.messages.length > 0) {
                // retry sending messages
                this.retrySendingMessages();
            }
        }, Globals.messageRetryInterval);
    }

    retrySendingMessages() {
        const now = new Date().getTime();

        this.messages.forEach(item => {
            // check state
            if (item.status === MessageStatus.Pending) {
                if ((!item.timestamp.retry || (now - item.timestamp.retry.getTime() >= Globals.messageRetryInterval))) {
                    if (!item.retries) {
                        item.retries = 1;
                    }
                    else {
                        ++item.retries;
                    }
                    if (item.retries <= Globals.maxRetries) {
                        console.log(`Trying to send a message to ${item.receiverUsername} (${item.retries})`);
                        sendMessage(item).then(() => {
                            console.log(`Message "${item.content}" marked as Sent`);
                            item.status = MessageStatus.Sent;
    
                            // update db and remove from queue
                            Database.messages.update(item.id!, {
                                status: MessageStatus.Sent
                            });
                            this.messages.splice(this.messages.findIndex(x => x.id === item.id), 1);
                        });
    
                        // TODO: check for acknowledgment and other stuff
                    }
                    else {
                        // update db and remove from queue
                        item.status = MessageStatus.Failed;
                        Database.messages.update(item.id!, {
                            status: MessageStatus.Failed
                        });
                        this.messages.splice(this.messages.findIndex(x => x.id === item.id), 1);                        
                    }
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