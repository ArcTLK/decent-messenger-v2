import { Globals } from "../Constants";
import MessageStatus from "../enums/MessageStatus";
import Database from "./Database";
import { sendMessage } from "./Peer";
import { addLog } from '../models/Log';
import LogType from "../enums/LogType";
import StoredMessage from "../models/message/StoredMessage";
import PayloadMessage from "../models/message/PayloadMessage";
import { SimpleObjectStore } from "./Store";
export default class MessageQueue {
    messages: StoredMessage[] = [];
    retrying: boolean = false;

    constructor() {
        // populate message queue from db
        Database.messages.where({
            status: MessageStatus.Queued
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
        // retry lock
        if (this.retrying) {
            return;
        }

        this.retrying = true;

        this.messages.forEach(item => {
            // check status
            if (item.status === MessageStatus.Queued) {
                // check if first attempt or max retries have passed
                if ((!item.retry && item.retries.length > 0) || item.retries.length > Globals.maxRetries) {
                    // update db and remove from queue
                    item.status = MessageStatus.Failed;
                    Database.messages.update(item.id!, {
                        status: MessageStatus.Failed
                    });
                    this.messages.splice(this.messages.findIndex(x => x.id === item.id), 1);
                }
                // check if retry duration passed
                else if (item.retries.length === 0 || item.retries[item.retries.length - 1].getTime() >= Globals.messageRetryInterval) {
                    item.retries.push(new Date());
                    Database.messages.update(item.id!, {
                        retries: item.retries
                    });

                    const key = item.createdAt + `-${item.retries.length}`;
                    addLog(`Trying to send the message to ${item.receiverUsername}`, key, 'Sending Message');
                    sendMessage(item, key).then(() => {
                        item.status = MessageStatus.Sent;

                        // update db and remove from queue
                        Database.messages.update(item.id!, {
                            status: MessageStatus.Sent,
                        });
                        this.messages.splice(this.messages.findIndex(x => x.id === item.id), 1);
                        
                        addLog(`Received acknowledgement, marking message as sent.`, key, 'Sending Message', LogType.Info, 1);
                    }).catch(error => {
                        addLog(error, key, 'Sending Message', LogType.Error, 1);
                    });
                }
            }
            else {
                this.messages.splice(this.messages.findIndex(x => x.id === item.id), 1);
            }
        });

        this.retrying = false;
    }

    addMessage(message: PayloadMessage, retry: boolean = true) {
        const storedMessage = {
            ...message,
            status: MessageStatus.Queued,
            retry,
            retries: []
        } as StoredMessage;

        this.messages.push(storedMessage);

        // store it in db
        Database.messages.add(storedMessage).then(() => {
            this.retrySendingMessages();
        });        
    }

    retryMessage(message: StoredMessage) {
        Database.messages.update(message.id!, {
            status: MessageStatus.Queued
        });

        this.messages.push({
            ...message,
            status: MessageStatus.Queued,
            retry: true,
            retries: []
        });

        this.retrySendingMessages();
    }
}

export const messageQueue = new MessageQueue();