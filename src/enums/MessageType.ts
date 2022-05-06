enum MessageType {
    Text = 'Text',
    Acknowledgment = 'Acknowledgement',
    AlreadyReceived = 'Already Received',
    KeyExchange = 'Key Exchange',
    KeyExchangeReply = 'Key Exchange Reply',
    CreateGroup = 'Create Group',
    AddBlock = 'Add Block',
    ConnectToBlockCreator = 'Connect to block creator',
    AskForBlockCreator = 'Ask for block creator',
    Answer = 'Answer',
    Heartbeat = 'Heartbeat',
    GroupMessage = 'Group Message',
    IAmNotBlockCreator = 'I am not block creator',
    PullAllBlocks = 'Pull all blocks'
}


export default MessageType;