export default interface Contact {
    name: string;
    username: string;
    publicKey: JsonWebKey;
    id?: number;    
}