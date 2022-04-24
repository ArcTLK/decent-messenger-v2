import { useState, useContext, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Button, Box, Avatar, Divider, Typography, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DoneIcon from '@mui/icons-material/Done';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import MessageStatus from '../enums/MessageStatus';
import { Context, SimpleObjectStore } from '../utils/Store';
import { messageQueue } from '../utils/MessageQueue';
import Database from '../utils/Database';
import { useLiveQuery } from 'dexie-react-hooks';
import { addLog } from '../models/Log';
import StoredMessage from '../models/message/StoredMessage';
import PayloadMessage from '../models/message/PayloadMessage';
import MessageType from '../enums/MessageType';
import ChatType from '../enums/ChatType';
import { createPayloadMessage, generateSignatureWithoutCleaning, sendMessage } from '../utils/Peer';
import Contact from '../models/Contact';
import { BlockMessageItem } from '../models/Block';
import Group from '../models/Group';
import { Buffer } from 'buffer';

const ChatPanel = () => {
    const {state, dispatch} = useContext(Context);

    const [typedMessage, setTypedMessage] = useState('');

    const messagesEndRef = useRef<null | HTMLElement>(null);

    const [isMessageInfoDialogOpen, setMessageInfoDialogOpen] = useState(false);
    const [messageInfoDialogContent, setMessageInfoDialogContent] = useState({});

    const namesFromUsernames: { [id: string] : string} = {};

    // TODO: show group messages 
    const group = useLiveQuery(async () => {
        if (state.currentOpenedChat.type === ChatType.Group) {
            return await Database
                .groups
                .where({
                    name: (state.currentOpenedChat.data as Group).name,
                    createdAt: (state.currentOpenedChat.data as Group).createdAt
                }).first();
        }
        else {
            return null;
        }
    }, [state.currentOpenedChat]);

    const messages = useLiveQuery(async () => {
        if (state.currentOpenedChat.type === ChatType.Private) {
            return await Database
                .messages
                .where('receiverUsername')
                .equals((state.currentOpenedChat.data as Contact).username ?? '')
                .or('senderUsername')
                .equals((state.currentOpenedChat.data as Contact).username ?? '')
                .and(x => x.type === MessageType.Text)
                .sortBy('createdAt');
        }
        else {                       
            return [];
        }        
    }, [state.currentOpenedChat]);

    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
        }

    }, [state.currentOpenedChat, messages]);

    const onSendMessageButtonClick = async () => {
        if(typedMessage === '') {
            dispatch({
				type: 'UpdateSnackbar',
				payload: {
					isOpen: true,
					type: 'error',
					message: 'Please enter a message'
				}
			});
            return;
        }

        if (state.currentOpenedChat.type === ChatType.Private) {
            const message = await createPayloadMessage(typedMessage, MessageType.Text, (state.currentOpenedChat.data as Contact).username);

            // add to message queue
            addLog('Adding message to Queue', message.createdAt + '-1', 'Sending Message');
            messageQueue.addMessage(message);
        }        
        else {
            // send group message
            const unsignedBlockItem = {
                senderUsername: SimpleObjectStore.user!.username,
                createdAt: new Date().getTime(),
                message: typedMessage
            };
            const signature = await generateSignatureWithoutCleaning(unsignedBlockItem);

            const payload: BlockMessageItem = {
                ...unsignedBlockItem,
                digitalSignature: Buffer.from(signature).toString('base64')
            };
            
            const groupManager = SimpleObjectStore.groupManagers.find(x => x.group.name === state.currentOpenedChat.data.name && x.group.createdAt === (state.currentOpenedChat.data as Group).createdAt);

            if (groupManager) {
                if (groupManager.roundRobinList[groupManager.roundRobinIndex].username === SimpleObjectStore.user?.username) {
                    // you are the block creator, so simply add the message to the block
                    groupManager.messages.push(payload);
                }
                else {
                    const tellBlockCreatorToAddMessage = async () => {
                        const connection = groupManager.blockCreatorConnection!;
                        const message = await createPayloadMessage(JSON.stringify({
                            ...payload,
                            group: {
                                name: groupManager.group.name,
                                createdAt: groupManager.group.createdAt
                            }
                        }), MessageType.GroupMessage, groupManager.roundRobinList[groupManager.roundRobinIndex].username);

                        sendMessage(message, uuidv4(), connection);
                    }
                    
                    // get block creator connection and use that to send the msg
                    if (groupManager.blockCreatorConnection === null) {
                        console.error('Not connected to block creator, reconnecting!');
                        groupManager.reconnect().then(() => {
                            tellBlockCreatorToAddMessage();
                        });
                    }
                    else {
                        tellBlockCreatorToAddMessage();
                    }
                }

                // save message in database
                if (groupManager.group.unsentMessages) {
                    groupManager.group.unsentMessages.push(payload);
                }
                else {
                    groupManager.group.unsentMessages = [payload];
                }

                Database.groups.update(groupManager.group, {
                    unsentMessages: groupManager.group.unsentMessages
                });
            }
        }        

        setTypedMessage('');
    }

    const retrySendingMessage = (message: StoredMessage) => {
        messageQueue.retryMessage(message);
    };

    const retrySendingGroupMessage = (message: BlockMessageItem) => {
        // retry
        const groupManager = SimpleObjectStore.groupManagers.find(x => x.group.name === state.currentOpenedChat.data.name && x.group.createdAt === (state.currentOpenedChat.data as Group).createdAt);

        if (groupManager) {
            if (groupManager.roundRobinList[groupManager.roundRobinIndex].username === SimpleObjectStore.user?.username) {
                // you are the block creator, so simply add the message to the block
                // check if message exists already
                if (!groupManager.messages.find(x => x.digitalSignature === message.digitalSignature)) {
                    groupManager.messages.push(message);
                }                
            }
            else {
                const tellBlockCreatorToAddMessage = async () => {
                    const connection = groupManager.blockCreatorConnection!;
                    const msg = await createPayloadMessage(JSON.stringify({
                        ...message,
                        group: {
                            name: groupManager.group.name,
                            createdAt: groupManager.group.createdAt
                        }
                    }), MessageType.GroupMessage, groupManager.roundRobinList[groupManager.roundRobinIndex].username);

                    sendMessage(msg, uuidv4(), connection);
                }
                
                // get block creator connection and use that to send the msg
                if (groupManager.blockCreatorConnection === null) {
                    console.error('Not connected to block creator, reconnecting!');
                    groupManager.reconnect().then(() => {
                        tellBlockCreatorToAddMessage();
                    });
                }
                else {
                    tellBlockCreatorToAddMessage();
                }
            }
        }
    }

    const showMessageInfo = (message: StoredMessage) => {
        // handle message info here
        setMessageInfoDialogContent(message);
        setMessageInfoDialogOpen(true);
    }

    const onMessageInfoDialogClose = () => {
        setMessageInfoDialogOpen(false);
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

                {/* Dialog for showing message info */}
                <Dialog open={isMessageInfoDialogOpen} onClose={onMessageInfoDialogClose} fullWidth={true} maxWidth='xs'>
                    <DialogTitle sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <InfoOutlinedIcon />
                        <Typography variant="h6" component={'span'}>Message Information</Typography>
                    </DialogTitle>
                    <DialogContent dividers={true} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 2 }}>
                        {/* add required information */}
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="caption" color='text.secondary'>Sender Username</Typography>
                            <Typography variant="body1" color='text.primary'>{(messageInfoDialogContent as StoredMessage).senderUsername}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="caption" color='text.secondary'>Created At</Typography>
                            <Typography variant="body1" color='text.primary'>{(messageInfoDialogContent as StoredMessage).createdAt}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <Typography variant="caption" color='text.secondary'>Nonce</Typography>
                            <Typography variant="body1" color='text.primary'>{(messageInfoDialogContent as StoredMessage).nonce}</Typography>
                        </Box>
                    </DialogContent>
                    <DialogActions sx={{ my: 1 }}>
                        <Button variant="contained" onClick={onMessageInfoDialogClose}>Close</Button>
                    </DialogActions>
                </Dialog>
            
                {/* ChatPanel Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 2, bgcolor: 'primary.main' }}>
                    <Avatar src={`https://avatars.dicebear.com/api/human/${(state.currentOpenedChat.type == ChatType.Private)? (state.currentOpenedChat.data as Contact).username : state.currentOpenedChat.data.name}.svg`} />
                    <Typography variant="h6" component="div" sx={{ color: 'white' }}>{state.currentOpenedChat.data.name}</Typography>
                </Box>

                <Divider />
    
                {/* ChatPanel Messages */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexGrow: 1, overflow: 'auto', p: 2 }}>
                    {group && group.unsentMessages && group.unsentMessages.map((message: BlockMessageItem, index) => (
                        <Box key={index} alignSelf={(message.senderUsername===state.user.username) ? 'flex-end' : 'flex-start'} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, my: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: message.senderUsername===state.user.username? 'end' : 'start', alignItems: 'center'}}>
                                <Box order={(message.senderUsername===state.user.username)? 2 : 1} sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 360, py: 1, px: 1.5, borderRadius: 2 }} bgcolor={message.senderUsername===state.user.username? 'primary.main' : 'secondary.light'} >
                                    {state.currentOpenedChat.type == ChatType.Group && <Box sx={{ display: 'flex', alignItems: 'center'}}>
                                        {/* Fetch name of user via username below */}
                                        {/* <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'} sx={{ fontSize: 12 }}>{ namesFromUsernames[message.senderUsername] }</Box> */}
                                        <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'} sx={{ fontSize: 12 }}>{ message.senderUsername }</Box>
                                    </Box>}

                                    <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'}>{message.message}</Box>
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: message.senderUsername===state.user.username? 'end' : 'start', alignItems: 'center', gap: 0.5 }}>
                                <Box color='text.secondary' sx={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                                    {new Date(message.createdAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Box>

                                {message.senderUsername===state.user.username && <Box color='text.secondary' sx={{ display: 'flex', alignItems: 'center' }}>
                                {
                                    <>
                                        <AccessTimeIcon sx={{ fontSize: 16 }}/>
                                        <Button size='small' variant="text" onClick={() => retrySendingGroupMessage(message)}>Retry</Button>
                                    </>
                                }
                                </Box>}
                            </Box>
                        </Box>
                    ))}
                    {messages && messages.map((message, index) => (
                        <Box key={index} alignSelf={(message.senderUsername===state.user.username)? 'flex-end' : 'flex-start'} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, my: 1 }}>
                            <Box sx={{ display: 'flex', justifyContent: message.senderUsername===state.user.username? 'end' : 'start', alignItems: 'center'}}>
                                <Box order={(message.senderUsername===state.user.username)? 1 : 2}>
                                    <IconButton onClick={() => showMessageInfo(message)} sx={{ color: 'text.secondary' }}>
                                        <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Box>

                                <Box order={(message.senderUsername===state.user.username)? 2 : 1} sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxWidth: 360, py: 1, px: 1.5, borderRadius: 2 }} bgcolor={message.senderUsername===state.user.username? 'primary.main' : 'secondary.light'} >
                                    {state.currentOpenedChat.type == ChatType.Group && <Box sx={{ display: 'flex', alignItems: 'center'}}>
                                        {/* Fetch name of user via username below */}
                                        {/* <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'} sx={{ fontSize: 12 }}>{ namesFromUsernames[message.senderUsername] }</Box> */}
                                        <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'} sx={{ fontSize: 12 }}>{ message.senderUsername }</Box>
                                    </Box>}

                                    <Box color={message.senderUsername===state.user.username? 'white' : 'text.primary'}>{message.payload}</Box>
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: message.senderUsername===state.user.username? 'end' : 'start', alignItems: 'center', gap: 0.5 }}>
                                <Box color='text.secondary' sx={{ display: 'flex', alignItems: 'center', fontSize: 12 }}>
                                    {new Date(message.createdAt).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </Box>

                                {message.senderUsername===state.user.username && <Box color='text.secondary' sx={{ display: 'flex', alignItems: 'center' }}>
                                {
                                    (message.status===MessageStatus.Queued && <AccessTimeIcon sx={{ fontSize: 16 }}/>) ||
                                    (message.status===MessageStatus.Sent && <DoneIcon sx={{ fontSize: 16 }}/>) ||
                                    (message.status===MessageStatus.Failed && <Button size='small' variant="text" onClick={() => retrySendingMessage(message)}>Retry</Button>) ||
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