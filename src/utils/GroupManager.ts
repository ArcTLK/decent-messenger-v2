import { Buffer } from "buffer";
import { SHA256, enc } from "crypto-js";
import { DataConnection } from "peerjs";
import { Globals } from "../Constants";
import ErrorType from "../enums/ErrorType";
import MessageType from "../enums/MessageType";
import Block, { BlockMessageItem } from "../models/Block";
import Contact from "../models/Contact";
import Group from "../models/Group";
import Blockchain from "./Blockchain";
import Database from "./Database";
import { askForBlockCreator, connectToBlockCreator } from "./Election";
import { encryptPayload, generateSignatureWithoutCleaning, isPeerOnline, sendMessage } from "./Peer";
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

        try {
            this.connecting = true;

            setTimeout(() => {
                // if not connected in 5 secs, set connecting to false - smth probably failed
                if (!this.connected) {
                    this.connecting = false;
                }
            }, 5000);

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
                        await this.becomeBlockCreator();
                    }
                }
                else {
                    this.blockCreatorConnection = connection;
                }
            }
            else {
                // become the block creator yourself
                await this.becomeBlockCreator();
            }
    
            this.connected = true;
            this.connecting = false;
        }
        catch (e) {
            console.error(e);
            this.connecting = false;
        }        
    }

    async becomeBlockCreator() {
        // start listening for messages and creating blocks
        let blocksCreated = 0;
        var interval = setInterval(async () => {
            // create block and send them to active connections
            if (this.messages.length === 0) {
                // send null block to connections
                this.connections.forEach(async connection => {                        
                    const contact = await Database.contacts.get({
                        username: connection.metadata.username
                    });
                    
                    if (contact) {
                        connection.send({
                            type: MessageType.AddBlock,
                            payload: await encryptPayload(JSON.stringify({ block: null }), contact.publicKey)
                        });
                    }      
                    else {
                        console.error(ErrorType.ContactNotFound);
                    }              
                });
            }
            else {
                // create block to add in blockchain
                const payload = {
                    serial: this.group.blockchain ? this.group.blockchain.blocks.length : 0,
                    timestamp: new Date().getTime(),
                    messages: this.messages                    
                }
                const signature = Buffer.from(await generateSignatureWithoutCleaning(payload)).toString('base64');
                const signedPayload = {
                    ...payload,
                    digitalSignature: signature,
                    previousHash: this.group.blockchain && this.group.blockchain.blocks.length > 0 ? this.group.blockchain.blocks[this.group.blockchain.blocks.length - 1].hash : ''
                }

                const hash = SHA256(JSON.stringify(signedPayload)).toString(enc.Base64);

                let block: Block = {
                    ...signedPayload,
                    hash
                }

                this.messages = [];

                // update db
                if (!this.group.blockchain) {
                    this.group.blockchain = new Blockchain();
                }

                if (!this.group.blockchain.blocks.find(x => x && x.hash === block.hash)) {
                    this.group.blockchain.blocks.push(block);
                }

                // check block for unsent messages and delete them from the db
                const hashes = new Set(block.messages.filter(x => x.senderUsername === SimpleObjectStore.user?.username).map(x => x.digitalSignature));
                this.group.unsentMessages = this.group.unsentMessages ? this.group.unsentMessages.filter(x => !hashes.has(x.digitalSignature)) : [];

                Database.groups.update(this.group, {
                    blockchain: this.group.blockchain,
                    unsentMessages: this.group.unsentMessages
                });

                // send block to connections
                this.connections.forEach(async connection => {                        
                    const contact = await Database.contacts.get({
                        username: connection.metadata.username
                    });
                    
                    if (contact) {
                        connection.send({
                            type: MessageType.AddBlock,
                            payload: await encryptPayload(JSON.stringify({ block }), contact.publicKey)
                        });
                    }      
                    else {
                        console.error(ErrorType.ContactNotFound);
                    }              
                });
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