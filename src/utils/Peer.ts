import Peer, { DataConnection } from 'peerjs';
import { Globals } from "../Constants";
import ErrorType from '../enums/ErrorType';
import MessageType from '../enums/MessageType';
import Message from '../models/Message';
import PeerData from '../models/PeerData';
import User from '../models/User';
import { ApiClient } from './ApiClient';
import Database from './Database';

export function connectToPeerServer(host: string, port: number, updatePeerServerWithConfig?: User): Peer {
    const peer = new Peer({
        host: host,
        port: port,
        path: Globals.api.endpoint.peerjs
    });

    peer.on('open', id => {
        console.log(`Connected to ${host}:${port} with peer ID: ${id}.`);

        if (updatePeerServerWithConfig) {
            // talk to API to update peerId
            updatePeerIdInPeerServer(updatePeerServerWithConfig.username, updatePeerServerWithConfig.deviceKey, id).then(() => {
                console.log(`Notified PeerServer ${host}:${port} about new peer ID.`)
            })
        }
    });

    return peer;
}

function transformMessageBeforeStoring(message: Message) {
    delete message.id;
    message.createdAt = new Date(message.createdAt);
    return message;
}

export function doRsaPublicKeyExchange(ourUsername: string, theirUsername: string): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        try {
            Database.app.get('rsa-keystore').then(async data => {
                if (data) {
                    const keys = JSON.parse(data.payload);
                    const connection = await peerBank.getDataConnectionForUsername(theirUsername);
            
                    connection.send({
                        publicKey: keys.publicKey,
                        username: ourUsername,
                        type: MessageType.KeyExchange
                    });

                    connection.on('data', data => {
                        // listen for public key of other party
                        if (data.type === MessageType.KeyExchangeReply) {
                            peerBank.releaseUsage(theirUsername);
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
        console.log('Client is now listening for messages.');
        dataConnection.on('data', data => {
            if (data.type === MessageType.Text) {
                // check if contact exists
                Database.contacts.get({
                    username: data.message.senderUsername
                }).then(contact => {
                    if (!contact) {
                        throw new Error(ErrorType.RSAKeyExchangeNotDone);
                    }

                    // check nonce
                    Database.messages.get({
                        nonce: data.message.nonce,
                        senderUsername: data.message.senderUsername
                    }).then(msg => {
                        if (!msg) {
                            Database.messages.add(transformMessageBeforeStoring(data.message)).then(() => {
                                // send acknowledgement
                                console.log('Sending acknowledgement to ' + data.message.senderUsername);
                                dataConnection.send({
                                    type: MessageType.Acknowledgment
                                });
                            });
                        }
                        else {
                            console.log('Received duplicated message for nonce ' + data.message.nonce);
                            dataConnection.send({
                                type: MessageType.AlreadyReceived
                            });
                        }
                    });
                });
            }
            else if (data.type === MessageType.KeyExchange) {
                // create a contact
                getPeerDataFromUsername(data.username).then(peerData => {             
                    Database.contacts.add({
                        name: peerData.name,
                        username: data.username,
                        publicKey: data.publicKey
                    }).then(() => {
                        Database.app.get('rsa-keystore').then(keys => {
                            if (keys) {
                                const key = JSON.parse(keys.payload).publicKey;
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

export function sendMessage(message: Message): Promise<boolean> {
    return new Promise<boolean>(async (resolve, reject) => {
        try {
            const connection = await peerBank.getDataConnectionForUsername(message.receiverUsername);
            
            connection.send({
                message,
                type: MessageType.Text
            });

            connection.on('data', data => {
                // check for acknowledgement
                if (data.type === MessageType.Acknowledgment) {
                    console.log('Acknowledgement received from ' + message.receiverUsername);
                    resolve(true);
                }
                else if (data.type === MessageType.AlreadyReceived) {
                    console.log(message.receiverUsername + ' has already received the message.');
                    resolve(true);
                }
            });            

            // message timeout
            setTimeout(() => reject(ErrorType.MessageTimeout), Globals.messageTimeoutDuration);
        }
        catch (e: any) {
            reject(false);
            throw new Error(e.response.data.error);
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
            peerId: string
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
                            peerId: peerData.peerId
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
                console.log('Connected to ' + username + ' on a data channel.');
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
}

export const peerBank = new PeerBank();