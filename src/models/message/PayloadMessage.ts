import MessageType from "../../enums/MessageType";
import BaseMessage from "./BaseMessage";

export default interface PayloadMessage extends BaseMessage {
    payload: any;
    type: MessageType;
}