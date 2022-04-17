import { useState, useContext, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button, Box, Avatar, Divider, Typography, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MessageStatus from '../enums/MessageStatus';
import { Context } from '../utils/Store';
import { messageQueue } from '../utils/MessageQueue';
import Database from '../utils/Database';
import { useLiveQuery } from 'dexie-react-hooks';
import { addLog } from '../models/Log';
import StoredMessage from '../models/message/StoredMessage';
import PayloadMessage from '../models/message/PayloadMessage';
import MessageType from '../enums/MessageType';
import ChatType from '../enums/ChatType';
import { createPayloadMessage } from '../utils/Peer';

const ChatPanel = () => {
    const {state, dispatch} = useContext(Context);

    const [typedMessage, setTypedMessage] = useState('');

    const messagesEndRef = useRef<null | HTMLElement>(null);

    const messages = useLiveQuery(async () => {
        // @ArcTLK modify below for group messages
        return await Database
            .messages
            .where('receiverUsername')
            .equals(state.currentOpenedChat.data.username ?? '')
            .or('senderUsername')
            .equals(state.currentOpenedChat.data.username ?? '')
            .and(x => x.type === MessageType.Text)
            .sortBy('createdAt');
    }, [state.currentOpenedChat]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }

    }, [state.currentOpenedChat, messages]);

    const onSendMessageButtonClick = async () => {
        // Construct message object

        // @ArcTLK - Modify below for group msgs
        const message = await createPayloadMessage(typedMessage, MessageType.Text, state.currentOpenedChat.data.username);

        // add to message queue
        addLog('Adding message to Queue', message.createdAt + '-1', 'Sending Message');
        messageQueue.addMessage(message);

        setTypedMessage('');
    }

    const retrySendingMessage = (message: StoredMessage) => {
        messageQueue.retryMessage(message);
    };

    if(Object.keys(state.currentOpenedChat).length === 0) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flexGrow: 3 }}>
                <Typography variant='body1'>Select User/Group to Chat</Typography>
            </Box>
        );
    }
    else {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 3 }}>
            
                {/* ChatPanel Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: 'primary.main' }}>
                    <Avatar src={`https://avatars.dicebear.com/api/human/${(state.currentOpenedChat.type == ChatType.Private)? state.currentOpenedChat.data.username : state.currentOpenedChat.data.name}.svg`} />
                    <Typography variant="h6" component="div" sx={{ color: 'white' }}>{state.currentOpenedChat.data.name}</Typography>
                </Box>

                <Divider />
    
                {/* ChatPanel Messages */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1, overflow: 'auto', p: 2 }}>
                    {messages && messages.map((message, index) => (
                        <Box key={index} alignSelf={(message.senderUsername===state.user.username)? 'flex-end' : 'flex-start'} bgcolor={message.senderUsername===state.user.username? 'primary.main' : 'secondary.light'} sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 360, py: 1, px: 2, m: 0.5, borderRadius: 2 }}>
                            {state.currentOpenedChat.type == ChatType.Group && <Box sx={{ display: 'flex', alignItems: 'center'}}>
                                {/* Fetch name of user via username below */}
                                {message.senderUsername}
                            </Box>}
                            <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'}>{message.payload}</Box>
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
                    <TextField fullWidth onKeyPress={e => e.key === 'Enter' && onSendMessageButtonClick()} value={typedMessage} onChange={e => setTypedMessage(e.target.value)} size='small' label='Type a Message' variant='outlined' />
                    <IconButton onClick={onSendMessageButtonClick}>
                        <SendIcon />
                    </IconButton>
                </Box>
            </Box>
        );
    }
};

export default ChatPanel;