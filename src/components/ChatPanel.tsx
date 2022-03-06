import { useState, useContext, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button, Box, Avatar, Divider, Typography, TextField, IconButton, List, ListItem, ListItemText } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import Message from '../models/Message';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MessageStatus from '../enums/MessageStatus';
import { Context } from '../utils/Store';
import { messageQueue } from '../utils/MessageQueue';
import Database from '../utils/Database';
import { useLiveQuery } from 'dexie-react-hooks';

const ChatPanel = () => {
    const {state, dispatch} = useContext(Context);

    const [typedMessage, setTypedMessage] = useState('');

    const messagesEndRef = useRef<null | HTMLElement>(null);

    const messages = useLiveQuery(async () => {
        return await Database
            .messages
            .where('receiverUsername')
            .equals(state.currentChatUser.username ?? '')
            .or('senderUsername')
            .equals(state.currentChatUser.username ?? '')
            .sortBy('createdAt');
    }, [state.currentChatUser]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }

    }, [state.currentChatUser, messages]);

    const onSendMessageButtonClick = async () => {
        // console.log('Send Message:', typedMessage);

        // Handle Sending Message Here

        // calculate serial - not required (using createdAt instead)
        // const previousMessages = await Database.messages.where('receiverUsername').equals(state.currentChatUser.username).sortBy('serial');
        // const previousMessage = previousMessages.pop();
        // const serial = previousMessage ? previousMessage.serial + 1 : 0;

        // Construct message object
        const message: Message = {
            content: typedMessage,
            status: MessageStatus.Queued,
            createdAt: new Date().getTime(),
            senderUsername: state.user.username,
            receiverUsername: state.currentChatUser.username,
            nonce: uuidv4()
        }

        // add to DB
        const id = await Database.messages.add(message);
        
        message.id = id;

        // add to message queue
        messageQueue.addMessage(message);

        setTypedMessage('');
    }

    const retrySendingMessage = (message: Message) => {
        console.log('Retrying: ', message);
        delete message._ignore;
        message.status = MessageStatus.Queued;
        Database.messages.update(message.id!, {
            status: MessageStatus.Queued
        });
        messageQueue.addMessage(message);
    };

    if(Object.keys(state.currentChatUser).length === 0) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGrow: 3 }}>
                <Typography variant='body1'>Select User to Chat</Typography>
            </Box>
        );
    }
    else {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 3 }}>
            
                {/* ChatPanel Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: 'primary.main' }}>
                    <Avatar src={`https://avatars.dicebear.com/api/human/${state.currentChatUser.username}.svg`} />
                    <Typography variant="h6" component="div" sx={{ color: 'white' }}>{state.currentChatUser.name}</Typography>
                </Box>

                <Divider />
    
                {/* ChatPanel Messages */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1, overflow: 'auto', p: 2 }}>
                    {messages && messages.map((message, index) => (
                        <Box key={index} alignSelf={(message.senderUsername===state.user.username)? 'flex-end' : 'flex-start'} bgcolor={message.senderUsername===state.user.username? 'primary.main' : 'secondary.light'} sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 360, py: 1, px: 2, m: 0.5, borderRadius: 2 }}>
                            <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'}>{message.content}</Box>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'end', alignItems: 'center'}}>
                                <Box color={message.senderUsername===state.user.username? '#d1c4e9' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', fontSize: 14 }}>
                                    {new Date(message.createdAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Box>
                                {message.senderUsername===state.user.username && <Box color={message.senderUsername===state.user.username? '#d1c4e9' : 'text.secondary'}>
                                {
                                    (message.status===MessageStatus.Queued && <AccessTimeIcon sx={{ fontSize: 16 }}/>) ||
                                    (message.status===MessageStatus.Sent && <DoneIcon sx={{ fontSize: 16 }}/>) ||
                                    (message.status===MessageStatus.Failed && <Button size='small' variant="text" onClick={() => retrySendingMessage(message)} sx={{ color: '#d1c4e9' }}>Retry</Button>) ||
                                    (<DoneAllIcon sx={{ fontSize: 16 }}/>)
                                }
                                </Box>}
                            </Box>
                        </Box>
                    ))}
                    <Box ref={messagesEndRef} />
                </Box>
    
                <Divider />
    
                {/* ChatPanel Message Input */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 2 }}>
                    <TextField fullWidth value={typedMessage} onChange={e => setTypedMessage(e.target.value)} size='small' label='Type a Message' variant='outlined' />
                    <IconButton onClick={onSendMessageButtonClick}>
                        <SendIcon />
                    </IconButton>
                </Box>
            </Box>
        );
    }
};

export default ChatPanel;