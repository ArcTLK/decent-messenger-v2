import { DataConnection } from "peerjs";
import { Globals } from "../Constants";
import MessageType from "../enums/MessageType";
import Block, { BlockMessageItem } from "../models/Block";
import Contact from "../models/Contact";
import Group from "../models/Group";
import { askForBlockCreator, connectToBlockCreator } from "./Election";
import { encryptPayload, isPeerOnline, sendMessage } from "./Peer";
import { SimpleObjectStore } from "./Store";

export class GroupManager {
    connected = false;
    connecting = false;
    reconnecting = false;
    shifting = false;
    group: Group;
    roundRobinList: Contact[] = [];
    roundRobinIndex: number;

    blockCreatorConnection: DataConnection | null;
    connections: DataConnection[] = [];
    messages: BlockMessageItem[] = [];
    connectionRetries = 0;

    constructor(group: Group) {
        this.group = group;
        this.roundRobinList = this.group.admins.concat(this.group.members);
    }

    async reconnect() {
        if (this.reconnecting) {
            return;
        }
        
        this.reconnecting = true;
        this.connected = false;
        this.blockCreatorConnection = null;
        await this.connect();
        this.reconnecting = false;
    }

    async connect() {
        if (this.connected || this.connecting) {
            return;
        }

        this.connecting = true;

        // check if already knows block creator
        if (!this.roundRobinIndex) {
            // inquire who is currently the block creator from random online member (ask 10 at a time)
            const randomizedList = this.roundRobinList
                .map(value => ({ value, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
            
            // exclude yourself from list
            const index = randomizedList.findIndex(x => x.username === SimpleObjectStore.user?.username);
            if (index !== -1) {
                randomizedList.splice(index, 1);
            }            

            let askList = [];
            let result = -1;
            
            for (let contact of randomizedList) {
                if (askList.length < 10) {
                    askList.push(contact);
                }
                else {
                    result = await askForBlockCreator(this.group, askList);
                    askList = [];

                    if (result !== -1) {
                        // block creator found
                        break;
                    }
                }                
            }

            // ask leftover if not yet found
            if (askList.length > 0 && result === -1) {
                result = await askForBlockCreator(this.group, askList);
                askList = [];
            }

            if (result !== -1) {
                // block creator found
                this.roundRobinIndex = result;
            }
            else {
                // make yourself the block creator
                this.roundRobinIndex = this.roundRobinList.findIndex(x => x.username === SimpleObjectStore.user?.username);
            }
        }

        if (this.roundRobinList[this.roundRobinIndex].username !== SimpleObjectStore.user?.username) {
            // connect to block creator
            const connection = await connectToBlockCreator(this, this.roundRobinList[this.roundRobinIndex].username)
            if (connection === null) {
                // connection failed, retry connection process
                this.connected = false;
                this.connecting = false;
                if (this.connectionRetries++ < Globals.maxBlockCreatorConnectionRetries) {
                    await this.connect();
                }                
                else {
                    // become the block creator yourself
                    this.becomeBlockCreator();
                }
            }
            else {
                this.blockCreatorConnection = connection;
            }
        }
        else {
            // become the block creator yourself
            this.becomeBlockCreator();
        }

        this.connected = true;
        this.connecting = false;
    }

    becomeBlockCreator() {
        // start listening for messages and creating blocks
        let blocksCreated = 0;
        var interval = setInterval(() => {
            // create block and send them to active connections
            if (this.messages.length === 0) {
                // TODO: reply saying no messages to connections
                // this.connections.forEach(async connection => {                        
                //     connection.send({
                //         type: MessageType.AddBlock,
                //         payload: await encryptPayload(JSON.stringify({ block: null }), contact.publicKey)
                //     });
                // });
            }

            blocksCreated += 1;
            if (blocksCreated > Globals.maxBlocksPerCreator) {
                // TODO: shift block creator at connectors end as well
                // clearInterval(interval);
                // this.shiftBlockCreator();
            }
        }, Globals.blockInterval);
    }

    shiftBlockCreator() {   
        return; // disable for now

        this.connected = false;

        if (this.shifting) {
            return;
        }

        this.shifting = true;

        // check who is online in round robin fashion
        Promise.all(this.roundRobinList.map(async contact => {
            if (contact.username !== SimpleObjectStore.user?.username) {
                return {
                    contact,
                    status: await isPeerOnline(contact.username)
                };
            }
            else {
                return { contact, status: true };
            }
        })).then(results => {
            for (let i = this.roundRobinIndex; i < this.roundRobinList.length + this.roundRobinIndex; ++i) {
                if (results[i % this.roundRobinList.length].status) {
                    this.roundRobinIndex = i % this.roundRobinList.length;
                }
            }

            this.shifting = false;
            this.connect();
        });        
    }

    async terminate() {
        this.connected = false;
        this.connections.map(connection => connection.close());
    }
}