import { Globals } from "../Constants";
import MessageStatus from "../enums/MessageStatus";
import Message from "../models/Message";
import Database from "./Database";
import { peerBank, sendMessage } from "./Peer";
import { addLog } from '../models/Log';
import LogType from "../enums/LogType";
export default class MessageQueue {
    messages: Message[] = [];

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
        const now = new Date().getTime();

        this.messages.forEach(item => {
            // check state
            if (item.status === MessageStatus.Queued) {
                if (!item._ignore) {
                    item._ignore = {};
                }
                if ((!item._ignore.retriedAt || (now - item._ignore.retriedAt.getTime() >= Globals.messageRetryInterval))) {
                    if (!item._ignore.retries) {
                        item._ignore.retries = 1;
                    }
                    else {
                        ++item._ignore.retries;
                    }

                    const key = item.nonce + `-${item._ignore.retries}`;
                    if (item._ignore.retries <= Globals.maxRetries) {                        
                        addLog(`Trying to send the message to ${item.receiverUsername}`, key, 'Sending Message');
                        sendMessage(item, key).then(() => {
                            item.status = MessageStatus.Sent;
    
                            // update db and remove from queue
                            Database.messages.update(item.id!, {
                                status: MessageStatus.Sent
                            });
                            this.messages.splice(this.messages.findIndex(x => x.id === item.id), 1);
                            
                            addLog(`Received acknowledgement, marking message as sent.`, key, 'Sending Message', LogType.Info, 1);
                        }).catch(error => {
                            addLog(error, key, 'Sending Message', LogType.Error, 1);
                        }).finally(() => {
                            peerBank.releaseUsage(item.receiverUsername);
                        });
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
            else {
                this.messages.splice(this.messages.findIndex(x => x.id === item.id), 1);
            }
        });
    }

    addMessage(message: Message) {
        this.messages.push(message);
        this.retrySendingMessages();
    }
}

export const messageQueue = new MessageQueue();