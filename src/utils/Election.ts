import { DataConnection } from "peerjs";
import { v4 } from "uuid";
import { Globals } from "../Constants";
import MessageType from "../enums/MessageType";
import Contact from "../models/Contact";
import Group from "../models/Group";
import { addLog } from "../models/Log";
import { GroupManager } from "./GroupManager";
import { createPayloadMessage, sendMessage } from "./Peer";
import { SimpleObjectStore } from "./Store";

export async function connectToBlockCreator(groupManager: GroupManager, username: string): Promise<DataConnection | null> {
    const connection = await SimpleObjectStore.peerBank.getDataConnectionForUsername(username);
    const logId = v4();
    
    let timer = new Date().getTime();

    var interval = setInterval(() => {
        if (new Date().getTime() - Globals.blockInterval * 2 > timer) {
            // its been so long without a block, probably went offline - close connection
            // TODO: uncomment this later on
            //cleanVariables();
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

        console.log(result);
        
        
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
            connection.on('data', data => {
                // receive block data
                // TODO: call handleReceivedMessage
                // TODO: if you had sent a message, check if your message is in this block or next 2 subsequent blocks, if not check block creator
                // if they are the same creator still, show an alert saying that your message was maliciously deleted by them
                console.log(data);
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