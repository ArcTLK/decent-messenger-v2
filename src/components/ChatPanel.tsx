import { useState, useContext } from 'react';
import { Box, Avatar, Divider, Typography, TextField, IconButton, List, ListItem, ListItemText } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import Message from '../models/Message';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import MessageStatus from '../enums/MessageStatus';
import { Context } from '../utils/Store';

const ChatPanel = () => {
    const {state, dispatch} = useContext(Context);

    const [typedMessage, setTypedMessage] = useState('');


    const onSendMessageButtonClick = () => {
        // console.log('Send Message:', typedMessage);

        // Handle Sending Message Here
    }

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
                    <Avatar />
                    <Typography variant="h6" component="div" sx={{ color: 'white' }}>{state.currentChatUser.name}</Typography>
                </Box>

                <Divider />
    
                {/* ChatPanel Messages */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1, overflow: 'auto', p: 2 }}>
                    {state.messages.filter(message => message.sender_username===state.currentChatUser.username || message.receiver_username===state.currentChatUser.username).map(message => (
                        <Box alignSelf={(message.sender_username===state.user.username)? 'flex-end' : 'flex-start'} bgcolor={message.sender_username===state.user.username? 'primary.main' : 'secondary.light'} sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 360, py: 1, px: 2, m: 0.5, borderRadius: 2 }}>
                            <Box color={message.sender_username===state.user.username? 'white' : 'text.primary'}>{message.content}</Box>
                            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'end', alignItems: 'center'}}>
                                <Box color={message.sender_username===state.user.username? '#d1c4e9' : 'text.secondary'} sx={{ display: 'flex', alignItems: 'center', fontSize: 14 }}>
                                    {message.timestamp.sent.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Box>
                                <Box color={message.sender_username===state.user.username? '#d1c4e9' : 'text.secondary'}>
                                {
                                    (message.status===MessageStatus.Pending && <AccessTimeIcon sx={{ fontSize: 16 }}/>) ||
                                    (message.status===MessageStatus.Sent && <DoneIcon sx={{ fontSize: 16 }}/>) ||
                                    (<DoneAllIcon sx={{ fontSize: 16 }}/>)
                                }
                                </Box>
                            </Box>
                        </Box>
                    ))}
                </Box>
    
                <Divider />
    
                {/* ChatPanel Message Input */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', p: 2 }}>
                    <TextField fullWidth onChange={e => setTypedMessage(e.target.value)} size='small' label='Type a Message' variant='outlined' />
                    <IconButton onClick={onSendMessageButtonClick}>
                        <SendIcon />
                    </IconButton>
                </Box>
            </Box>
        );
    }
};

export default ChatPanel;