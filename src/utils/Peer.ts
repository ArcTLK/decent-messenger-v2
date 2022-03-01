import Peer from 'peerjs';
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
        console.log('Sending a message to ' + username);
        // Step 1: Get Peer Data from username
        const peerData = await getPeerDataFromUsername(username);
        
        // Step 2: Connect to peer server
        const [host, port] = peerData.server.split(':');
        const peer = connectToPeerServer(host, parseInt(port));

        peer.on('error', data => {
            console.log(data);
        });

        peer.on('open', myPeerId => {
            const dataConnection = peer.connect(peerData.peerId);

            dataConnection.on('error', data => {
                console.log(data);
            });
    
            dataConnection.on('open', () => {
                dataConnection.send({
                    message
                });
                console.log('Sent msg to ' + username);
                // TODO: close connection
            })   
        });
             
    }
    catch (e: any) {
        throw new Error(e.response.data.error);
    }
}