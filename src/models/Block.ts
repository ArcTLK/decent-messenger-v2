import Message from "./Message";

interface Block {
    serial: number;
    timestamp: number;
    authorisedDigitalSignature: string;
    encryptionKeyHash: string;
    nonce: string; // check nonce using totp
    hash?: string;
    previousHash?: string;
    messages: Message[];   
}

export default Block;