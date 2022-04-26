import Peer, { DataConnection } from "peerjs";
import { Globals } from "../Constants";
import { connectToPeerServer, getPeerDataFromUsername } from "./Peer";
import { SimpleObjectStore } from "./Store";
export default class PeerBank {
    peers: {
        [username: string]: {
            connection?: DataConnection,
            lastUsed: Date,
            myPeer: Peer,
            peerId: string,
            errors: number
        }
    } = {};
    peerCount: number = 0;

    createPeerServerConnectionForUsername(username: string): Promise<{
        connection?: DataConnection,
        lastUsed: Date,
        myPeer: Peer,
        peerId: string,
        errors: number
    }> {
        return new Promise<{
            connection?: DataConnection,
            lastUsed: Date,
            myPeer: Peer,
            peerId: string,
            errors: number
        }>(async (resolve, reject) => {
            if (this.peers[username]) {
                resolve(this.peers[username]);
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

                        if (this.peers[username]) {
                            // does not exist
                            ++this.peerCount;
                        }

                        this.peers[username] = {
                            lastUsed: new Date(),
                            myPeer: peer,
                            peerId: peerData.peerId,
                            errors: 0
                        }

                        resolve(this.peers[username]);
                    });
                }                
                catch (e: any) {
                    reject(e.message);
                }
            }
        });
    }

    getFreshDataConnectionFromUsername(username: string): Promise<DataConnection> {
        return new Promise<DataConnection>(async (resolve, reject) => {
            this.createPeerServerConnectionForUsername(username).then(peerData => {
                // create a data connection
                this.createDataConnection(peerData.myPeer, username).then(connection => {
                    resolve(connection);
                }).catch(e => reject(e));
            }).catch(e => {
                reject(e);
            });
        });
    }

    getDataConnectionForUsername(username: string): Promise<DataConnection> {
        return new Promise<DataConnection>(async (resolve, reject) => {
            if (this.peers[username]) {
                if (this.peers[username].connection) {
                    this.peers[username].lastUsed = new Date();
                    resolve(this.peers[username].connection!);
                }
                else {
                    // create a data connection
                    this.createDataConnection(this.peers[username].myPeer, username).then(connection => {
                        resolve(connection);
                    }).catch(e => reject(e));
                }
            }
            else {
                this.getFreshDataConnectionFromUsername(username).then(connection => resolve(connection)).catch(e => reject(e));
            }
        });        
    }

    createDataConnection(peer: Peer, username: string) {
        return new Promise<DataConnection>((resolve, reject) => {
            const dataConnection = peer.connect(this.peers[username].peerId, {
                metadata: { username: SimpleObjectStore.user?.username }
            });                
            dataConnection.on('open', () => { 
                // console.log('Connected to ' + username + ' on a data channel.');
                this.peers[username].connection = dataConnection;
                this.peers[username].lastUsed = new Date();
                resolve(dataConnection);
            });

            setTimeout(() => {
                reject('Connection timeout');
            }, Globals.messageTimeoutDuration);
        });
    }
    
    // can be used to remove peers in case a peer is offline / inactive
    removePeer(username: string) {
        //console.log('Removing peer for username ' + username);
        if (this.peers[username]) {
            this.peers[username].myPeer.destroy();
            delete this.peers[username];
            --this.peerCount;
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

    reportError(username: string) {
        if (this.peers[username]) {
            this.peers[username].errors += 1;
        }

        if (this.peers[username].errors > Globals.maxErrorsBeforeTermination) {
            this.removePeer(username);
        }
    }
}