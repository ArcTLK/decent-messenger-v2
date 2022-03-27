import Peer, { DataConnection } from 'peerjs';
import rsa from 'js-crypto-rsa';
import aes from 'crypto-js/aes';
import utf8Encoder from 'crypto-js/enc-utf8';
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
import { peerBank } from './PeerBank';
import { messageQueue } from './MessageQueue';
import Contact from '../models/Contact';

// helper functions
function cleanMessage(message: StoredMessage | SecurePayloadMessage): PayloadMessage {
    return {
        payload: message.payload,
        type: message.type, 
        senderUsername: message.senderUsername,
        receiverUsername: message.receiverUsername,
        nonce: message.nonce,
        createdAt: message.createdAt
    };
}

async function generateSignature(message: StoredMessage) {
    // create digital signature
    const keys = await Database.app.get('rsa-keystore');
    if (keys) {
        const cleanedMessage = cleanMessage(message);

        return await rsa.sign(new TextEncoder().encode(JSON.stringify(cleanedMessage)), JSON.parse(keys.payload).privateKey, 'SHA-256');
    }
    else {
        throw new Error(ErrorType.RSAKeyStoreNotFound);
    }
}

async function secureMessage(message: PayloadMessage): Promise<SecurePayloadMessage> {
    const copy = JSON.parse(JSON.stringify(message));    

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

    return copy;
}

async function encryptPayload(payload: string, key: JsonWebKey): Promise<{ ciphertext: string, key: Uint8Array }> {
    const randomAESKey = uuidv4();
    const encryptedAESKey = await rsa.encrypt(new TextEncoder().encode(randomAESKey), key, 'SHA-256');

    return {
        ciphertext: aes.encrypt(payload, randomAESKey).toString(),
        key: encryptedAESKey
    };
}

async function decryptPayload(data: { ciphertext: string, key: ArrayBuffer }): Promise<string> {
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

export function listenForMessages(peer: Peer) {
    peer.on('connection', dataConnection => {
        console.log(`${dataConnection.peer} created a data channel connection to us.`);
        dataConnection.on('data', (message: SecurePayloadMessage) => {
            if (message.type === MessageType.Text) {
                const uuid = v4();
                addLog(`Received an encrypted payload: ${message.encryptedPayload.ciphertext} from ${message.senderUsername}`, uuid, 'Receiving Message');
                // decrypt message
                decryptPayload(message.encryptedPayload).then(payload => {
                    message.payload = payload;

                    // check if contact exists
                    Database.contacts.get({
                        username: message.senderUsername
                    }).then(contact => {
                        if (!contact) {
                            throw new Error(ErrorType.RSAKeyExchangeNotDone);
                        }

                        addLog(`Decrypted message: ${payload}`, uuid, 'Receiving Message');

                        // check nonce
                        Database.messages.get({
                            nonce: message.nonce,
                            senderUsername: message.senderUsername
                        }).then(msg => {
                            if (!msg) {
                                addLog(`Nonce is unique.`, uuid, 'Receiving Message');
                                // verify signature
                                const cleanedMessage = cleanMessage(message);
                                rsa.verify(new TextEncoder().encode(JSON.stringify(cleanedMessage)), new Uint8Array(message.signature), contact.publicKey, 'SHA-256').then(valid => {
                                    if (valid) {
                                        addLog(`Digital signature verified.`, uuid, 'Receiving Message');
                                        Database.messages.add(cleanedMessage as StoredMessage).then(() => {
                                            // send acknowledgement
                                            addLog(`Sending acknowledgement to sender.`, uuid, 'Receiving Message', LogType.Info, 1);
                                            dataConnection.send({
                                                type: MessageType.Acknowledgment,
                                                payload: message.nonce
                                            });
                                        });
                                    }
                                    else {
                                        addLog(`Digital signature verification failed.`, uuid, 'Receiving Message', LogType.Error, 1);
                                    }                                     
                                }).catch(error => {
                                    addLog(error, uuid, 'Receiving Message', LogType.Error, 1);
                                });
                            }
                            else {
                                addLog(`Nonce was duplicate, informing sender.`, uuid, 'Receiving Message', LogType.Warn, 1);
                                dataConnection.send({
                                    type: MessageType.AlreadyReceived,
                                    payload: message.nonce
                                });
                            }
                        });
                    });
                }).catch(error => {
                    console.error(error);
                });
            }
            else if (message.type === MessageType.KeyExchange) {
                // create a contact
                const uuid = v4();
                addLog(`Received someone's RSA public key, finding out who (asking Web Server).`, uuid, 'Adding Contact (Receiver)');
                getPeerDataFromUsername(message.senderUsername).then(peerData => {             
                    addLog(`Their name was ${peerData.name}.`, uuid, 'Adding Contact (Receiver)');
                    Database.contacts.add({
                        name: peerData.name,
                        username: message.senderUsername,
                        publicKey: message.payload
                    }).then(() => {
                        addLog(`Created and saved their contact.`, uuid, 'Adding Contact (Receiver)');
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
                });
            }
        })
    });
}

// action functions
export function doRsaPublicKeyExchange(ourUsername: string, theirUsername: string, logId?: string): Promise<JsonWebKey> {
    return new Promise<JsonWebKey>(async (resolve, reject) => {
        try {
            Database.app.get('rsa-keystore').then(async data => {
                if (data) {
                    const keys = JSON.parse(data.payload);
                    const connection = await peerBank.getDataConnectionForUsername(theirUsername);

                    if (logId) {
                        addLog('Sending my RSA public key to ' + theirUsername, logId, 'Adding Contact (Sender)');
                    }
                    
                    connection.send({
                        payload: keys.publicKey,
                        senderUsername: ourUsername,
                        type: MessageType.KeyExchange
                    });

                    connection.on('data', data => {
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

export function sendMessage(message: StoredMessage, logId?: string): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
        try {
            if (logId) {
                addLog(`Opening a data channel to ${message.receiverUsername}`, logId, 'Sending Message');
            }
            
            const connection = await peerBank.getDataConnectionForUsername(message.receiverUsername);
            
            // secure message
            const securedMessage = await secureMessage(cleanMessage(message));

            if (logId) {
                addLog(`Created Digital Signature using RSA-256: ${new TextDecoder().decode(securedMessage.signature)}`, logId, 'Sending Message');
                addLog(`Encrypted message using RSA-AES-256: ${securedMessage.encryptedPayload.ciphertext}`, logId, 'Sending Message');
            }

            connection.send(securedMessage);

            if (logId) {
                addLog(`Message sent, waiting for acknowledgement.`, logId, 'Sending Message');
            }

            connection.on('data', data => {
                // check for acknowledgement
                if (message.nonce === data.payload) {
                    if (data.type === MessageType.Acknowledgment) {
                        resolve(true);
                    }
                    else if (data.type === MessageType.AlreadyReceived) {
                        resolve(true);
                    }
                }                
            });            

            // message timeout
            setTimeout(() => reject(ErrorType.MessageTimeout), Globals.messageTimeoutDuration);   
        }
        catch (e: any) {
            reject(false);
            throw e;
        }
    });
}

export async function createGroup(user: User, name: string, members: Contact[]) {  
    const keystore = await Database.app.get('rsa-keystore');
    
    if (!keystore) {
        throw new Error(ErrorType.RSAKeyStoreNotFound);
    }

    // store in database
    const encryptionKey = uuidv4();
    const id = await Database.groups.add({
        name,
        members,
        admins: [{ name: user.name, username: user.username, publicKey: JSON.parse(keystore.payload).publicKey }],
        encryptionKey
    });

    // construct payload - not including publicKey as recipients are responsible for performing RSA key exchange on their own
    const payload = JSON.stringify({
        name,
        members: members.map(x => ({ name: x.name, username: x.username })),
        admins: [{ name: user.name, username: user.username }],
        encryptionKey
    });

    members.forEach(contact => {
        messageQueue.addMessage({
            type: MessageType.CreateGroup,
            senderUsername: user.username,
            receiverUsername: contact.username,
            nonce: uuidv4(),
            createdAt: new Date().getTime(),
            payload
        });
    });
}



