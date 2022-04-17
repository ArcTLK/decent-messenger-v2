import { DataConnection } from "peerjs";
import { v4 } from "uuid";
import LogType from "../enums/LogType";
import MessageType from "../enums/MessageType";
import Contact from "../models/Contact";
import Group from "../models/Group";
import { addLog } from "../models/Log";
import PayloadMessage from "../models/message/PayloadMessage";
import User from "../models/User";
import { createPayloadMessage, sendMessage } from "./Peer";
import { peerBank } from "./PeerBank";

export async function connectToGroup(group: Group): Promise<DataConnection> {


    
    return await peerBank.getDataConnectionForUsername('x');
}

export async function connectToBlockCreator(username: string): Promise<DataConnection> {
    const connection = await peerBank.getDataConnectionForUsername(username);

    // TODO: shift block creator in list on connection close

    let timer = new Date().getTime();

    setTimeout(() => {
        // 10 mins make a constant
        if (new Date().getTime() - 600 > timer) {
            // its been so long without a block, probably went offline - close connection
            connection.close();
        }
    });

    connection.on('data', data => {
        // receive block data
        // TODO: call handleReceivedMessage
        // TODO: if you had sent a message, check if your message is in this block or next 2 subsequent blocks, if not check block creator
        // if they are the same creator still, show an alert saying that your message was maliciously deleted by them
        console.log(data);
        timer = new Date().getTime();
    });

    connection.on('error', error => {
        console.error(error);
        connection.close();
    });
    connection.on('close', () => {
        // connection closed, probably went offline
    });

    return connection;
}

export async function askForBlockCreator(group: Group, contact: Contact) {
    const logId = v4();

    addLog(`Asking ${contact.username} for block creator.`, logId, 'Identify Block Creator');

    const message = await createPayloadMessage({
        group: {
            name: group.name,
            createdAt: group.createdAt
        }
    }, MessageType.AskForBlockCreator, contact.username);

    const result = await sendMessage(message, logId);
    // TODO: check who is block creator by asking a random online group member
    // TODO: if no reply / none online assume yourself as block creator

}

export async function askForBlocks(connection: DataConnection, startFrom: number) {
    // TODO: ask for all blocks till date from block creator from start number.
}