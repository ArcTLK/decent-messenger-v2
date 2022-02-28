import Peer from 'peerjs';
import { Globals } from "../Constants";
import { PeerData } from '../models/PeerData';
import { ApiClient } from './ApiClient';

export function connectToPeerServer(host: string, port: number): Peer {
    return new Peer({
        host: host,
        port: port,
        path: Globals.api.endpoint.peerjs
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

export async function sendMessageToUser(username: string) {
    try {
        // Step 1: Get Peer Data from username
        const peerData = await getPeerDataFromUsername(username);
        console.log(peerData);
        
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
                    test: 'Hi!'
                });
                console.log('Sent msg to ' + username);
            })   
        });
             
    }
    catch (e: any) {
        throw new Error(e.response.data.error);
    }
}