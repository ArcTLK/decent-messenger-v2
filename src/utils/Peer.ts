import Peer, { DataConnection } from 'peerjs';
import rsa from 'js-crypto-rsa';
import aes from 'crypto-js/aes';
import utf8Encoder from 'crypto-js/enc-utf8';
import { Buffer } from 'buffer';
import { v4 as uuidv4, v4 } from 'uuid';
import { Globals } from "../Constants";
import ErrorType from '../enums/ErrorType';
import MessageType from '../enums/MessageType';
import PeerData from '../models/PeerData';
import User from '../models/User';
import { ApiClient } from './ApiClient';
import Database from './Database';
import { addLog } from '../models/Log';
import LogType from '../enums/LogType';
import StoredMessage from '../models/message/StoredMessage';
import PayloadMessage from '../models/message/PayloadMessage';
import SecurePayloadMessage from '../models/message/SecurePayloadMessage';
import { messageQueue } from './MessageQueue';
import Contact from '../models/Contact';
import Group from '../models/Group';
import { SimpleObjectStore } from './Store';
import { GroupManager } from './GroupManager';

// helper functions
export async function createPayloadMessage(payload: string, type: MessageType, receiverUsername: string): Promise<PayloadMessage> {
    if (SimpleObjectStore.user) {
        return {
            type,
            payload,
            receiverUsername,
            senderUsername: SimpleObjectStore.user.username,
            createdAt: new Date().getTime(),     
            nonce: uuidv4()   
        };
    }
    else {
        throw new Error(ErrorType.UserNotFound);
    }
}

export function cleanMessage(message: StoredMessage | SecurePayloadMessage | PayloadMessage): PayloadMessage {
    return {
        payload: message.payload,
        type: message.type, 
        senderUsername: message.senderUsername,
        receiverUsername: message.receiverUsername,
        createdAt: message.createdAt,
        nonce: message.nonce
    };
}

export async function generateSignatureWithoutCleaning(payload: any) {
    const keys = await Database.app.get('rsa-keystore');
    if (keys) {
        return await rsa.sign(new TextEncoder().encode(JSON.stringify(payload)), JSON.parse(keys.payload).privateKey, 'SHA-256');
    }
    else {
        throw new Error(ErrorType.RSAKeyStoreNotFound);
    }
}

export async function generateSignature(message: SecurePayloadMessage) {
    // create digital signature
    const cleanedMessage = cleanMessage(message);

    return await generateSignatureWithoutCleaning(cleanedMessage);
}

export async function secureMessage(message: PayloadMessage): Promise<SecurePayloadMessage> {
    const copy: SecurePayloadMessage = JSON.parse(JSON.stringify(message));

    // create digital signature
    copy.signature = await generateSignature(copy);

    // encrypt payload
    const receiver = await Database.contacts.get({
        username: message.receiverUsername
    });

    if (receiver) {
        copy.encryptedPayload = await encryptPayload(message.payload, receiver.publicKey);
    }
    else {
        throw new Error(ErrorType.ContactNotFound);
    } 

    delete copy.payload;
    copy.secure = true;

    return copy;
}

export async function encryptPayload(payload: string, key: JsonWebKey): Promise<{ ciphertext: string, key: Uint8Array }> {
    const randomAESKey = uuidv4();
    const encryptedAESKey = await rsa.encrypt(new TextEncoder().encode(randomAESKey), key, 'SHA-256');

    return {
        ciphertext: aes.encrypt(payload, randomAESKey).toString(),
        key: encryptedAESKey
    };
}

export async function decryptPayload(data: { ciphertext: string, key: ArrayBuffer }): Promise<string> {
    const keys = await Database.app.get('rsa-keystore');
    if (keys) {
        // decrypt AES key
        const key = new Uint8Array(data.key);
        const aesKey = await rsa.decrypt(key, JSON.parse(keys.payload).privateKey, 'SHA-256');
        
        // decrypt data using AES key
        const decryptedPayload = aes.decrypt(data.ciphertext, new TextDecoder().decode(aesKey));        

        return decryptedPayload.toString(utf8Encoder);
    }
    else {
        throw new Error(ErrorType.RSAKeyStoreNotFound);
    }
}


// connection functions
export function updatePeerIdInPeerServer(username: string, deviceKey: string, peerId: string): Promise<any> {
    return ApiClient.put('users', {
        username,
        deviceKey,
        peerId
    });
}

export function getPeerDataFromUsername(username: string): Promise<PeerData> {
    return ApiClient.get(`users/${username}`).then(response => response.data);
}

export function connectToPeerServer(host: string, port: number, updatePeerServerWithConfig?: User): Peer {
    const peer = new Peer({
        host: host,
        port: port,
        path: Globals.api.endpoint.peerjs,
        secure: true
    });

    peer.on('open', id => {
        addLog(`Connected to ${host}:${port} with peer ID: ${id}.`, '0', 'Initialization');

        if (updatePeerServerWithConfig) {
            // talk to API to update peerId
            updatePeerIdInPeerServer(updatePeerServerWithConfig.username, updatePeerServerWithConfig.deviceKey, id).then(() => {
                addLog(`Notified PeerServer ${host}:${port} about new peer ID.`, '0', 'Initialization', LogType.Info, 1);
            })
        }
    });

    return peer;
}

export function isPeerOnline(username: string): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
        const connection = await SimpleObjectStore.peerBank.getFreshDataConnectionFromUsername(username);

        connection.send({
            type: MessageType.Heartbeat,
            payload: 'Hi!'
        });

        const onData = (data: any) => {
            if (data.type === MessageType.Acknowledgment) {
                resolve(true);
            }
        }

        connection.on('data', onData);

        setTimeout(() => {
            connection.off('data', onData);
            resolve(false);
        }, Globals.messageTimeoutDuration);
    });
}

export function listenForMessages(peer: Peer) {
    peer.on('connection', dataConnection => {
        // console.log(`${dataConnection.peer} created a data channel connection to us.`);
        dataConnection.on('data', (message: SecurePayloadMessage) => {
            handleReceivedMessage(message, dataConnection);
        });
    });
}

// action functions
async function handleReceivedMessage(message: SecurePayloadMessage, dataConnection: DataConnection) {
    // handle secured payload
    const uuid = v4();
    let responsePayload: any = {};
    let responseType: MessageType = MessageType.Acknowledgment;

    if (message.secure) {        
        addLog(`Received an encrypted payload: ${message.encryptedPayload.ciphertext} from ${message.senderUsername}`, uuid, 'Receiving Message');

        // decrypt message
        try {
            message.payload = await decryptPayload(message.encryptedPayload); 
            addLog(`Decrypted message: ${message.payload}`, uuid, 'Receiving Message');           
        }
        catch {
            console.error('Decryption failed for message from ' + message.senderUsername);
        }

        // check if sender contact exists
        const contact = await Database.contacts.get({ username: message.senderUsername });
        if (!contact) {
            throw new Error(ErrorType.RSAKeyExchangeNotDone);
        }
        
        // verify digital signature
        const cleanedMessage = cleanMessage(message);
        const validDigitalSignature = await rsa.verify(new TextEncoder().encode(JSON.stringify(cleanedMessage)), new Uint8Array(message.signature), contact.publicKey, 'SHA-256');
        if (!validDigitalSignature) {
            addLog(`Digital signature verification failed.`, uuid, 'Receiving Message', LogType.Error, 1);
            return;
        }

        addLog(`Digital signature verified.`, uuid, 'Receiving Message');

        // check nonce
        const nonce = await Database.messages.get({
            nonce: message.nonce,
            senderUsername: message.senderUsername,
            createdAt: message.createdAt
        });

        if (nonce) {
            // duplicate!
            addLog(`Nonce was duplicate, informing sender.`, uuid, 'Receiving Message', LogType.Warn, 1);
            dataConnection.send({
                type: MessageType.AlreadyReceived,
                payload: await encryptPayload(JSON.stringify({ nonce: message.nonce }), contact.publicKey)
            });

            return;
        }
        
        addLog(`Nonce is unique.`, uuid, 'Receiving Message');
        const savedMessageId = await Database.messages.add(cleanMessage(message) as StoredMessage);

        // save extra data
        await Database.extraMessages.add({
            messageId: savedMessageId,
            encryptedPayload: message.encryptedPayload.ciphertext,
            digitalSignature: Buffer.from(message.signature).toString('base64')
        });

        responsePayload.nonce = message.nonce;
    }

    if (message.type === MessageType.KeyExchange) {
        // create a contact
        addLog(`Received someone's RSA public key, finding out who (asking Web Server).`, uuid, 'Adding Contact (Receiver)');
        getPeerDataFromUsername(message.senderUsername).then(async peerData => {             
            addLog(`Their name was ${peerData.name}.`, uuid, 'Adding Contact (Receiver)');
            // check if does not exist
            const x = await Database.contacts.where({ username: message.senderUsername }).first();

            if (!x) {
                await Database.contacts.add({
                    name: peerData.name,
                    username: message.senderUsername,
                    publicKey: message.payload
                });

                addLog(`Created and saved their contact.`, uuid, 'Adding Contact (Receiver)');
                
            }
            
            Database.app.get('rsa-keystore').then(keys => {
                if (keys) {
                    const key = JSON.parse(keys.payload).publicKey;
                    addLog(`Sending them our RSA public key.`, uuid, 'Adding Contact (Receiver)', LogType.Info, 1);
                    // reply with our public key
                    dataConnection.send({
                        type: MessageType.KeyExchangeReply,
                        publicKey: key
                    });
                }
                else {
                    console.error(ErrorType.RSAKeyStoreNotFound);
                }
            });   
        });
    }
    else if (message.type === MessageType.CreateGroup) {
        // store group details in database
        const group = JSON.parse(message.payload);
        await Database.groups.add(group);
        const groupManager = new GroupManager(group);
        SimpleObjectStore.groupManagers.push(groupManager);
        groupManager.connect();
    }
    else if (message.type === MessageType.ConnectToBlockCreator) {
        // TODO: if X blocks are created, send a message to the list of conns saying so, so that they can shift block creator & empty list
        // TODO: in case blocks are not able to be sent to a particular member after 3 tries, pop them from the list of connections
        // TODO: if list of connections are empty and some of the X blocks are still left, it means that you are offline, so handle accordingly

        const group = JSON.parse(message.payload).group;
        const groupManager = SimpleObjectStore.groupManagers.find(x => x.group.name === group.name && x.group.createdAt === group.createdAt);
        responseType = MessageType.Answer;
        if (!groupManager || groupManager.roundRobinIndex === undefined) {
            // we also dont know who the block creator is            
            responsePayload.blockCreator = null;
        }
        else if (groupManager.roundRobinIndex !== groupManager.roundRobinList.findIndex(x => x.username === SimpleObjectStore.user?.username)) { 
            // its not me, its someone else
            responsePayload.blockCreator = groupManager.roundRobinIndex;
        }
        else {
            // its me
            groupManager.connections.push(dataConnection);
            responsePayload.blockCreator = groupManager.roundRobinIndex;
        }        
    }
    else if (message.type === MessageType.AskForBlockCreator) {
        // check if you know block creator
        const group = JSON.parse(message.payload).group;
        const groupManager = SimpleObjectStore.groupManagers.find(x => x.group.name === group.name && x.group.createdAt === group.createdAt);

        responseType = MessageType.Answer;
        if (!groupManager || groupManager.roundRobinIndex === undefined) {
            // we also dont know who the block creator is            
            responsePayload.blockCreator = null;
        }
        else {
            responsePayload.blockCreator = groupManager.roundRobinIndex;
        }
    }
    else if (message.type === MessageType.Heartbeat) {
        dataConnection.send({
            type: MessageType.Acknowledgment,
            payload: 'Hello!'
        });
    }
    else if (message.type === MessageType.GroupMessage) {
        const payload = JSON.parse(message.payload);
        const groupManager = SimpleObjectStore.groupManagers.find(x => x.group.name === payload.group.name && x.group.createdAt === payload.group.createdAt);
        delete payload.group;
        
        if (groupManager) {
            // check if you are the block creator
            if (groupManager.roundRobinList[groupManager.roundRobinIndex].username === SimpleObjectStore.user?.username) {
                // check if message is already in queue
                if (!groupManager.messages.find(x => x.digitalSignature === payload.digitalSignature)) {
                    groupManager.messages.push(payload);
                }
            }
            else {
                // reject
                responseType = MessageType.IAmNotBlockCreator;
            }
        }
        else {
            // not my group, reject
            responseType = MessageType.IAmNotBlockCreator;
        }
    }
    else if (message.type === MessageType.PullAllBlocks) {
        const payload = JSON.parse(message.payload);
        const groupManager = SimpleObjectStore.groupManagers.find(x => x.group.name === payload.group.name && x.group.createdAt === payload.group.createdAt);
        delete payload.group;
        
        if (groupManager) {
            // send all blocks
            responsePayload.blockchain = groupManager.group.blockchain ?? null;
        }
        else {
            // not my group, reject
            responseType = MessageType.IAmNotBlockCreator;
        }
    }

    if (message.secure) {
        // send acknowledgement / reply
        addLog(`Sending acknowledgement / reply to sender.`, uuid, 'Receiving Message', LogType.Info, 1);
        
        // secure this as well
        const contact = await Database.contacts.get({ username: message.senderUsername });
        if (!contact) {
            throw new Error(ErrorType.RSAKeyExchangeNotDone);
        }

        const encryptedPayload = await encryptPayload(JSON.stringify(responsePayload), contact.publicKey);

        dataConnection.send({
            type: responseType,
            payload: encryptedPayload
        });
    }
}

export function doRsaPublicKeyExchange(ourUsername: string, theirUsername: string, logId?: string): Promise<JsonWebKey> {
    return new Promise<JsonWebKey>(async (resolve, reject) => {
        try {
            Database.app.get('rsa-keystore').then(async data => {
                if (data) {
                    const keys = JSON.parse(data.payload);
                    let connection: DataConnection;

                    try {
                        connection = await SimpleObjectStore.peerBank.getDataConnectionForUsername(theirUsername);
                    }
                    catch (e) {
                        reject(e);
                    }                    

                    if (logId) {
                        addLog('Sending my RSA public key to ' + theirUsername, logId, 'Adding Contact (Sender)');
                    }
                    
                    connection!.send({
                        payload: keys.publicKey,
                        senderUsername: ourUsername,
                        type: MessageType.KeyExchange
                    });

                    connection!.on('data', (data: any) => {
                        // listen for public key of other party
                        if (data.type === MessageType.KeyExchangeReply) {
                            if (logId) {
                                addLog(`Received ${theirUsername}'s public key.`, logId, 'Adding Contact (Sender)');
                            }
                            resolve(data.publicKey);
                        }
                    });

                    // message timeout
                    setTimeout(() => reject(ErrorType.KeyExchangeTimeout), Globals.messageTimeoutDuration);                    
                }
                else {
                    reject(ErrorType.RSAKeyStoreNotFound);
                }
            });            
        }
        catch (e: any) {
            reject(false);
            throw new Error(e.response.data.error);
        }
    });    
}

export function sendMessage(message: StoredMessage | PayloadMessage, logId?: string, connection?: DataConnection): Promise<any> {
    return new Promise<boolean>(async (resolve, reject) => {
        try {
            if (logId) {
                addLog(`Opening a data channel to ${message.receiverUsername}`, logId, 'Sending Message');
            }

            if (connection === undefined) {
                connection = await SimpleObjectStore.peerBank.getDataConnectionForUsername(message.receiverUsername);
            }

            // secure message
            const securedMessage = await secureMessage(cleanMessage(message));

            if (logId) {
                addLog(`Created Digital Signature using RSA-256: ${Buffer.from(securedMessage.signature).toString('base64')}`, logId, 'Sending Message');
                addLog(`Encrypted message using RSA-AES-256: ${securedMessage.encryptedPayload.ciphertext}`, logId, 'Sending Message');
            }

            connection.send(securedMessage);
            
            if (logId) {
                addLog(`Message sent, waiting for acknowledgement.`, logId, 'Sending Message');
            }           

            var replyHandler = async (data: PayloadMessage) => {
                // decrypt
                data.payload = JSON.parse(await decryptPayload(data.payload));                
                
                // this would contain the acknowledgement / reply
                if (message.nonce === data.payload.nonce) {
                    // save extra data
                    if ((message as StoredMessage).id) {
                        await Database.extraMessages.add({
                            messageId: (message as StoredMessage).id ?? 0,
                            encryptedPayload: securedMessage.encryptedPayload.ciphertext,
                            digitalSignature: Buffer.from(securedMessage.signature).toString('base64')
                        });
                    }
                    

                    // resolve with response payload
                    resolve(data.payload);

                    connection!.off('data', replyHandler);
                }  
            }

            var errorHandler = (e: any) => {
                if (e.message.indexOf('Connection is not open') !== -1) {
                    // connection was broken off, reset connection
                    SimpleObjectStore.peerBank.removePeer(message.receiverUsername);
                }

                SimpleObjectStore.peerBank.reportError(message.receiverUsername);
                console.error(e);
                reject(e);
            }

            connection.on('data', replyHandler);             
            connection.on('error', errorHandler);

            // message timeout
            setTimeout(() => {
                reject(ErrorType.MessageTimeout);
                connection!.off('error', errorHandler);
            }, Globals.messageTimeoutDuration);   
        }
        catch (e: any) {
            reject(e);
        }
    });
}

export async function createGroup(user: User, name: string, members: Contact[]) {  
    const keystore = await Database.app.get('rsa-keystore');
    
    if (!keystore) {
        throw new Error(ErrorType.RSAKeyStoreNotFound);
    }

    // store in database
    const group: Group = {
        name,
        members,
        admins: [{ name: user.name, username: user.username, publicKey: JSON.parse(keystore.payload).publicKey }],
        encryptionKey: uuidv4(),
        createdAt: new Date().getTime()
    }

    // check if group already exists
    if (await Database.groups.where({ name }).first()) {
        throw new Error('Group with this name already exists!');
    }

    await Database.groups.add(group);
    const groupManager = new GroupManager(group);
    SimpleObjectStore.groupManagers.push(groupManager);
    groupManager.connect();
    
    // construct payload
    const payload = JSON.stringify(group);

    members.forEach(contact => {
        messageQueue.addMessage({
            type: MessageType.CreateGroup,
            senderUsername: user.username,
            receiverUsername: contact.username,
            createdAt: new Date().getTime(),
            payload,
            nonce: uuidv4()
        });
    });
}



