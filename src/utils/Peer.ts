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
import { groupMessageQueue } from './MessageQueue';
import StoredMessage from '../models/message/StoredMessage';
import PayloadMessage from '../models/message/PayloadMessage';
import SecurePayloadMessage from '../models/message/SecurePayloadMessage';

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

// member usernames
export function createGroup(members: string[]) {
    members.forEach(username => {
        //groupMessageQueue.addMessage()
    });
}

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
                                                type: MessageType.Acknowledgment
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
                                    type: MessageType.AlreadyReceived
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
                if (data.type === MessageType.Acknowledgment) {
                    resolve(true);
                }
                else if (data.type === MessageType.AlreadyReceived) {
                    resolve(true);
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

class PeerBank {
    peers: {
        [username: string]: {
            connection?: DataConnection,
            inUse: number,
            lastUsed: Date,
            myPeer: Peer,
            peerId: string,
            errors: number
        }
    } = {};
    peerCount: number = 0;

    createPeerServerConnectionForUsername(username: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            if (this.peers[username]) {
                resolve();
            }
            else {
                // peer connection not found
                try {
                    // Step 1: Get Peer Data from username
                    const peerData = await getPeerDataFromUsername(username);
                    
                    // Step 2: Connect to peer server
                    const [host, port] = peerData.server.split(':');
                    const peer = connectToPeerServer(host, parseInt(port));                    
                    
                    peer.on('error', error => {
                        console.error(`Closing peer for user ${username} [${error.type}]: (${error.message})`);
                        this.removePeer(username);
                        reject(error.type);
                    });
                    peer.on('close', () => {
                        console.log('Closing peer for user ' + username + ' (Close Event called)');
                        this.removePeer(username);
                    });
                    peer.on('disconnected', () => {
                        console.log('Closing peer for user ' + username + ' (Disconnected)');
                        this.removePeer(username);
                    });

                    peer.on('open', () => {
                        // remove least recently used peer
                        if (this.peerCount > Globals.maxPeerConnections) {
                            this.removeLRU();
                        }

                        this.peers[username] = {
                            lastUsed: new Date(),
                            inUse: 0,
                            myPeer: peer,
                            peerId: peerData.peerId,
                            errors: 0
                        }
                        ++this.peerCount;
                        resolve();
                    });
                }                
                catch (e: any) {
                    reject(e.message);
                }
            }
        });
    }

    getDataConnectionForUsername(username: string): Promise<DataConnection> {
        return new Promise<DataConnection>(async (resolve, reject) => {
            if (this.peers[username]) {
                if (this.peers[username].connection) {
                    this.peers[username].lastUsed = new Date();
                    ++this.peers[username].inUse;
                    resolve(this.peers[username].connection!);
                }
                else {
                    // create a data connection
                    this.createDataConnection(this.peers[username].myPeer, username).then(connection => {
                        resolve(connection);
                    });
                }
            }
            else {
                this.createPeerServerConnectionForUsername(username).then(() => {
                    // create a data connection
                    this.createDataConnection(this.peers[username].myPeer, username).then(connection => {
                        resolve(connection);
                    });
                });
            }
        });        
    }

    createDataConnection(peer: Peer, username: string) {
        return new Promise<DataConnection>((resolve, reject) => {
            const dataConnection = peer.connect(this.peers[username].peerId);                
            dataConnection.on('open', () => { 
                // console.log('Connected to ' + username + ' on a data channel.');
                this.peers[username].connection = dataConnection;
                this.peers[username].lastUsed = new Date();
                this.peers[username].inUse = 1;
                resolve(dataConnection);
            });
        });
    }
    
    // can be used to remove peers in case a peer is offline / inactive
    removePeer(username: string) {
        // console.log('Removing peer for username ' + username);
        if (this.peers[username]) {
            if (!this.peers[username].inUse) {
                this.peers[username].myPeer.destroy();
                delete this.peers[username];
                --this.peerCount;
            }   
            else {
                throw new Error(`Peer ${this.peers[username].myPeer.id} of user ${username} is currently in use and was asked to be deleted.`);
            }
        }   
    }

    removeLRU() {
        let min = new Date().getTime();
        let LRU = null;
        for (let peer in this.peers) {
            if (this.peers[peer].lastUsed.getTime() < min) {
                LRU = peer;
                min = this.peers[peer].lastUsed.getTime();
            }
        }

        if (LRU) {
            console.log('Closing connection with user ' + LRU + ' due to LRU policy.');
            this.removePeer(LRU);
        }
    }

    releaseUsage(username: string) {
        if (this.peers[username].inUse > 0) {
            this.peers[username].inUse -= 1;
        }
        else {
            console.error('Peer is being over-released for user ' + username);
        }
    }

    reportError(username: string) {
        if (this.peers[username]) {
            this.peers[username].errors += 1;
        }

        if (this.peers[username].errors > Globals.maxErrorsBeforeTermination) {
            this.removePeer(username);
        }
    }
}

export const peerBank = new PeerBank();