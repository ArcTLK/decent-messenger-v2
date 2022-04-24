import { DataConnection } from "peerjs";
import { v4 } from "uuid";
import { Globals } from "../Constants";
import MessageType from "../enums/MessageType";
import { BlockMessageItem } from "../models/Block";
import Contact from "../models/Contact";
import Group from "../models/Group";
import { addLog } from "../models/Log";
import Blockchain from "./Blockchain";
import Database from "./Database";
import { GroupManager } from "./GroupManager";
import { createPayloadMessage, decryptPayload, sendMessage } from "./Peer";
import { SimpleObjectStore } from "./Store";

export async function connectToBlockCreator(groupManager: GroupManager, username: string): Promise<DataConnection | null> {
    const connection = await SimpleObjectStore.peerBank.getDataConnectionForUsername(username);
    const logId = v4();
    
    let timer = new Date().getTime();

    var interval = setInterval(() => {
        if (new Date().getTime() - Globals.blockInterval * 2 > timer) {
            // its been so long without a block, probably went offline - close connection
            cleanVariables();
        }
    }, Globals.blockInterval);

    function cleanVariables() {
        clearInterval(interval);
        // groupManager.shiftBlockCreator();
        groupManager.reconnect();
        SimpleObjectStore.peerBank.removePeer(username);
    }

    const message = await createPayloadMessage(JSON.stringify({
        group: {
            name: groupManager.group.name,
            createdAt: groupManager.group.createdAt
        }
    }), MessageType.ConnectToBlockCreator, username);

    try {
        const result = await sendMessage(message, logId, connection);        
        
        if (result.blockCreator === null) {
            // hes not block creator and doesnt know who is, trigger the ask process
            return null;
        }
        else if (result.blockCreator !== groupManager.roundRobinIndex) {
            // someone else is block creator, connect to them instead
            return await connectToBlockCreator(groupManager, groupManager.roundRobinList[result.blockCreator].username);
        }
        else {
            // they are the block creator
            connection.on('data', async data => {
                // receive block data
                if (data.type === MessageType.AddBlock) {
                    data.payload = JSON.parse(await decryptPayload(data.payload)); 
                }

                if (data.payload.block) {
                    // received a block save it in db
                    if (!groupManager.group.blockchain) {
                        groupManager.group.blockchain = new Blockchain();
                    }

                    if (!groupManager.group.blockchain.blocks.find(x => x && x.hash === data.payload.block.hash)) {
                        groupManager.group.blockchain.blocks.push(data.payload.block);
                    } 

                    // check block for unsent messages and delete them from the db
                    const hashes = new Set(data.payload.block.messages.filter((x: BlockMessageItem) => x.senderUsername === SimpleObjectStore.user?.username).map((x: BlockMessageItem) => x.digitalSignature));
                    groupManager.group.unsentMessages = groupManager.group.unsentMessages ? groupManager.group.unsentMessages.filter(x => !hashes.has(x.digitalSignature)) : [];

                    Database.groups.update(groupManager.group, {
                        blockchain: groupManager.group.blockchain,
                        unsentMessages: groupManager.group.unsentMessages
                    });
                }

                // TODO: if you had sent a message, check if your message is in this block or next 2 subsequent blocks, if not check block creator
                // if they are the same creator still, show an alert saying that your message was maliciously deleted by them
                timer = new Date().getTime();
            });
        }
    }   
    catch (e) {
        // TODO: handle connection error case
        console.error(e);
        return null;
    }    

    connection.on('error', error => {
        console.error(error);
        cleanVariables();
    });

    connection.on('close', () => {
        // connection closed, probably went offline
        cleanVariables();
    });

    return connection;
}

export function askForBlockCreator(group: Group, contacts: Contact[]) {
    return new Promise<number>(async (resolve, reject) => {
        await Promise.all(contacts.map(async contact => {
            const logId = v4();
    
            addLog(`Asking ${contact.username} for block creator.`, logId, 'Identify Block Creator');
        
            const message = await createPayloadMessage(JSON.stringify({
                group: {
                    name: group.name,
                    createdAt: group.createdAt
                }
            }), MessageType.AskForBlockCreator, contact.username);
        
            try {
                const result = await sendMessage(message, logId);
                
                if (result.blockCreator !== null) {
                    resolve(result.blockCreator);
                }
            }   
            catch (e) {
                // ignore errors - contact maybe offline
                console.error(e);
            }
        }));

        resolve(-1);
    });
}

export async function askForBlocks(connection: DataConnection, startFrom: number) {
    // TODO: ask for all blocks till date from block creator from start number.
}