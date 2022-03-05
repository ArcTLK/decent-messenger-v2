import Peer, { DataConnection } from 'peerjs';
import { Globals } from "../Constants";
import PeerData from '../models/PeerData';
import User from '../models/User';
import { ApiClient } from './ApiClient';

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

export function listenForMessages(peer: Peer) {
    peer.on('connection', dataConnection => {
        console.log('Client is now listening for messages.');
        dataConnection.on('data', data => {
            console.log(data);
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

function getPeerDataFromUsername(username: string): Promise<PeerData> {
    return ApiClient.get(`users/${username}`).then(response => response.data);
}

function sendMessageToPeer(peerId: string) {
    
}

export async function sendMessageToUser(username: string, message: string) {
    try {
        console.log('Trying to send a message to ' + username);

        const connection = await peerBank.getDataConnectionForUsername(username);
        
        connection.on('open', () => {
            connection.send({
                message
            });

            console.log('Sent message to ' + username);
        }); 
    }
    catch (e: any) {
        throw new Error(e.response.data.error);
    }
}

class PeerBank {
    peers: {
        [username: string]: {
            connection: DataConnection,
            inUse: number,
            lastUsed: Date,
            peer: Peer
        }
    } = {};

    getDataConnectionForUsername(username: string): Promise<DataConnection> {
        return new Promise<DataConnection>(async (resolve, reject) => {
            if (this.peers[username]) {
                this.peers[username].lastUsed = new Date();
                ++this.peers[username].inUse;
                resolve(this.peers[username].connection);
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
                        console.error(error);
                        this.removePeer(username);
                        reject(error.type);
                    });
                    peer.on('close', () => {
                        console.log('Closing peer for user ' + username + ' (Unknown reason)');
                        this.removePeer(username);
                    });
                    peer.on('disconnected', () => {
                        console.log('Closing peer for user ' + username + ' (Disconnected)');
                        this.removePeer(username);
                    });

                    const dataConnection = peer.connect(peerData.peerId);                
                    dataConnection.on('open', () => {                        
                        console.log('Connected to ' + username + ' on a data channel.');
                        // remove least recently used peer
                        this.removeLRU();
                        this.peers[username] = {
                            connection: dataConnection,
                            lastUsed: new Date(),
                            inUse: 1,
                            peer: peer
                        }
                        resolve(dataConnection);
                    });


                }                
                catch (e: any) {
                    reject(e.message);
                }
            }
        });        
    }
    
    // can be used to remove peers in case a peer is offline / inactive
    removePeer(username: string) {
        if (!this.peers[username].inUse) {
            this.peers[username].peer.destroy();
            delete this.peers[username];
        }   
        else {
            throw new Error(`Peer ${this.peers[username].peer.id} of user ${username} is currently in use and was asked to be deleted.`);
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
            this.peers[LRU].peer.destroy();
            delete this.peers[LRU];
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