interface BlockMessageItem {
    senderUsername: string;
    digitalSignature: string;
    createdAt: number;
    message: string;
}

interface Block {
    serial: number;
    timestamp: number;
    digitalSignature: string;
    encryptionKeyHash: string;
    hash: string;
    previousHash: string;
    messages: BlockMessageItem[];   
}

export default Block;