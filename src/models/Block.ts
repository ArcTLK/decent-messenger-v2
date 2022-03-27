import PayloadMessage from "./message/PayloadMessage";

interface Block {
    serial: number;
    timestamp: number;
    authorisedDigitalSignature: string;
    encryptionKeyHash: string;
    nonce: string; // check nonce using totp
    hash?: string;
    previousHash?: string;
    messages: PayloadMessage[];   
}

export default Block;