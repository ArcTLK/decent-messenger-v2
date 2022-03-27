import PayloadMessage from "./PayloadMessage";

export default interface SecurePayloadMessage extends PayloadMessage {
    encryptedPayload: {
        ciphertext: string,
        key: Uint8Array
    };
    signature: Uint8Array;
    secure: boolean;
}