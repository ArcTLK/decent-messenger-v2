import { useState, useContext } from 'react';
import { Box, Avatar, Divider, Typography, TextField, IconButton } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import Message from '../models/Message';
import MessageStatus from '../enums/MessageStatus';
import { Context } from '../utils/Store';

// <DummyData>
function randomText(words: number): string {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for ( let i = 0; i < words; i++ ) {
        for(let j=0; j<Math.ceil(Math.random()*20); j++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        result += " ";
    }
    return result;
}

const messages: Message[] = [];

for(let i=0;i<50;i++) {
    const sender = Math.round(Math.random())===0? 'john_doe0' : `john_doe${(Math.round(Math.random()*20+1)).toString()}`;
    const receiver = sender==='john_doe0'? `john_doe${(Math.round(Math.random()*20)+1).toString()}` : 'john_doe0';
    messages.push({
        content: randomText(Math.ceil(Math.random()*30)),
        status: MessageStatus.Pending,
        timestamp: {
            pending: new Date(),
            sent: new Date(),
            acknowledged: new Date()
        },
        sender_username: sender,
        receiver_username: receiver
    } as Message)
}

// </DummyData>

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
                <Typography variant='h4'>Select User to Chat</Typography>
            </Box>
        );
    }
    else {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 3 }}>
            
                {/* ChatPanel Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2 }}>
                    <Avatar />
                    <Typography variant="h6" component="div">{state.currentChatUser.name}</Typography>
                </Box>

                <Divider />
    
                {/* ChatPanel Messages */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexGrow: 1, overflow: 'auto', p: 2 }}>
                    {messages.map(message => (
                        <Box alignSelf={(message.sender_username==='john_doe0')? 'flex-end' : 'flex-start'} sx={{ maxWidth: 360, p: 1, m: 0.5, borderRadius: 2, bgcolor: 'secondary.light' }}>
                            <Box>{message.content}</Box>
                            {/* <Box component='small' display="block" textAlign='end'>{message.timestamp.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}</Box> */}
                        </Box>
                    ))}
                </Box>
    
                <Divider />
    
                {/* ChatPanel Message Input */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', boxShadow: '0px 0px 10px lightgray', p: 2 }}>
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